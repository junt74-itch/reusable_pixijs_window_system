import { expect, test } from "bun:test";
import net from "node:net";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");
const HOST = "127.0.0.1";
const PORT = 4179;
const BASE = `http://${HOST}:${PORT}`;
const READY_TIMEOUT_MS = 30_000;

const CONSUMER_PATHS = [
  "/examples/consumer/minimal-submodule.html",
  "/examples/consumer/minimal-submodule-runtime.ts",
  "/examples/consumer/assets/fonts/game-font/font.xml",
  "/examples/consumer/assets/fonts/game-font/font.png",
] as const;

function isPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      resolve(error.code === "EADDRINUSE");
    });
    probe.once("listening", () => {
      probe.close(() => resolve(false));
    });
    probe.listen(port, host);
  });
}

async function waitUntilReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/examples/consumer/minimal-submodule.html`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 200) {
        return;
      }
      lastError = new Error(`unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(200);
  }

  throw new Error(
    `Vite did not serve consumer HTML within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

async function killProcess(proc: ReturnType<typeof Bun.spawn>): Promise<void> {
  proc.kill();
  await proc.exited.catch(() => undefined);
}

test(
  "consumer example files are reachable over HTTP via Vite",
  async () => {
    if (await isPortInUse(PORT, HOST)) {
      throw new Error(`Port ${PORT} is already in use; smoke test requires a free port`);
    }

    const proc = Bun.spawn(
      ["bunx", "vite", "--port", String(PORT), "--strictPort", "--host", HOST],
      {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, FORCE_COLOR: "0" },
      },
    );

    try {
      await waitUntilReady(READY_TIMEOUT_MS);

      for (const path of CONSUMER_PATHS) {
        const response = await fetch(`${BASE}${path}`);
        expect(response.status, `GET ${path}`).toBe(200);
      }
    } finally {
      await killProcess(proc);
    }
  },
  READY_TIMEOUT_MS + 15_000,
);

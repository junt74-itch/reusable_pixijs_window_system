/** Consumer-owned NineSlice chrome. Texture must already be loaded. */
export interface NineSliceSkinOptions {
  readonly textureKey: string;
  readonly frame?: string | number;
  readonly leftWidth: number;
  readonly rightWidth: number;
  readonly topHeight: number;
  readonly bottomHeight: number;
  readonly tileX?: boolean;
  readonly tileY?: boolean;
}

export class MissingWindowSkinError extends Error {
  public override readonly name = "MissingWindowSkinError";
  public readonly textureKey: string;

  public constructor(textureKey: string) {
    super(`Window skin texture "${textureKey}" is not loaded.`);
    this.textureKey = textureKey;
  }
}

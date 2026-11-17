/**
 * IconAtlasBootstrap
 *
 * Companion to the Icon Atlas plugin (Windows › Icon Atlas). The plugin packs
 * the icons your scene references into one atlas and repoints every reference at
 * a per-icon crop texture. Crop textures can only be configured at runtime —
 * `cropRect` and `inputTexture` live on RectCropTextureProvider and have no
 * author-time equivalent — so this component does that configuration on start.
 *
 * One of these per scene is enough. The plugin adds and wires it for you; there
 * is normally no reason to touch it by hand.
 *
 * No manifest is needed: the atlas is a uniform grid, so crop `i`'s rectangle
 * follows from its index plus the grid size. Keep `crops` in atlas frame order —
 * the plugin writes it that way.
 */

@component
export class IconAtlasBootstrap extends BaseScriptComponent {
  @input
  @hint('The generated atlas texture, e.g. Assets/IconAtlas/used-icons-atlas.png')
  atlas: Texture

  @input
  @hint('One crop texture per atlas frame, in frame order. Written by the plugin.')
  crops: Texture[]

  @input
  @label('Atlas Columns')
  columns: number = 1

  @input
  @label('Atlas Rows')
  rows: number = 1

  @input
  @label('Log On Start')
  verbose: boolean = false

  onAwake(): void {
    // Before the first frame renders, so nothing flashes untinted.
    this.createEvent('OnStartEvent').bind(() => this.apply())
  }

  /** Points every crop texture at the atlas and gives it its own cell. */
  apply(): void {
    if (isNull(this.atlas)) {
      console.error('[IconAtlasBootstrap] No atlas assigned — icons will render as the full sheet.')
      return
    }
    if (!this.crops || this.crops.length === 0) {
      console.warn('[IconAtlasBootstrap] No crop textures assigned; nothing to configure.')
      return
    }

    const columns = Math.max(1, Math.floor(this.columns))
    const rows = Math.max(1, Math.floor(this.rows))
    let configured = 0

    for (let index = 0; index < this.crops.length; index++) {
      const crop = this.crops[index]
      if (isNull(crop)) { continue }

      const provider = crop.control as RectCropTextureProvider
      if (isNull(provider)) { continue }

      provider.inputTexture = this.atlas
      provider.cropRect = this.frameRect(index, columns, rows)
      configured++
    }

    if (this.verbose) {
      console.log(
        `[IconAtlasBootstrap] ${configured}/${this.crops.length} crops bound to a ` +
        `${columns}x${rows} atlas.`
      )
    }
  }

  /**
   * cropRect is in the input texture's local space: -1..1 on both axes with +Y
   * up, so frame 0 is the top-left cell.
   */
  private frameRect(index: number, columns: number, rows: number): Rect {
    const column = index % columns
    const row = Math.floor(index / columns)
    return Rect.create(
      (column / columns) * 2 - 1,
      ((column + 1) / columns) * 2 - 1,
      1 - ((row + 1) / rows) * 2,
      1 - (row / rows) * 2
    )
  }
}

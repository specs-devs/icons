/**
 * IconBoard
 *
 * Lays the whole icon library out as a flat board in world space, one panel per
 * source directory — the same reading order as the Figma reference sheet.
 *
 * Icons are drawn from ONE atlas texture (IconAtlas/icon-atlas.png) using the
 * generated frame table in ./IconFrames, so the board needs no per-icon asset
 * references and picks up daily Figma syncs automatically: the CI job repacks
 * the atlas and regenerates IconFrames.ts whenever the icon set changes, and
 * this component just renders whatever they describe. All icon quads share a
 * single runtime-built mesh — one draw call instead of one per icon.
 *
 * Two nested grids:
 *   - "Grid Per Group"  — icons inside one directory panel (Figma: 10 columns)
 *   - "Grid Overall"    — the panels themselves (Figma: 2 columns)
 *
 * Everything is built at runtime under a single child object, so nothing is
 * baked into Scene.scene. Refresh the Preview to pick up input changes.
 */

import { ATLAS_CELL_PIXELS, ATLAS_COLUMNS, ATLAS_ROWS, GROUPS } from './IconFrames'

// Text.size is expressed in the same units as the layout rect: size 48 renders a
// 4.5 cm tall line box at scale 1, so one size unit ≈ 0.09375 cm.
const TEXT_UNIT = 0.09375

// Small Text.size values rasterise poorly, so every label is rendered at this
// size and then scaled on its transform down to the height the inputs ask for.
const BASE_TEXT_SIZE = 48
const BASE_LINE_HEIGHT = BASE_TEXT_SIZE * TEXT_UNIT

// Small Z separations so panels never z-fight with the icons sitting on them.
const Z_PANEL = 0.0
const Z_ICON = 0.1
const Z_LABEL = 0.2

// Inset each frame's UVs by half a texel so linear filtering never bleeds a
// neighbouring atlas cell into an icon's edge.
const UV_INSET_U = 0.5 / (ATLAS_COLUMNS * ATLAS_CELL_PIXELS)
const UV_INSET_V = 0.5 / (ATLAS_ROWS * ATLAS_CELL_PIXELS)

@component
export class IconBoard extends BaseScriptComponent {
  // ---------------------------------------------------------------- Scale ---
  @input
  @label('Overall Scale')
  @hint('Uniform scale of the entire board.')
  overallScale: number = 1.0

  @input
  @label('Icon Scale')
  @hint('Size of each icon relative to its grid cell. 1 = fills 60% of the cell.')
  iconScale: number = 1.0

  // ---------------------------------------------------------------- Grids ---
  @input
  @label('Grid Per Group (columns)')
  @hint('Columns inside one directory panel. Rows are added as needed.')
  iconColumns: number = 10

  @input
  @label('Grid Overall (columns)')
  @hint('Columns of directory panels. Rows are added as needed.')
  groupColumns: number = 2

  // --------------------------------------------------------------- Layout ---
  @input
  @label('Cell Size (cm)')
  @hint('Grid pitch — the spacing between icon centres.')
  cellSize: number = 4.0

  @input
  @label('Group Gap (cm)')
  @hint('Gap between directory panels.')
  groupGap: number = 6.0

  @input
  @label('Panel Padding (cm)')
  @hint('Inset between a panel edge and its icon grid.')
  panelPadding: number = 2.0

  @input
  @label('Group Title Height (cm)')
  titleTextHeight: number = 2.6

  @input
  @label('Icon Name Height (cm)')
  @hint('Long names shrink to stay inside their cell.')
  nameTextHeight: number = 0.6

  @input
  @label('Show Icon Names')
  showIconNames: boolean = true

  @input
  @label('Show Group Panels')
  showPanels: boolean = true

  // ------------------------------------------------------------ Materials ---
  @input
  @hint('Image material for the icon mesh — "Icon Mat". Cloned once; its baseTex is pointed at the atlas.')
  iconMaterial: Material

  @input
  @allowUndefined
  @hint('Image material for the panel backgrounds — "Panel Mat". Cloned once; its baseTex is neutralised so panels render as flat baseColor.')
  panelMaterial: Material

  // ---------------------------------------------------------------- Atlas ---
  @input
  @hint('The synced icon atlas — IconAtlas/icon-atlas.png. Its frame layout is described by the generated Scripts/IconFrames.ts.')
  atlas: Texture

  private board: SceneObject = null
  private panelMat: Material = null

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => this.build())
  }

  /** Tears down any previous board and lays the whole library out again. */
  build(): void {
    if (!this.iconMaterial) {
      console.error('[IconBoard] Icon Material is not assigned — nothing to draw.')
      return
    }
    if (isNull(this.atlas)) {
      console.error('[IconBoard] Atlas texture is not assigned — wire IconAtlas/icon-atlas.png.')
      return
    }

    if (this.board) {
      this.board.destroy()
      this.board = null
    }

    const groups = GROUPS.filter((g) => g.icons.length > 0)
    if (groups.length === 0) {
      console.warn('[IconBoard] Generated IconFrames module lists no icons.')
      return
    }

    this.board = global.scene.createSceneObject('Board')
    this.board.setParent(this.sceneObject)
    const s = Math.max(0.0001, this.overallScale)
    this.board.getTransform().setLocalScale(new vec3(s, s, s))

    const cols = Math.max(1, Math.floor(this.iconColumns))
    const groupCols = Math.max(1, Math.floor(this.groupColumns))
    const cell = Math.max(0.01, this.cellSize)
    const pad = Math.max(0, this.panelPadding)
    const gap = Math.max(0, this.groupGap)

    // A title block is one text line plus a little breathing room underneath.
    const titleHeight = Math.max(0.1, this.titleTextHeight) + cell * 0.4
    // Every panel is the full grid width so columns line up across the board.
    const panelWidth = cols * cell + pad * 2

    const groupRows = groups.map((g) => Math.ceil(g.icons.length / cols))
    const groupHeights = groupRows.map((rows) => titleHeight + rows * cell + pad * 2)

    // Each board row is as tall as its tallest panel.
    const boardRows = Math.ceil(groups.length / groupCols)
    const rowHeights: number[] = []
    for (let r = 0; r < boardRows; r++) {
      let h = 0
      for (let c = 0; c < groupCols; c++) {
        const i = r * groupCols + c
        if (i < groups.length) {
          h = Math.max(h, groupHeights[i])
        }
      }
      rowHeights.push(h)
    }

    const columnPitch = panelWidth + gap
    const totalWidth = groupCols * columnPitch - gap
    let totalHeight = -gap
    for (let r = 0; r < boardRows; r++) {
      totalHeight += rowHeights[r] + gap
    }

    // Centre the board on this object rather than growing off to one side.
    const originX = -totalWidth / 2
    let cursorY = totalHeight / 2

    // One shared mesh for every icon quad on the board.
    const builder = new MeshBuilder([
      { name: 'position', components: 3 },
      { name: 'texture0', components: 2 },
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16

    // Every panel looks alike, so they all share one prepared clone.
    this.panelMat = this.showPanels ? this.preparePanelMaterial() : null

    for (let r = 0; r < boardRows; r++) {
      for (let c = 0; c < groupCols; c++) {
        const i = r * groupCols + c
        if (i >= groups.length) {
          continue
        }
        this.buildGroup(
          groups[i],
          frameOffsetOf(groups, i),
          builder,
          originX + c * columnPitch,
          cursorY,
          cols,
          cell,
          pad,
          panelWidth,
          titleHeight
        )
      }
      cursorY -= rowHeights[r] + gap
    }

    const iconsObj = global.scene.createSceneObject('Icons')
    iconsObj.setParent(this.board)
    const visual = iconsObj.createComponent('Component.RenderMeshVisual') as RenderMeshVisual
    // "Icon Mat" ships with a texture already in baseTex so the asset pipeline
    // never sees an empty slot; pointing the clone at the atlas replaces it
    // before anything is drawn, so whatever it shipped with never reaches the
    // screen — there is nothing to clear on the asset itself.
    const material = this.iconMaterial.clone()
    material.mainPass.baseTex = this.atlas
    material.mainPass.twoSided = true
    visual.addMaterial(material)
    if (builder.isValid()) {
      builder.updateMesh()
      visual.mesh = builder.getMesh()
    } else {
      console.error('[IconBoard] Icon mesh failed to validate — board not drawn.')
      return
    }

    const total = groups.reduce((sum, g) => sum + g.icons.length, 0)
    console.log(
      `[IconBoard] ${total} icons across ${groups.length} groups — ` +
        `${totalWidth.toFixed(1)}×${totalHeight.toFixed(1)} cm at scale ${s}.`
    )
  }

  /**
   * Clones "Panel Mat" and neutralises its base texture, so panels render as a
   * flat baseColor instead of showing whatever texture the asset ships with.
   *
   * The material has a texture wired into baseTex with ENABLE_BASE_TEX left on,
   * because the asset pipeline rejects an empty texture slot. A Lens script can
   * set uniforms but cannot clear a shader define, so that sample cannot be
   * switched off from here — feeding it a 1x1 opaque white pixel is equivalent:
   * white multiplies out and leaves baseColor untouched, exactly as if the
   * "Base Texture" checkbox were unticked.
   */
  private preparePanelMaterial(): Material {
    if (!this.panelMaterial) {
      return null
    }
    const mat = this.panelMaterial.clone()
    mat.mainPass.baseTex = whitePixelTexture()
    return mat
  }

  /**
   * Builds one directory panel: title, backdrop, icon quads (appended to the
   * shared mesh) and name labels. (gx, gy) is the panel's top-left corner in
   * board space; the grid fills left-to-right, top-to-bottom.
   */
  private buildGroup(
    group: { label: string; icons: string[] },
    frameOffset: number,
    builder: MeshBuilder,
    gx: number,
    gy: number,
    cols: number,
    cell: number,
    pad: number,
    panelWidth: number,
    titleHeight: number
  ): void {
    const groupObj = global.scene.createSceneObject(group.label)
    groupObj.setParent(this.board)

    const rows = Math.ceil(group.icons.length / cols)
    const panelHeight = rows * cell + pad * 2
    const centreX = gx + panelWidth / 2

    this.makeLabel(
      groupObj,
      `${group.label}  (${group.icons.length})`,
      new vec3(centreX, gy - titleHeight / 2, Z_LABEL),
      this.titleTextHeight,
      panelWidth
    )

    if (this.panelMat) {
      const panel = global.scene.createSceneObject('Panel')
      panel.setParent(groupObj)
      const visual = panel.createComponent('Component.Image') as Image
      visual.clearMaterials()
      visual.addMaterial(this.panelMat)
      panel.getTransform().setLocalPosition(
        new vec3(centreX, gy - titleHeight - panelHeight / 2, Z_PANEL)
      )
      panel.getTransform().setLocalScale(new vec3(panelWidth, panelHeight, 1))
    }

    const iconSize = cell * 0.6 * Math.max(0.01, this.iconScale)
    const gridTop = gy - titleHeight - pad

    for (let i = 0; i < group.icons.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = gx + pad + (col + 0.5) * cell
      const cy = gridTop - (row + 0.5) * cell
      // Nudge the glyph up when a caption sits under it.
      const iconY = this.showIconNames ? cy + cell * 0.13 : cy

      this.appendIconQuad(builder, frameOffset + i, cx, iconY, iconSize)

      if (this.showIconNames) {
        this.makeLabel(
          groupObj,
          group.icons[i],
          new vec3(cx, cy - cell * 0.3, Z_LABEL),
          this.nameTextHeight,
          cell * 0.94
        )
      }
    }
  }

  /**
   * Appends one icon quad to the shared mesh: centred at (cx, cy), `size` cm
   * square, UV-mapped to atlas frame `frame`. Frames are packed row-major with
   * row 0 at the TOP of the atlas image, while mesh UV v runs bottom-up, so
   * the v range is flipped.
   */
  private appendIconQuad(
    builder: MeshBuilder,
    frame: number,
    cx: number,
    cy: number,
    size: number
  ): void {
    const col = frame % ATLAS_COLUMNS
    const row = Math.floor(frame / ATLAS_COLUMNS)

    const u0 = col / ATLAS_COLUMNS + UV_INSET_U
    const u1 = (col + 1) / ATLAS_COLUMNS - UV_INSET_U
    const v1 = 1 - row / ATLAS_ROWS - UV_INSET_V // top of the frame
    const v0 = 1 - (row + 1) / ATLAS_ROWS + UV_INSET_V // bottom of the frame

    const h = size / 2
    const base = builder.getVerticesCount()
    // bl, br, tr, tl — counter-clockwise seen from +Z (the camera side).
    builder.appendVerticesInterleaved([
      cx - h, cy - h, Z_ICON, u0, v0,
      cx + h, cy - h, Z_ICON, u1, v0,
      cx + h, cy + h, Z_ICON, u1, v1,
      cx - h, cy + h, Z_ICON, u0, v1,
    ])
    builder.appendIndices([base, base + 1, base + 2, base + 2, base + 3, base])
  }

  /**
   * Renders one line of text at `heightCm` tall, fitted inside `maxWidthCm`.
   *
   * The glyphs are always rasterised at BASE_TEXT_SIZE and shrunk on the
   * transform — setting a tiny Text.size directly renders nothing. Because
   * layoutRect is in the text's own local units, the width budget has to be
   * divided back out by that transform scale.
   */
  private makeLabel(
    parent: SceneObject,
    value: string,
    position: vec3,
    heightCm: number,
    maxWidthCm: number
  ): void {
    const obj = global.scene.createSceneObject('Label')
    obj.setParent(parent)

    const text = obj.createComponent('Component.Text') as Text
    text.text = value
    text.size = BASE_TEXT_SIZE
    text.depthTest = false

    const scale = Math.max(0.001, heightCm) / BASE_LINE_HEIGHT
    const halfWidth = maxWidthCm / scale / 2
    text.layoutRect = Rect.create(-halfWidth, halfWidth, -BASE_LINE_HEIGHT / 2, BASE_LINE_HEIGHT / 2)
    text.horizontalOverflow = HorizontalOverflow.Shrink

    obj.getTransform().setLocalPosition(position)
    obj.getTransform().setLocalScale(new vec3(scale, scale, 1))
  }
}

/** A 1x1 opaque white texture — a base-texture sample that changes nothing. */
function whitePixelTexture(): Texture {
  const tex = ProceduralTextureProvider.createWithFormat(1, 1, TextureFormat.RGBA8Unorm)
  const control = tex.control as ProceduralTextureProvider
  control.setPixels(0, 0, 1, 1, new Uint8Array([255, 255, 255, 255]))
  return tex
}

/** Atlas frame index of the first icon in groups[i] (frames run contiguously). */
function frameOffsetOf(groups: { icons: string[] }[], index: number): number {
  let offset = 0
  for (let i = 0; i < index; i++) {
    offset += groups[i].icons.length
  }
  return offset
}

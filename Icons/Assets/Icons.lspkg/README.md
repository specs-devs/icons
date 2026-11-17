# Icons

The SPECS iconography set for Spectacles: 353 UI icons mirrored from the SPECS Iconography 3.0 design file and grouped by category, plus an editor plugin that packs only the icons your Lens actually uses into a single optimised atlas.

Icons are plain PNG textures, so they drop straight into any material, `Image` component, or script `Texture` input — no runtime library and no setup required.

## Categories

| Folder | Icons | |
|---|---|---|
| `Iconography/Arrows` | 54 | directions, chevrons, turns, undo/redo, upload/download |
| `Iconography/System` | 66 | settings, search, lock, visibility, theming, star, share |
| `Iconography/Signal-devices` | 34 | wifi, cellular, battery, bluetooth, hotspot, airplane |
| `Iconography/Media` | 31 | playback, volume, camera, gallery, microphone |
| `Iconography/Input` | 30 | keyboard, keypad, emoji, text size, translate |
| `Iconography/Ar-devices` | 32 | Specs, phone controller, hand, cube, globe, tracking |
| `Iconography/Editing` | 28 | pencil, brush, crop, palette, sort, transform |
| `Iconography/Communication-people` | 25 | users, calls, video, chat, contacts |
| `Iconography/Files` | 19 | documents, folders, cloud sync, bookmarks |
| `Iconography/Alerts-notifications` | 19 | info, warning, error, checkmark, shield, bell |
| `Iconography/Misc` | 15 | infinity, molecule, flask, follow, star |

## Using an icon

Drag any icon from `Iconography/<Category>/` onto a texture slot — a material's Base Texture, an `Image` component, or a `Texture` input on your own script. That is the whole workflow.

```typescript
@component
export class MyButton extends BaseScriptComponent {
  @input icon: Texture   // assign e.g. Iconography/System/gear.png

  onAwake() {
    const image = this.sceneObject.getComponent('Component.Image') as Image
    const material = image.mainMaterial.clone()
    image.clearMaterials()
    image.addMaterial(material)
    material.mainPass.baseTex = this.icon
  }
}
```

## Keeping your Lens small

Icons that stay in this package are **not** part of your Lens build — only icons your scene references are included. If you use many icons, the bundled **Icon Atlas** plugin packs just those into one texture:

1. Open **Windows › Icon Atlas**.
2. Press **Scan scene for used icons** to see exactly which icons your scene references, and where.
3. Choose a resolution (128 / 160 / 320 px per icon) and press **Create atlas from used icons**.
4. Press **Repoint scene at atlas** to move every reference onto the atlas, so the individual icons are no longer pulled into the build.

Step 4 adds a single `IconAtlasBootstrap` component to your scene, which configures the atlas at runtime. Without it, crop regions cannot be applied — Lens Studio only exposes them at runtime.

A worked example: 20 icons at 128 px pack into a 640×512 atlas costing about **1.25 MB** of texture memory, against roughly **8 MB** for the same 20 icons loose at their native 320 px.

Two things worth knowing:

- An atlas reduces **draw calls and asset count**, not bytes — a grid of N icons occupies the same pixels as N separate textures of the same size. The savings come from including only what you use, and from choosing a smaller cell size.
- Lens Studio caps imported textures at **2048 px** per axis. The plugin shrinks the cell size automatically to stay inside that and tells you when it does, so an atlas is never silently rescaled.

## Source

Icons are generated from the SPECS Iconography 3.0 design file and refreshed automatically. Category folders mirror the sections in that file, so a new section appears here as a new folder. Icon file names are lowercase-kebab and stable — safe to reference from code.

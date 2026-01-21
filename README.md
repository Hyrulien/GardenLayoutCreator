# GLC - Garden Layout Creator

GLC is a simple helper that lets you plan and place your garden layout in Magic Garden.

## How to use it

- Install the GLC userscript in your browser (Tampermonkey or Violentmonkey).
- Open Magic Garden and look for the small GLC launcher in the bottom-right.
- Click **Open** or **L** (default) to show the Garden Layout Creator window.

## Install

1. Install **Tampermonkey** or **Violentmonkey**
2. Install the userscript from this link:
   `https://raw.githubusercontent.com/Hyrulien/GardenLayoutCreator/main/dist/LayoutCreator.user.js`

## Where are the settings?

Click the **⚙ Settings** button in the top‑right of the Garden Layout Creator window.  
This is where you'll find options like **Preview ALL**, **Free Inventory Slots**, **Keybinds** and **Hide Menu**.

## Getting started

- **Select an item**: Choose a plant, decor, or mutation you want to place.
- **Place**: Left‑click a tile to place the selected item there. Hold to place multiple.
- **Remove**: Right‑click a tile to delete whatever is on it. Hold to delete multiple.
- **Clear selection**: Pressing right‑click also clears the current selection outline (green border).

## Mutations

Mutations let you apply special effects to plants (Gold, Rainbow, Frozen, Wet, etc.).

- **Select Mutation mode**: Switch the dropdown from Plant/Decor to **Mutation**.
- **Pick a mutation**: Choose from the mutation list (Gold, Rainbow, Frozen, Chilled, Wet, Dawnlit, Amberlit, etc.).
- **Apply to plants**: Left‑click any plant tile to apply the selected mutation. Hold to apply to multiple.
- **Remove mutations**: Right‑click a plant tile (in Mutation mode) to remove the mutation without deleting the plant.
- **Color-coded outlines**: Each mutation shows a unique border color on tiles (Gold = yellow, Rainbow = gradient, Frozen = icy blue, etc.).
- **Requirements**: The Requirements window will show mutated plants separately (e.g., "Sunflower (Rainbow) 2/5").

## Ignore Zones

Ignore zones let you exclude specific tiles from layout operations.

- **Mark tiles as ignored**: Hold **Shift** and click or hold Left‑click across tiles to mark them as ignored.
- **Unmark tiles**: Hold **Shift** and drag Left‑click again on ignored tiles to unmark them.
- **Purple outline**: Ignored tiles show a purple border.
- **What gets excluded**:
  - Ignored tiles are not counted in the Requirements window.
  - **Apply Layout** will not pot, place, or move items on or from ignored tiles.
- **Saved with layouts**: Ignore zones are saved when you create a layout and restored when you load it.

## Tile colors

- **Green**: Currently selected tile.
- **Blue**: Will be applied to your garden.
- **Purple**: Ignored tile (won't be changed when applying layouts).
- **Yellow**: Blocked by an egg or obstacle.
- **Red**: You're missing quantity for that item.
- **Mutation colors**: Gold (yellow), Rainbow (gradient), Frozen (icy blue), Chilled (white), Wet (blue), etc.

## Dirt vs Boardwalk

- **Dirt**: Your two main 10×10 garden grids (plants + decor).
- **Boardwalk**: The wooden tiles around the main grids (**decor only**).

## Preview vs Preview ALL

- **Preview** shows how your garden should look after applying (for ~5 seconds).
- With **Preview ALL OFF**:
  - Tiles can appear blank in preview if you're missing quantity of plants/decors.
- With **Preview ALL ON**:
  - Preview shows the entire garden **1:1 exactly as you designed it**, including items you don't currently own enough of.

## Requirements window

The **Requirements** window shows how many of each item you need to finish the layout.

It counts:
- Items already **potted** in your inventory
- Items already **placed in your garden** that match (those will be re‑potted and moved to the correct tile)

If you don't have enough of something, GLC will place as many items as it can and leave blank spaces for the rest.

## Applying layouts (important warnings)

- Applying saved loadouts uses your **Planter Pots**.
- Recommended **Free Inventory Slots**: **at least 10**.
- **Eggs block placement**: Remove eggs from target tiles before applying a layout.
- **Retry behavior**: If Apply stops midway (due to inventory space or missing items), you can press **Apply Layout** again. GLC will retry to finish placing items.
- GLC prioritizes moving misplaced garden plants before using potted inventory items.

## Other helpful features

- **Import / Export (JSON)**:
  - Export saves your layouts to a `.json` file (great for backups and sharing).
  - Import loads a `.json` file back into GLC.
  - Backing up your layouts is recommended.
- **Invert**: Mirrors the **current tab** (Dirt or Boardwalk) from one side to the other. Each tab inverts separately.
- **Clear Left / Clear Right**: Toggle options next to **Invert** and **Apply** buttons to clear specific garden sides.
- **Reset Draft**: Clears the entire Layout Creator back to a blank state.
- **Load from garden**: Copies your current live garden into the editor.
- **Hide Menu**: Hides the bottom‑right launcher popup.

## FAQ 

TBD

## Support

If you like GLC, you can support development here:
`https://ko-fi.com/hyru`

## For developers

```bash
npm install
npm run build
```

The build outputs `dist/LayoutCreator.user.js`.

import { eventMatchesKeybind } from "./keybinds";
import { shareGlobal } from "../utils/page-context";
import { GardenLayoutService } from "./gardenLayout";
import { Store } from "../store/api";

let keybindsInstalled = false;

const shouldIgnoreKeydown = (ev: KeyboardEvent) => {
  const el = ev.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
};

function installEditorKeybindsOnce() {
  if (keybindsInstalled || typeof window === "undefined") return;
  keybindsInstalled = true;
  window.addEventListener("keydown", (ev) => {
    if (shouldIgnoreKeydown(ev)) return;
    if (eventMatchesKeybind("gui.toggle-layout-creator" as any, ev)) {
      ev.preventDefault();
      ev.stopPropagation();
      const launchBtn = document.querySelector(
        '.glc-launch .glc-launch-item[data-id="editor"] .btn'
      ) as HTMLButtonElement | null;
      launchBtn?.click();
    }
  });
}

export const EditorService = {
  init() {
    installEditorKeybindsOnce();
    shareGlobal("glcEditorPreviewFriendGarden", async (garden: any) => {
      return await GardenLayoutService.previewGarden(garden);
    });
    shareGlobal("glcEditorClearFriendGardenPreview", async () => {
      return await GardenLayoutService.clearPreview();
    });
    shareGlobal("glcGetInventorySlots", async () => {
      const inventory = await Store.select<any>("myInventoryAtom");
      const items =
        Array.isArray(inventory?.items)
          ? inventory.items
          : Array.isArray(inventory?.inventory)
            ? inventory.inventory
            : Array.isArray(inventory?.inventory?.items)
              ? inventory.inventory.items
              : Array.isArray(inventory)
                ? inventory
                : [];
      const usedSlots = items.length;
      const capacity =
        inventory?.capacity ??
        inventory?.maxSlots ??
        inventory?.maxSize ??
        inventory?.inventory?.capacity ??
        inventory?.inventory?.maxSlots ??
        inventory?.inventory?.maxSize ??
        inventory?.data?.capacity ??
        inventory?.data?.maxSlots ??
        inventory?.data?.maxSize ??
        100;
      const freeSlots = Number.isFinite(capacity) ? Math.max(0, capacity - usedSlots) : null;
      const isFull = await Store.select<boolean>("isMyInventoryAtMaxLengthAtom");
      return {
        usedSlots,
        capacity,
        freeSlots,
        isFull,
        rawInventory: inventory,
      };
    });
    shareGlobal("glcReadInventoryFreeSlots", async () => {
      return await GardenLayoutService.getInventoryFreeSlots();
    });
  },
  isEnabled() {
    return false;
  },
};

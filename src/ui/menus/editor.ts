// src/ui/menus/editor.ts
import { Menu } from "../menu";
import { EditorService } from "../../services/editor";
import { GardenLayoutService } from "../../services/gardenLayout";
import { attachSpriteIcon } from "../spriteIconCache";
import { decorCatalog, eggCatalog, mutationCatalog, plantCatalog } from "../../data/hardcoded-data.clean";
import { fetchRemoteVersion, getLocalVersion } from "../../utils/version";
import { isDiscordSurface } from "../../utils/api";
import { DEV_ONLY } from "../../utils/dev";
import { getKeybind, onKeybindChange, setKeybind } from "../../services/keybinds";
import { readAriesPath, readGlcPath, writeAriesPath, writeGlcPath } from "../../utils/localStorage";
import { pageWindow } from "../../utils/page-context";

export function renderEditorMenu(container: HTMLElement) {
  const ui = new Menu({ id: "editor", compact: true });

  const createActionButton = (label: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.borderRadius = "6px";
    button.style.border = "1px solid rgba(255,255,255,0.2)";
    button.style.background = "rgba(255,255,255,0.04)";
    button.style.color = "inherit";
    button.style.fontWeight = "600";
    button.style.fontSize = "13px";
    button.style.padding = "6px 12px";
    button.style.cursor = "pointer";
    button.addEventListener("mouseenter", () => (button.style.background = "rgba(255,255,255,0.08)"));
    button.addEventListener("mouseleave", () => (button.style.background = "rgba(255,255,255,0.04)"));
    return button;
  };

  const createStatusLine = () => {
    const line = document.createElement("div");
    line.style.fontSize = "13px";
    line.style.minHeight = "18px";
    line.style.opacity = "0.9";
    return line;
  };

  const showStatus = (line: HTMLElement, ok: boolean, message: string) => {
    line.textContent = message;
    line.style.color = ok ? "#8bf1b5" : "#ff9c9c";
  };

  const downloadJSONFile = (filename: string, payload: string) => {
    const win = pageWindow || window;
    try {
      const safePayload = JSON.stringify(payload);
      const safeFilename = JSON.stringify(filename);
      const script = `(function(){try{const data=${safePayload};const name=${safeFilename};const blob=new Blob([data],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.style.display="none";const parent=document.body||document.documentElement||document;parent.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}catch(e){console.error("[GLC] download:",e)}})();`;
      win.eval(script);
      return;
    } catch {
      // ignore and fallback
    }
    try {
      const doc = (win.document || document) as Document;
      const root: ParentNode | null =
        (doc.body as ParentNode | null) ||
        (doc.documentElement as ParentNode | null) ||
        (document.body as ParentNode | null);
      const blob = new Blob([payload], { type: "application/json" });
      const url = (win.URL || URL).createObjectURL(blob);
      const a = doc.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      if (root) root.appendChild(a);
      a.click();
      if (root) root.removeChild(a);
      (win.URL || URL).revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const stripEggs = (garden: any) => {
    const next = GardenLayoutService.getEmptyGarden();
    const copyMap = (source: Record<string, any>) => {
      const out: Record<string, any> = {};
      for (const [key, obj] of Object.entries(source || {})) {
        if (!obj || typeof obj !== "object") continue;
        const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
        if (type === "egg") continue;
        out[key] = obj;
      }
      return out;
    };
    next.tileObjects = copyMap(garden?.tileObjects || {});
    next.boardwalkTileObjects = copyMap(garden?.boardwalkTileObjects || {});
    const ignored = garden?.ignoredTiles;
    if (ignored && typeof ignored === "object") {
      next.ignoredTiles = {
        dirt: Array.isArray(ignored.dirt) ? ignored.dirt.filter((n: number) => Number.isFinite(n)) : [],
        boardwalk: Array.isArray(ignored.boardwalk)
          ? ignored.boardwalk.filter((n: number) => Number.isFinite(n))
          : [],
      };
    }
    return next;
  };

  let applyExternalGarden: ((garden: any) => void) | null = null;

  const renderLayoutTab = (view: HTMLElement) => {
    view.innerHTML = "";
    view.style.display = "flex";
    view.style.flexDirection = "column";
    view.style.gap = "12px";
    view.style.justifyContent = "flex-start";
    view.style.alignItems = "stretch";
    view.style.height = "100%";
    view.style.minHeight = "0";
    view.style.overflow = "hidden";
    view.style.flex = "1";
    ui.root.style.display = "flex";
    ui.root.style.flexDirection = "column";
    ui.root.style.height = "100%";
    ui.root.style.maxHeight = "100%";
    ui.root.style.minHeight = "0";
    ui.root.style.overflow = "hidden";
    ui.root.style.flex = "1 1 auto";

    let cleanup: (() => void) | null = null;
    (view as any).__cleanup__ = () => {
      try { cleanup?.(); } catch {}
      cleanup = null;
    };

    // Layout-only editor UI
    const sectionCard = (title: string, content: HTMLElement) => {
      const card = ui.card(title, { tone: "muted", align: "center" });
      card.root.style.maxWidth = "960px";
      card.root.style.alignSelf = "stretch";
      card.body.style.display = "grid";
      card.body.style.gap = "16px";
      card.body.style.width = "100%";
      card.body.style.minHeight = "0";
      card.body.append(content);
      return card;
    };

  // Layout creator (editor testing)
  const layoutWrap = document.createElement("div");
  layoutWrap.style.display = "grid";
  layoutWrap.style.gap = "14px";
  layoutWrap.style.width = "100%";
  layoutWrap.style.minHeight = "0";

  const layoutStatus = document.createElement("div");
  layoutStatus.style.fontSize = "14px";
  layoutStatus.style.opacity = "0.7";
  layoutStatus.style.minHeight = "18px";

  const headerRow = document.createElement("div");
  headerRow.style.display = "flex";
  headerRow.style.justifyContent = "flex-end";
  headerRow.style.gap = "12px";
  headerRow.style.alignItems = "start";

  const requirementsWrap = document.createElement("div");
  requirementsWrap.style.display = "flex";
  requirementsWrap.style.flexDirection = "column";
  requirementsWrap.style.alignItems = "flex-start";
  requirementsWrap.style.gap = "6px";
  requirementsWrap.style.maxHeight = "140px";
  requirementsWrap.style.overflow = "auto";
  requirementsWrap.style.padding = "6px 8px";
  requirementsWrap.style.fontSize = "12px";

  // requirements moved to attached window

  const PLANT_DISPLAY_NAME_OVERRIDES: Record<string, string> = {
    DawnCelestial: "Dawnbinder",
    MoonCelestial: "Moonbinder",
    Starweaver: "Starweaver",
    Lychee: "Lychee",
    Cacao: "Cacao",
  };
  const SEED_ICON_PLANTS = new Set(["Starweaver", "DawnCelestial", "MoonCelestial"]);
  const SEED_ICON_SIZE = 30;

  const settingsPanel = document.createElement("div");
  settingsPanel.style.display = "none";
  settingsPanel.style.position = "absolute";
  settingsPanel.style.top = "0";
  settingsPanel.style.right = "0";
  settingsPanel.style.padding = "10px 12px";
  settingsPanel.style.borderRadius = "10px";
  settingsPanel.style.border = "1px solid #2b3441";
  settingsPanel.style.background = "rgba(16,21,28,0.92)";
  settingsPanel.style.boxShadow = "0 8px 16px rgba(0,0,0,0.35)";
  settingsPanel.style.zIndex = "9999";
  settingsPanel.style.minWidth = "220px";


  const tabsRow = document.createElement("div");
  tabsRow.style.display = "flex";
  tabsRow.style.gap = "10px";

  const tabDirt = ui.btn("Dirt", { size: "md" });
  const tabBoard = ui.btn("Boardwalk", { size: "md", variant: "secondary" });
  tabsRow.append(tabDirt, tabBoard);

  const selectionRow = document.createElement("div");
  selectionRow.style.display = "flex";
  selectionRow.style.gap = "12px";
  selectionRow.style.alignItems = "center";

  const selectionCount = document.createElement("div");
  selectionCount.style.fontSize = "14px";
  selectionCount.style.opacity = "0.7";
  selectionCount.textContent = "0 tiles selected";

  selectionRow.append(selectionCount);

  const pickerRow = document.createElement("div");
  pickerRow.style.display = "grid";
  pickerRow.style.gridTemplateColumns = "1fr 1fr";
  pickerRow.style.gap = "12px";

  const typeSelect = document.createElement("select");
  typeSelect.innerHTML = `
    <option value="plant">Plant</option>
    <option value="decor">Decor</option>
  `;
  typeSelect.style.width = "100%";
  typeSelect.style.borderRadius = "8px";
  typeSelect.style.border = "1px solid #2b3441";
  typeSelect.style.background = "rgba(16,21,28,0.9)";
  typeSelect.style.color = "#e7eef7";
  typeSelect.style.padding = "8px 10px";
  typeSelect.style.fontSize = "14px";

  const plantSelect = document.createElement("select");
  const decorSelect = document.createElement("select");
  const mutationSelect = document.createElement("select");
  const plantPreview = document.createElement("div");
  const decorPreview = document.createElement("div");
  const mutationPreview = document.createElement("div");
  const setupPreview = (el: HTMLDivElement) => {
    el.style.width = "30px";
    el.style.height = "30px";
    el.style.borderRadius = "6px";
    el.style.border = "1px solid #2b3441";
    el.style.background = "rgba(16,21,28,0.9)";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
  };
  setupPreview(plantPreview);
  setupPreview(decorPreview);
  setupPreview(mutationPreview);
  const getPlantDisplayName = (id: string) =>
    PLANT_DISPLAY_NAME_OVERRIDES[id] || plantCatalog[id]?.crop?.name || plantCatalog[id]?.plant?.name || id;
  const getDecorDisplayName = (id: string) => decorCatalog[id]?.name || id;
  const getPlantIconCategories = (id: string) =>
    SEED_ICON_PLANTS.has(id) ? ["seed"] : ["tallplant", "plant", "crop", "plants"];
  const getMutationDisplayName = (id: string) => mutationCatalog[id as keyof typeof mutationCatalog]?.name || id;
  const MUTATION_OUTLINES: Record<string, { border: string; shadow: string }> = {
    Gold: { border: "#f5d44b", shadow: "0 0 0 2px rgba(245,212,75,0.6) inset" },
    Rainbow: { border: "transparent", shadow: "0 0 0 2px rgba(255,255,255,0.3) inset" },
    Frozen: { border: "#8fd9ff", shadow: "0 0 0 2px rgba(143,217,255,0.6) inset" },
    Chilled: { border: "#f0f4ff", shadow: "0 0 0 2px rgba(240,244,255,0.7) inset" },
    Wet: { border: "#5aa9ff", shadow: "0 0 0 2px rgba(90,169,255,0.6) inset" },
    Dawnlit: { border: "#a78bfa", shadow: "0 0 0 2px rgba(167,139,250,0.6) inset" },
    Amberlit: { border: "#ff9f4a", shadow: "0 0 0 2px rgba(255,159,74,0.6) inset" },
    Dawncharged: { border: "#8b5cf6", shadow: "0 0 0 2px rgba(139,92,246,0.6) inset" },
    Ambercharged: { border: "#ff7b2e", shadow: "0 0 0 2px rgba(255,123,46,0.6) inset" },
  };
  const MUTATION_GROUPS = [
    { id: "color", members: ["Rainbow", "Gold"] },
    { id: "weather", members: ["Frozen", "Chilled", "Wet"] },
    { id: "dawn", members: ["Dawncharged", "Ambercharged", "Dawnlit", "Amberlit"] },
  ] as const;
  const mutationGroupIndex = new Map<string, number>();
  MUTATION_GROUPS.forEach((group, idx) => {
    group.members.forEach((name) => mutationGroupIndex.set(name, idx));
  });
  const getTileMutations = (obj: any): string[] => {
    if (!obj || typeof obj !== "object") return [];
    const raw: string[] = [];
    if (Array.isArray((obj as any).glcMutations)) {
      raw.push(...(obj as any).glcMutations);
    } else if (typeof (obj as any).glcMutation === "string") {
      raw.push((obj as any).glcMutation);
    }
    const normalized = new Set<string>();
    for (const mut of raw) {
      const name = GardenLayoutService.normalizeMutation(String(mut || ""));
      if (name && mutationCatalog[name as keyof typeof mutationCatalog]) {
        normalized.add(name);
      }
    }
    const ordered: string[] = [];
    MUTATION_GROUPS.forEach((group) => {
      for (const name of group.members) {
        if (normalized.has(name)) {
          ordered.push(name);
          break;
        }
      }
    });
    return ordered.length ? ordered : Array.from(normalized.values()).slice(0, 3);
  };
  const setTileMutations = (obj: any, mutations: string[]) => {
    if (!obj || typeof obj !== "object") return;
    const list = (mutations || []).filter(Boolean);
    if (list.length) {
      (obj as any).glcMutations = list.slice(0, 3);
      if ((obj as any).glcMutation) delete (obj as any).glcMutation;
    } else {
      if ((obj as any).glcMutations) delete (obj as any).glcMutations;
      if ((obj as any).glcMutation) delete (obj as any).glcMutation;
    }
  };
  const fillSelect = (
    el: HTMLSelectElement,
    items: string[],
    label: string,
    getLabel: (id: string) => string
  ) => {
    el.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = label;
    el.appendChild(first);
    for (const id of items) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = getLabel(id);
      el.appendChild(opt);
    }
    el.style.width = "100%";
    el.style.borderRadius = "8px";
    el.style.border = "1px solid #2b3441";
    el.style.background = "rgba(16,21,28,0.9)";
    el.style.color = "#e7eef7";
    el.style.padding = "8px 10px";
    el.style.fontSize = "14px";
  };
  fillSelect(plantSelect, GardenLayoutService.listPlantIds(), "Plant species", getPlantDisplayName);
  fillSelect(decorSelect, GardenLayoutService.listDecorIds(), "Decor ID", getDecorDisplayName);
  fillSelect(mutationSelect, Object.keys(mutationCatalog || {}), "Mutation", getMutationDisplayName);

  const plantPickerBtn = ui.btn("Pick plant", { size: "md", variant: "secondary" });
  plantPickerBtn.style.width = "100%";
  const plantPickerWrap = document.createElement("div");
  plantPickerWrap.style.display = "grid";
  plantPickerWrap.style.gridTemplateColumns = "1fr 36px";
  plantPickerWrap.style.gap = "8px";
  plantPickerWrap.style.alignItems = "center";
  plantPickerWrap.append(plantPickerBtn, plantPreview);

  const plantPickerGrid = document.createElement("div");
  plantPickerGrid.style.display = "none";
  plantPickerGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(40px, 1fr))";
  plantPickerGrid.style.gap = "6px";
  plantPickerGrid.style.maxHeight = "220px";
  plantPickerGrid.style.overflow = "auto";
  plantPickerGrid.style.padding = "8px";
  plantPickerGrid.style.borderRadius = "8px";
  plantPickerGrid.style.border = "1px solid #2b3441";
  plantPickerGrid.style.background = "rgba(16,21,28,0.9)";

  const decorPickerBtn = ui.btn("Pick decor", { size: "md", variant: "secondary" });
  decorPickerBtn.style.width = "100%";
  const decorPickerWrap = document.createElement("div");
  decorPickerWrap.style.display = "grid";
  decorPickerWrap.style.gridTemplateColumns = "1fr 36px";
  decorPickerWrap.style.gap = "8px";
  decorPickerWrap.style.alignItems = "center";
  decorPickerWrap.append(decorPickerBtn, decorPreview);

  const decorPickerGrid = document.createElement("div");
  decorPickerGrid.style.display = "none";
  decorPickerGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(40px, 1fr))";
  decorPickerGrid.style.gap = "6px";
  decorPickerGrid.style.maxHeight = "220px";
  decorPickerGrid.style.overflow = "auto";
  decorPickerGrid.style.padding = "8px";
  decorPickerGrid.style.borderRadius = "8px";
  decorPickerGrid.style.border = "1px solid #2b3441";
  decorPickerGrid.style.background = "rgba(16,21,28,0.9)";

  const mutationPickerBtn = ui.btn("Pick mutation", { size: "md", variant: "secondary" });
  mutationPickerBtn.style.width = "100%";
  const mutationPickerWrap = document.createElement("div");
  mutationPickerWrap.style.display = "grid";
  mutationPickerWrap.style.gridTemplateColumns = "1fr 36px";
  mutationPickerWrap.style.gap = "8px";
  mutationPickerWrap.style.alignItems = "center";
  mutationPickerWrap.append(mutationPickerBtn, mutationPreview);

  const mutationPickerGrid = document.createElement("div");
  mutationPickerGrid.style.display = "none";
  mutationPickerGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(40px, 1fr))";
  mutationPickerGrid.style.gap = "6px";
  mutationPickerGrid.style.maxHeight = "220px";
  mutationPickerGrid.style.overflow = "auto";
  mutationPickerGrid.style.padding = "8px";
  mutationPickerGrid.style.borderRadius = "8px";
  mutationPickerGrid.style.border = "1px solid #2b3441";
  mutationPickerGrid.style.background = "rgba(16,21,28,0.9)";

  pickerRow.append(typeSelect, plantPickerWrap);

  // Apply row removed (click applies directly)

  const gridWrap = document.createElement("div");
  gridWrap.style.display = "grid";
  gridWrap.style.gap = "8px";
  gridWrap.style.alignItems = "start";

  const tilesWrap = document.createElement("div");
  tilesWrap.style.display = "grid";
  tilesWrap.style.gap = "4px";
  tilesWrap.style.padding = "12px";
  tilesWrap.style.borderRadius = "10px";
  tilesWrap.style.border = "1px solid #2b3441";
  tilesWrap.style.background = "rgba(16,21,28,0.9)";
  tilesWrap.style.maxHeight = "560px";
  tilesWrap.style.overflow = "auto";
  tilesWrap.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  gridWrap.append(tilesWrap);

  const layoutActionsRow = document.createElement("div");
  layoutActionsRow.style.display = "flex";
  layoutActionsRow.style.gap = "12px";
  layoutActionsRow.style.flexWrap = "wrap";
  layoutActionsRow.style.alignItems = "center";

  const saveLayoutBtn = ui.btn("New Layout", {
    variant: "secondary",
    fullWidth: false,
  });
  const applyLayoutBtn = ui.btn("Apply Layout", {
    variant: "primary",
    fullWidth: false,
  });
  const invertLayoutBtn = ui.btn("Invert", {
    variant: "secondary",
    fullWidth: false,
  });
  saveLayoutBtn.style.width = "auto";
  applyLayoutBtn.style.width = "auto";
  invertLayoutBtn.style.width = "auto";
  const clearLeftWrap = document.createElement("div");
  clearLeftWrap.style.display = "flex";
  clearLeftWrap.style.alignItems = "center";
  clearLeftWrap.style.gap = "6px";
  clearLeftWrap.style.marginLeft = "auto";
  const clearLeftToggle = ui.switch(false) as HTMLInputElement;
  const clearLeftLabel = document.createElement("div");
  clearLeftLabel.textContent = "Clear Left";
  clearLeftLabel.style.fontSize = "12px";
  clearLeftLabel.style.opacity = "0.8";
  clearLeftWrap.append(clearLeftLabel, clearLeftToggle);
  layoutActionsRow.append(saveLayoutBtn, applyLayoutBtn, invertLayoutBtn, clearLeftWrap);

  const layoutHotkeyRow = document.createElement("div");
  layoutHotkeyRow.style.display = "flex";
  layoutHotkeyRow.style.gap = "8px";
  layoutHotkeyRow.style.alignItems = "center";
  const layoutHotkeyLabel = document.createElement("div");
  layoutHotkeyLabel.textContent = "Toggle Layout Creator";
  layoutHotkeyLabel.style.fontSize = "14px";
  layoutHotkeyLabel.style.opacity = "0.7";
  const layoutHotkeyButton = ui.hotkeyButton(
    getKeybind("gui.toggle-layout-creator" as any),
    (hk) => setKeybind("gui.toggle-layout-creator" as any, hk),
    {
      emptyLabel: "Unassigned",
      listeningLabel: "Press a key…",
      clearable: true,
    }
  );
  layoutHotkeyButton.style.width = "auto";
  layoutHotkeyButton.style.padding = "4px 6px";
  layoutHotkeyButton.style.fontSize = "12px";
  layoutHotkeyButton.style.lineHeight = "1";
  layoutHotkeyButton.style.minHeight = "24px";
  layoutHotkeyButton.style.minWidth = "46px";
  layoutHotkeyButton.style.flexShrink = "0";
  layoutHotkeyRow.append(layoutHotkeyLabel, layoutHotkeyButton);
  const keybindMap = readAriesPath<Record<string, unknown>>("keybinds.bindings") || {};
  if (!Object.prototype.hasOwnProperty.call(keybindMap, "gui.toggle-layout-creator")) {
    setKeybind("gui.toggle-layout-creator" as any, { code: "KeyL" } as any);
    layoutHotkeyButton.refreshHotkey(getKeybind("gui.toggle-layout-creator" as any));
  }
  const stopLayoutHotkey = onKeybindChange("gui.toggle-layout-creator" as any, (hk) => {
    layoutHotkeyButton.refreshHotkey(hk);
  });
  ui.on("unmounted", stopLayoutHotkey);

  const inventoryRow = document.createElement("div");
  inventoryRow.style.display = "flex";
  inventoryRow.style.gap = "8px";
  inventoryRow.style.alignItems = "center";

  const inventoryLabel = document.createElement("div");
  inventoryLabel.textContent = "Free inventory slots";
  inventoryLabel.style.fontSize = "14px";
  inventoryLabel.style.opacity = "0.7";

  const inventoryInput = document.createElement("input");
  inventoryInput.type = "number";
  inventoryInput.min = "1";
  inventoryInput.step = "1";
  const INVENTORY_SLOTS_PATH = "glc.settings.inventorySlots";
  const INVENTORY_SLOTS_KEY = "glc.settings.inventorySlots";
  const storedSlots = Number(readAriesPath<number>(INVENTORY_SLOTS_PATH));
  let initialSlots = Number.isFinite(storedSlots) && storedSlots >= 0 ? Math.floor(storedSlots) : NaN;
  if (!Number.isFinite(initialSlots)) {
    try {
      const raw = window.localStorage?.getItem(INVENTORY_SLOTS_KEY);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) initialSlots = Math.floor(parsed);
    } catch {
      /* ignore storage access errors */
    }
  }
  if (!Number.isFinite(initialSlots)) initialSlots = 10;
  inventoryInput.value = String(initialSlots);
  inventoryInput.style.width = "40px";
  inventoryInput.style.borderRadius = "8px";
  inventoryInput.style.border = "1px solid #2b3441";
  inventoryInput.style.background = "rgba(16,21,28,0.9)";
  inventoryInput.style.color = "#e7eef7";
  inventoryInput.style.padding = "6px 8px";
  inventoryInput.style.fontSize = "14px";
  blockGameInput(inventoryInput);
  const normalizeInventorySlots = (value: number): number => {
    if (!Number.isFinite(value) || value < 1) return 10;
    return Math.floor(value);
  };
  inventoryInput.addEventListener("change", () => {
    const raw = Number(inventoryInput.value);
    const next = normalizeInventorySlots(raw);
    inventoryInput.value = String(next);
    writeAriesPath(INVENTORY_SLOTS_PATH, next);
    try {
      window.localStorage?.setItem(INVENTORY_SLOTS_KEY, String(next));
    } catch {
      /* ignore storage access errors */
    }
  });

  inventoryRow.append(inventoryLabel, inventoryInput);
  const previewAllRow = document.createElement("div");
  previewAllRow.style.display = "flex";
  previewAllRow.style.alignItems = "center";
  previewAllRow.style.gap = "8px";
  const previewAllLabel = document.createElement("div");
  previewAllLabel.textContent = "Preview ALL";
  previewAllLabel.style.fontSize = "14px";
  previewAllLabel.style.opacity = "0.7";
  const previewAllToggle = ui.switch(false) as HTMLInputElement;
  previewAllRow.append(previewAllLabel, previewAllToggle);
  const hideMenuRow = document.createElement("div");
  hideMenuRow.style.display = "flex";
  hideMenuRow.style.alignItems = "center";
  hideMenuRow.style.gap = "8px";
  const hideMenuLabel = document.createElement("div");
  hideMenuLabel.textContent = "Hide Menu";
  hideMenuLabel.style.fontSize = "14px";
  hideMenuLabel.style.opacity = "0.7";
  const hideMenuToggle = ui.switch(false) as HTMLInputElement;
  hideMenuRow.append(hideMenuLabel, hideMenuToggle);
  settingsPanel.append(layoutHotkeyRow, previewAllRow, hideMenuRow, inventoryRow);
  const HIDE_MENU_PATH = "glc.settings.hideMenu";
  const getLauncherEl = () =>
    document.querySelector<HTMLElement>(".glc-launch");
  const getLaunchItemEl = () =>
    document.querySelector<HTMLElement>('.glc-launch .glc-launch-item[data-id="editor"]');
  const setLauncherHidden = (hidden: boolean) => {
    const launcher = getLauncherEl();
    const item = getLaunchItemEl();
    if (item) item.style.display = hidden ? "none" : "";
    if (launcher) {
    const anyVisible = Array.from(launcher.querySelectorAll<HTMLElement>(".glc-launch-item")).some(
        (el) => el.style.display !== "none"
      );
      launcher.style.display = anyVisible ? "" : "none";
    }
  };
  const initialHideMenu = !!readGlcPath<boolean>(HIDE_MENU_PATH);
  hideMenuToggle.checked = initialHideMenu;
  setLauncherHidden(initialHideMenu);
  hideMenuToggle.addEventListener("change", () => {
    const hidden = hideMenuToggle.checked;
    writeGlcPath(HIDE_MENU_PATH, hidden);
    setLauncherHidden(hidden);
  });

  const draftActionsRow = document.createElement("div");
  draftActionsRow.style.display = "flex";
  draftActionsRow.style.gap = "12px";
  draftActionsRow.style.flexWrap = "wrap";

  const resetDraftBtn = ui.btn("Reset draft", {
    variant: "secondary",
    fullWidth: false,
  });
  const previewLayoutBtn = ui.btn("Preview Layout", {
    variant: "secondary",
    fullWidth: false,
  });
  const loadFromGardenBtn = ui.btn("Load from garden", {
    variant: "secondary",
    fullWidth: false,
  });
  resetDraftBtn.style.width = "auto";
  previewLayoutBtn.style.width = "auto";
  loadFromGardenBtn.style.width = "auto";
  const clearRightWrap = document.createElement("div");
  clearRightWrap.style.display = "flex";
  clearRightWrap.style.alignItems = "center";
  clearRightWrap.style.gap = "6px";
  clearRightWrap.style.marginLeft = "auto";
  const clearRightToggle = ui.switch(false) as HTMLInputElement;
  const clearRightLabel = document.createElement("div");
  clearRightLabel.textContent = "Clear Right";
  clearRightLabel.style.fontSize = "12px";
  clearRightLabel.style.opacity = "0.8";
  clearRightWrap.append(clearRightLabel, clearRightToggle);
  draftActionsRow.append(resetDraftBtn, previewLayoutBtn, loadFromGardenBtn, clearRightWrap);

  const savedLayoutsWrap = document.createElement("div");
  savedLayoutsWrap.style.display = "flex";
  savedLayoutsWrap.style.flexDirection = "column";
  savedLayoutsWrap.style.gap = "12px";
  savedLayoutsWrap.style.maxHeight = "none";
  savedLayoutsWrap.style.overflow = "visible";

  const ioCard = ui.card("Import / Export", {
    description: "Import or export Layout Creator layouts directly through JSON files.",
  });
  ioCard.body.style.display = "flex";
  ioCard.body.style.flexDirection = "column";
  ioCard.body.style.gap = "10px";

  const ioStatus = createStatusLine();
  const exportButton = createActionButton("Export Layouts");
  exportButton.style.width = "100%";
  exportButton.style.boxSizing = "border-box";
  exportButton.addEventListener("click", () => {
    const payload = GardenLayoutService.exportLoadouts();
    const filename = `GLC-Layouts-${Date.now()}.json`;
    downloadJSONFile(filename, payload);
    showStatus(ioStatus, true, "Layouts exported as JSON file.");
  });

  const importWrapper = document.createElement("div");
  importWrapper.style.display = "flex";
  importWrapper.style.flexDirection = "column";
  importWrapper.style.gap = "8px";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json,text/plain";
  fileInput.style.display = "none";

  const fileCard = document.createElement("div");
  Object.assign(fileCard.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "18px 22px",
    width: "100%",
    minHeight: "110px",
    borderRadius: "14px",
    border: "1px dashed #5d6a7d",
    background: "linear-gradient(180deg, #0b141c, #091018)",
    transition: "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
    cursor: "pointer",
    textAlign: "center",
  });
  fileCard.tabIndex = 0;
  fileCard.setAttribute("role", "button");
  fileCard.setAttribute("aria-label", "Import layouts JSON");

  const fileCardTitle = document.createElement("div");
  fileCardTitle.textContent = "Import layouts";
  Object.assign(fileCardTitle.style, {
    fontWeight: "600",
    fontSize: "14px",
    letterSpacing: "0.02em",
  });

  const fileStatus = document.createElement("div");
  const defaultStatusText = "Drop a JSON file or click to browse.";
  fileStatus.textContent = defaultStatusText;
  Object.assign(fileStatus.style, {
    fontSize: "12px",
    opacity: "0.75",
  });

  fileCard.append(fileCardTitle, fileStatus);

  const setFileCardActive = (active: boolean) => {
    if (active) {
      fileCard.style.borderColor = "#6fc3ff";
      fileCard.style.boxShadow = "0 0 0 3px #6fc3ff22";
      fileCard.style.background = "linear-gradient(180deg, #102030, #0b1826)";
    } else {
      fileCard.style.borderColor = "#5d6a7d";
      fileCard.style.boxShadow = "none";
      fileCard.style.background = "linear-gradient(180deg, #0b141c, #091018)";
    }
  };

  const triggerFileSelect = () => fileInput.click();
  const displaySelection = (files: FileList | null | undefined) => {
    if (!files || !files.length) {
      fileStatus.textContent = defaultStatusText;
      return;
    }
    fileStatus.textContent = files.length === 1 ? files[0].name : `${files.length} files selected`;
  };

  fileCard.addEventListener("mouseenter", () => setFileCardActive(true));
  fileCard.addEventListener("mouseleave", () => setFileCardActive(document.activeElement === fileCard));
  fileCard.addEventListener("focus", () => setFileCardActive(true));
  fileCard.addEventListener("blur", () => setFileCardActive(false));
  fileCard.addEventListener("click", triggerFileSelect);
  fileCard.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      triggerFileSelect();
    }
  });
  fileCard.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    setFileCardActive(true);
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
  });
  fileCard.addEventListener("dragleave", () => setFileCardActive(document.activeElement === fileCard));
  fileCard.addEventListener("drop", (ev) => {
    ev.preventDefault();
    setFileCardActive(false);
    const files = ev.dataTransfer?.files;
    if (!files || !files.length) return;
    fileInput.files = files;
    displaySelection(files);
    void handleImport(files);
  });

  const handleImport = async (files?: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const result = GardenLayoutService.importLoadouts(text);
      showStatus(ioStatus, result.success, result.message);
      if (result.success) {
        renderSavedLayouts();
      }
    } catch {
      showStatus(ioStatus, false, "Failed to import JSON file.");
    } finally {
      fileInput.value = "";
    }
  };

  fileInput.addEventListener("change", () => {
    const files = fileInput.files;
    displaySelection(files);
    void handleImport(files);
  });

  importWrapper.append(fileInput, fileCard);
  ioCard.body.append(importWrapper, ioStatus, exportButton);

  const loadoutsSection = document.createElement("div");
  loadoutsSection.style.display = "grid";
  loadoutsSection.style.gap = "12px";
  loadoutsSection.style.transition = "opacity 160ms ease, max-height 160ms ease";
  loadoutsSection.style.overflow = "hidden";
  loadoutsSection.append(savedLayoutsWrap, ioCard.root);

  layoutWrap.append(
    headerRow,
    selectionRow,
    pickerRow,
    plantPickerGrid,
    decorPickerGrid,
    mutationPickerGrid,
    gridWrap,
    layoutActionsRow,
    draftActionsRow,
    layoutStatus,
    loadoutsSection
  );

  const layoutCard = sectionCard("", layoutWrap);
  layoutCard.root.style.alignSelf = "stretch";
  layoutCard.root.style.flex = "0 0 auto";
  layoutCard.root.style.flexShrink = "0";
  layoutCard.root.style.position = "relative";
  layoutCard.header.style.display = "flex";
  layoutCard.header.style.alignItems = "center";
  layoutCard.header.style.gap = "12px";
  layoutCard.header.style.paddingBottom = "0";
  const titleEl = layoutCard.header.querySelector<HTMLElement>(".qmm-card__title");
  if (titleEl) {
    titleEl.textContent = "";
    titleEl.style.display = "none";
  }
  layoutCard.header.appendChild(tabsRow);

  const windowEl = ui.root.closest<HTMLElement>(".glc-win");
  const windowBody = windowEl?.querySelector<HTMLElement>(".w-body") ?? null;
  const windowHead = windowEl?.querySelector<HTMLElement>(".w-head") ?? null;
  const minBtn = windowHead?.querySelector<HTMLButtonElement>('[data-act="min"]') ?? null;
  const closeBtn = windowHead?.querySelector<HTMLButtonElement>('[data-act="close"]') ?? null;
  const onClose = () => {
    GardenLayoutService.cancelApply();
  };
  closeBtn?.addEventListener("click", onClose);
  let loadoutsHidden = false;
  let layoutsNaturalHeight = 0;
  const measureNaturalHeight = () => {
    if (layoutsNaturalHeight === 0 && loadoutsSection.offsetHeight > 0) {
      layoutsNaturalHeight = loadoutsSection.scrollHeight;
      loadoutsSection.style.maxHeight = `${layoutsNaturalHeight}px`;
    }
  };
  const applyHalfState = () => {
    if (!loadoutsHidden) {
      measureNaturalHeight();
      loadoutsSection.style.maxHeight = layoutsNaturalHeight > 0 ? `${layoutsNaturalHeight}px` : "none";
      loadoutsSection.style.display = "grid";
      loadoutsSection.style.visibility = "visible";
      loadoutsSection.style.pointerEvents = "auto";
      loadoutsSection.style.opacity = "1";
    } else {
      if (layoutsNaturalHeight === 0) {
        layoutsNaturalHeight = loadoutsSection.scrollHeight;
      }
      loadoutsSection.style.maxHeight = "0px";
      loadoutsSection.style.visibility = "hidden";
      loadoutsSection.style.pointerEvents = "none";
      loadoutsSection.style.opacity = "0";
    }
  };
  const updateLoadoutsHeight = () => {
    layoutsNaturalHeight = loadoutsSection.scrollHeight;
    loadoutsSection.style.maxHeight = `${layoutsNaturalHeight}px`;
  };
  if (windowHead) {
    const headTitle = windowHead.querySelector<HTMLElement>(".w-title");
    if (headTitle) headTitle.textContent = "🧱 Garden Layout Creator";
    const existing = windowHead.querySelector<HTMLButtonElement>('[data-act="settings"]');
    if (existing) existing.remove();
    const gearButton = document.createElement("button");
    gearButton.className = "w-btn";
    gearButton.dataset.act = "settings";
    gearButton.title = "Settings";
    gearButton.textContent = "⚙";
    gearButton.addEventListener("click", () => {
      settingsPanel.style.display = settingsPanel.style.display === "none" ? "block" : "none";
    });
    const versionBadge = document.createElement("span");
    versionBadge.id = "glc-version-layout";
    versionBadge.className = "pill warn";
    versionBadge.style.padding = "4px 8px";
    versionBadge.style.borderRadius = "999px";
    versionBadge.style.border = "1px solid rgba(255,255,255,0.15)";
    versionBadge.style.background = "rgba(255,255,255,0.06)";
    versionBadge.style.color = "#e7eef7";
    versionBadge.style.fontSize = "12px";
    versionBadge.style.lineHeight = "1.2";
    versionBadge.style.whiteSpace = "nowrap";
    const downloadUrl =
      "https://raw.githubusercontent.com/Hyrulien/GardenLayoutCreator/main/dist/LayoutCreator.user.js";

    const setBadge = (text: string, cls: "ok" | "warn" | "bad") => {
      versionBadge.textContent = text;
      versionBadge.classList.remove("ok", "warn", "bad");
      versionBadge.classList.add(cls);
      if (cls === "ok") {
        versionBadge.style.background = "rgba(36, 161, 72, 0.20)";
        versionBadge.style.borderColor = "#48d17066";
      } else if (cls === "warn") {
        versionBadge.style.background = "rgba(241, 194, 27, 0.18)";
        versionBadge.style.borderColor = "#ffd65c66";
      } else {
        versionBadge.style.background = "rgba(218, 30, 40, 0.20)";
        versionBadge.style.borderColor = "#ff7c8666";
      }
    };
    const setDownloadTarget = (url?: string | null) => {
      if (url) {
        versionBadge.dataset.download = url;
        versionBadge.style.cursor = "pointer";
        versionBadge.title = "Download the new version";
      } else {
        delete versionBadge.dataset.download;
        versionBadge.style.removeProperty("cursor");
        versionBadge.removeAttribute("title");
      }
    };
    const openDownloadLink = (url: string) => {
      const shouldUseGM = isDiscordSurface();
      const gmOpen =
        typeof (globalThis as any).GM_openInTab === "function"
          ? (globalThis as any).GM_openInTab
          : typeof (globalThis as any)?.GM?.openInTab === "function"
            ? (globalThis as any).GM.openInTab.bind((globalThis as any).GM)
            : null;
      if (shouldUseGM && gmOpen) {
        try {
          gmOpen(url, { active: true, setParent: true });
        return;
        } catch (error) {
          console.warn("[GLC] GM_openInTab failed, falling back to window.open", error);
        }
      }
      window.open(url, "_blank", "noopener,noreferrer");
    };
    versionBadge.addEventListener("click", () => {
      const url = versionBadge.dataset.download;
      if (url) {
        openDownloadLink(url);
      }
    });
    setBadge("checking…", "warn");
    setDownloadTarget(null);
    (async () => {
      const localVersion = getLocalVersion();
      try {
        const remoteData = await fetchRemoteVersion();
        const remoteVersion = remoteData?.version?.trim();
        if (!remoteVersion) {
          setBadge(localVersion || "Unknown", "warn");
          return;
        }
        if (!localVersion) {
          setBadge(remoteVersion, "warn");
          setDownloadTarget(downloadUrl);
          return;
        }
        if (localVersion === remoteVersion) {
          setBadge(localVersion, "ok");
          setDownloadTarget(null);
          return;
        }
        setBadge(`${localVersion} → ${remoteVersion}`, "warn");
        setDownloadTarget(downloadUrl);
      } catch (error) {
        console.error("[GLC] Failed to check version:", error);
        setBadge(localVersion || "Unknown", "warn");
      }
    })();
    const applyHeaderBtn = document.createElement("button");
    applyHeaderBtn.className = "w-btn";
    applyHeaderBtn.dataset.act = "apply";
    applyHeaderBtn.title = "Apply current layout";
    applyHeaderBtn.textContent = "▶";
    applyHeaderBtn.addEventListener("click", async () => {
      const slotsAvailable = normalizeInventorySlots(Number(inventoryInput.value));
      inventoryInput.value = String(slotsAvailable);
      const ok = await GardenLayoutService.applyGarden(draft, {
        ignoreInventory: EditorService.isEnabled(),
        clearTargetTiles: true,
        inventorySlotsAvailable: Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0,
      });
      if (!ok) return;
      if (!clearLeftToggle.checked && !clearRightToggle.checked) return;
      const slotsLimit = Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0;
      if (slotsLimit <= 0) return;
      const { tasks, blocked } = await GardenLayoutService.getClearSideTasks(draft, {
        clearLeft: clearLeftToggle.checked,
        clearRight: clearRightToggle.checked,
      });
      if (!tasks.length) return;
      if (tasks.length > slotsLimit) {
        const proceed = window.confirm(
          `Clearing ${tasks.length} items needs ${slotsLimit} free slots. Only ${slotsLimit} items will be picked up. Continue?`
        );
        if (!proceed) return;
      }
      await GardenLayoutService.clearSideTasks(tasks, slotsLimit);
    });

    const halfButton = document.createElement("button");
    halfButton.className = "w-btn";
    halfButton.dataset.act = "half";
    halfButton.title = "Toggle layouts";
    halfButton.textContent = "▭";
    const lockWindowPosition = () => {
      if (!windowEl) return;
      const rect = windowEl.getBoundingClientRect();
      windowEl.style.top = `${rect.top}px`;
      windowEl.style.left = `${rect.left}px`;
      windowEl.style.right = "auto";
      windowEl.style.bottom = "auto";
    };
    const clampWindowPosition = () => {
      if (!windowEl) return;
      const margin = 8;
      const rect = windowEl.getBoundingClientRect();
      const maxX = window.innerWidth - windowEl.offsetWidth - margin;
      const maxY = window.innerHeight - windowEl.offsetHeight - margin;
      const nextLeft = Math.max(margin, Math.min(maxX, rect.left));
      const nextTop = Math.max(margin, Math.min(maxY, rect.top));
      windowEl.style.left = `${nextLeft}px`;
      windowEl.style.top = `${nextTop}px`;
      windowEl.style.right = "auto";
      windowEl.style.bottom = "auto";
    };

    halfButton.addEventListener("click", () => {
      if (windowEl && windowBody && windowBody.style.display !== "none") {
        // Only lock position when window is visible (not minimized)
        lockWindowPosition();

        loadoutsHidden = !loadoutsHidden;
        applyHalfState();
        const transitionMs = 160;
        window.setTimeout(() => {
          clampWindowPosition();
        }, transitionMs + 60);
      } else {
        loadoutsHidden = !loadoutsHidden;
        applyHalfState();
        clampWindowPosition();
      }
    });
    // Measure natural height after DOM is ready
    requestAnimationFrame(() => {
      if (layoutsNaturalHeight === 0) {
        layoutsNaturalHeight = loadoutsSection.scrollHeight;
        if (layoutsNaturalHeight > 0) {
          loadoutsSection.style.maxHeight = `${layoutsNaturalHeight}px`;
        }
      }
      applyHalfState();
    });
    if (minBtn) {
      windowHead.insertBefore(versionBadge, minBtn);
      windowHead.insertBefore(gearButton, minBtn);
      windowHead.insertBefore(applyHeaderBtn, minBtn);
      windowHead.insertBefore(halfButton, minBtn);
    } else {
      windowHead.append(versionBadge, gearButton, applyHeaderBtn, halfButton);
    }
  }

  layoutCard.root.append(settingsPanel);

  const requirementsWin = document.createElement("div");
  requirementsWin.className = "glc-win";
  requirementsWin.style.position = "fixed";
  requirementsWin.style.width = "max-content";
  requirementsWin.style.maxWidth = "max-content";
  requirementsWin.style.minHeight = "120px";
  requirementsWin.style.zIndex = "9999";
  requirementsWin.innerHTML = `
    <div class="w-head">
      <div class="w-title">Requirements</div>
      <div class="sp"></div>
    </div>
    <div class="w-body"></div>
  `;
  const reqBody = requirementsWin.querySelector(".w-body") as HTMLElement;
  reqBody.appendChild(requirementsWrap);
  (document.documentElement || document.body).appendChild(requirementsWin);

  const positionRequirements = () => {
    if (!windowEl) return;
    const minimized = windowBody?.style.display === "none";
    const hidden =
      windowEl.classList.contains("is-hidden") || windowEl.style.display === "none" || minimized;
    requirementsWin.style.display = hidden ? "none" : "";
    if (hidden) return;
    const rect = windowEl.getBoundingClientRect();
    requirementsWin.style.top = `${rect.top}px`;
    requirementsWin.style.left = `${rect.right + 8}px`;
  };
  let reqRaf = 0;
  const tickRequirements = () => {
    positionRequirements();
    reqRaf = window.requestAnimationFrame(tickRequirements);
  };
  tickRequirements();

  view.append(layoutCard.root);

  let currentKind: "Dirt" | "Boardwalk" = "Dirt";
  let lastDirtType: "plant" | "decor" | "mutation" = "plant";
  let selectedTile: number | null = null;
  let selectedTiles = new Set<number>();
  let selectionAnchor: { x: number; y: number } | null = null;
  let selectionActive = false;
  let groupDragActive = false;
  let groupDragAnchor: { x: number; y: number } | null = null;
  let lastGroupDelta = { dx: 0, dy: 0 };
  let draft = GardenLayoutService.getEmptyGarden();
  let currentGarden = GardenLayoutService.getEmptyGarden();
  let currentTiles: Array<{ localIdx: number; x: number; y: number }> = [];
  let tilePosByIdx = new Map<number, { x: number; y: number }>();
  let tileIdxByPos = new Map<string, number>();
  const tileCells = new Map<number, HTMLButtonElement>();
  let missingPlantTiles = new Set<number>();
  let missingDecorTiles = new Set<string>();
  let blockedTiles = new Set<number>();
  let liveEggTiles: Record<"Dirt" | "Boardwalk", Set<number>> = {
    Dirt: new Set(),
    Boardwalk: new Set(),
  };
  let clearMarkedTiles: Record<"Dirt" | "Boardwalk", Set<number>> = {
    Dirt: new Set(),
    Boardwalk: new Set(),
  };
  let isDragging = false;
  let dragMode: "apply" | "clear" | "ignore-add" | "ignore-remove" | "mutation-clear" = "apply";
  let clearDragActive = false;
  let previewActive = false;
  const ignoredTilesByType: Record<"Dirt" | "Boardwalk", Set<number>> = {
    Dirt: new Set(),
    Boardwalk: new Set(),
  };
  const syncIgnoredFromDraft = () => {
    const dirt = Array.isArray(draft.ignoredTiles?.dirt) ? draft.ignoredTiles!.dirt! : [];
    const board = Array.isArray(draft.ignoredTiles?.boardwalk) ? draft.ignoredTiles!.boardwalk! : [];
    ignoredTilesByType.Dirt = new Set(dirt.filter((n) => Number.isFinite(n)));
    ignoredTilesByType.Boardwalk = new Set(board.filter((n) => Number.isFinite(n)));
  };
  const writeIgnoredToDraft = () => {
    draft.ignoredTiles = {
      dirt: Array.from(ignoredTilesByType.Dirt.values()),
      boardwalk: Array.from(ignoredTilesByType.Boardwalk.values()),
    };
  };
  const isIgnoredTile = (idx: number) => ignoredTilesByType[currentKind].has(idx);
  const isEggTile = (idx: number) => liveEggTiles[currentKind].has(idx);
  const getTilePos = (idx: number): { x: number; y: number } | null => tilePosByIdx.get(idx) || null;
  const getTileIdxAt = (x: number, y: number): number | null => tileIdxByPos.get(`${x},${y}`) ?? null;
  syncIgnoredFromDraft();

  const applySelectedTiles = (next: Set<number>) => {
    const prev = selectedTiles;
    selectedTiles = next;
    for (const idx of prev) {
      if (!next.has(idx)) updateTileCell(idx);
    }
    for (const idx of next) {
      if (!prev.has(idx)) updateTileCell(idx);
    }
    updateSelectionLabel();
  };

  const clearSelectedTiles = () => {
    if (!selectedTiles.size) return;
    const prev = selectedTiles;
    selectedTiles = new Set<number>();
    for (const idx of prev) {
      updateTileCell(idx);
    }
    updateSelectionLabel();
  };

  const selectTilesInRect = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const next = new Set<number>();
    for (const tile of currentTiles) {
      if (tile.x < minX || tile.x > maxX || tile.y < minY || tile.y > maxY) continue;
      next.add(tile.localIdx);
    }
    applySelectedTiles(next);
  };

  const moveSelectedTilesBy = (dx: number, dy: number): boolean => {
    if (!dx && !dy) return true;
    if (!selectedTiles.size) return false;
    const targetIndices: number[] = [];
    for (const idx of selectedTiles) {
      const pos = getTilePos(idx);
      if (!pos) return false;
      const targetIdx = getTileIdxAt(pos.x + dx, pos.y + dy);
      if (targetIdx == null) return false;
      if (isIgnoredTile(targetIdx) || isEggTile(targetIdx)) return false;
      targetIndices.push(targetIdx);
    }
    const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
    const moved = new Map<number, any>();
    for (const idx of selectedTiles) {
      const obj = map[String(idx)];
      if (obj && typeof obj === "object") {
        const pos = getTilePos(idx);
        if (!pos) continue;
        const targetIdx = getTileIdxAt(pos.x + dx, pos.y + dy);
        if (targetIdx == null) continue;
        moved.set(targetIdx, obj);
      }
    }
    for (const idx of selectedTiles) {
      delete map[String(idx)];
    }
    for (const [targetIdx, obj] of moved.entries()) {
      map[String(targetIdx)] = obj;
    }
    const nextSelected = new Set<number>(targetIndices);
    applySelectedTiles(nextSelected);
    for (const idx of targetIndices) {
      updateTileCell(idx);
    }
    void refreshRequirementInfo();
    return true;
  };

  const updateClearMarkers = async () => {
    if (!clearLeftToggle.checked && !clearRightToggle.checked) {
      clearMarkedTiles.Dirt.clear();
      clearMarkedTiles.Boardwalk.clear();
      for (const idx of tileCells.keys()) {
        updateTileCell(idx);
      }
      return;
    }
    try {
      const { tasks } = await GardenLayoutService.getClearSideTasks(draft, {
        clearLeft: clearLeftToggle.checked,
        clearRight: clearRightToggle.checked,
      });
      const blockedTargets = new Set<number>(
        GardenLayoutService.getBlockedTargetTiles(currentGarden, draft)
      );
      const dirtSet = new Set<number>();
      const boardSet = new Set<number>();
      for (const task of tasks) {
        if (task.tileType === "Dirt") {
          if (!blockedTargets.has(task.localIdx)) dirtSet.add(task.localIdx);
        } else {
          if (!blockedTargets.has(task.localIdx)) boardSet.add(task.localIdx);
        }
      }
      clearMarkedTiles.Dirt = dirtSet;
      clearMarkedTiles.Boardwalk = boardSet;
      for (const idx of tileCells.keys()) {
        updateTileCell(idx);
      }
    } catch {
      // ignore errors
    }
  };

  const setLayoutStatus = (msg: string) => {
    layoutStatus.textContent = msg;
  };

  const updateSelectionLabel = () => {
    const count = selectedTiles.size ? selectedTiles.size : selectedTile == null ? 0 : 1;
    selectionCount.textContent = `${count} tiles selected`;
  };

  const hasDraftTiles = () =>
    Object.keys(draft.tileObjects || {}).length > 0 || Object.keys(draft.boardwalkTileObjects || {}).length > 0;

  const saveNewLayout = () => {
    if (!hasDraftTiles()) {
      console.log("[GLC GardenLayout] save skipped (empty draft)");
        return;
      }
    const saved = GardenLayoutService.saveLayout("Untitled", draft);
    renderSavedLayouts();
  };

  const refreshRequirementInfo = async () => {
    const [list, linkedAvailability, decorAvailability, liveGarden] = await Promise.all([
      GardenLayoutService.getRequirementSummary(draft),
      GardenLayoutService.getLinkedPlantAvailability(draft),
      GardenLayoutService.getDecorAvailabilityCounts(draft.ignoredTiles),
      GardenLayoutService.getCurrentGarden(),
    ]);
    const availability = linkedAvailability.base;
    const mutationAvailability = linkedAvailability.mutation;
    currentGarden = liveGarden || GardenLayoutService.getEmptyGarden();
    const potRequirement = await GardenLayoutService.getPlanterPotRequirement(draft, currentGarden);
    const nextEggs: Record<"Dirt" | "Boardwalk", Set<number>> = {
      Dirt: new Set(),
      Boardwalk: new Set(),
    };
    for (const [key, obj] of Object.entries(currentGarden.tileObjects || {})) {
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
      if (type !== "egg") continue;
      const idx = Number(key);
      if (Number.isFinite(idx)) nextEggs.Dirt.add(idx);
    }
    for (const [key, obj] of Object.entries(currentGarden.boardwalkTileObjects || {})) {
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
      if (type !== "egg") continue;
      const idx = Number(key);
      if (Number.isFinite(idx)) nextEggs.Boardwalk.add(idx);
    }
    liveEggTiles = nextEggs;
    const ignoredDirt = ignoredTilesByType.Dirt;
    const ignoredBoard = ignoredTilesByType.Boardwalk;
    const nextMissing = new Set<number>();
    const plantCounts = new Map<string, number>();
    const plantMutationCounts = new Map<string, number>();
    const entries = Object.entries(draft.tileObjects || {}).sort(([a], [b]) => Number(a) - Number(b));
    for (const [key, obj] of entries) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignoredDirt.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type !== "plant") continue;
      const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
      const species = GardenLayoutService.resolvePlantSpecies(rawSpecies);
      if (!species) continue;
      const mutations = getTileMutations(obj);
      if (mutations.length) {
        const key = `${species}::${mutations.slice().sort((a, b) => a.localeCompare(b)).join("+")}`;
        const used = (plantMutationCounts.get(key) || 0) + 1;
        plantMutationCounts.set(key, used);
        const have = mutationAvailability.get(key) || 0;
        if (used > have && Number.isFinite(idx)) nextMissing.add(idx);
      } else {
        const used = (plantCounts.get(species) || 0) + 1;
        plantCounts.set(species, used);
        const have = availability.get(species) || 0;
        if (used > have && Number.isFinite(idx)) nextMissing.add(idx);
      }
    }
    missingPlantTiles = nextMissing;
    const nextMissingDecor = new Set<string>();
    const decorCounts = new Map<string, number>();
    const addDecorEntries = (
      tileType: "Dirt" | "Boardwalk",
      map: Record<string, any>,
      ignoredSet: Set<number>
    ) => {
      for (const [key, obj] of Object.entries(map || {})) {
        const idx = Number(key);
        if (Number.isFinite(idx) && ignoredSet.has(idx)) continue;
        if (!obj || typeof obj !== "object") continue;
        const type = String((obj as any).objectType || "").toLowerCase();
        if (type !== "decor") continue;
        const decorId = String((obj as any).decorId || "");
        if (!decorId) continue;
        const used = (decorCounts.get(decorId) || 0) + 1;
        decorCounts.set(decorId, used);
        const have = decorAvailability.get(decorId) || 0;
        if (used > have) {
          nextMissingDecor.add(`${tileType}:${key}`);
        }
      }
    };
    addDecorEntries("Dirt", draft.tileObjects || {}, ignoredDirt);
    addDecorEntries("Boardwalk", draft.boardwalkTileObjects || {}, ignoredBoard);
    missingDecorTiles = nextMissingDecor;
    const nextBlocked = new Set<number>();
    const draftMap = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
    const currentMap = currentKind === "Dirt" ? currentGarden.tileObjects : currentGarden.boardwalkTileObjects;
    const ignoredCurrent = currentKind === "Dirt" ? ignoredDirt : ignoredBoard;
    for (const [key, obj] of Object.entries(draftMap || {})) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignoredCurrent.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const curObj = (currentMap || {})[key];
      if (!curObj || typeof curObj !== "object") continue;
      const curType = String((curObj as any).objectType ?? (curObj as any).type ?? "").toLowerCase();
      if (curType !== "egg") continue;
      const nextType = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
      const sameEgg =
        nextType === "egg" &&
        String((obj as any).eggId ?? "") === String((curObj as any).eggId ?? "");
      if (!sameEgg) nextBlocked.add(Number(key));
    }
    blockedTiles = nextBlocked;
    requirementsWrap.replaceChildren();
    const hasPotRequirement = potRequirement.needed > 0;
    if (!list.length && !hasPotRequirement) {
      const empty = document.createElement("div");
      empty.textContent = "No requirements";
      empty.style.opacity = "0.7";
      requirementsWrap.appendChild(empty);
    } else {
      if (hasPotRequirement) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "6px";
        row.style.whiteSpace = "nowrap";
        row.style.color = potRequirement.owned >= potRequirement.needed ? "#58d38a" : "#ff6b6b";
        const icon = document.createElement("div");
        icon.style.width = "16px";
        icon.style.height = "16px";
        attachSpriteIcon(icon, ["item", "tool", "decor"], ["PlanterPot", "Planter Pot"], 14, "editor-req-tool");
        const label = document.createElement("div");
        label.textContent = `Planter Pots ${potRequirement.owned}/${potRequirement.needed}`;
        row.append(icon, label);
        requirementsWrap.appendChild(row);
      }
      for (const item of list) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "6px";
        row.style.whiteSpace = "nowrap";
        row.style.color = item.have >= item.needed ? "#58d38a" : "#ff6b6b";

        const icon = document.createElement("div");
        icon.style.width = "16px";
        icon.style.height = "16px";
        if (item.type === "plant") {
          const size = SEED_ICON_PLANTS.has(item.id) ? 18 : 14;
          attachSpriteIcon(icon, getPlantIconCategories(item.id), item.id, size, "editor-req-plant");
        } else {
          attachSpriteIcon(icon, ["decor"], item.id, 14, "editor-req-decor");
        }

        const label = document.createElement("div");
        const displayName = item.type === "plant" ? getPlantDisplayName(item.id) : getDecorDisplayName(item.id);
        const mutationLabel = item.type === "plant" && item.mutation ? ` (${getMutationDisplayName(item.mutation)})` : "";
        label.textContent = `${displayName}${mutationLabel} ${item.have}/${item.needed}`;

        row.append(icon, label);
        requirementsWrap.appendChild(row);
      }
    }
    for (const idx of tileCells.keys()) {
      updateTileCell(idx);
    }
  };
  let reqRefreshBusy = false;
  let reqRefreshTimer = 0;
  const scheduleRequirementRefresh = () => {
    if (reqRefreshBusy) return;
    reqRefreshBusy = true;
    refreshRequirementInfo().finally(() => {
      reqRefreshBusy = false;
    });
  };

  const syncTypeOptions = () => {
    if (currentKind === "Boardwalk") {
      typeSelect.innerHTML = `<option value="decor">Decor</option>`;
      typeSelect.value = "decor";
    } else {
      typeSelect.innerHTML = `
        <option value="plant">Plant</option>
        <option value="decor">Decor</option>
        <option value="mutation">Mutation</option>
      `;
      typeSelect.value = lastDirtType || "plant";
    }
    updatePickerVisibility();
    updatePickerPreview();
  };

  const updatePickerVisibility = () => {
    const type = typeSelect.value;
    pickerRow.innerHTML = "";
    pickerRow.append(typeSelect);
    if (type === "plant") pickerRow.append(plantPickerWrap);
    else if (type === "decor") pickerRow.append(decorPickerWrap);
    else if (type === "mutation") pickerRow.append(mutationPickerWrap);
    if (type !== "plant") plantPickerGrid.style.display = "none";
    if (type !== "decor") decorPickerGrid.style.display = "none";
    if (type !== "mutation") mutationPickerGrid.style.display = "none";
  };

  const updatePickerPreview = () => {
    const type = typeSelect.value;
    if (type === "plant") {
      const id = plantSelect.value;
      plantPreview.replaceChildren();
      if (id) {
        const size = SEED_ICON_PLANTS.has(id) ? SEED_ICON_SIZE : 20;
        plantPreview.style.width = `${size}px`;
        plantPreview.style.height = `${size}px`;
        attachSpriteIcon(plantPreview, getPlantIconCategories(id), id, size, "editor-plant");
      }
      plantPickerBtn.textContent = id ? getPlantDisplayName(id) : "Pick plant";
    } else if (type === "decor") {
      const id = decorSelect.value;
      plantPreview.style.width = "30px";
      plantPreview.style.height = "30px";
      decorPreview.replaceChildren();
      if (id) attachSpriteIcon(decorPreview, ["decor"], id, 20, "editor-decor");
      decorPickerBtn.textContent = id ? getDecorDisplayName(id) : "Pick decor";
    } else if (type === "mutation") {
      const id = mutationSelect.value;
      plantPreview.style.width = "30px";
      plantPreview.style.height = "30px";
      mutationPreview.replaceChildren();
      if (id) attachSpriteIcon(mutationPreview, ["mutation"], id, 20, "editor-mutation");
      mutationPickerBtn.textContent = id ? getMutationDisplayName(id) : "Pick mutation";
    }
  };

  const clearTileByIdx = (idx: number) => {
    if (isIgnoredTile(idx)) return;
    if (isEggTile(idx)) return;
    const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
    if (map[String(idx)]) {
      delete map[String(idx)];
      updateTileCell(idx);
      void refreshRequirementInfo();
    }
  };
  const clearMutationByIdx = (idx: number) => {
    if (isIgnoredTile(idx)) return;
    if (isEggTile(idx)) return;
    const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
    const obj = map[String(idx)];
    if (!obj || typeof obj !== "object") return;
    const type = String((obj as any).objectType || "").toLowerCase();
    if (type !== "plant") return;
    if (!(obj as any).glcMutation && !(obj as any).glcMutations) return;
    delete (obj as any).glcMutation;
    delete (obj as any).glcMutations;
    map[String(idx)] = obj;
    updateTileCell(idx);
    void refreshRequirementInfo();
  };

  const renderGrid = () => {
    tilesWrap.innerHTML = "";
    tileCells.clear();
    if (!currentTiles.length) {
      const empty = document.createElement("div");
      empty.textContent = "Garden tiles not ready.";
      empty.style.fontSize = "12px";
      empty.style.opacity = "0.7";
      tilesWrap.appendChild(empty);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const byPos = new Map<string, { localIdx: number; x: number; y: number }>();
    tilePosByIdx = new Map<number, { x: number; y: number }>();
    tileIdxByPos = new Map<string, number>();
    for (const t of currentTiles) {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x);
      maxY = Math.max(maxY, t.y);
      byPos.set(`${t.x},${t.y}`, t);
      tilePosByIdx.set(t.localIdx, { x: t.x, y: t.y });
      tileIdxByPos.set(`${t.x},${t.y}`, t.localIdx);
    }

    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    tilesWrap.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
    tilesWrap.style.gridTemplateRows = `repeat(${rows}, 30px)`;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = byPos.get(`${x},${y}`);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.style.width = "30px";
        cell.style.height = "30px";
        cell.style.padding = "0";
        cell.style.borderRadius = "8px";
        cell.style.border = "1px solid rgba(255,255,255,0.12)";
        cell.style.background = tile ? "rgba(48, 58, 72, 0.9)" : "transparent";
        cell.style.color = "#e7eef7";
        cell.style.fontSize = "11px";
        cell.style.cursor = tile ? "pointer" : "default";
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.justifyContent = "center";
        cell.style.position = "relative";
        if (!tile) {
          cell.disabled = true;
          tilesWrap.appendChild(cell);
          continue;
        }
        cell.dataset.localIdx = String(tile.localIdx);

        const icon = document.createElement("div");
        icon.className = "glc-tile-icon";
        icon.style.width = "20px";
        icon.style.height = "20px";
        icon.style.display = "flex";
        icon.style.alignItems = "center";
        icon.style.justifyContent = "center";
        cell.appendChild(icon);

        const eggIcon = document.createElement("div");
        eggIcon.className = "glc-tile-egg";
        eggIcon.style.position = "absolute";
        eggIcon.style.top = "50%";
        eggIcon.style.left = "50%";
        eggIcon.style.transform = "translate(-50%, -50%)";
        eggIcon.style.width = "18px";
        eggIcon.style.height = "18px";
        eggIcon.style.display = "none";
        eggIcon.style.alignItems = "center";
        eggIcon.style.justifyContent = "center";
        cell.appendChild(eggIcon);

        const clearIcon = document.createElement("div");
        clearIcon.className = "glc-tile-clear";
        clearIcon.style.position = "absolute";
        clearIcon.style.top = "0";
        clearIcon.style.left = "0";
        clearIcon.style.width = "100%";
        clearIcon.style.height = "100%";
        clearIcon.style.display = "none";
        clearIcon.style.alignItems = "center";
        clearIcon.style.justifyContent = "center";
        clearIcon.style.background = "rgba(255,50,50,0.3)";
        clearIcon.style.borderRadius = "8px";
        clearIcon.style.fontSize = "16px";
        clearIcon.style.fontWeight = "bold";
        clearIcon.style.color = "#ff3030";
        clearIcon.style.pointerEvents = "none";
        clearIcon.style.zIndex = "2";
        clearIcon.textContent = "✕";
        cell.appendChild(clearIcon);

        tileCells.set(tile.localIdx, cell);

        const applySelectedItemToTile = () => {
          const type = typeSelect.value as "plant" | "decor" | "mutation";
          if (currentKind === "Boardwalk" && type !== "decor") return;
          if (type !== "mutation" && isIgnoredTile(tile.localIdx)) return;
          if (isEggTile(tile.localIdx)) return;
          const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
          if (type === "mutation") {
            const obj = map[String(tile.localIdx)];
            if (!obj || typeof obj !== "object") return;
            const objType = String((obj as any).objectType || "").toLowerCase();
            if (objType !== "plant") return;
            const selected = GardenLayoutService.normalizeMutation(mutationSelect.value);
            if (!selected) {
              setTileMutations(obj, []);
            } else {
              let muts = getTileMutations(obj);
              if (muts.includes(selected)) {
                muts = muts.filter((m) => m !== selected);
              } else {
                const groupIdx = mutationGroupIndex.get(selected);
                if (groupIdx != null) {
                  muts = muts.filter((m) => mutationGroupIndex.get(m) !== groupIdx);
                }
                muts.push(selected);
              }
              setTileMutations(obj, muts);
            }
            map[String(tile.localIdx)] = obj;
            void refreshRequirementInfo();
            return;
          }
          const id = type === "plant" ? plantSelect.value : type === "decor" ? decorSelect.value : null;
          if (!id) return;
          const obj = GardenLayoutService.buildTileObject(type, id);
          if (!obj) {
            delete map[String(tile.localIdx)];
          } else {
            const prev = map[String(tile.localIdx)];
            if (
              (obj as any).objectType === "plant" &&
              prev &&
              typeof prev === "object" &&
              ((prev as any).glcMutation || (prev as any).glcMutations)
            ) {
              const prevMutations = getTileMutations(prev);
              setTileMutations(obj, prevMutations);
            }
            map[String(tile.localIdx)] = obj;
          }
          void refreshRequirementInfo();
        };

        const applySelectionToTile = () => {
          if (selectedTiles.size) {
            clearSelectedTiles();
          }
          const prev = selectedTile;
          selectedTile = tile.localIdx;
          applySelectedItemToTile();
          updateSelectionLabel();
          updateTileCell(tile.localIdx);
          if (prev != null && prev !== tile.localIdx) {
            updateTileCell(prev);
          }
        };

        const clearTileAt = () => {
          clearTileByIdx(tile.localIdx);
        };
        const applyIgnoreToTile = (remove: boolean) => {
          const set = ignoredTilesByType[currentKind];
          const had = set.has(tile.localIdx);
          if (remove) {
            if (!had) return;
            set.delete(tile.localIdx);
          } else {
            if (had) return;
            set.add(tile.localIdx);
          }
          writeIgnoredToDraft();
          updateTileCell(tile.localIdx);
          void refreshRequirementInfo();
        };

        cell.addEventListener("contextmenu", (event) => {
          event.preventDefault();
        });
        cell.addEventListener("mousedown", (event) => {
          event.preventDefault();
          if (isEggTile(tile.localIdx)) return;
          const btn = (event as MouseEvent).button;
          if (btn === 2) {
            if (typeSelect.value === "mutation") {
              isDragging = true;
              dragMode = "mutation-clear";
              clearDragActive = false;
              clearMutationByIdx(tile.localIdx);
              if (selectedTile != null) {
                const prev = selectedTile;
                selectedTile = null;
                updateSelectionLabel();
                updateTileCell(prev);
              }
              return;
            }
            isDragging = true;
            dragMode = "clear";
            clearDragActive = true;
            clearTileAt();
            if (selectedTile != null) {
              const prev = selectedTile;
              selectedTile = null;
              updateSelectionLabel();
              updateTileCell(prev);
            }
            return;
          }
          if (btn !== 0) return;
          if ((event as MouseEvent).altKey) {
            const pos = getTilePos(tile.localIdx);
            if (!pos) return;
            selectionActive = true;
            selectionAnchor = pos;
            groupDragActive = false;
            lastGroupDelta = { dx: 0, dy: 0 };
            if (selectedTile != null) {
              const prev = selectedTile;
              selectedTile = null;
              updateTileCell(prev);
            }
            selectTilesInRect(pos, pos);
            return;
          }
          isDragging = true;
          clearDragActive = false;
          if ((event as MouseEvent).shiftKey) {
            const removing = isIgnoredTile(tile.localIdx);
            dragMode = removing ? "ignore-remove" : "ignore-add";
            applyIgnoreToTile(removing);
            return;
          }
          if (selectedTiles.size > 1 && selectedTiles.has(tile.localIdx)) {
            const pos = getTilePos(tile.localIdx);
            if (!pos) return;
            groupDragActive = true;
            groupDragAnchor = pos;
            lastGroupDelta = { dx: 0, dy: 0 };
            isDragging = false;
            if (selectedTile != null) {
              const prev = selectedTile;
              selectedTile = null;
              updateSelectionLabel();
              updateTileCell(prev);
            }
            return;
          }
          dragMode = "apply";
          applySelectionToTile();
        });
        cell.addEventListener("mouseenter", () => {
          if (!isDragging) return;
          if (dragMode === "clear") {
            clearTileAt();
            return;
          }
          if (dragMode === "mutation-clear") {
            clearMutationByIdx(tile.localIdx);
            return;
          }
          if (dragMode === "ignore-add" || dragMode === "ignore-remove") {
            applyIgnoreToTile(dragMode === "ignore-remove");
            return;
          }
          if (dragMode !== "apply") {
            isDragging = false;
            return;
          }
          applySelectionToTile();
        });
        tilesWrap.appendChild(cell);
        updateTileCell(tile.localIdx);
      }
    }
  };

  tilesWrap.addEventListener("mousemove", (event) => {
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const btn = el?.closest?.("button[data-local-idx]") as HTMLButtonElement | null;
    const idx = btn ? Number(btn.dataset.localIdx) : NaN;
    if (selectionActive && selectionAnchor) {
      if (!Number.isFinite(idx)) return;
      const pos = getTilePos(idx);
      if (!pos) return;
      selectTilesInRect(selectionAnchor, pos);
      return;
    }
    if (groupDragActive && groupDragAnchor) {
      if (!Number.isFinite(idx)) return;
      const pos = getTilePos(idx);
      if (!pos) return;
      const nextDx = pos.x - groupDragAnchor.x;
      const nextDy = pos.y - groupDragAnchor.y;
      if (nextDx === lastGroupDelta.dx && nextDy === lastGroupDelta.dy) return;
      const diffDx = nextDx - lastGroupDelta.dx;
      const diffDy = nextDy - lastGroupDelta.dy;
      if (moveSelectedTilesBy(diffDx, diffDy)) {
        lastGroupDelta = { dx: nextDx, dy: nextDy };
      }
      return;
    }
    if (!isDragging || dragMode !== "clear" || !clearDragActive) return;
    if (Number.isFinite(idx)) {
      clearTileByIdx(idx);
    }
  });

  const updateTileCell = (idx: number) => {
    const cell = tileCells.get(idx);
    if (!cell) return;
    const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
    const obj = map[String(idx)];
    const label = GardenLayoutService.formatTileLabel(obj);
    cell.title = label || `Tile ${idx}`;

    const icon = cell.querySelector<HTMLDivElement>(".glc-tile-icon");
    const eggIcon = cell.querySelector<HTMLDivElement>(".glc-tile-egg");
    if (icon) {
      if (obj && typeof obj === "object") {
        const type = String((obj as any).objectType || "").toLowerCase();
        if (type === "plant") {
          const species = (obj as any).species;
          const size = SEED_ICON_PLANTS.has(species) ? SEED_ICON_SIZE : 18;
          icon.style.width = `${size}px`;
          icon.style.height = `${size}px`;
          attachSpriteIcon(icon, getPlantIconCategories(species), species, size, "editor-tile-plant");
        } else if (type === "decor") {
          icon.style.width = "20px";
          icon.style.height = "20px";
          attachSpriteIcon(icon, ["decor"], (obj as any).decorId, 18, "editor-tile-decor");
        } else {
          icon.style.width = "20px";
          icon.style.height = "20px";
          icon.replaceChildren();
        }
      } else {
        icon.style.width = "20px";
        icon.style.height = "20px";
        icon.replaceChildren();
      }
    }
    if (eggIcon) {
      if (!isEggTile(idx)) {
        eggIcon.style.display = "none";
        eggIcon.replaceChildren();
      } else {
        eggIcon.style.display = "flex";
        const liveMap = currentKind === "Dirt" ? currentGarden.tileObjects : currentGarden.boardwalkTileObjects;
        const curObj = liveMap[String(idx)];
        const eggId = curObj && typeof curObj === "object" ? String((curObj as any).eggId || "") : "";
        if (eggId) {
          const tileRef = (eggCatalog as any)?.[eggId]?.tileRef;
          const candidates = [eggId, `egg/${eggId}`, `pet/${eggId}`];
          if (Number.isFinite(tileRef)) candidates.push(String(tileRef));
          attachSpriteIcon(eggIcon, ["pet"], candidates, 18, "editor-tile-egg");
        }
      }
    }

    const clearIcon = cell.querySelector<HTMLDivElement>(".glc-tile-clear");
    if (clearIcon) {
      const isMarkedForClear = clearMarkedTiles[currentKind].has(idx);
      clearIcon.style.display = isMarkedForClear ? "flex" : "none";
    }

    const occupied = !!obj;
    const mutations = obj && typeof obj === "object" ? getTileMutations(obj) : [];
    const isMissing = missingPlantTiles.has(idx) || missingDecorTiles.has(`${currentKind}:${idx}`);
    const isSelected = selectedTile === idx || selectedTiles.has(idx);
    
    cell.style.borderImage = "none";
    cell.style.borderImageSlice = "";
    cell.style.border = "1px solid rgba(255,255,255,0.12)";
    cell.style.backgroundImage = "none";
    cell.style.backgroundOrigin = "";
    cell.style.backgroundClip = "";
    if (isIgnoredTile(idx)) {
      cell.style.borderColor = "#b266ff";
      cell.style.boxShadow = "0 0 0 2px rgba(178,102,255,0.7) inset";
    } else if (isEggTile(idx)) {
      cell.style.borderColor = "#f5c542";
      cell.style.boxShadow = "0 0 0 2px rgba(245,197,66,0.7) inset";
    } else if (isSelected) {
      cell.style.borderColor = "#3cd17a";
      cell.style.boxShadow = "0 0 0 2px rgba(60,209,122,0.7) inset";
    } else if (blockedTiles.has(idx)) {
      cell.style.borderColor = "#f5c542";
      cell.style.boxShadow = "0 0 0 2px rgba(245,197,66,0.7) inset";
    } else if (mutations.length) {
        const ordered = mutations
          .slice()
          .sort((a, b) => (mutationGroupIndex.get(a) ?? 0) - (mutationGroupIndex.get(b) ?? 0));
      const rings: string[] = [];
      let ringIndex = 0;
      for (const mutation of ordered) {
        const outline = MUTATION_OUTLINES[mutation];
        if (!outline) continue;
        if (mutation === "Rainbow") {
          cell.style.border = "2px solid transparent";
          cell.style.borderRadius = "8px";
          cell.style.backgroundImage =
            "linear-gradient(rgba(48, 58, 72, 0.9), rgba(48, 58, 72, 0.9)), linear-gradient(90deg,#ff5a5a,#ffb347,#ffe97b,#8dff8d,#6ecbff,#b28dff)";
          cell.style.backgroundOrigin = "border-box";
          cell.style.backgroundClip = "padding-box, border-box";
          ringIndex += 1;
          continue;
        }
          const baseWidth = mutation === "Gold" ? 2 : 1;
          const width = baseWidth + ringIndex;
        rings.push(`0 0 0 ${width}px ${outline.border} inset`);
        ringIndex += 1;
      }
      if (isMissing) {
        rings.push("0 0 8px 2px rgba(255,107,107,0.8)");
      }
      cell.style.boxShadow = rings.length ? rings.join(", ") : "none";
    } else if (isMissing) {
      cell.style.borderColor = "#ff6b6b";
      cell.style.boxShadow = "0 0 0 2px rgba(255,107,107,0.7) inset";
    } else if (occupied) {
      cell.style.borderColor = "#4a7dff";
      cell.style.boxShadow = "0 0 0 1px rgba(74,125,255,0.6) inset";
    } else {
      cell.style.borderColor = "rgba(255,255,255,0.12)";
      cell.style.boxShadow = "none";
    }
  };

  const refreshTiles = async () => {
    currentTiles = await GardenLayoutService.getTileGrid(currentKind);
    renderGrid();
  };


  const resetDraft = () => {
    draft = GardenLayoutService.getEmptyGarden();
    syncIgnoredFromDraft();
    selectedTile = null;
    updateSelectionLabel();
    renderGrid();
    void refreshRequirementInfo();
  };

  const loadFromCurrentGarden = async () => {
    const current = await GardenLayoutService.getCurrentGarden();
    if (current && typeof current === "object") {
      draft = stripEggs(current);
      applyGardenMutationBorders(draft);
      syncIgnoredFromDraft();
      renderGrid();
      void refreshRequirementInfo();
    } else {
    }
  };

  applyExternalGarden = (garden: any) => {
    if (garden && typeof garden === "object") {
      draft = stripEggs(garden);
      applyGardenMutationBorders(draft);
      syncIgnoredFromDraft();
      renderGrid();
      void refreshRequirementInfo();
    }
  };

  const maturePreviewObject = (obj: any) => {
    if (!obj || typeof obj !== "object") return obj;
    const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
    if (type !== "plant") return obj;
    const now = Date.now();
    const matureTs = now - 1000;
    const speciesId = String((obj as any).species || (obj as any).seedKey || "");
    const maxScale = Number((plantCatalog as Record<string, any>)?.[speciesId]?.crop?.maxScale || 1);
    const mutations = getTileMutations(obj);
    const clone = { ...(obj as any) };
    clone.plantedAt = matureTs;
    clone.maturedAt = matureTs;
    if (Array.isArray(clone.slots)) {
      clone.slots = clone.slots.map((slot: any) => ({
        ...slot,
        startTime: matureTs,
        endTime: matureTs,
        targetScale: Number.isFinite(maxScale) && maxScale > 0 ? maxScale : slot?.targetScale ?? 1,
        mutations: mutations.length ? mutations : Array.isArray(slot?.mutations) ? slot.mutations : [],
      }));
    }
    return clone;
  };

  const buildPreviewGarden = () => {
    const preview = {
      tileObjects: {},
      boardwalkTileObjects: {},
    };
    const addEggs = (currentMap: Record<string, any>, targetMap: Record<string, any>) => {
      for (const [key, obj] of Object.entries(currentMap || {})) {
        if (!obj || typeof obj !== "object") continue;
        const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
        if (type !== "egg") continue;
        targetMap[key] = obj;
      }
    };
    const applyDraft = (
      tileType: "Dirt" | "Boardwalk",
      draftMap: Record<string, any>,
      currentMap: Record<string, any>,
      targetMap: Record<string, any>
    ) => {
      const ignoredSet = tileType === "Dirt" ? ignoredTilesByType.Dirt : ignoredTilesByType.Boardwalk;
      for (const [key, obj] of Object.entries(draftMap || {})) {
        if (!obj || typeof obj !== "object") continue;
        const curObj = (currentMap || {})[key];
        const idx = Number(key);
        if (Number.isFinite(idx) && ignoredSet.has(idx)) {
          if (curObj) targetMap[key] = curObj;
          continue;
        }
        const curType = String((curObj as any)?.objectType ?? (curObj as any)?.type ?? "").toLowerCase();
        const nextType = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
        if (curType === "egg") {
          const sameEgg =
            nextType === "egg" &&
            String((obj as any).eggId ?? "") === String((curObj as any).eggId ?? "");
          if (!sameEgg) {
            if (curObj) {
              targetMap[key] = curObj;
            }
            continue;
          }
        }
        if (!previewAllToggle.checked && nextType === "plant" && Number.isFinite(idx) && missingPlantTiles.has(idx)) {
          if (curObj) {
            targetMap[key] = curObj;
          }
          continue;
        }
        if (!previewAllToggle.checked && nextType === "decor" && missingDecorTiles.has(`${tileType}:${key}`)) {
          if (curObj) {
            targetMap[key] = curObj;
          }
          continue;
        }
        targetMap[key] = maturePreviewObject(obj);
      }
    };
    addEggs(currentGarden.tileObjects || {}, preview.tileObjects);
    addEggs(currentGarden.boardwalkTileObjects || {}, preview.boardwalkTileObjects);
    applyDraft("Dirt", draft.tileObjects || {}, currentGarden.tileObjects || {}, preview.tileObjects);
    applyDraft(
      "Boardwalk",
      draft.boardwalkTileObjects || {},
      currentGarden.boardwalkTileObjects || {},
      preview.boardwalkTileObjects
    );
    return preview;
  };

  const previewLayout = async () => {
    if (previewActive) return;
    await refreshRequirementInfo();
    const previewGarden = buildPreviewGarden();
    const previewFn = (window as any)?.glcEditorPreviewFriendGarden as undefined | ((garden: any) => Promise<boolean>);
    const clearFn = (window as any)?.glcEditorClearFriendGardenPreview as undefined | (() => Promise<boolean>);
    if (typeof previewFn !== "function" || typeof clearFn !== "function") {
      return;
    }
    previewActive = true;
    await previewFn(previewGarden);
    const cleanup = () => {
      if (!previewActive) return;
      previewActive = false;
      void clearFn();
      document.removeEventListener("keydown", onEsc, true);
      if (previewTimer) window.clearTimeout(previewTimer);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup();
      }
    };
    document.addEventListener("keydown", onEsc, true);
    const previewTimer = window.setTimeout(() => {
      cleanup();
    }, 5000);
  };

  const renderSavedLayouts = () => {
    savedLayoutsWrap.innerHTML = "";
    const list = GardenLayoutService.listLayouts();
    if (!list.length) {
      const empty = document.createElement("div");
      empty.textContent = "No saved layouts yet.";
      empty.style.opacity = "0.7";
      empty.style.fontSize = "12px";
      savedLayoutsWrap.appendChild(empty);
      layoutsNaturalHeight = 0;
      requestAnimationFrame(() => {
        if (!loadoutsHidden) {
          updateLoadoutsHeight();
        }
      });
      return;
    }
    for (const g of list) {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto auto auto auto";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.padding = "10px";
      row.style.borderRadius = "10px";
      row.style.border = "1px solid #2b3441";
      row.style.background = "rgba(16,21,28,0.9)";

      const name = document.createElement("div");
      name.textContent = g.name || "Untitled";
      name.style.fontWeight = "700";
      name.style.fontSize = "15px";
      name.style.overflow = "hidden";
      name.style.textOverflow = "ellipsis";
      name.style.whiteSpace = "nowrap";
      name.style.cursor = "text";
      name.style.textAlign = "center";
      name.style.width = "100%";

      const nameInput = ui.inputText("", g.name || "Untitled");
      nameInput.style.display = "none";
      nameInput.style.width = "100%";
      nameInput.style.borderRadius = "8px";
      nameInput.style.border = "1px solid #2b3441";
      nameInput.style.background = "rgba(16,21,28,0.9)";
      nameInput.style.color = "#e7eef7";
      nameInput.style.padding = "6px 8px";
      nameInput.style.fontSize = "14px";
      nameInput.style.textAlign = "center";
      blockGameInput(nameInput);

      const beginEdit = () => {
        name.style.display = "none";
        nameInput.style.display = "block";
        nameInput.focus();
        nameInput.select();
      };
      const finishEdit = () => {
        const nextName = nameInput.value.trim() || "Untitled";
        if (GardenLayoutService.renameLayout(g.id, nextName)) {
          name.textContent = nextName;
        }
        nameInput.style.display = "none";
        name.style.display = "block";
        renderSavedLayouts();
      };

      name.addEventListener("click", beginEdit);
      nameInput.addEventListener("blur", finishEdit);
      nameInput.addEventListener("input", () => {
        const nextName = nameInput.value.trim() || "Untitled";
        if (GardenLayoutService.renameLayout(g.id, nextName)) {
          name.textContent = nextName;
        }
      });
      nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          (event.currentTarget as HTMLInputElement).blur();
          finishEdit();
        }
        if (event.key === "Escape") {
          nameInput.value = g.name || "Untitled";
          nameInput.style.display = "none";
          name.style.display = "block";
        }
      });

      const edit = ui.btn("Edit", {
        size: "md",
        onClick: () => {
          draft = g.garden;
          syncIgnoredFromDraft();
          renderGrid();
          void refreshRequirementInfo();
        },
      });
      const save = ui.btn("Save", {
        size: "md",
        onClick: () => {
          if (GardenLayoutService.updateLayout(g.id, draft)) {
            renderSavedLayouts();
          }
        },
      });
      const del = ui.btn("Delete", {
        size: "md",
        variant: "danger",
        onClick: () => {
          if (GardenLayoutService.deleteLayout(g.id)) {
            renderSavedLayouts();
          }
        },
      });

      const nameWrap = document.createElement("div");
      nameWrap.style.display = "grid";
      nameWrap.style.gridTemplateColumns = "1fr";
      nameWrap.style.justifyItems = "center";
      nameWrap.style.textAlign = "center";
      nameWrap.append(name, nameInput);
      row.append(nameWrap, edit, save, del);
      savedLayoutsWrap.appendChild(row);
    }
    layoutsNaturalHeight = 0;
    requestAnimationFrame(() => {
      if (!loadoutsHidden) {
        updateLoadoutsHeight();
      }
    });
  };

  const setActiveTab = (kind: "Dirt" | "Boardwalk") => {
    if (currentKind === "Dirt") {
      lastDirtType = typeSelect.value as "plant" | "decor" | "mutation";
    }
    currentKind = kind;
    const isDirt = kind === "Dirt";
    tabDirt.style.background = isDirt ? "#4a6fb8" : "";
    tabDirt.style.borderColor = isDirt ? "#4a6fb8" : "";
    tabBoard.style.background = !isDirt ? "#4a6fb8" : "";
    tabBoard.style.borderColor = !isDirt ? "#4a6fb8" : "";
    syncTypeOptions();
    scheduleRequirementRefresh();
  };

  tabDirt.addEventListener("click", () => {
    setActiveTab("Dirt");
    selectedTile = null;
    clearSelectedTiles();
    updateSelectionLabel();
    refreshTiles();
  });
  tabBoard.addEventListener("click", () => {
    setActiveTab("Boardwalk");
    selectedTile = null;
    clearSelectedTiles();
    updateSelectionLabel();
    refreshTiles();
  });

  const onMouseUp = () => {
    isDragging = false;
    clearDragActive = false;
    selectionActive = false;
    selectionAnchor = null;
    groupDragActive = false;
    groupDragAnchor = null;
    lastGroupDelta = { dx: 0, dy: 0 };
  };
  document.addEventListener("mouseup", onMouseUp);
  cleanup = () => {
    document.removeEventListener("mouseup", onMouseUp);
    if (reqRaf) window.cancelAnimationFrame(reqRaf);
    if (reqRefreshTimer) window.clearInterval(reqRefreshTimer);
    requirementsWin.remove();
    closeBtn?.removeEventListener("click", onClose);
  };

  // selection is single-tile only; no explicit clear button
  resetDraftBtn.addEventListener("click", () => {
    const proceed = window.confirm("Reset the current draft?");
    if (!proceed) return;
    resetDraft();
  });
  previewLayoutBtn.addEventListener("click", () => {
    void previewLayout();
  });
  loadFromGardenBtn.addEventListener("click", () => {
    void loadFromCurrentGarden();
  });

  saveLayoutBtn.addEventListener("click", () => {
    saveNewLayout();
  });
  applyLayoutBtn.addEventListener("click", async () => {
    const slotsAvailable = normalizeInventorySlots(Number(inventoryInput.value));
    inventoryInput.value = String(slotsAvailable);
    const ok = await GardenLayoutService.applyGarden(draft, {
      ignoreInventory: EditorService.isEnabled(),
      clearTargetTiles: true,
      inventorySlotsAvailable: Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0,
    });
    if (!ok) return;
    if (!clearLeftToggle.checked && !clearRightToggle.checked) return;
    const slotsLimit = Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0;
    if (slotsLimit <= 0) {
      return;
    }
    const { tasks, blocked } = await GardenLayoutService.getClearSideTasks(draft, {
      clearLeft: clearLeftToggle.checked,
      clearRight: clearRightToggle.checked,
    });
    if (!tasks.length) {
      if (blocked > 0) {
      }
      return;
    }
    if (tasks.length > slotsLimit) {
      const proceed = window.confirm(
        `Clearing ${tasks.length} items needs ${slotsLimit} free slots. Only ${slotsLimit} items will be picked up. Continue?`
      );
      if (!proceed) return;
    }
    const result = await GardenLayoutService.clearSideTasks(tasks, slotsLimit);
    const sideLabel = clearLeftToggle.checked && clearRightToggle.checked
      ? "left/right sides"
      : clearLeftToggle.checked
        ? "left side"
        : "right side";
    const skippedNote = result.skipped ? ` ${result.skipped} skipped (inventory limit).` : "";
    const blockedNote = blocked ? ` ${blocked} blocked (eggs/items).` : "";
  });
  invertLayoutBtn.addEventListener("click", async () => {
    draft = await GardenLayoutService.invertLayout(draft, currentKind);
    selectedTile = null;
    updateSelectionLabel();
    renderGrid();
    void refreshRequirementInfo();
  });

  typeSelect.addEventListener("change", () => {
    if (currentKind === "Dirt") {
      lastDirtType = typeSelect.value as "plant" | "decor" | "mutation";
    }
    updatePickerVisibility();
    updatePickerPreview();
  });
  plantSelect.addEventListener("change", updatePickerPreview);
  decorSelect.addEventListener("change", updatePickerPreview);
  mutationSelect.addEventListener("change", updatePickerPreview);
  syncTypeOptions();
  scheduleRequirementRefresh();
  reqRefreshTimer = window.setInterval(() => {
    if (document.hidden) return;
    scheduleRequirementRefresh();
  }, 2000);


  const renderPlantPickerGrid = () => {
    plantPickerGrid.replaceChildren();
    const list = GardenLayoutService.listPlantIds();
    for (const id of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.width = "36px";
      btn.style.height = "36px";
      btn.style.borderRadius = "8px";
      btn.style.border = "1px solid rgba(255,255,255,0.12)";
      btn.style.background = "rgba(48,58,72,0.9)";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.cursor = "pointer";
      btn.title = getPlantDisplayName(id);
      const size = SEED_ICON_PLANTS.has(id) ? SEED_ICON_SIZE : 22;
      attachSpriteIcon(btn, getPlantIconCategories(id), id, size, "editor-plant-picker");
      btn.addEventListener("click", () => {
        plantSelect.value = id;
        updatePickerPreview();
        plantPickerGrid.style.display = "none";
      });
      plantPickerGrid.appendChild(btn);
    }
  };
  renderPlantPickerGrid();


  const applyGardenMutationBorders = (garden: any) => {
    const applyToMap = (map: Record<string, any>) => {
      for (const obj of Object.values(map || {})) {
        if (!obj || typeof obj !== "object") continue;
        const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
        if (type !== "plant") continue;
        const rawMuts: string[] = [];
        if (Array.isArray((obj as any).slots)) {
          for (const slot of (obj as any).slots) {
            if (Array.isArray(slot?.mutations)) {
              rawMuts.push(...slot.mutations);
            }
          }
        }
        if (Array.isArray((obj as any).mutations)) {
          rawMuts.push(...(obj as any).mutations);
        }
        const normalized = new Set<string>();
        for (const mut of rawMuts) {
          const name = GardenLayoutService.normalizeMutation(String(mut || ""));
          if (name && mutationCatalog[name as keyof typeof mutationCatalog]) {
            normalized.add(name);
          }
        }
        const selected: string[] = [];
        MUTATION_GROUPS.forEach((group) => {
          for (const name of group.members) {
            if (normalized.has(name)) {
              selected.push(name);
              break;
            }
          }
        });
        setTileMutations(obj, selected);
      }
    };
    applyToMap(garden?.tileObjects || {});
    applyToMap(garden?.boardwalkTileObjects || {});
  };

  plantPickerBtn.addEventListener("click", () => {
    plantPickerGrid.style.display = plantPickerGrid.style.display === "none" ? "grid" : "none";
  });

  const renderDecorPickerGrid = () => {
    decorPickerGrid.replaceChildren();
    const list = GardenLayoutService.listDecorIds();
    for (const id of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.width = "36px";
      btn.style.height = "36px";
      btn.style.borderRadius = "8px";
      btn.style.border = "1px solid rgba(255,255,255,0.12)";
      btn.style.background = "rgba(48,58,72,0.9)";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.cursor = "pointer";
      btn.title = getDecorDisplayName(id);
      attachSpriteIcon(btn, ["decor"], id, 22, "editor-decor-picker");
      btn.addEventListener("click", () => {
        decorSelect.value = id;
        updatePickerPreview();
        decorPickerGrid.style.display = "none";
      });
      decorPickerGrid.appendChild(btn);
    }
  };
  renderDecorPickerGrid();

  decorPickerBtn.addEventListener("click", () => {
    decorPickerGrid.style.display = decorPickerGrid.style.display === "none" ? "grid" : "none";
  });

  const renderMutationPickerGrid = () => {
    mutationPickerGrid.replaceChildren();
    const list = Object.keys(mutationCatalog || {});
    for (const id of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.width = "36px";
      btn.style.height = "36px";
      btn.style.borderRadius = "8px";
      btn.style.border = "1px solid rgba(255,255,255,0.12)";
      btn.style.background = "rgba(48,58,72,0.9)";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.cursor = "pointer";
      btn.title = getMutationDisplayName(id);
      attachSpriteIcon(btn, ["mutation"], id, 22, "editor-mutation-picker");
      btn.addEventListener("click", () => {
        mutationSelect.value = id;
        updatePickerPreview();
        mutationPickerGrid.style.display = "none";
      });
      mutationPickerGrid.appendChild(btn);
    }
  };
  renderMutationPickerGrid();

  mutationPickerBtn.addEventListener("click", () => {
    mutationPickerGrid.style.display = mutationPickerGrid.style.display === "none" ? "grid" : "none";
  });
  clearLeftToggle.addEventListener("change", () => {
    void updateClearMarkers();
  });
  clearRightToggle.addEventListener("change", () => {
    void updateClearMarkers();
  });

  setActiveTab("Dirt");
  updateSelectionLabel();
  renderSavedLayouts();
  void refreshTiles();

  // layoutCard already appended
  };

  const renderDevTab = (view: HTMLElement) => {
    view.innerHTML = "";
    view.style.display = "grid";
    view.style.gap = "12px";
    view.style.justifyItems = "center";
    view.style.alignItems = "start";
    view.style.minHeight = "0";

    const card = ui.card("Dev settings", { tone: "muted", align: "center" });
    card.root.style.maxWidth = "520px";
    card.body.style.display = "grid";
    card.body.style.gap = "10px";

    const statusLine = createStatusLine();

    const selectRow = document.createElement("div");
    selectRow.style.display = "grid";
    selectRow.style.gap = "8px";

    const selectLabel = document.createElement("div");
    selectLabel.textContent = "Select player";
    selectLabel.style.opacity = "0.85";
    selectLabel.style.fontSize = "12px";

    const playerSelect = document.createElement("select");
    playerSelect.style.width = "100%";
    playerSelect.style.borderRadius = "8px";
    playerSelect.style.border = "1px solid #2b3441";
    playerSelect.style.background = "rgba(16,21,28,0.9)";
    playerSelect.style.color = "#e7eef7";
    playerSelect.style.padding = "8px 10px";
    playerSelect.style.fontSize = "14px";

    const refreshBtn = ui.btn("Refresh list", { size: "sm", variant: "ghost" });
    const loadBtn = ui.btn("Load other player's garden", { size: "sm", variant: "secondary" });

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.flexWrap = "wrap";
    buttonRow.style.gap = "8px";
    buttonRow.append(refreshBtn, loadBtn);

    const hydratePlayers = async () => {
      playerSelect.innerHTML = "";
      const list = await GardenLayoutService.listLobbyPlayers();
      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No other players found";
        playerSelect.appendChild(opt);
        playerSelect.disabled = true;
        return;
      }
      playerSelect.disabled = false;
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select a player";
      playerSelect.appendChild(placeholder);
      for (const p of list) {
        const opt = document.createElement("option");
        opt.value = p.id;
        const slotLabel = Number.isFinite(p.slotIndex as number) ? ` (#${p.slotIndex})` : "";
        opt.textContent = `${p.name}${slotLabel}`;
        playerSelect.appendChild(opt);
      }
    };

    refreshBtn.addEventListener("click", () => {
      void hydratePlayers();
    });

    loadBtn.addEventListener("click", async () => {
      const playerId = playerSelect.value;
      if (!playerId) {
        showStatus(statusLine, false, "Select a player first.");
        return;
      }
      const garden = await GardenLayoutService.getGardenForPlayerId(playerId);
      if (!garden) {
        showStatus(statusLine, false, "Unable to load that player's garden.");
        return;
      }
      if (!applyExternalGarden) {
        showStatus(statusLine, false, "Open the Layout tab once, then try again.");
        return;
      }
      applyExternalGarden(garden);
      showStatus(statusLine, true, "Loaded other player's garden into the editor.");
    });

    selectRow.append(selectLabel, playerSelect);
    card.body.append(selectRow, buttonRow, statusLine);
    view.appendChild(card.root);
    void hydratePlayers();
  };

  ui.addTab("layout", "Layout", renderLayoutTab);
  if (DEV_ONLY) {
    ui.addTab("dev-settings", "Settings", renderDevTab);
  }
  ui.mount(container);
}

function blockGameInput(el: HTMLElement) {
  const handler = (e: Event) => {
    e.stopPropagation();
  };
  ["keydown", "keypress", "keyup", "mousedown"].forEach((type) => {
    el.addEventListener(type, handler);
  });
}

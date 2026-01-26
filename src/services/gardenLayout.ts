import { Store } from "../store/api";
import type { GardenState } from "../store/atoms";
import { readAriesPath, writeAriesPath } from "../utils/localStorage";
import { tos } from "../utils/tileObjectSystemApi";
import { toastSimple } from "../ui/toast";
import { plantCatalog, decorCatalog, eggCatalog, mutationCatalog } from "../data/hardcoded-data.clean";
import { PlayerService } from "./player";

export type SavedLayout = {
  id: string;
  name: string;
  createdAt: number;
  garden: GardenState;
};

export type LobbyPlayer = {
  id: string;
  name: string;
  slotIndex: number | null;
};

export type TileEntry = {
  localIdx: number;
  x: number;
  y: number;
};

export type LayoutApplyOptions = {
  ignoreInventory?: boolean;
  clearTargetTiles?: boolean;
  inventorySlotsAvailable?: number;
};

export type LayoutImportResult = {
  success: boolean;
  message: string;
};

export type ClearSideOptions = {
  clearLeft?: boolean;
  clearRight?: boolean;
};

type InventoryCounts = {
  seeds: Map<string, number>;
  plants: Map<string, number>;
  decors: Map<string, number>;
  eggs: Map<string, number>;
  tools: Map<string, number>;
};

type InventoryDebugEntry = {
  name: string;
  quantity: number;
  itemType: string;
  raw?: {
    id?: unknown;
    toolId?: unknown;
    itemId?: unknown;
    name?: unknown;
    itemName?: unknown;
    itemType?: unknown;
    dataName?: unknown;
    dataId?: unknown;
    dataToolId?: unknown;
    dataItemId?: unknown;
  };
};

type InventoryDebugSnapshot = {
  itemsCount: number;
  toolEntries: InventoryDebugEntry[];
  potLikeEntries: InventoryDebugEntry[];
  typeCounts: Record<string, number>;
  toolRawItems: Array<Record<string, unknown>>;
};

let lastInventoryDebug: InventoryDebugSnapshot | null = null;
let applyCancelRequested = false;

type ClearTask = {
  tileType: "Dirt" | "Boardwalk";
  localIdx: number;
  action: "pot" | "pickup";
};

type MissingItem = {
  type: "plant" | "decor" | "egg";
  id: string;
  mutation?: string;
  needed: number;
  have: number;
};

type RequirementSummary = {
  type: "plant" | "decor";
  id: string;
  mutation?: string;
  needed: number;
  have: number;
};

const ARIES_LAYOUTS_PATH = "editor.savedGardens";
const LEGACY_LAYOUTS_PATH = "editor.savedLayouts";
const LEGACY_LAYOUTS_KEY = "qws:editor:saved-layouts";
const MAX_LAYOUTS = 50;

const EMPTY_GARDEN: GardenState = { tileObjects: {}, boardwalkTileObjects: {}, ignoredTiles: { dirt: [], boardwalk: [] } };
let previewBackup: { garden: GardenState; userSlotIdx: number } | null = null;
let previewActive = false;
const PLANT_DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  DawnCelestial: "Dawnbinder",
  MoonCelestial: "Moonbinder",
  Starweaver: "Starweaver",
  Lychee: "Lychee",
  Cacao: "Cacao",
};

export const GardenLayoutService = {
  listLayouts(): SavedLayout[] {
    return readLayouts();
  },

  async previewGarden(garden: GardenState | null): Promise<boolean> {
    if (!garden || typeof garden !== "object") return false;
    try {
      const pid = await getPlayerId();
      if (!pid) return false;
      const userSlotIdx = await getUserSlotIdx(pid);
      if (!Number.isFinite(userSlotIdx)) return false;
      const currentGarden = (await getGardenForPlayer(pid)) || EMPTY_GARDEN;
      previewBackup = { garden: sanitizeGardenForPreview(currentGarden), userSlotIdx: userSlotIdx as number };
      await applyGardenToTos(sanitizeGardenForPreview(garden), userSlotIdx as number);
      previewActive = true;
      return true;
    } catch {
      previewActive = false;
      return false;
    }
  },

  async clearPreview(): Promise<boolean> {
    if (!previewActive) return false;
    previewActive = false;
    try {
      const backup = previewBackup;
      previewBackup = null;
      if (backup) {
        await applyGardenToTos(backup.garden, backup.userSlotIdx);
      }
      return true;
    } catch {
      return false;
    }
  },

  saveLayout(name: string, garden: GardenState): SavedLayout {
    const now = Date.now();
    const all = readLayouts();
    const baseName = name?.trim() || "Untitled";
    const gardenData = sanitizeGarden(garden);
    const saved: SavedLayout = {
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      name: baseName,
      createdAt: now,
      garden: { ...(gardenData as any), name: baseName },
    };

    all.unshift(saved);
    const updated = all.slice(0, MAX_LAYOUTS);
    writeLayouts(updated);
    return saved;
  },

  deleteLayout(id: string): boolean {
    if (!id) return false;
    const all = readLayouts();
    const next = all.filter((g) => g.id !== id);
    if (next.length === all.length) return false;
    writeLayouts(next);
    return true;
  },

  renameLayout(id: string, name: string): boolean {
    if (!id) return false;
    const nextName = String(name || "").trim();
    if (!nextName) return false;
    const all = readLayouts();
    const idx = all.findIndex((g) => g.id === id);
    if (idx < 0) return false;
    const updated = all.map((g, i) =>
      i === idx ? { ...g, name: nextName, garden: { ...(g.garden as any), name: nextName } } : g
    );
    writeLayouts(updated);
    return true;
  },

  updateLayout(id: string, garden: GardenState): boolean {
    if (!id) return false;
    const all = readLayouts();
    const idx = all.findIndex((g) => g.id === id);
    if (idx < 0) return false;
    const existing = all[idx];
    const nextGarden = sanitizeGarden(garden);
    const updated = all.map((g, i) =>
      i === idx
        ? {
            ...g,
            createdAt: Date.now(),
            garden: { ...(nextGarden as any), name: existing.name },
          }
        : g
    );
    writeLayouts(updated);
    return true;
  },

  async getRequirementSummary(garden: GardenState): Promise<RequirementSummary[]> {
    const requiredDecors = new Map<string, number>();
    const aliasMap = getPlantAliasMap();

    const registerDecor = (map: Map<string, number>, id: string | null) => {
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    };

    const requiredPlants = collectRequiredPlants(garden, aliasMap);
    registerRequiredDecors(requiredDecors, garden);

    const inventory = await getInventoryCounts();
    const current = await getCurrentGarden();
    const linkedAvailability = await getLinkedAvailability(requiredPlants, current, aliasMap, garden);
    const gardenDecorCounts = current
      ? countGardenDecors(
          current,
          getIgnoredSet(garden, "Dirt"),
          getIgnoredSet(garden, "Boardwalk")
        )
      : new Map<string, number>();

    const summary: RequirementSummary[] = [];
    for (const entry of requiredPlants.values()) {
      const id = entry.id;
      const mutations = entry.mutations;
      const key = mutationSetKey(id, mutations);
      const have = mutations.length
        ? linkedAvailability.mutation.get(key) || 0
        : linkedAvailability.base.get(id) || 0;
      summary.push({
        type: "plant",
        id,
        mutation: mutations.length ? mutations.join("+") : undefined,
        needed: entry.needed,
        have,
      });
    }
    for (const [id, needed] of requiredDecors) {
      const have = (inventory.decors.get(id) || 0) + (gardenDecorCounts.get(id) || 0);
      summary.push({ type: "decor", id, needed, have });
    }

    summary.sort((a, b) => {
      if (a.type !== b.type) return a.type === "plant" ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    return summary;
  },

  async getLinkedPlantAvailability(
    garden: GardenState
  ): Promise<{ base: Map<string, number>; mutation: Map<string, number> }> {
    const aliasMap = getPlantAliasMap();
    const requiredPlants = collectRequiredPlants(garden, aliasMap);
    const current = await getCurrentGarden();
    return getLinkedAvailability(requiredPlants, current, aliasMap, garden);
  },

  async getPlanterPotRequirement(
    garden: GardenState,
    currentGarden: GardenState
  ): Promise<{ needed: number; owned: number }> {
    const needed = await calculatePlanterPotsNeeded(garden, currentGarden);
    const inventory = await getInventoryCounts();
    const owned =
      inventory.tools.get("Planter Pot") ||
      inventory.tools.get("PlanterPot") ||
      0;
    return { needed, owned };
  },

  getBlockedTargetTiles(currentGarden: GardenState, targetGarden: GardenState): number[] {
    return getBlockedTargetTilesFromState(currentGarden, targetGarden);
  },

  getDraftRemovalTiles(
    garden: GardenState,
    currentGarden: GardenState
  ): { Dirt: Set<number>; Boardwalk: Set<number> } {
    const removal: { Dirt: Set<number>; Boardwalk: Set<number> } = {
      Dirt: new Set(),
      Boardwalk: new Set(),
    };

    const add = (tileType: "Dirt" | "Boardwalk", idx: number) => {
      if (Number.isFinite(idx)) removal[tileType].add(idx);
    };

    const checkMap = (
      tileType: "Dirt" | "Boardwalk",
      currentMap: Record<string, any>,
      draftMap: Record<string, any>
    ) => {
      const ignored = getIgnoredSet(garden, tileType);
      for (const [key, curObj] of Object.entries(currentMap || {})) {
        const idx = Number(key);
        if (Number.isFinite(idx) && ignored.has(idx)) continue;
        if (!curObj || typeof curObj !== "object") continue;
        const draftObj = draftMap?.[key];
        if (!draftObj || typeof draftObj !== "object") {
          add(tileType, idx);
          continue;
        }
        if (!isSameTileObject(curObj, draftObj)) {
          add(tileType, idx);
          continue;
        }
        const curType = String((curObj as any).objectType ?? (curObj as any).type ?? "").toLowerCase();
        if (curType === "plant") {
          const desiredMutations = getDesiredMutations(draftObj);
          if (desiredMutations.length && !plantHasMutationsInclusive(curObj, desiredMutations)) {
            add(tileType, idx);
          }
        }
      }
    };

    checkMap("Dirt", currentGarden.tileObjects || {}, garden.tileObjects || {});
    checkMap("Boardwalk", currentGarden.boardwalkTileObjects || {}, garden.boardwalkTileObjects || {});

    return removal;
  },

  resolvePlantSpecies(raw: string): string {
    const aliasMap = getPlantAliasMap();
    return resolvePlantSpeciesKey(String(raw || ""), aliasMap);
  },
  normalizeMutation(raw: string): string {
    return normalizeMutationTag(raw);
  },

  async getPlantAvailabilityCounts(ignoredTiles?: GardenState["ignoredTiles"]): Promise<Map<string, number>> {
    const aliasMap = getPlantAliasMap();
    const inventory = await getInventoryCounts();
    const current = await getCurrentGarden();
    const ignored = new Set<number>(
      Array.isArray(ignoredTiles?.dirt) ? ignoredTiles!.dirt!.filter((n) => Number.isFinite(n)) : []
    );
    const gardenPlantCounts = current ? countGardenPlants(current, aliasMap, ignored) : new Map<string, number>();
    const combined = new Map<string, number>();
    for (const [id, count] of inventory.plants) {
      addCount(combined, id, count);
    }
    for (const [id, count] of gardenPlantCounts) {
      addCount(combined, id, count);
    }
    return combined;
  },

  async getPlantAvailabilityMutationCounts(
    ignoredTiles?: GardenState["ignoredTiles"]
  ): Promise<Map<string, number>> {
    const aliasMap = getPlantAliasMap();
    const inventory = await getInventoryPlantMutationCounts(aliasMap);
    const current = await getCurrentGarden();
    const ignored = new Set<number>(
      Array.isArray(ignoredTiles?.dirt) ? ignoredTiles!.dirt!.filter((n) => Number.isFinite(n)) : []
    );
    const gardenMutationCounts = current
      ? countGardenPlantsByMutation(current, aliasMap, ignored)
      : new Map<string, number>();
    const combined = new Map<string, number>();
    for (const [key, count] of inventory) {
      addCount(combined, key, count);
    }
    for (const [key, count] of gardenMutationCounts) {
      addCount(combined, key, count);
    }
    return combined;
  },

  async getDecorAvailabilityCounts(ignoredTiles?: GardenState["ignoredTiles"]): Promise<Map<string, number>> {
    const inventory = await getInventoryCounts();
    const current = await getCurrentGarden();
    const ignoredDirt = new Set<number>(
      Array.isArray(ignoredTiles?.dirt) ? ignoredTiles!.dirt!.filter((n) => Number.isFinite(n)) : []
    );
    const ignoredBoard = new Set<number>(
      Array.isArray(ignoredTiles?.boardwalk) ? ignoredTiles!.boardwalk!.filter((n) => Number.isFinite(n)) : []
    );
    const gardenDecorCounts = current
      ? countGardenDecors(current, ignoredDirt, ignoredBoard)
      : new Map<string, number>();
    const combined = new Map<string, number>();
    for (const [id, count] of inventory.decors) {
      addCount(combined, id, count);
    }
    for (const [id, count] of gardenDecorCounts) {
      addCount(combined, id, count);
    }
    return combined;
  },

  exportLayout(id: string): string | null {
    if (!id) return null;
    const all = readLayouts();
    const found = all.find((g) => g.id === id);
    if (!found) return null;
    return JSON.stringify(found.garden, null, 2);
  },

  exportLoadouts(): string {
    return JSON.stringify(readLayouts(), null, 2);
  },

  importLoadouts(payload: string): LayoutImportResult {
    if (!payload) return { success: false, message: "Import payload is empty." };
    try {
      const parsed = JSON.parse(payload);
      const list = normalizeImportedLayouts(parsed);
      if (!list.length) {
        return { success: false, message: "No valid loadouts found in JSON." };
      }
      writeLayouts(list.slice(0, MAX_LAYOUTS));
      return { success: true, message: `Imported ${list.length} loadout(s).` };
    } catch {
      return { success: false, message: "Invalid JSON payload." };
    }
  },

  importLayout(name: string, raw: string): SavedLayout | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const garden = sanitizeGarden(parsed);
      const now = Date.now();
    const gardenData = sanitizeGarden(parsed);
    const saved: SavedLayout = {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        name: name?.trim() || "Imported layout",
        createdAt: now,
      garden: { ...(gardenData as any), name: name?.trim() || "Imported layout" },
      };
      const all = readLayouts();
      all.unshift(saved);
      writeLayouts(all.slice(0, MAX_LAYOUTS));
      return saved;
    } catch {
      return null;
    }
  },

  getEmptyGarden(): GardenState {
    return { tileObjects: {}, boardwalkTileObjects: {}, ignoredTiles: { dirt: [], boardwalk: [] } };
  },

  async getCurrentGarden(): Promise<GardenState | null> {
    return getCurrentGarden();
  },

  async listLobbyPlayers(): Promise<LobbyPlayer[]> {
    return await listLobbyPlayers();
  },

  async getGardenForPlayerId(playerId: string): Promise<GardenState | null> {
    return await getGardenForPlayer(playerId);
  },

  async getInventoryFreeSlots(): Promise<{ usedSlots: number; capacity: number; freeSlots: number } | null> {
    return resolveInventoryFreeSlots();
  },

  async getTileGrid(type: "Dirt" | "Boardwalk"): Promise<TileEntry[]> {
    const pid = await getPlayerId();
    if (!pid) return [];
    const cur = await Store.select<any>("stateAtom");
    const slots = cur?.child?.data?.userSlots;
    const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
    if (!slotMatch || !slotMatch.matchSlot) return [];
    const userSlotIdx = slotMatchToIndex(slotMatch);

    const mapData = await Store.select<any>("mapAtom");
    const cols = Number((mapData as any)?.cols);
    if (!mapData || !Number.isFinite(cols)) return [];

    const source =
      type === "Dirt"
        ? (mapData as any)?.globalTileIdxToDirtTile || {}
        : (mapData as any)?.globalTileIdxToBoardwalk || {};

    const out: TileEntry[] = [];
    for (const [gidxStr, v] of Object.entries(source)) {
      if (Number((v as any)?.userSlotIdx) !== userSlotIdx) continue;
      const gidx = Number(gidxStr);
      if (!Number.isFinite(gidx)) continue;
      const localIdx =
        type === "Dirt"
          ? Number((v as any)?.dirtTileIdx ?? -1)
          : Number((v as any)?.boardwalkTileIdx ?? -1);
      if (!Number.isFinite(localIdx) || localIdx < 0) continue;
      out.push({ localIdx, x: gidx % cols, y: Math.floor(gidx / cols) });
    }

    return out;
  },

  async getClearSideTasks(
    draftGarden: GardenState,
    opts: ClearSideOptions
  ): Promise<{ tasks: ClearTask[]; blocked: number }> {
    const clearLeft = !!opts.clearLeft;
    const clearRight = !!opts.clearRight;
    if (!clearLeft && !clearRight) return { tasks: [], blocked: 0 };
    const current = await getCurrentGarden();
    if (!current) return { tasks: [], blocked: 0 };
    const [dirtTiles, boardTiles] = await Promise.all([
      this.getTileGrid("Dirt"),
      this.getTileGrid("Boardwalk"),
    ]);
    const tasks: ClearTask[] = [];
    let blocked = 0;
    const ignoredDirt = getIgnoredSet(draftGarden, "Dirt");
    const ignoredBoardwalk = getIgnoredSet(draftGarden, "Boardwalk");

    const gatherTasks = (
      tileType: "Dirt" | "Boardwalk",
      tiles: TileEntry[],
      draftMap: Record<string, any>,
      currentMap: Record<string, any>
    ) => {
      const bounds = getTileBounds(tiles);
      if (!bounds) return;
      for (const entry of tiles) {
        const ignored = tileType === "Dirt" ? ignoredDirt : ignoredBoardwalk;
        if (ignored.has(entry.localIdx)) continue;
        const side = getTileSide(entry.x, bounds);
        if (side === "left" && !clearLeft) continue;
        if (side === "right" && !clearRight) continue;
        if (draftMap[String(entry.localIdx)]) continue;
        const obj = currentMap[String(entry.localIdx)];
        if (!obj || typeof obj !== "object") continue;
        const objType = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
        if (objType === "plant") {
          tasks.push({ tileType: "Dirt", localIdx: entry.localIdx, action: "pot" });
        } else if (objType === "decor") {
          tasks.push({ tileType, localIdx: entry.localIdx, action: "pickup" });
        } else {
          blocked += 1;
        }
      }
    };

    gatherTasks("Dirt", dirtTiles, draftGarden.tileObjects || {}, current.tileObjects || {});
    gatherTasks(
      "Boardwalk",
      boardTiles,
      draftGarden.boardwalkTileObjects || {},
      current.boardwalkTileObjects || {}
    );
    return { tasks, blocked };
  },

  async clearSideTasks(tasks: ClearTask[], slotsAvailable: number): Promise<{ cleared: number; skipped: number }> {
    let slotsLeft = Math.max(0, Math.floor(Number(slotsAvailable) || 0));
    let cleared = 0;
    for (const task of tasks) {
      if (slotsLeft <= 0) break;
      try {
        if (task.action === "pot") {
          await PlayerService.potPlant(task.localIdx);
        } else {
          await PlayerService.pickupDecor(task.tileType, task.localIdx);
        }
      } catch {
      }
      slotsLeft -= 1;
      cleared += 1;
      await delay(60);
    }
    const skipped = Math.max(0, tasks.length - cleared);
    return { cleared, skipped };
  },

  async invertLayout(garden: GardenState, tileType?: "Dirt" | "Boardwalk"): Promise<GardenState> {
    const safe = sanitizeGarden(garden);
    const [dirtTiles, boardTiles] = await Promise.all([
      this.getTileGrid("Dirt"),
      this.getTileGrid("Boardwalk"),
    ]);
    const ignoredDirt = getIgnoredSet(safe, "Dirt");
    const ignoredBoardwalk = getIgnoredSet(safe, "Boardwalk");
    const nextTileObjects =
      tileType === "Boardwalk" ? safe.tileObjects || {} : mirrorTileMap(safe.tileObjects || {}, dirtTiles);
    const nextBoardwalkObjects =
      tileType === "Dirt" ? safe.boardwalkTileObjects || {} : mirrorTileMap(safe.boardwalkTileObjects || {}, boardTiles);
    const keepEggs = (source: Record<string, any>, target: Record<string, any>) => {
      for (const [key, obj] of Object.entries(source || {})) {
        if (!obj || typeof obj !== "object") continue;
        const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
        if (type !== "egg") continue;
        target[key] = obj;
      }
    };
    keepEggs(safe.tileObjects || {}, nextTileObjects as Record<string, any>);
    keepEggs(safe.boardwalkTileObjects || {}, nextBoardwalkObjects as Record<string, any>);
    return {
      tileObjects: nextTileObjects,
      boardwalkTileObjects: nextBoardwalkObjects,
      ignoredTiles: {
        dirt: tileType === "Boardwalk" ? Array.from(ignoredDirt.values()) : mirrorIgnoredTiles(ignoredDirt, dirtTiles),
        boardwalk:
          tileType === "Dirt" ? Array.from(ignoredBoardwalk.values()) : mirrorIgnoredTiles(ignoredBoardwalk, boardTiles),
      },
    };
  },

  buildTileObject(
    type: "empty" | "plant" | "decor" | "egg",
    id: string | null
  ): any | null {
    if (type === "empty") return null;
    if (!id) return null;

    const now = Date.now();
    if (type === "plant") {
      const info = (plantCatalog as Record<string, any>)[id];
      const slotCount = Array.isArray(info?.plant?.slotOffsets) ? info.plant.slotOffsets.length : 1;
      const secondsToMature = Number(info?.plant?.secondsToMature) || 60;
      const end = now + secondsToMature * 1000;
      const slots = Array.from({ length: slotCount }, () => ({
        species: id,
        startTime: now,
        endTime: end,
        targetScale: 1,
        mutations: [],
      }));
      return {
        objectType: "plant",
        species: id,
        seedKey: id,
        plantedAt: now,
        maturedAt: end,
        slots,
      };
    }

    if (type === "decor") {
      return {
        objectType: "decor",
        decorId: id,
        rotation: 0,
      };
    }

    return {
      objectType: "egg",
      eggId: id,
      plantedAt: now,
      maturedAt: now + 60 * 1000,
    };
  },

  formatTileLabel(obj: any): string {
    if (!obj) return "";
    const typ = String(obj.objectType || "");
    if (typ === "plant") {
      const species = String(obj.species || "");
      const display =
        PLANT_DISPLAY_NAME_OVERRIDES[species] ||
        plantCatalog[species]?.crop?.name ||
        plantCatalog[species]?.plant?.name;
      const mutations = getDesiredMutations(obj);
      const base = display || species || "Plant";
      return mutations.length ? `${base} (${mutations.join("+")})` : base;
    }
    if (typ === "decor") {
      const decorId = String(obj.decorId || "");
      return decorCatalog[decorId]?.name || decorId || "Decor";
    }
    if (typ === "egg") {
      const eggId = String(obj.eggId || "");
      return eggCatalog[eggId]?.name || eggId || "Egg";
    }
    return "Item";
  },

  async applyGarden(garden: GardenState, opts: LayoutApplyOptions = {}): Promise<boolean> {
    applyCancelRequested = false;
    const current = await getCurrentGarden();
    if (current) {
      const blocked = await getBlockedTargetTilesAsync(current, garden);
      if (blocked.length && !opts.clearTargetTiles) {
        const details = describeBlockedTiles(current, blocked).slice(0, 5).join(", ");
        await toastSimple(
          "Garden Layout",
          `Clear target tiles first. Blocked: ${details || blocked.length}`,
          "error"
        );
        return false;
      }
    }

    if (!opts.ignoreInventory) {
      const inventory = await getInventoryCounts();
      const missing = await buildMissingItems(garden, inventory, opts.clearTargetTiles ? current : null);
      if (missing.length) {
        await toastSimple("Garden Layout", `Missing items: ${formatMissingSummary(missing)}`, "error");
      }
    }

    if (opts.clearTargetTiles) {
      const blocked = current ? await getBlockedTargetTilesAsync(current, garden) : [];
      return applyGardenServerWithPotting(garden, blocked, {
        inventorySlotsAvailable: opts.inventorySlotsAvailable,
        allowClientSide: opts.ignoreInventory,
      });
    }

    if (opts.ignoreInventory) return setCurrentGarden(garden);

    await toastSimple("Garden Layout", "Applying layout...", "info", 2000);
    return applyGardenServer(garden);
  },

  async applySavedLayout(id: string, opts: LayoutApplyOptions = {}): Promise<boolean> {
    if (!id) return false;
    const all = readLayouts();
    const found = all.find((g) => g.id === id);
    if (!found) return false;
    return this.applyGarden(found.garden, opts);
  },

  cancelApply() {
    applyCancelRequested = true;
  },

  listPlantIds(): string[] {
    return Object.keys(plantCatalog || {});
  },

  listDecorIds(): string[] {
    return Object.keys(decorCatalog || {});
  },

  listEggIds(): string[] {
    return Object.keys(eggCatalog || {});
  },

  async debugPlantInventory(): Promise<void> {
    const snapshot = await readPlantInventoryDebugSnapshot();
    const total = snapshot.length;
    if (!total) {
      await toastSimple("Garden Layout", "No plant items found in inventory.", "info", 2500);
      return;
    }
    const preview = snapshot
      .slice(0, 5)
      .map((entry) => `${entry.species || "?"}:${entry.id || "?"}`)
      .join(", ");
    await toastSimple(
      "Garden Layout",
      `Plant items: ${total}. Sample: ${preview || "n/a"}`,
      "info",
      3500
    );
    try {
      console.log("[GLC GardenLayout] Plant inventory snapshot", snapshot);
    } catch {}
  },
};

type RequiredPlantEntry = { id: string; mutations: string[]; needed: number };

function collectRequiredPlants(garden: GardenState, aliasMap: Map<string, string>): Map<string, RequiredPlantEntry> {
  const requiredPlants = new Map<string, RequiredPlantEntry>();
  const registerPlant = (id: string | null, mutations: string[]) => {
    if (!id) return;
    const key = mutationSetKey(id, mutations);
    const entry = requiredPlants.get(key);
    if (entry) {
      entry.needed += 1;
    } else {
      requiredPlants.set(key, { id, mutations, needed: 1 });
    }
  };
  const mapEntries: Array<["Dirt" | "Boardwalk", Record<string, any>]> = [
    ["Dirt", garden?.tileObjects || {}],
    ["Boardwalk", garden?.boardwalkTileObjects || {}],
  ];
  for (const [tileType, map] of mapEntries) {
    const ignored = getIgnoredSet(garden, tileType);
    for (const [key, obj] of Object.entries(map)) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type !== "plant") continue;
      const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
      const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      const mutations = getDesiredMutations(obj);
      registerPlant(species || null, mutations);
    }
  }
  return requiredPlants;
}

function registerRequiredDecors(requiredDecors: Map<string, number>, garden: GardenState): void {
  const mapEntries: Array<["Dirt" | "Boardwalk", Record<string, any>]> = [
    ["Dirt", garden?.tileObjects || {}],
    ["Boardwalk", garden?.boardwalkTileObjects || {}],
  ];
  for (const [tileType, map] of mapEntries) {
    const ignored = getIgnoredSet(garden, tileType);
    for (const [key, obj] of Object.entries(map)) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type !== "decor") continue;
      const decorId = String((obj as any).decorId || (obj as any).id || "");
      if (!decorId) continue;
      requiredDecors.set(decorId, (requiredDecors.get(decorId) || 0) + 1);
    }
  }
}

async function getLinkedAvailability(
  requiredPlants: Map<string, RequiredPlantEntry>,
  current: GardenState | null,
  aliasMap: Map<string, string>,
  garden: GardenState
): Promise<{ base: Map<string, number>; mutation: Map<string, number> }> {
  const plantInstances = await buildPlantInstances(current, aliasMap, garden);
  return computeLinkedAvailability(requiredPlants, plantInstances);
}

async function buildPlantInstances(
  current: GardenState | null,
  aliasMap: Map<string, string>,
  garden: GardenState
): Promise<Map<string, string[][]>> {
  const instances = new Map<string, string[][]>();
  const addInstance = (species: string, mutations: string[]) => {
    if (!species) return;
    if (!instances.has(species)) instances.set(species, []);
    instances.get(species)!.push(mutations);
  };

  const invBySpecies = await readPlantInventoryBySpeciesWithMutations(aliasMap);
  for (const [species, entries] of invBySpecies.entries()) {
    for (const entry of entries) {
      addInstance(species, entry.mutations || []);
    }
  }

  if (current) {
    const ignored = getIgnoredSet(garden, "Dirt");
    for (const [key, obj] of Object.entries(current.tileObjects || {})) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type !== "plant") continue;
      const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
      const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      const mutations = getPlantMutations(obj);
      addInstance(species, mutations);
    }
  }
  return instances;
}

function computeLinkedAvailability(
  requiredPlants: Map<string, RequiredPlantEntry>,
  plantInstances: Map<string, string[][]>
): { base: Map<string, number>; mutation: Map<string, number> } {
  const base = new Map<string, number>();
  const mutation = new Map<string, number>();
  const reqsBySpecies = new Map<
    string,
    { mutationReqs: Array<{ mutations: string[]; needed: number; key: string }> }
  >();

  for (const entry of requiredPlants.values()) {
    if (!reqsBySpecies.has(entry.id)) {
      reqsBySpecies.set(entry.id, { mutationReqs: [] });
    }
    if (entry.mutations.length) {
      reqsBySpecies
        .get(entry.id)!
        .mutationReqs.push({ mutations: entry.mutations, needed: entry.needed, key: mutationSetKey(entry.id, entry.mutations) });
    }
  }

  const allocatePlantsForMutationSet = (plants: string[][], required: string[], maxCount: number): number => {
    const limit = Math.max(0, Math.floor(maxCount));
    if (!limit) return 0;
    const candidates = plants
      .map((mutations, idx) => ({
        idx,
        len: Array.isArray(mutations) ? mutations.length : 0,
        matches: required.every((mutationName) => hasMutation(mutations, mutationName)),
      }))
      .filter((candidate) => candidate.matches)
      .sort((a, b) => a.len - b.len);
    const selected = candidates.slice(0, limit).map((candidate) => candidate.idx).sort((a, b) => b - a);
    for (const idx of selected) {
      plants.splice(idx, 1);
    }
    return selected.length;
  };

  for (const [species, reqs] of reqsBySpecies.entries()) {
    const plants = (plantInstances.get(species) || []).map((muts) => muts.slice());
    const remaining = plants.slice();
    const mutationReqs = reqs.mutationReqs
      .slice()
      .sort((a, b) => b.mutations.length - a.mutations.length || b.needed - a.needed);
    for (const req of mutationReqs) {
      const allocated = allocatePlantsForMutationSet(remaining, req.mutations, req.needed);
      mutation.set(req.key, allocated);
    }
    base.set(species, remaining.length);
  }

  return { base, mutation };
}

function readLayouts(): SavedLayout[] {
  const parseList = (parsed: unknown): SavedLayout[] => {
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr
      .map((g) => ({
        id: String((g as any)?.id || ""),
        name: String((g as any)?.name || (g as any)?.garden?.name || "Untitled"),
        createdAt: Number((g as any)?.createdAt) || Date.now(),
        garden: sanitizeGarden((g as any)?.garden || {}),
      }))
      .filter((g) => !!g.id);
  };
  try {
    const parsed = readAriesPath<unknown>(ARIES_LAYOUTS_PATH);
    if (Array.isArray(parsed)) {
      return parseList(parsed);
    }
  } catch {
    /* ignore */
  }
  try {
    const parsed = readAriesPath<unknown>(LEGACY_LAYOUTS_PATH);
    const list = parseList(parsed);
    if (list.length) {
      writeLayouts(list);
    }
    return list;
  } catch {
    /* ignore */
  }
  try {
    const raw = typeof window !== "undefined" ? window.localStorage?.getItem(LEGACY_LAYOUTS_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = parseList(parsed);
    if (list.length) {
      writeLayouts(list);
    }
    return list;
  } catch {
    return [];
  }
}

function writeLayouts(list: SavedLayout[]) {
  try {
    writeAriesPath(ARIES_LAYOUTS_PATH, list || []);
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.setItem(LEGACY_LAYOUTS_KEY, JSON.stringify(list || []));
    }
  } catch {
    /* ignore */
  }
}

function normalizeImportedLayouts(raw: any): SavedLayout[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: SavedLayout[] = [];
  for (const g of arr) {
    if (!g || typeof g !== "object") continue;
    const id = String((g as any)?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const name = String((g as any)?.name || (g as any)?.garden?.name || "Untitled").trim() || "Untitled";
    const createdAt = Number((g as any)?.createdAt) || Date.now();
    const garden = sanitizeGarden((g as any)?.garden || {});
    out.push({
      id,
      name,
      createdAt,
      garden: { ...(garden as any), name },
    });
  }
  return out;
}

function sanitizeGarden(val: any): GardenState {
  const tileObjects = val && typeof val === "object" && typeof val.tileObjects === "object" ? val.tileObjects : {};
  const boardwalkTileObjects =
    val && typeof val === "object" && typeof val.boardwalkTileObjects === "object"
      ? val.boardwalkTileObjects
      : {};
  const ignoredTiles = sanitizeIgnoredTiles(val?.ignoredTiles);
  const stripEggs = (map: Record<string, any>) => {
    const next: Record<string, any> = {};
    for (const [key, obj] of Object.entries(map || {})) {
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || (obj as any).type || "").toLowerCase();
      if (type === "egg") continue;
      next[key] = obj;
    }
    return next;
  };
  return {
    tileObjects: stripEggs(tileObjects),
    boardwalkTileObjects: stripEggs(boardwalkTileObjects),
    ignoredTiles,
  };
}

function sanitizeGardenForPreview(val: any): GardenState {
  const tileObjects = val && typeof val === "object" && typeof val.tileObjects === "object" ? val.tileObjects : {};
  const boardwalkTileObjects =
    val && typeof val === "object" && typeof val.boardwalkTileObjects === "object"
      ? val.boardwalkTileObjects
      : {};
  const ignoredTiles = sanitizeIgnoredTiles(val?.ignoredTiles);
  return {
    tileObjects: { ...(tileObjects as any) },
    boardwalkTileObjects: { ...(boardwalkTileObjects as any) },
    ignoredTiles,
  };
}

function sanitizeIgnoredTiles(raw: any): { dirt: number[]; boardwalk: number[] } {
  const dirt = Array.isArray(raw?.dirt) ? raw.dirt : Array.isArray(raw?.Dirt) ? raw.Dirt : [];
  const boardwalk = Array.isArray(raw?.boardwalk) ? raw.boardwalk : Array.isArray(raw?.Boardwalk) ? raw.Boardwalk : [];
  const clean = (list: any[]) =>
    Array.from(
      new Set(
        list
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n >= 0)
          .map((n) => Math.floor(n))
      )
    );
  return { dirt: clean(dirt), boardwalk: clean(boardwalk) };
}

function getTileBounds(tiles: TileEntry[]): { minX: number; maxX: number } | null {
  if (!tiles.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const entry of tiles) {
    minX = Math.min(minX, entry.x);
    maxX = Math.max(maxX, entry.x);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return { minX, maxX };
}

function getTileSide(x: number, bounds: { minX: number; maxX: number }): "left" | "right" {
  const mid = bounds.minX + Math.floor((bounds.maxX - bounds.minX) / 2);
  return x <= mid ? "left" : "right";
}

function getIgnoredSet(garden: GardenState | null | undefined, tileType: "Dirt" | "Boardwalk"): Set<number> {
  const raw = tileType === "Dirt" ? garden?.ignoredTiles?.dirt : garden?.ignoredTiles?.boardwalk;
  if (!Array.isArray(raw)) return new Set<number>();
  return new Set(
    raw
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .map((n) => Math.floor(n))
  );
}

function mirrorTileMap(source: Record<string, any>, tiles: TileEntry[]): Record<string, any> {
  if (!tiles.length) return { ...source };
  let minX = Infinity;
  let maxX = -Infinity;
  const coordToLocal = new Map<string, number>();
  for (const entry of tiles) {
    minX = Math.min(minX, entry.x);
    maxX = Math.max(maxX, entry.x);
    coordToLocal.set(`${entry.x},${entry.y}`, entry.localIdx);
  }
  const next: Record<string, any> = {};
  for (const entry of tiles) {
    const obj = source[String(entry.localIdx)];
    if (!obj) continue;
    const mirroredX = minX + (maxX - entry.x);
    const targetLocal = coordToLocal.get(`${mirroredX},${entry.y}`);
    if (targetLocal == null) continue;
    next[String(targetLocal)] = obj;
  }
  return next;
}

function mirrorIgnoredTiles(source: Set<number>, tiles: TileEntry[]): number[] {
  if (!tiles.length) return Array.from(source.values());
  let minX = Infinity;
  let maxX = -Infinity;
  const coordToLocal = new Map<string, number>();
  for (const entry of tiles) {
    minX = Math.min(minX, entry.x);
    maxX = Math.max(maxX, entry.x);
    coordToLocal.set(`${entry.x},${entry.y}`, entry.localIdx);
  }
  const next = new Set<number>();
  for (const entry of tiles) {
    if (!source.has(entry.localIdx)) continue;
    const mirroredX = minX + (maxX - entry.x);
    const targetLocal = coordToLocal.get(`${mirroredX},${entry.y}`);
    if (targetLocal == null) continue;
    next.add(targetLocal);
  }
  return Array.from(next.values());
}

function isGardenEmpty(val: GardenState): boolean {
  const tiles = val?.tileObjects;
  const boards = val?.boardwalkTileObjects;
  const isEmptyObj = (o: any) => o && typeof o === "object" && Object.keys(o).length === 0;
  return isEmptyObj(tiles) && isEmptyObj(boards);
}

function listEggsInGarden(garden: GardenState): string[] {
  const eggs: string[] = [];
  const collect = (map: Record<string, any>) => {
    for (const obj of Object.values(map || {})) {
      if (obj && typeof obj === "object" && obj.objectType === "egg") {
        const eggId = String((obj as any).eggId || "egg");
        eggs.push(eggId);
      }
    }
  };
  collect(garden.tileObjects || {});
  collect(garden.boardwalkTileObjects || {});
  return eggs;
}

async function getBlockedTargetTilesAsync(current: GardenState, target: GardenState): Promise<number[]> {
  if (tos.isReady()) {
    const pid = await getPlayerId();
    if (!pid) return getBlockedTargetTilesFromState(current, target);
    const cur = await Store.select<any>("stateAtom");
    const slots = cur?.child?.data?.userSlots;
    const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
    if (!slotMatch || !slotMatch.matchSlot) return getBlockedTargetTilesFromState(current, target);
    const userSlotIdx = slotMatchToIndex(slotMatch);

    const mapData = await Store.select<any>("mapAtom");
    const cols = Number((mapData as any)?.cols);
    if (!mapData || !Number.isFinite(cols)) return getBlockedTargetTilesFromState(current, target);

    const dirtCoords = buildTileCoordMap(mapData, userSlotIdx, "Dirt");
    const boardCoords = buildTileCoordMap(mapData, userSlotIdx, "Boardwalk");

    const blocked: number[] = [];
    const check = (next: Record<string, any>, coordMap: Map<number, { x: number; y: number }>) => {
      for (const key of Object.keys(next || {})) {
        const localIdx = Number(key);
        if (!Number.isFinite(localIdx)) continue;
        const coords = coordMap.get(localIdx);
        if (!coords) continue;
        const info = tos.getTileObject(coords.x, coords.y, { ensureView: true });
        const curObj = (info as any)?.tileObject;
        if (isTileOccupied(curObj) && !isSameTileObject(curObj, next?.[key])) {
          blocked.push(localIdx);
        }
      }
    };

    check(target.tileObjects || {}, dirtCoords);
    check(target.boardwalkTileObjects || {}, boardCoords);
    return blocked;
  }

  return getBlockedTargetTilesFromState(current, target);
}

function buildTileCoordMap(mapData: any, userSlotIdx: number, type: "Dirt" | "Boardwalk") {
  const map = new Map<number, { x: number; y: number }>();
  const source =
    type === "Dirt"
      ? (mapData as any)?.globalTileIdxToDirtTile || {}
      : (mapData as any)?.globalTileIdxToBoardwalk || {};
  const cols = Number((mapData as any)?.cols);
  if (!Number.isFinite(cols)) return map;
  for (const [gidxStr, v] of Object.entries(source)) {
    if (Number((v as any)?.userSlotIdx) !== userSlotIdx) continue;
    const gidx = Number(gidxStr);
    if (!Number.isFinite(gidx)) continue;
    const localIdx =
      type === "Dirt"
        ? Number((v as any)?.dirtTileIdx ?? -1)
        : Number((v as any)?.boardwalkTileIdx ?? -1);
    if (!Number.isFinite(localIdx) || localIdx < 0) continue;
    map.set(localIdx, { x: gidx % cols, y: Math.floor(gidx / cols) });
  }
  return map;
}

function getBlockedTargetTilesFromState(current: GardenState, target: GardenState): number[] {
  const blocked: number[] = [];
  const check = (cur: Record<string, any>, next: Record<string, any>) => {
    for (const key of Object.keys(next || {})) {
      const curObj = cur?.[key];
      if (isTileOccupied(curObj) && !isSameTileObject(curObj, next?.[key])) {
        const n = Number(key);
        blocked.push(Number.isFinite(n) ? n : -1);
      }
    }
  };
  check(current.tileObjects || {}, target.tileObjects || {});
  check(current.boardwalkTileObjects || {}, target.boardwalkTileObjects || {});
  return blocked.filter((n) => n >= 0);
}

function isTileOccupied(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const typ = (obj as any).objectType ?? (obj as any).type;
  if (typeof typ === "string" && typ) return true;
  const markers = ["species", "seedKey", "decorId", "eggId"];
  return markers.some((k) => typeof (obj as any)[k] === "string" && (obj as any)[k]);
}

function hasMutationSlots(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const slots = Array.isArray((obj as any).slots) ? (obj as any).slots : (obj as any).data?.slots;
  return Array.isArray(slots) && slots.length > 0;
}

function isSameTileObject(a: any, b: any): boolean {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const typeA = String((a as any).objectType ?? (a as any).type ?? "");
  const typeB = String((b as any).objectType ?? (b as any).type ?? "");
  if (!typeA || !typeB || typeA !== typeB) return false;
  if (typeA === "plant") {
    return String((a as any).species || (a as any).seedKey || "") ===
      String((b as any).species || (b as any).seedKey || "");
  }
  if (typeA === "decor") {
    return String((a as any).decorId || "") === String((b as any).decorId || "");
  }
  if (typeA === "egg") {
    return String((a as any).eggId || "") === String((b as any).eggId || "");
  }
  return false;
}

function describeBlockedTiles(current: GardenState, blocked: number[]): string[] {
  const lookup = (map: Record<string, any>, slot: number) => map?.[String(slot)];
  const results: string[] = [];
  for (const slot of blocked) {
    const obj = lookup(current.tileObjects || {}, slot) ?? lookup(current.boardwalkTileObjects || {}, slot);
    if (!obj || typeof obj !== "object") {
      results.push(String(slot));
      continue;
    }
    const typ = String((obj as any).objectType ?? (obj as any).type ?? "item");
    const label = (obj as any).species || (obj as any).decorId || (obj as any).eggId || "";
    results.push(`${slot}:${typ}${label ? `:${label}` : ""}`);
  }
  return results;
}

async function getPlayerId(): Promise<string | null> {
  const player = await Store.select<any>("playerAtom");
  const pid = (player as any)?.id ?? (player as any)?.playerId ?? null;
  return typeof pid === "string" && pid ? pid : null;
}

function resolvePlayerLabel(
  slot: any,
  fallbackId: string,
  slotKey?: string,
  nameMap?: Map<string, string>
): string {
  const mapped = nameMap?.get(fallbackId);
  if (mapped && mapped.trim()) return mapped.trim();
  const direct =
    slot?.name ??
    slot?.playerName ??
    slot?.displayName ??
    slot?.username ??
    slot?.data?.playerName ??
    slot?.data?.displayName ??
    slot?.data?.name ??
    slot?.data?.username ??
    slot?.data?.player?.name ??
    slot?.data?.player?.displayName ??
    slot?.data?.player?.username ??
    slot?.data?.player?.user?.name ??
    slot?.data?.player?.user?.displayName ??
    slot?.data?.player?.user?.username ??
    slot?.data?.user?.name ??
    slot?.data?.user?.displayName ??
    slot?.data?.user?.username;
  const label = typeof direct === "string" && direct.trim() ? direct.trim() : "";
  if (label) return label;
  if (slotKey && slotKey.trim()) return `Player ${slotKey}`;
  return fallbackId;
}

function extractPlayerNameMap(state: any): Map<string, string> {
  const map = new Map<string, string>();
  const add = (entry: any) => {
    if (!entry || typeof entry !== "object") return;
    const idRaw = entry.id ?? entry.playerId ?? entry.userId ?? entry.accountId ?? "";
    const id = String(idRaw || "").trim();
    if (!id) return;
    const nameRaw =
      entry.name ??
      entry.displayName ??
      entry.username ??
      entry.user?.name ??
      entry.user?.displayName ??
      entry.user?.username;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    if (name) map.set(id, name);
  };
  const candidates = [
    state?.data?.players,
    state?.child?.data?.players,
    state?.child?.data?.playersById,
    state?.child?.data?.room?.players,
  ];
  for (const source of candidates) {
    if (Array.isArray(source)) {
      source.forEach(add);
    } else if (source && typeof source === "object") {
      Object.values(source).forEach(add);
    }
  }
  return map;
}

async function listLobbyPlayers(): Promise<LobbyPlayer[]> {
  try {
    const cur = await Store.select<any>("stateAtom");
    const slots = cur?.child?.data?.userSlots;
    const selfId = await getPlayerId();
    const players: LobbyPlayer[] = [];
    const nameMap = extractPlayerNameMap(cur);
    const pushSlot = (slot: any, slotKey?: string, idx?: number) => {
      if (!slot || typeof slot !== "object") return;
      const idRaw = slot?.playerId ?? slot?.id ?? slot?.data?.playerId ?? slot?.data?.id ?? "";
      const id = String(idRaw || "").trim();
      if (!id) return;
      if (selfId && id === selfId) return;
      const slotIndex =
        Number.isFinite(idx as number)
          ? (idx as number)
          : slotKey && Number.isFinite(Number(slotKey))
            ? Number(slotKey)
            : null;
      const name = resolvePlayerLabel(slot, id, slotKey, nameMap);
      players.push({ id, name, slotIndex });
    };
    if (Array.isArray(slots)) {
      slots.forEach((slot, idx) => pushSlot(slot, String(idx), idx));
    } else if (slots && typeof slots === "object") {
      const entries = Object.entries(slots as Record<string, any>);
      entries.sort(([a], [b]) => compareSlotKeys(a, b));
      entries.forEach(([key, slot], idx) => pushSlot(slot, key, idx));
    }
    return players;
  } catch {
    return [];
  }
}

async function getUserSlotIdx(playerId: string): Promise<number | null> {
  try {
    const cur = await Store.select<any>("stateAtom");
    const slots = cur?.child?.data?.userSlots;
    const slotMatch = findPlayerSlot(slots, playerId, { sortObject: true });
    if (!slotMatch || !slotMatch.matchSlot) return null;
    return slotMatchToIndex(slotMatch);
  } catch {
    return null;
  }
}

async function getCurrentGarden(): Promise<GardenState | null> {
  try {
    const pid = await getPlayerId();
    if (!pid) return null;
    return await getGardenForPlayer(pid);
  } catch {
    return null;
  }
}

async function resolveInventoryFreeSlots(): Promise<{ usedSlots: number; capacity: number; freeSlots: number } | null> {
  try {
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
    if (!Number.isFinite(capacity)) return null;
    const safeCapacity = Math.max(0, Math.floor(capacity));
    const freeSlots = Math.max(0, safeCapacity - usedSlots);
    return { usedSlots, capacity: safeCapacity, freeSlots };
  } catch {
    return null;
  }
}

async function getGardenForPlayer(playerId: string): Promise<GardenState | null> {
  try {
    if (!playerId) return null;
    const cur = await Store.select<any>("stateAtom");
    const slots = cur?.child?.data?.userSlots;
    const slotMatch = findPlayerSlot(slots, playerId, { sortObject: true });
    if (!slotMatch || !slotMatch.matchSlot) return null;
    const g = slotMatch.matchSlot?.data?.garden;
    return sanitizeGardenForPreview(g || {});
  } catch {
    return null;
  }
}

async function setCurrentGarden(nextGarden: GardenState): Promise<boolean> {
  try {
    const pid = await getPlayerId();
    if (!pid) return false;
    const cur = await Store.select<any>("stateAtom");
    const slots = cur?.child?.data?.userSlots;
    const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
    if (!slotMatch || !slotMatch.matchSlot) return false;

    const userSlotIdx = slotMatchToIndex(slotMatch);
    const updatedSlot = {
      ...(slotMatch.matchSlot as any),
      data: {
        ...(slotMatch.matchSlot?.data || {}),
        garden: sanitizeGarden(nextGarden),
      },
    };
    const nextUserSlots = rebuildUserSlots(slotMatch, () => updatedSlot);
    const nextState = buildStateWithUserSlots(cur, nextUserSlots);
    await Store.set("stateAtom", nextState);

    try {
      await applyGardenToTos(nextGarden, userSlotIdx);
    } catch {}
    return true;
  } catch {
    return false;
  }
}

async function applyGardenToTos(garden: GardenState, userSlotIdx: number) {
  if (!tos.isReady()) return;
  const mapData = await Store.select<any>("mapAtom");
  const cols = Number((mapData as any)?.cols);
  if (!mapData || !Number.isFinite(cols)) return;

  const dirtEntries = Object.entries((mapData as any)?.globalTileIdxToDirtTile || {}).filter(
    ([, v]) => (v as any)?.userSlotIdx === userSlotIdx
  );
  const boardEntries = Object.entries((mapData as any)?.globalTileIdxToBoardwalk || {}).filter(
    ([, v]) => (v as any)?.userSlotIdx === userSlotIdx
  );

  const applyEntry = (entry: [string, any], type: "Dirt" | "Boardwalk") => {
    const [gidxStr, v] = entry;
    const gidx = Number(gidxStr);
    if (!Number.isFinite(gidx)) return;
    const x = gidx % cols;
    const y = Math.floor(gidx / cols);
    const localIdx =
      type === "Dirt"
        ? Number((v as any)?.dirtTileIdx ?? -1)
        : Number((v as any)?.boardwalkTileIdx ?? -1);
    const obj =
      type === "Dirt"
        ? (garden.tileObjects || {})[String(localIdx)]
        : (garden.boardwalkTileObjects || {})[String(localIdx)];

    if (!obj) {
      tos.setTileEmpty(x, y, { ensureView: true, forceUpdate: true });
      return;
    }

    injectTileObjectRaw(x, y, obj);
    const typ = obj.objectType;
    if (typ === "plant") {
      tos.setTilePlant(
        x,
        y,
        {
          species: obj.species,
          plantedAt: obj.plantedAt,
          maturedAt: obj.maturedAt,
          slots: obj.slots,
        },
        { ensureView: true, forceUpdate: true }
      );
    } else if (typ === "decor") {
      tos.setTileDecor(x, y, { rotation: obj.rotation }, { ensureView: true, forceUpdate: true });
    } else if (typ === "egg") {
      // Keep egg visuals via injected tile object.
      return;
    } else {
      tos.setTileEmpty(x, y, { ensureView: true, forceUpdate: true });
    }
  };

  dirtEntries.forEach((e) => applyEntry(e as any, "Dirt"));
  boardEntries.forEach((e) => applyEntry(e as any, "Boardwalk"));
}

async function applyGardenServer(garden: GardenState): Promise<boolean> {
  try {
    const dirt = garden.tileObjects || {};
    const board = garden.boardwalkTileObjects || {};
    const actions: Array<() => Promise<void>> = [];

    const dirtEntries = toChunkedEntries(dirt);
    for (const chunk of dirtEntries) {
      if (applyCancelRequested) return false;
      for (const [localIdx, obj] of chunk) {
        if (applyCancelRequested) return false;
        if (!obj || typeof obj !== "object") continue;
        const typ = String((obj as any).objectType || "");
        if (typ === "plant") {
          await toastSimple("Garden Layout", "Only potted plants are supported.", "error");
          return false;
      } else if (typ === "egg") {
        continue;
        } else if (typ === "decor") {
          const decorId = String((obj as any).decorId || "");
          if (decorId) {
            const rotation = Number((obj as any).rotation ?? 0);
            actions.push(() => PlayerService.placeDecor("Dirt", localIdx, decorId, rotation as any));
          }
        }
      }
      for (const action of actions) {
        if (applyCancelRequested) return false;
        await action();
        await delay(40);
      }
      actions.length = 0;
    }

    const boardEntries = toChunkedEntries(board);
    for (const chunk of boardEntries) {
      if (applyCancelRequested) return false;
      for (const [localIdx, obj] of chunk) {
        if (applyCancelRequested) return false;
        if (!obj || typeof obj !== "object") continue;
        const typ = String((obj as any).objectType || "");
        if (typ !== "decor") continue;
        const decorId = String((obj as any).decorId || "");
        if (decorId) {
          const rotation = Number((obj as any).rotation ?? 0);
          actions.push(() => PlayerService.placeDecor("Boardwalk", localIdx, decorId, rotation as any));
        }
      }
      for (const action of actions) {
        if (applyCancelRequested) return false;
        await action();
        await delay(40);
      }
      actions.length = 0;
    }
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toChunkedEntries(
  map: Record<string, any>,
  chunkSize: number = 10
): Array<Array<[number, any]>> {
  const entries: Array<[number, any]> = [];
  for (const [key, obj] of Object.entries(map || {})) {
    const localIdx = Number(key);
    if (!Number.isFinite(localIdx)) continue;
    entries.push([localIdx, obj]);
  }
  entries.sort((a, b) => a[0] - b[0]);
  const chunks: Array<Array<[number, any]>> = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  return chunks;
}

async function calculatePlanterPotsNeeded(garden: GardenState, currentGarden: GardenState): Promise<number> {
  const ignoredDirt = getIgnoredSet(garden, "Dirt");
  const aliasMap = getPlantAliasMap();

  const desiredBySpecies = new Map<string, number>();
  const desiredByMutation = new Map<string, { mutations: string[]; count: number }>();
  const inPlaceBySpecies = new Map<string, number>();
  const inPlaceByMutation = new Map<string, number>();
  const potSupplyBySpecies = new Map<string, number>();
  const potSupplyByMutation = new Map<string, number>();
  const potSupplyInstances = new Map<string, string[][]>();

  let potsFromTargets = 0;

  const addMap = (map: Map<string, number>, key: string, qty: number) => {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + qty);
  };

  // Build desired counts + count pots from target tiles
  for (const [key, draftObj] of Object.entries(garden.tileObjects || {})) {
    const idx = Number(key);
    if (Number.isFinite(idx) && ignoredDirt.has(idx)) continue;
    if (!draftObj || typeof draftObj !== "object") continue;

    const desiredType = String((draftObj as any).objectType || "").toLowerCase();
    const desiredMutations = desiredType === "plant" ? getDesiredMutations(draftObj) : [];
    const desiredSpecies =
      desiredType === "plant"
        ? resolvePlantSpeciesKey(String((draftObj as any).species || (draftObj as any).seedKey || ""), aliasMap)
        : "";

    if (desiredType === "plant" && desiredSpecies) {
      if (desiredMutations.length) {
        const key = mutationSetKey(desiredSpecies, desiredMutations);
        const entry = desiredByMutation.get(key);
        if (entry) entry.count += 1;
        else desiredByMutation.set(key, { mutations: desiredMutations, count: 1 });
      } else {
        addMap(desiredBySpecies, desiredSpecies, 1);
      }
    }

    const curObj = (currentGarden.tileObjects || {})[key];
    if (!curObj || typeof curObj !== "object") continue;
    const curType = String((curObj as any).objectType || "").toLowerCase();
    if (curType !== "plant") continue;

    const curSpecies = resolvePlantSpeciesKey(String((curObj as any).species || (curObj as any).seedKey || ""), aliasMap);
    const curMutations = getPlantMutations(curObj);
    const curHasDesiredMutation = desiredMutations.length
      ? desiredMutations.every((mutation) => curMutations.includes(mutation))
      : false;

    let inPlace = false;
    if (desiredType === "plant" && desiredSpecies && curSpecies === desiredSpecies) {
      if (!desiredMutations.length || curHasDesiredMutation) {
        inPlace = true;
        if (desiredMutations.length) {
          addMap(inPlaceByMutation, mutationSetKey(desiredSpecies, desiredMutations), 1);
        } else {
          addMap(inPlaceBySpecies, desiredSpecies, 1);
        }
      }
    }

    if (!inPlace) {
      potsFromTargets += 1;
      if (curSpecies) addMap(potSupplyBySpecies, curSpecies, 1);
      if (curSpecies) {
        if (!potSupplyInstances.has(curSpecies)) potSupplyInstances.set(curSpecies, []);
        potSupplyInstances.get(curSpecies)!.push(curMutations);
      }
    }
  }

  const invPlants = await readPlantInventoryBySpecies(aliasMap);
  const invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);

  const invBySpecies = new Map<string, number>();
  for (const [species, ids] of invPlants.entries()) {
    addMap(invBySpecies, species, ids.length);
  }

  const invByMutation = new Map<string, number>();
  for (const [key, entry] of desiredByMutation.entries()) {
    const species = key.split("::")[0] || "";
    const entries = invPlantsByMutation.get(species) || [];
    const count = entries.filter((plant) =>
      entry.mutations.every((mutation) => plant.mutations.includes(mutation))
    ).length;
    invByMutation.set(key, count);
  }

  const gardenBySpecies = countGardenPlants(currentGarden, aliasMap, ignoredDirt);
  const gardenByMutation = new Map<string, number>();
  for (const [key, entry] of desiredByMutation.entries()) {
    const species = key.split("::")[0] || "";
    const supply = potSupplyInstances.get(species) || [];
    const supplyCount = supply.filter((muts) => entry.mutations.every((m) => muts.includes(m))).length;
    potSupplyByMutation.set(key, supplyCount);
    let count = 0;
    for (const [idxKey, obj] of Object.entries(currentGarden.tileObjects || {})) {
      const idx = Number(idxKey);
      if (Number.isFinite(idx) && ignoredDirt.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type !== "plant") continue;
      const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
      const curSpecies = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      if (curSpecies !== species) continue;
      const mutations = getPlantMutations(obj);
      if (entry.mutations.every((mutation) => mutations.includes(mutation))) {
        count += 1;
      }
    }
    gardenByMutation.set(key, count);
  }

  let potsFromGarden = 0;

  for (const [species, desiredCount] of desiredBySpecies.entries()) {
    const inPlace = inPlaceBySpecies.get(species) || 0;
    const required = Math.max(0, desiredCount - inPlace);
    const availableInv =
      (invBySpecies.get(species) || 0) +
      (potSupplyBySpecies.get(species) || 0);
    const missing = Math.max(0, required - availableInv);
    const availableGarden = Math.max(
      0,
      (gardenBySpecies.get(species) || 0) -
        inPlace -
        (potSupplyBySpecies.get(species) || 0)
    );
    potsFromGarden += Math.min(missing, availableGarden);
  }

  for (const [key, entry] of desiredByMutation.entries()) {
    const desiredCount = entry.count;
    const inPlace = inPlaceByMutation.get(key) || 0;
    const required = Math.max(0, desiredCount - inPlace);
    const availableInv =
      (invByMutation.get(key) || 0) +
      (potSupplyByMutation.get(key) || 0);
    const missing = Math.max(0, required - availableInv);
    const availableGarden = Math.max(
      0,
      (gardenByMutation.get(key) || 0) -
        inPlace -
        (potSupplyByMutation.get(key) || 0)
    );
    potsFromGarden += Math.min(missing, availableGarden);
  }

  return potsFromTargets + potsFromGarden;
}

async function applyGardenServerWithPotting(
  garden: GardenState,
  blocked: number[],
  opts: { inventorySlotsAvailable?: number; allowClientSide?: boolean }
): Promise<boolean> {
  const debugUsedInventory: Array<{
    id: string;
    species: string;
    mutation: string | null;
    tile: number;
  }> = [];
  const usedInventoryIds = new Set<string>();
  const tileCooldowns = new Map<number, number>();
  const pendingPlacements = new Map<number, { attempts: number }>();
  const logInventorySnapshot = async (label: string) => {
    try {
      const snapshot = await readPlantInventoryDebugSnapshot();
      const entries = snapshot.map((entry, idx) => ({
        slot: idx,
        id: entry.id,
        species: entry.species,
        rawSpecies: entry.rawSpecies,
        itemType: entry.itemType,
      }));
      console.info(`[GLC GardenLayout][Apply] ${label} inventory snapshot`, entries);
    } catch {}
  };

  const buildInventoryIndex = (map: Map<string, InventoryPlantEntry[]>) => {
    const index = new Map<string, { species: string; mutations: string[] }>();
    for (const [species, entries] of map.entries()) {
      for (const entry of entries) {
        if (usedInventoryIds.has(entry.id)) continue;
        index.set(entry.id, { species, mutations: entry.mutations || [] });
      }
    }
    return index;
  };
  const pruneUsedIds = (list: string[] | undefined): string[] | undefined => {
    if (!list || !list.length || !usedInventoryIds.size) return list;
    return list.filter((id) => !usedInventoryIds.has(id));
  };
  const removeUsedFromInventoryMaps = (
    invBySpecies: Map<string, string[]>,
    invByMutation: Map<string, InventoryPlantEntry[]>
  ) => {
    if (!usedInventoryIds.size) return;
    for (const [species, entries] of invByMutation.entries()) {
      const next = entries.filter((entry) => !usedInventoryIds.has(entry.id));
      if (next.length !== entries.length) {
        invByMutation.set(species, next);
      }
    }
    for (const [species, ids] of invBySpecies.entries()) {
      const next = ids.filter((id) => !usedInventoryIds.has(id));
      if (next.length !== ids.length) {
        invBySpecies.set(species, next);
      }
    }
  };
  let cancelNotified = false;
  const checkCancelled = async () => {
    if (!applyCancelRequested) return false;
    if (!cancelNotified) {
      cancelNotified = true;
      await toastSimple("Garden Layout", "Apply cancelled.", "info", 2000);
    }
    return true;
  };

  await logInventorySnapshot("Before apply");
  const initialGarden = await getCurrentGarden();
  if (!initialGarden) return false;
  let currentGarden: GardenState = initialGarden;

  // Check planter pot requirements
  const potsNeeded = await calculatePlanterPotsNeeded(garden, currentGarden);
  if (await checkCancelled()) return false;
  if (potsNeeded > 0) {
    const inventory = await getInventoryCounts();
    const potsOwned = inventory.tools.get("Planter Pot") || inventory.tools.get("PlanterPot") || 0;
    try {
      console.info("[GLC][PlanterPot] inventory check", {
        potsNeeded,
        potsOwned,
        toolEntries: lastInventoryDebug?.toolEntries ?? [],
        potLikeEntries: lastInventoryDebug?.potLikeEntries ?? [],
        typeCounts: lastInventoryDebug?.typeCounts ?? {},
        itemsCount: lastInventoryDebug?.itemsCount ?? 0,
      });
    } catch {}
    if (potsNeeded > potsOwned) {
      const missing = potsNeeded - potsOwned;
      await toastSimple(
        "Garden Layout",
        `To apply this Layout you need ${potsNeeded} Planter Pots, you're missing ${missing} Planter Pots`,
        "error",
        4000
      );
      return false;
    }
  }

  const rawSlots = Number(opts.inventorySlotsAvailable ?? 0);
  const configuredSlots = Number.isFinite(rawSlots) && rawSlots >= 1 ? Math.floor(rawSlots) : 10;
  let freeSlotInfo = await resolveInventoryFreeSlots();
  let availableSlots = freeSlotInfo?.freeSlots ?? configuredSlots;
  let slotsLeft = Number.isFinite(availableSlots) ? availableSlots : 0;
  const refreshSlotsLeft = async () => {
    freeSlotInfo = await resolveInventoryFreeSlots();
    availableSlots = freeSlotInfo?.freeSlots ?? configuredSlots;
    slotsLeft = Number.isFinite(availableSlots) ? availableSlots : 0;
  };

  if (blocked.length) {
    await toastSimple("Garden Layout", "Clearing target tiles...", "info", 1800);
  }

  const aliasMap = getPlantAliasMap();
  let invPlants = await readPlantInventoryBySpecies(aliasMap);
  let invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
  removeUsedFromInventoryMaps(invPlants, invPlantsByMutation);
  let invIndex = buildInventoryIndex(invPlantsByMutation);
  let inventoryDirty = false;
  let inventoryFullWarned = false;
  let eggBlockedWarned = false;
  if (!invPlants.size) {
    await toastSimple("Garden Layout", "No potted plants detected in inventory.", "info", 2000);
  }
  const blockedSet = new Set(blocked);
  const ignoredDirt = getIgnoredSet(garden, "Dirt");
  const ignoredBoardwalk = getIgnoredSet(garden, "Boardwalk");
  const desiredSpeciesBySlot = new Map<number, string>();
  const desiredMutationBySlot = new Map<number, string[]>();
  const desiredDecorBySlotDirt = new Map<number, string>();
  const desiredDecorBySlotBoardwalk = new Map<number, string>();
  for (const [key, obj] of Object.entries(garden.tileObjects || {})) {
    if (!obj || typeof obj !== "object") continue;
    const type = String((obj as any).objectType || "").toLowerCase();
    if (type === "decor") {
      const decorId = String((obj as any).decorId || "");
      const idx = Number(key);
      if (decorId && Number.isFinite(idx) && !ignoredDirt.has(idx)) {
        desiredDecorBySlotDirt.set(idx, decorId);
      }
      continue;
    }
    if (type !== "plant") continue;
    const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
    const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
    const idx = Number(key);
    if (!Number.isFinite(idx) || !species) continue;
    if (blockedSet.has(idx)) continue;
    if (ignoredDirt.has(idx)) continue;
    desiredSpeciesBySlot.set(idx, species);
    desiredMutationBySlot.set(idx, getDesiredMutations(obj));
  }
  for (const [key, obj] of Object.entries(garden.boardwalkTileObjects || {})) {
    if (!obj || typeof obj !== "object") continue;
    const type = String((obj as any).objectType || "").toLowerCase();
    if (type !== "decor") continue;
    const decorId = String((obj as any).decorId || "");
    const idx = Number(key);
    if (decorId && Number.isFinite(idx) && !ignoredBoardwalk.has(idx)) {
      desiredDecorBySlotBoardwalk.set(idx, decorId);
    }
  }
  const desiredKeyBySlot = new Map<number, string>();
  const desiredCountByKey = new Map<string, number>();
  const buildDesiredKeyMaps = () => {
    desiredKeyBySlot.clear();
    desiredCountByKey.clear();
    for (const [idx, species] of desiredSpeciesBySlot.entries()) {
      const mutations = desiredMutationBySlot.get(idx) || [];
      const key = mutationSetKey(species, mutations);
      desiredKeyBySlot.set(idx, key);
      desiredCountByKey.set(key, (desiredCountByKey.get(key) || 0) + 1);
    }
  };
  const computeRemainingByKey = (currentState: GardenState) => {
    const remaining = new Map<string, number>();
    for (const [key, count] of desiredCountByKey.entries()) {
      remaining.set(key, count);
    }
    for (const [idx, species] of desiredSpeciesBySlot.entries()) {
      const obj = getGardenTileObject(currentState, "Dirt", idx);
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType ?? (obj as any).type ?? "").toLowerCase();
      if (type !== "plant") continue;
      const curSpecies = resolvePlantSpeciesKey(String((obj as any).species || (obj as any).seedKey || ""), aliasMap);
      if (!curSpecies || curSpecies !== species) continue;
      const desiredMutations = desiredMutationBySlot.get(idx) || [];
      if (desiredMutations.length && !plantHasMutationsInclusive(obj, desiredMutations)) continue;
      const key = desiredKeyBySlot.get(idx);
      if (!key) continue;
      const next = (remaining.get(key) || 0) - 1;
      remaining.set(key, Math.max(0, next));
    }
    return remaining;
  };
  buildDesiredKeyMaps();
  let remainingByKey = computeRemainingByKey(currentGarden);
  const placedTargets = new Set<number>();
  let gardenPlants = collectGardenPlantSlots(currentGarden, aliasMap, ignoredDirt);
  let gardenMutationSources = new Map<string, number[]>();
  let mispositionedGardenPlants = new Map<string, number[]>();
  let mispositionedGardenDecors = new Map<string, DecorSlot[]>();
  let decorCounts = new Map<string, number>();

  const mapData = await Store.select<any>("mapAtom");
  const pid = await getPlayerId();
  let dirtCoords = new Map<number, { x: number; y: number }>();
  let boardCoords = new Map<number, { x: number; y: number }>();
  if (pid && mapData) {
    const cur = await Store.select<any>("stateAtom");
    const slots = cur?.child?.data?.userSlots;
    const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
    if (slotMatch && slotMatch.matchSlot) {
      const userSlotIdx = slotMatchToIndex(slotMatch);
      dirtCoords = buildTileCoordMap(mapData, userSlotIdx, "Dirt");
      boardCoords = buildTileCoordMap(mapData, userSlotIdx, "Boardwalk");
    }
  }

  const processTile = async (tileType: "Dirt" | "Boardwalk", localIdx: number, obj: any): Promise<boolean> => {
    if (await checkCancelled()) return false;
    if (!obj || typeof obj !== "object") return false;
    const ignoredSet = tileType === "Dirt" ? ignoredDirt : ignoredBoardwalk;
    if (ignoredSet.has(localIdx)) return false;
    const desiredType = String(obj.objectType || "");
    const desiredMutations = desiredType === "plant" ? getDesiredMutations(obj) : [];
    const desiredSpecies =
      desiredType === "plant"
        ? resolvePlantSpeciesKey(String(obj.species || obj.seedKey || ""), aliasMap)
        : "";
    const desiredKey =
      tileType === "Dirt" && desiredType === "plant"
        ? desiredKeyBySlot.get(localIdx) || mutationSetKey(desiredSpecies, desiredMutations)
        : null;
    const remainingForKey = desiredKey ? remainingByKey.get(desiredKey) || 0 : 0;
    let changed = false;

    if (tileType === "Boardwalk") {
      const curObj = getCurrentTileObject(currentGarden, tileType, localIdx, boardCoords);
      const curType = String((curObj as any)?.objectType ?? (curObj as any)?.type ?? "");
      const curDecorId = curType === "decor" ? String((curObj as any)?.decorId || "") : "";
      if (curObj && desiredType && isSameTileObject(curObj, obj)) {
        return false;
      }
      if (curObj) {
        if (await checkCancelled()) return false;
        await PlayerService.pickupDecor("Boardwalk", localIdx);
        if (curDecorId) {
          addCount(decorCounts, curDecorId, 1);
          removeGardenDecorSlot(mispositionedGardenDecors, curDecorId, "Boardwalk", localIdx);
        }
        await delay(50);
        changed = true;
      }
      if (desiredType === "decor") {
        const decorId = String(obj.decorId || "");
        if (decorId) {
          const ok = await ensureDecorAvailable(
            decorCounts,
            mispositionedGardenDecors,
            decorId,
            "Boardwalk",
            localIdx
          );
          if (!ok) {
            return changed;
          }
          if (await checkCancelled()) return changed;
          await PlayerService.placeDecor("Boardwalk", localIdx, decorId, Number(obj.rotation ?? 0) as any);
          await delay(40);
          changed = true;
        }
      }
      return changed;
    }

    if (tileType === "Dirt" && desiredType === "plant") {
      const cooldown = tileCooldowns.get(localIdx) || 0;
      if (cooldown > 0) return false;
      const pending = pendingPlacements.get(localIdx);
      if (pending && pending.attempts < 4) return false;
    }
    const curObj = getCurrentTileObject(currentGarden, tileType, localIdx, dirtCoords);
    const mutationObj =
      curObj && !hasMutationSlots(curObj) ? getGardenTileObject(currentGarden, tileType, localIdx) : curObj;
    const curType = String((curObj as any)?.objectType ?? (curObj as any)?.type ?? "");
    if (curObj && desiredType && isSameTileObject(curObj, obj)) {
      if (!desiredMutations.length || plantHasMutationsInclusive(mutationObj || curObj, desiredMutations)) {
        return false;
      }
    }
    if (curObj && desiredType === "plant" && curType === "plant") {
      const curRawSpecies = String((curObj as any)?.species || (curObj as any)?.seedKey || "");
      const desiredRawSpecies = String(obj.species || obj.seedKey || "");
      const curSpecies = resolvePlantSpeciesKey(curRawSpecies, aliasMap);
      const desiredSpecies = resolvePlantSpeciesKey(desiredRawSpecies, aliasMap);
      if (curSpecies && desiredSpecies && curSpecies === desiredSpecies) {
        if (!desiredMutations.length || plantHasMutationsInclusive(mutationObj || curObj, desiredMutations)) {
          return false;
        }
      }
    }

    if (curObj) {
      if (curType === "plant") {
        if (slotsLeft <= 0) {
          await refreshSlotsLeft();
        }
        if (slotsLeft <= 0) {
          if (!inventoryFullWarned) {
            inventoryFullWarned = true;
            const debug = `Slots setting: ${availableSlots}, remaining: ${slotsLeft}.`;
            await toastSimple("Garden Layout", `Inventory full. Free slots and retry. ${debug}`, "error");
            try {
              console.warn("[GLC GardenLayout] Inventory full debug", {
                availableSlots,
                slotsLeft,
                inventoryDirty,
                pottedInventorySpecies: invPlants?.size ?? 0,
              });
            } catch {}
          }
          return false;
        }
        if (await checkCancelled()) return false;
        await PlayerService.potPlant(localIdx);
        slotsLeft -= 1;
        inventoryDirty = true;
        changed = true;
      } else if (curType === "egg") {
        if (!eggBlockedWarned) {
          eggBlockedWarned = true;
          await toastSimple("Garden Layout", "Remove eggs on target tiles before applying.", "error");
        }
        return false;
      } else {
        const curDecorId = String((curObj as any)?.decorId || "");
        if (await checkCancelled()) return changed;
        await PlayerService.pickupDecor("Dirt", localIdx);
        if (curDecorId) {
          addCount(decorCounts, curDecorId, 1);
          removeGardenDecorSlot(mispositionedGardenDecors, curDecorId, "Dirt", localIdx);
        }
        changed = true;
      }
      await delay(50);
    }

    if (desiredType === "plant") {
      const rawSpecies = String(obj.species || obj.seedKey || "");
      const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      let list = desiredMutations.length
        ? getPlantListByMutations(invPlantsByMutation, species, desiredMutations)
        : getPlantListBySpecies(invPlants, species);
      list = pruneUsedIds(list);
      if (desiredMutations.length && slotsLeft > 0 && remainingForKey > 0) {
        const pottedFromGarden = await potGardenPlantsBatchWithMutations(
          currentGarden,
          gardenMutationSources,
          species,
          desiredMutations,
          1,
          localIdx
        );
        if (pottedFromGarden > 0) {
          slotsLeft -= pottedFromGarden;
          await delay(160);
          invPlants = await readPlantInventoryBySpecies(aliasMap);
          invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
          removeUsedFromInventoryMaps(invPlants, invPlantsByMutation);
          invIndex = buildInventoryIndex(invPlantsByMutation);
          inventoryDirty = false;
          list = getPlantListByMutations(invPlantsByMutation, species, desiredMutations);
          list = pruneUsedIds(list);
          changed = true;
        }
      }
      const mispositionedSlots = mispositionedGardenPlants.get(species) || [];
      if (mispositionedSlots.length && slotsLeft > 0 && remainingForKey > 0) {
        const pottedFromGarden = desiredMutations.length
          ? await potGardenPlantsBatchWithMutations(
              currentGarden,
              mispositionedGardenPlants,
              species,
              desiredMutations,
              1,
              localIdx
            )
          : await potGardenPlantsBatch(mispositionedGardenPlants, species, 1, localIdx);
        if (pottedFromGarden > 0) {
          slotsLeft -= pottedFromGarden;
          await delay(160);
          invPlants = await readPlantInventoryBySpecies(aliasMap);
          invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
          invIndex = buildInventoryIndex(invPlantsByMutation);
          inventoryDirty = false;
          list = desiredMutations.length
            ? getPlantListByMutations(invPlantsByMutation, species, desiredMutations)
            : getPlantListBySpecies(invPlants, species);
          list = pruneUsedIds(list);
          changed = true;
        }
      }
      if ((!list || !list.length) && inventoryDirty) {
        invPlants = await readPlantInventoryBySpecies(aliasMap);
        invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
        invIndex = buildInventoryIndex(invPlantsByMutation);
        inventoryDirty = false;
        list = desiredMutations.length
          ? getPlantListByMutations(invPlantsByMutation, species, desiredMutations)
          : getPlantListBySpecies(invPlants, species);
        list = pruneUsedIds(list);
      }
      if (!list || !list.length) {
        if (slotsLeft <= 0) {
          await refreshSlotsLeft();
        }
        if (slotsLeft <= 0) {
          if (!inventoryFullWarned) {
            inventoryFullWarned = true;
            const debug = `Slots setting: ${availableSlots}, remaining: ${slotsLeft}.`;
            await toastSimple("Garden Layout", `Inventory full. Free slots and retry. ${debug}`, "error");
            try {
              console.warn("[GLC GardenLayout] Inventory full debug", {
                availableSlots,
                slotsLeft,
                inventoryDirty,
                pottedInventorySpecies: invPlants?.size ?? 0,
              });
            } catch {}
          }
          return changed;
        }
        if (remainingForKey <= 0) {
          return changed;
        }
        const potted = desiredMutations.length
          ? await potGardenPlantsBatchWithMutations(
              currentGarden,
              gardenPlants,
              species,
              desiredMutations,
              Math.min(slotsLeft, remainingForKey),
              localIdx
            )
          : await potGardenPlantsBatch(gardenPlants, species, Math.min(slotsLeft, remainingForKey), localIdx);
        if (potted > 0) {
          slotsLeft -= potted;
          await delay(160);
          invPlants = await readPlantInventoryBySpecies(aliasMap);
          invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
          invIndex = buildInventoryIndex(invPlantsByMutation);
          inventoryDirty = false;
          list = desiredMutations.length
            ? getPlantListByMutations(invPlantsByMutation, species, desiredMutations)
            : getPlantListBySpecies(invPlants, species);
          list = pruneUsedIds(list);
          changed = true;
        }
      }
      if (list && list.length) {
        const itemId = list.shift()!;
        const invMeta = invIndex.get(itemId);
        usedInventoryIds.add(itemId);
        if (!consumeInventoryItem(invPlants, invPlantsByMutation, invIndex, itemId)) {
          try {
            console.warn("[GLC GardenLayout][Apply] Inventory item not found in cache", { itemId });
          } catch {}
        }
        debugUsedInventory.push({
          id: itemId,
          species: invMeta?.species || species || "",
          mutation: desiredMutations.length ? desiredMutations.join("+") : null,
          tile: localIdx,
        });
        try {
          console.info("[GLC GardenLayout][Apply] Using inventory plant", {
            itemId,
            species: invMeta?.species || species,
            mutations: invMeta?.mutations || [],
            targetTile: localIdx,
            desiredMutation: desiredMutations.length ? desiredMutations.join("+") : null,
          });
        } catch {}
        if (await checkCancelled()) return changed;
        await PlayerService.plantGardenPlant(localIdx, itemId);
        tileCooldowns.set(localIdx, 3);
        pendingPlacements.set(localIdx, { attempts: 0 });
        slotsLeft += 1;
        if (desiredKey && !placedTargets.has(localIdx)) {
          remainingByKey.set(desiredKey, Math.max(0, (remainingByKey.get(desiredKey) || 0) - 1));
          placedTargets.add(localIdx);
        }
        await delay(80);
        changed = true;
      } else {
        return changed;
      }
    } else if (desiredType === "decor") {
      const decorId = String(obj.decorId || "");
      if (decorId) {
        const ok = await ensureDecorAvailable(decorCounts, mispositionedGardenDecors, decorId, "Dirt", localIdx);
        if (!ok) {
          return changed;
        }
        if (await checkCancelled()) return changed;
        await PlayerService.placeDecor("Dirt", localIdx, decorId, Number(obj.rotation ?? 0) as any);
        changed = true;
      }
    } else if (desiredType === "egg") {
      return changed;
    }

    await delay(50);
    return changed;
  };

  try {
    const groupDirtEntries = () => {
      const byPlantKey = new Map<string, Array<[number, any]>>();
      const plantOrder: string[] = [];
      const byDecor = new Map<string, Array<[number, any]>>();
      const others: Array<[number, any]> = [];
      for (const [localIdx, obj] of toChunkedEntries(garden.tileObjects || {}).flat()) {
        if (ignoredDirt.has(localIdx)) continue;
        if (!obj || typeof obj !== "object") continue;
        const desiredType = String(obj.objectType || "").toLowerCase();
        if (desiredType === "plant") {
          const rawSpecies = String(obj.species || obj.seedKey || "");
          const species = resolvePlantSpeciesKey(rawSpecies, aliasMap) || rawSpecies;
          const mutations = getDesiredMutations(obj);
          const key = mutationSetKey(species, mutations);
          if (!byPlantKey.has(key)) {
            byPlantKey.set(key, []);
            plantOrder.push(key);
          }
          byPlantKey.get(key)!.push([localIdx, obj]);
        } else if (desiredType === "decor") {
          const decorId = String(obj.decorId || "");
          if (!byDecor.has(decorId)) byDecor.set(decorId, []);
          byDecor.get(decorId)!.push([localIdx, obj]);
        } else {
          others.push([localIdx, obj]);
        }
      }
      const ordered: Array<[number, any]> = [];
      plantOrder.forEach((key) => {
        ordered.push(...(byPlantKey.get(key) || []));
      });
      Array.from(byDecor.keys())
        .sort((a, b) => a.localeCompare(b))
        .forEach((decorId) => {
          ordered.push(...byDecor.get(decorId)!);
        });
      ordered.push(...others);
      return ordered;
    };

    const groupBoardEntries = () => {
      const byDecor = new Map<string, Array<[number, any]>>();
      const others: Array<[number, any]> = [];
      for (const [localIdx, obj] of toChunkedEntries(garden.boardwalkTileObjects || {}).flat()) {
        if (ignoredBoardwalk.has(localIdx)) continue;
        if (!obj || typeof obj !== "object") continue;
        const desiredType = String(obj.objectType || "").toLowerCase();
        if (desiredType === "decor") {
          const decorId = String(obj.decorId || "");
          if (!byDecor.has(decorId)) byDecor.set(decorId, []);
          byDecor.get(decorId)!.push([localIdx, obj]);
        } else {
          others.push([localIdx, obj]);
        }
      }
      const ordered: Array<[number, any]> = [];
      Array.from(byDecor.keys())
        .sort((a, b) => a.localeCompare(b))
        .forEach((decorId) => {
          ordered.push(...byDecor.get(decorId)!);
        });
      ordered.push(...others);
      return ordered;
    };

    const MAX_PASSES = 200;
    let finalPass = 0;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      if (await checkCancelled()) return false;
      const nextCurrent = await getCurrentGarden();
      if (!nextCurrent) break;
      currentGarden = nextCurrent;
      remainingByKey = computeRemainingByKey(currentGarden);
      placedTargets.clear();
      for (const [idx, remaining] of tileCooldowns.entries()) {
        if (remaining <= 1) tileCooldowns.delete(idx);
        else tileCooldowns.set(idx, remaining - 1);
      }
      gardenMutationSources = collectGardenMutationSources(
        currentGarden,
        aliasMap,
        ignoredDirt,
        desiredSpeciesBySlot,
        desiredMutationBySlot
      );
      for (const [idx, pending] of pendingPlacements.entries()) {
        const desiredSpecies = desiredSpeciesBySlot.get(idx);
        if (!desiredSpecies) {
          pendingPlacements.delete(idx);
          continue;
        }
        const desiredMutations = desiredMutationBySlot.get(idx) || [];
        const curObj = getCurrentTileObject(currentGarden, "Dirt", idx, dirtCoords);
        const mutationObj =
          curObj && !hasMutationSlots(curObj) ? getGardenTileObject(currentGarden, "Dirt", idx) : curObj;
        const curType = String((curObj as any)?.objectType ?? (curObj as any)?.type ?? "");
        if (curType === "plant") {
          const curSpecies = resolvePlantSpeciesKey(
            String((curObj as any)?.species || (curObj as any)?.seedKey || ""),
            aliasMap
          );
          if (
            curSpecies &&
            curSpecies === desiredSpecies &&
            (!desiredMutations.length || plantHasMutationsInclusive(mutationObj || curObj, desiredMutations))
          ) {
            pendingPlacements.delete(idx);
            continue;
          }
        }
        if (pending.attempts >= 4) {
          pendingPlacements.delete(idx);
          continue;
        }
        pending.attempts += 1;
      }
      freeSlotInfo = await resolveInventoryFreeSlots();
      availableSlots = freeSlotInfo?.freeSlots ?? configuredSlots;
      slotsLeft = Number.isFinite(availableSlots) ? availableSlots : 0;
      gardenPlants = collectGardenPlantSlots(currentGarden, aliasMap, ignoredDirt);
      mispositionedGardenPlants = (() => {
        const map = new Map<string, number[]>();
        for (const [key, obj] of Object.entries(currentGarden.tileObjects || {})) {
          const idx = Number(key);
          if (Number.isFinite(idx) && ignoredDirt.has(idx)) continue;
          if (blockedSet.has(idx)) continue;
          if (!obj || typeof obj !== "object") continue;
          const type = String((obj as any).objectType || "").toLowerCase();
          if (type !== "plant") continue;
          const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
          const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
          if (!Number.isFinite(idx) || !species) continue;
          const desired = desiredSpeciesBySlot.get(idx);
          const desiredMutations = desiredMutationBySlot.get(idx) || [];
          if (desired && desired === species) {
            if (!desiredMutations.length || plantHasMutationsInclusive(obj, desiredMutations)) continue;
          }
          if (!map.has(species)) map.set(species, []);
          map.get(species)!.push(idx);
        }
        return map;
      })();
      mispositionedGardenDecors = (() => {
        const map = new Map<string, DecorSlot[]>();
        const addSlots = (
          tileType: "Dirt" | "Boardwalk",
          entries: Record<string, any>,
          desiredMap: Map<number, string>,
          ignored: Set<number>
        ) => {
          for (const [key, obj] of Object.entries(entries || {})) {
            const idx = Number(key);
            if (Number.isFinite(idx) && ignored.has(idx)) continue;
            if (!obj || typeof obj !== "object") continue;
            const type = String((obj as any).objectType || "").toLowerCase();
            if (type !== "decor") continue;
            const decorId = String((obj as any).decorId || "");
            if (!decorId || !Number.isFinite(idx)) continue;
            const desired = desiredMap.get(idx);
            if (desired && desired === decorId) continue;
            if (!map.has(decorId)) map.set(decorId, []);
            map.get(decorId)!.push({ tileType, localIdx: idx });
          }
        };
        addSlots("Dirt", currentGarden.tileObjects || {}, desiredDecorBySlotDirt, ignoredDirt);
        addSlots(
          "Boardwalk",
          currentGarden.boardwalkTileObjects || {},
          desiredDecorBySlotBoardwalk,
          ignoredBoardwalk
        );
        return map;
      })();
      const inventory = await getInventoryCounts();
      decorCounts = new Map(inventory.decors);
      if (inventoryDirty) {
        invPlants = await readPlantInventoryBySpecies(aliasMap);
        invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
        removeUsedFromInventoryMaps(invPlants, invPlantsByMutation);
        invIndex = buildInventoryIndex(invPlantsByMutation);
        inventoryDirty = false;
      }

      let passChanges = 0;
      const dirtEntries = groupDirtEntries();
      for (const [localIdx, obj] of dirtEntries) {
        if (await checkCancelled()) return false;
        if (blockedSet.size && !blockedSet.has(localIdx) && !getCurrentTileObject(currentGarden, "Dirt", localIdx, dirtCoords)) {
          // empty slot, still place
        }
        if (await processTile("Dirt", localIdx, obj)) passChanges += 1;
      }
      const boardEntries = groupBoardEntries();
      for (const [localIdx, obj] of boardEntries) {
        if (await checkCancelled()) return false;
        if (await processTile("Boardwalk", localIdx, obj)) passChanges += 1;
      }
      finalPass = pass + 1;
      if (passChanges === 0) {
        const hasPendingTargets = (() => {
          for (const [idx, species] of desiredSpeciesBySlot.entries()) {
            if (blockedSet.has(idx)) continue;
            const curObj = getCurrentTileObject(currentGarden, "Dirt", idx, dirtCoords);
            const mutationObj =
              curObj && !hasMutationSlots(curObj) ? getGardenTileObject(currentGarden, "Dirt", idx) : curObj;
            const curType = String((curObj as any)?.objectType ?? (curObj as any)?.type ?? "");
            if (curType !== "plant") return true;
            const curSpecies = resolvePlantSpeciesKey(
              String((curObj as any)?.species || (curObj as any)?.seedKey || ""),
              aliasMap
            );
            if (!curSpecies || curSpecies !== species) return true;
            const desiredMutations = desiredMutationBySlot.get(idx) || [];
            if (desiredMutations.length && !plantHasMutationsInclusive(mutationObj || curObj, desiredMutations)) {
              return true;
            }
          }
          for (const [idx, decorId] of desiredDecorBySlotDirt.entries()) {
            const curObj = getCurrentTileObject(currentGarden, "Dirt", idx, dirtCoords);
            const curType = String((curObj as any)?.objectType ?? (curObj as any)?.type ?? "");
            const curId = curType === "decor" ? String((curObj as any)?.decorId || "") : "";
            if (!curId || curId !== decorId) return true;
          }
          for (const [idx, decorId] of desiredDecorBySlotBoardwalk.entries()) {
            const curObj = getCurrentTileObject(currentGarden, "Boardwalk", idx, boardCoords);
            const curType = String((curObj as any)?.objectType ?? (curObj as any)?.type ?? "");
            const curId = curType === "decor" ? String((curObj as any)?.decorId || "") : "";
            if (!curId || curId !== decorId) return true;
          }
          return false;
        })();
        if (hasPendingTargets) {
          inventoryDirty = true;
          await delay(400);
          continue;
        }
        break;
      }
      await delay(140);
    }
    try {
      console.log(`[GLC GardenLayout] Attempts ${finalPass}/${MAX_PASSES} finished`);
    } catch {}
    try {
      console.info("[GLC GardenLayout][Apply] Inventory plants used before stop", debugUsedInventory);
    } catch {}
    await logInventorySnapshot("After apply");
  } catch (err) {
    if (!opts.allowClientSide) return false;
    return setCurrentGarden(garden);
  }

  return true;
}

function getGardenTileObject(current: GardenState, tileType: "Dirt" | "Boardwalk", localIdx: number) {
  return tileType === "Dirt"
    ? (current.tileObjects || {})[String(localIdx)]
    : (current.boardwalkTileObjects || {})[String(localIdx)];
}

function getCurrentTileObject(
  current: GardenState,
  tileType: "Dirt" | "Boardwalk",
  localIdx: number,
  coordMap: Map<number, { x: number; y: number }>
) {
  if (tos.isReady()) {
    const coords = coordMap.get(localIdx);
    if (coords) {
      const info = tos.getTileObject(coords.x, coords.y, { ensureView: true });
      return (info as any)?.tileObject ?? null;
    }
  }
  return getGardenTileObject(current, tileType, localIdx);
}

async function readPlantInventoryBySpecies(aliasMap: Map<string, string> = getPlantAliasMap()): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  try {
    const inventory = await Store.select<any>("myInventoryAtom");
    const items = extractInventoryItems(inventory);
    for (const entry of items) {
      if (!entry || typeof entry !== "object") continue;
      const source =
        (entry as any).item && typeof (entry as any).item === "object"
          ? (entry as any).item
          : entry;
      if (!source || typeof source !== "object") continue;
      const type = String(source.itemType ?? source.data?.itemType ?? source.type ?? "").toLowerCase();
      if (!type.includes("plant")) continue;
      const rawSpecies =
        source.species ??
        source.plantSpecies ??
        source.seedSpecies ??
        source.cropSpecies ??
        source.baseSpecies ??
        source.itemSpecies ??
        source.data?.plantSpecies ??
        source.data?.species ??
        (Array.isArray(source.slots) && source.slots[0]?.species ? source.slots[0].species : "");
      const species = resolvePlantSpeciesKey(String(rawSpecies || ""), aliasMap);
      const id = String(source.id ?? source.plantId ?? source.itemId ?? source.data?.id ?? "");
      if (!species || !id) continue;
      if (!map.has(species)) map.set(species, []);
      map.get(species)!.push(id);
    }
  } catch {}
  return map;
}

type InventoryPlantEntry = { id: string; mutations: string[] };

function getInventoryPlantMutations(source: any): string[] {
  const out = new Set<string>();
  const slots = Array.isArray(source?.slots) ? source.slots : Array.isArray(source?.data?.slots) ? source.data.slots : [];
  for (const slot of slots) {
    const list = normalizeMutationList(slot?.mutations);
    for (const mut of list) out.add(mut);
  }
  if (Array.isArray(source?.mutations)) {
    const list = normalizeMutationList(source.mutations);
    for (const mut of list) out.add(mut);
  }
  return Array.from(out);
}

async function readPlantInventoryBySpeciesWithMutations(
  aliasMap: Map<string, string> = getPlantAliasMap()
): Promise<Map<string, InventoryPlantEntry[]>> {
  const map = new Map<string, InventoryPlantEntry[]>();
  try {
    const inventory = await Store.select<any>("myInventoryAtom");
    const items = extractInventoryItems(inventory);
    for (const entry of items) {
      if (!entry || typeof entry !== "object") continue;
      const source =
        (entry as any).item && typeof (entry as any).item === "object"
          ? (entry as any).item
          : entry;
      if (!source || typeof source !== "object") continue;
      const type = String(source.itemType ?? source.data?.itemType ?? source.type ?? "").toLowerCase();
      if (!type.includes("plant")) continue;
      const rawSpecies =
        source.species ??
        source.plantSpecies ??
        source.seedSpecies ??
        source.cropSpecies ??
        source.baseSpecies ??
        source.itemSpecies ??
        source.data?.plantSpecies ??
        source.data?.species ??
        (Array.isArray(source.slots) && source.slots[0]?.species ? source.slots[0].species : "");
      const species = resolvePlantSpeciesKey(String(rawSpecies || ""), aliasMap);
      const id = String(source.id ?? source.plantId ?? source.itemId ?? source.data?.id ?? "");
      if (!species || !id) continue;
      const mutations = getInventoryPlantMutations(source);
      if (!map.has(species)) map.set(species, []);
      map.get(species)!.push({ id, mutations });
    }
  } catch {}
  return map;
}

type PlantInventoryDebugEntry = {
  id: string;
  species: string;
  rawSpecies: string;
  itemType: string;
};

function consumeInventoryItem(
  invPlants: Map<string, string[]>,
  invPlantsByMutation: Map<string, InventoryPlantEntry[]>,
  invIndex: Map<string, { species: string; mutations: string[] }>,
  itemId: string
): boolean {
  let matchedSpecies: string | null = null;
  for (const [species, entries] of invPlantsByMutation.entries()) {
    const idx = entries.findIndex((entry) => entry.id === itemId);
    if (idx >= 0) {
      entries.splice(idx, 1);
      matchedSpecies = species;
      break;
    }
  }
  if (matchedSpecies) {
    const speciesList = invPlants.get(matchedSpecies);
    if (speciesList) {
      const idx = speciesList.indexOf(itemId);
      if (idx >= 0) {
        speciesList.splice(idx, 1);
      }
    }
  } else {
    for (const [species, ids] of invPlants.entries()) {
      const idx = ids.indexOf(itemId);
      if (idx >= 0) {
        ids.splice(idx, 1);
        matchedSpecies = species;
        break;
      }
    }
  }
  invIndex.delete(itemId);
  return Boolean(matchedSpecies);
}

async function readPlantInventoryDebugSnapshot(): Promise<PlantInventoryDebugEntry[]> {
  const out: PlantInventoryDebugEntry[] = [];
  try {
    const inventory = await Store.select<any>("myInventoryAtom");
    const items = extractInventoryItems(inventory);
    const aliasMap = getPlantAliasMap();
    for (const entry of items) {
      if (!entry || typeof entry !== "object") continue;
      const source =
        (entry as any).item && typeof (entry as any).item === "object"
          ? (entry as any).item
          : entry;
      if (!source || typeof source !== "object") continue;
      const itemType = String(source.itemType ?? source.data?.itemType ?? source.type ?? "");
      const rawSpecies =
        source.species ??
        source.plantSpecies ??
        source.seedSpecies ??
        source.cropSpecies ??
        source.baseSpecies ??
        source.itemSpecies ??
        source.data?.plantSpecies ??
        source.data?.species ??
        (Array.isArray(source.slots) && source.slots[0]?.species ? source.slots[0].species : "");
      const species = resolvePlantSpeciesKey(String(rawSpecies || ""), aliasMap);
      const id = String(source.id ?? source.plantId ?? source.itemId ?? source.data?.id ?? "");
      if (!itemType) continue;
      if (!String(itemType).toLowerCase().includes("plant")) continue;
      out.push({
        id,
        species,
        rawSpecies: String(rawSpecies || ""),
        itemType: String(itemType),
      });
    }
  } catch {}
  return out;
}

function normalizeSpeciesKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/(seed|plant|baby|fruit|crop)$/i, "");
}

function buildPlantSpeciesAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  const register = (key: unknown, species: string) => {
    if (typeof key !== "string") return;
    const normalized = normalizeSpeciesKey(key.trim());
    if (!normalized) return;
    if (!map.has(normalized)) map.set(normalized, species);
  };

  for (const [species, entry] of Object.entries(plantCatalog as Record<string, any>)) {
    register(species, species);
    register(entry?.seed?.name, species);
    register(entry?.plant?.name, species);
    register(entry?.crop?.name, species);
  }

  return map;
}

let cachedAliasMap: Map<string, string> | null = null;
function getPlantAliasMap(): Map<string, string> {
  if (!cachedAliasMap) {
    cachedAliasMap = buildPlantSpeciesAliasMap();
  }
  return cachedAliasMap;
}

function resolvePlantSpeciesKey(raw: string, aliasMap: Map<string, string>): string {
  if (!raw) return "";
  if ((plantCatalog as any)?.[raw]) return raw;
  const normalized = normalizeSpeciesKey(raw);
  const mapped = aliasMap.get(normalized);
  if (mapped) return mapped;
  for (const key of Object.keys(plantCatalog as Record<string, any>)) {
    if (normalizeSpeciesKey(key) === normalized) return key;
  }
  return raw;
}

const mutationKeys = new Set(Object.keys(mutationCatalog || {}));
function normalizeMutationTag(value: unknown): string {
  const raw = typeof value === "string" ? value : value == null ? "" : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const collapsed = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  switch (collapsed) {
    case "gold":
      return "Gold";
    case "rainbow":
      return "Rainbow";
    case "wet":
      return "Wet";
    case "chilled":
      return "Chilled";
    case "frozen":
      return "Frozen";
    case "dawn":
    case "dawnlit":
    case "dawnlight":
      return "Dawnlit";
    case "dawnbound":
    case "dawncharged":
    case "dawnradiant":
      return "Dawncharged";
    case "amberlit":
    case "amberlight":
    case "amberglow":
    case "ambershine":
      return "Amberlit";
    case "amberbound":
    case "ambercharged":
    case "amberradiant":
      return "Ambercharged";
    default: {
      if (mutationKeys.has(trimmed)) return trimmed;
      const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      return mutationKeys.has(normalized) ? normalized : trimmed;
    }
  }
}

function normalizeMutationList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const entry of raw) {
    const normalized = normalizeMutationTag(entry);
    if (normalized) out.add(normalized);
  }
  return Array.from(out);
}

function getPlantMutations(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  const slots = Array.isArray(obj.slots) ? obj.slots : Array.isArray(obj.data?.slots) ? obj.data.slots : [];
  const out = new Set<string>();
  for (const slot of slots) {
    const list = normalizeMutationList(slot?.mutations);
    for (const mut of list) out.add(mut);
  }
  return Array.from(out);
}

function hasOnlyMutation(list: unknown, mutation: string | null): boolean {
  const normalized = normalizeMutationTag(mutation);
  if (!normalized) return false;
  const muts = normalizeMutationList(list);
  return muts.length === 1 && muts[0] === normalized;
}

function hasMutation(list: unknown, mutation: string | null): boolean {
  const normalized = normalizeMutationTag(mutation);
  if (!normalized) return false;
  const muts = normalizeMutationList(list);
  return muts.includes(normalized);
}

function getDesiredMutations(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  const raw: string[] = [];
  if (Array.isArray((obj as any).glcMutations)) {
    raw.push(...(obj as any).glcMutations);
  }
  if (typeof (obj as any).glcMutation === "string") {
    raw.push((obj as any).glcMutation);
  }
  return normalizeMutationList(raw);
}

function plantHasMutation(obj: any, mutation: string | null): boolean {
  if (!mutation) return false;
  const muts = getPlantMutations(obj);
  return hasOnlyMutation(muts, mutation);
}

function plantHasMutationInclusive(obj: any, mutation: string | null): boolean {
  if (!mutation) return false;
  const muts = getPlantMutations(obj);
  return hasMutation(muts, mutation);
}

function plantHasMutationsInclusive(obj: any, mutations: string[]): boolean {
  if (!Array.isArray(mutations) || !mutations.length) return true;
  const muts = getPlantMutations(obj);
  return mutations.every((mutation) => hasMutation(muts, mutation));
}

function mutationKeyFor(species: string, mutation?: string | null): string {
  return `${species}::${mutation || ""}`;
}

function mutationSetKey(species: string, mutations: string[]): string {
  const list = (mutations || []).slice().sort((a, b) => a.localeCompare(b));
  return `${species}::${list.join("+")}`;
}

function getPlantListBySpecies(map: Map<string, string[]>, species: string): string[] | undefined {
  if (!species) return undefined;
  const direct = map.get(species);
  if (direct) return direct;
  const normalized = normalizeSpeciesKey(species);
  for (const [key, value] of map.entries()) {
    if (normalizeSpeciesKey(key) === normalized) return value;
  }
  return undefined;
}

function getPlantListByMutation(
  map: Map<string, InventoryPlantEntry[]>,
  species: string,
  mutation: string
): string[] | undefined {
  if (!species || !mutation) return undefined;
  const direct = map.get(species) || [];
  const normalized = normalizeSpeciesKey(species);
  const entries = direct.length
    ? direct
    : Array.from(map.entries())
        .filter(([key]) => normalizeSpeciesKey(key) === normalized)
        .flatMap(([, value]) => value);
  if (!entries.length) return undefined;
  const matched = entries.filter((entry) => hasMutation(entry.mutations, mutation)).map((entry) => entry.id);
  return matched.length ? matched : undefined;
}

function getPlantListByMutations(
  map: Map<string, InventoryPlantEntry[]>,
  species: string,
  mutations: string[]
): string[] | undefined {
  if (!species) return undefined;
  const required = normalizeMutationList(mutations);
  if (!required.length) return getPlantListBySpecies(map as any, species);
  const direct = map.get(species) || [];
  const normalized = normalizeSpeciesKey(species);
  const entries = direct.length
    ? direct
    : Array.from(map.entries())
        .filter(([key]) => normalizeSpeciesKey(key) === normalized)
        .flatMap(([, value]) => value);
  if (!entries.length) return undefined;
  const matched = entries
    .filter((entry) => required.every((mut) => hasMutation(entry.mutations, mut)))
    .map((entry) => entry.id);
  return matched.length ? matched : undefined;
}

function countGardenPlants(
  current: GardenState,
  aliasMap: Map<string, string>,
  ignored: Set<number> = new Set()
): Map<string, number> {
  const map = new Map<string, number>();
  for (const [key, obj] of Object.entries(current.tileObjects || {})) {
    const idx = Number(key);
    if (Number.isFinite(idx) && ignored.has(idx)) continue;
    if (!obj || typeof obj !== "object") continue;
    const type = String((obj as any).objectType || "").toLowerCase();
    if (type !== "plant") continue;
    const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
    const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
    addCount(map, species, 1);
  }
  return map;
}

function countGardenPlantsByMutation(
  current: GardenState,
  aliasMap: Map<string, string>,
  ignored: Set<number> = new Set()
): Map<string, number> {
  const map = new Map<string, number>();
  for (const [key, obj] of Object.entries(current.tileObjects || {})) {
    const idx = Number(key);
    if (Number.isFinite(idx) && ignored.has(idx)) continue;
    if (!obj || typeof obj !== "object") continue;
    const type = String((obj as any).objectType || "").toLowerCase();
    if (type !== "plant") continue;
    const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
    const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
    const mutations = getPlantMutations(obj);
    for (const mutation of mutations) {
      addCount(map, mutationKeyFor(species, mutation), 1);
    }
  }
  return map;
}

function countGardenDecors(
  current: GardenState,
  ignoredDirt: Set<number> = new Set(),
  ignoredBoardwalk: Set<number> = new Set()
): Map<string, number> {
  const map = new Map<string, number>();
  const count = (entries: Record<string, any>, ignored: Set<number>) => {
    for (const [key, obj] of Object.entries(entries || {})) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type !== "decor") continue;
      const decorId = String((obj as any).decorId || "");
      addCount(map, decorId, 1);
    }
  };
  count(current.tileObjects || {}, ignoredDirt);
  count(current.boardwalkTileObjects || {}, ignoredBoardwalk);
  return map;
}

function collectGardenPlantSlots(
  current: GardenState,
  aliasMap: Map<string, string>,
  ignored: Set<number> = new Set()
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const [key, obj] of Object.entries(current.tileObjects || {})) {
    const idx = Number(key);
    if (Number.isFinite(idx) && ignored.has(idx)) continue;
    if (!obj || typeof obj !== "object") continue;
    const type = String((obj as any).objectType || "").toLowerCase();
    if (type !== "plant") continue;
    const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
    const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
    if (!Number.isFinite(idx)) continue;
    if (!map.has(species)) map.set(species, []);
    map.get(species)!.push(idx);
  }
  return map;
}

function collectGardenMutationSources(
  current: GardenState,
  aliasMap: Map<string, string>,
  ignored: Set<number>,
  desiredSpeciesBySlot: Map<number, string>,
  desiredMutationBySlot: Map<number, string[]>
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const [key, obj] of Object.entries(current.tileObjects || {})) {
    const idx = Number(key);
    if (Number.isFinite(idx) && ignored.has(idx)) continue;
    if (!obj || typeof obj !== "object") continue;
    const type = String((obj as any).objectType || "").toLowerCase();
    if (type !== "plant") continue;
    const rawSpecies = String((obj as any).species || (obj as any).seedKey || "");
    const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
    if (!Number.isFinite(idx) || !species) continue;
    const desiredSpecies = desiredSpeciesBySlot.get(idx);
    const desiredMutations = desiredMutationBySlot.get(idx) || [];
    if (
      desiredSpecies &&
      desiredSpecies === species &&
      desiredMutations.length &&
      plantHasMutationsInclusive(obj, desiredMutations)
    ) {
      continue;
    }
    if (!map.has(species)) map.set(species, []);
    map.get(species)!.push(idx);
  }
  return map;
}

type DecorSlot = { tileType: "Dirt" | "Boardwalk"; localIdx: number };

function collectGardenDecorSlots(
  current: GardenState,
  ignoredDirt: Set<number> = new Set(),
  ignoredBoardwalk: Set<number> = new Set()
): Map<string, DecorSlot[]> {
  const map = new Map<string, DecorSlot[]>();
  const collect = (entries: Record<string, any>, tileType: "Dirt" | "Boardwalk") => {
    for (const [key, obj] of Object.entries(entries || {})) {
      const idx = Number(key);
      const ignored = tileType === "Dirt" ? ignoredDirt : ignoredBoardwalk;
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type !== "decor") continue;
      const decorId = String((obj as any).decorId || "");
      if (!decorId || !Number.isFinite(idx)) continue;
      if (!map.has(decorId)) map.set(decorId, []);
      map.get(decorId)!.push({ tileType, localIdx: idx });
    }
  };
  collect(current.tileObjects || {}, "Dirt");
  collect(current.boardwalkTileObjects || {}, "Boardwalk");
  return map;
}

function removeGardenDecorSlot(
  map: Map<string, DecorSlot[]>,
  decorId: string,
  tileType: "Dirt" | "Boardwalk",
  localIdx: number
): void {
  const list = map.get(decorId);
  if (!list || !list.length) return;
  const idx = list.findIndex((slot) => slot.tileType === tileType && slot.localIdx === localIdx);
  if (idx >= 0) list.splice(idx, 1);
}

function takeGardenDecorSlot(
  map: Map<string, DecorSlot[]>,
  decorId: string,
  excludeType: "Dirt" | "Boardwalk",
  excludeIdx: number
): DecorSlot | null {
  const list = map.get(decorId);
  if (!list || !list.length) return null;
  let idx = list.findIndex((slot) => slot.tileType !== excludeType || slot.localIdx !== excludeIdx);
  if (idx < 0) idx = 0;
  const picked = list.splice(idx, 1)[0];
  return picked || null;
}

async function ensureDecorAvailable(
  counts: Map<string, number>,
  slots: Map<string, DecorSlot[]>,
  decorId: string,
  excludeType: "Dirt" | "Boardwalk",
  excludeIdx: number
): Promise<boolean> {
  const have = counts.get(decorId) || 0;
  if (have > 0) {
    counts.set(decorId, have - 1);
    return true;
  }
  const picked = takeGardenDecorSlot(slots, decorId, excludeType, excludeIdx);
  if (!picked) return false;
  await PlayerService.pickupDecor(picked.tileType, picked.localIdx);
  addCount(counts, decorId, 1);
  counts.set(decorId, (counts.get(decorId) || 0) - 1);
  await delay(60);
  return true;
}

function takeGardenPlantSlot(map: Map<string, number[]>, species: string, excludeIdx: number): number | null {
  const list = map.get(species);
  if (!list || !list.length) return null;
  let idx = list.findIndex((value) => value !== excludeIdx);
  if (idx < 0) idx = 0;
  const picked = list.splice(idx, 1)[0];
  return Number.isFinite(picked) ? picked : null;
}

async function potGardenPlantsBatch(
  map: Map<string, number[]>,
  species: string,
  maxCount: number,
  excludeIdx: number
): Promise<number> {
  let count = 0;
  const limit = Math.max(0, Math.floor(maxCount));
  while (count < limit) {
    if (applyCancelRequested) break;
    const sourceIdx = takeGardenPlantSlot(map, species, excludeIdx);
    if (sourceIdx == null) break;
    await PlayerService.potPlant(sourceIdx);
    count += 1;
    await delay(60);
  }
  return count;
}

function takeGardenPlantSlotWithMutation(
  current: GardenState,
  map: Map<string, number[]>,
  species: string,
  mutation: string,
  excludeIdx: number
): number | null {
  const list = map.get(species);
  if (!list || !list.length) return null;
  for (let i = 0; i < list.length; i++) {
    const idx = list[i];
    if (idx === excludeIdx) continue;
    const obj = (current.tileObjects || {})[String(idx)];
    if (obj && plantHasMutation(obj, mutation)) {
      list.splice(i, 1);
      return idx;
    }
  }
  for (let i = 0; i < list.length; i++) {
    const idx = list[i];
    if (idx === excludeIdx) continue;
    const obj = (current.tileObjects || {})[String(idx)];
    if (obj && plantHasMutationInclusive(obj, mutation)) {
      list.splice(i, 1);
      return idx;
    }
  }
  return null;
}

function takeGardenPlantSlotWithMutations(
  current: GardenState,
  map: Map<string, number[]>,
  species: string,
  mutations: string[],
  excludeIdx: number
): number | null {
  const list = map.get(species);
  if (!list || !list.length) return null;
  for (let i = 0; i < list.length; i++) {
    const idx = list[i];
    if (idx === excludeIdx) continue;
    const obj = (current.tileObjects || {})[String(idx)];
    if (obj && plantHasMutationsInclusive(obj, mutations)) {
      list.splice(i, 1);
      return idx;
    }
  }
  return null;
}

async function potGardenPlantsBatchWithMutation(
  current: GardenState,
  map: Map<string, number[]>,
  species: string,
  mutation: string,
  maxCount: number,
  excludeIdx: number
): Promise<number> {
  let count = 0;
  const limit = Math.max(0, Math.floor(maxCount));
  while (count < limit) {
    if (applyCancelRequested) break;
    const sourceIdx = takeGardenPlantSlotWithMutation(current, map, species, mutation, excludeIdx);
    if (sourceIdx == null) break;
    await PlayerService.potPlant(sourceIdx);
    count += 1;
    await delay(60);
  }
  return count;
}

async function potGardenPlantsBatchWithMutations(
  current: GardenState,
  map: Map<string, number[]>,
  species: string,
  mutations: string[],
  maxCount: number,
  excludeIdx: number
): Promise<number> {
  let count = 0;
  const limit = Math.max(0, Math.floor(maxCount));
  while (count < limit) {
    if (applyCancelRequested) break;
    const sourceIdx = takeGardenPlantSlotWithMutations(current, map, species, mutations, excludeIdx);
    if (sourceIdx == null) break;
    await PlayerService.potPlant(sourceIdx);
    count += 1;
    await delay(60);
  }
  return count;
}

function injectTileObjectRaw(tx: number, ty: number, obj: any): boolean {
  try {
    const info = tos.getTileObject(tx, ty, { ensureView: true });
    const tv = (info as any)?.tileView;
    if (!tv || typeof tv.onDataChanged !== "function") return false;
    const cloned = (() => {
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch {
        return obj;
      }
    })();
    tv.onDataChanged(cloned);
    const status = tos.getStatus();
    const ctx = (status.engine as any)?.reusableContext;
    if (ctx && typeof tv.update === "function") {
      try {
        tv.update(ctx);
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

function findPlayerSlot(
  slots: any,
  playerId: string,
  opts: { sortObject?: boolean } = {}
): SlotMatch | null {
  if (!slots || typeof slots !== "object") return null;
  const isMatch = (slot: any) => slot && String(slot.playerId || slot.id || "") === String(playerId);

  if (Array.isArray(slots)) {
    const arr = slots as any[];
    for (let i = 0; i < arr.length; i++) {
      if (isMatch(arr[i])) {
        return { isArray: true, matchSlot: arr[i], matchIndex: i, entries: null, slotsArray: arr };
      }
    }
    return null;
  }

  const entries = Object.entries(slots as Record<string, any>);
  if (opts.sortObject) entries.sort(([a], [b]) => compareSlotKeys(a, b));

  for (let i = 0; i < entries.length; i++) {
    const [, s] = entries[i];
    if (isMatch(s)) {
      return { isArray: false, matchSlot: s, matchIndex: i, entries, slotsArray: null };
    }
  }
  return null;
}

type SlotMatch = {
  isArray: boolean;
  matchSlot: any;
  matchIndex: number;
  entries: Array<[string, any]> | null;
  slotsArray: any[] | null;
};

function compareSlotKeys(a: string, b: string): number {
  const ai = Number(a);
  const bi = Number(b);
  if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
  return a.localeCompare(b);
}

function slotMatchToIndex(meta: SlotMatch): number {
  if (meta.isArray) return meta.matchIndex;
  const entry = meta.entries?.[meta.matchIndex];
  const k = entry ? entry[0] : null;
  const n = Number(k);
  return Number.isFinite(n) ? n : 0;
}

function rebuildUserSlots(meta: SlotMatch, buildSlot: (slot: any) => any): any {
  if (meta.isArray) {
    const nextSlots = (meta.slotsArray || []).slice();
    nextSlots[meta.matchIndex] = buildSlot(meta.matchSlot);
    return nextSlots;
  }
  const nextEntries = (meta.entries || []).map(([k, s], idx) =>
    idx === meta.matchIndex ? [k, buildSlot(s)] : [k, s]
  );
  return Object.fromEntries(nextEntries);
}

function buildStateWithUserSlots(cur: any, userSlots: any) {
  return {
    ...(cur || {}),
    child: {
      ...(cur?.child || {}),
      data: {
        ...(cur?.child?.data || {}),
        userSlots,
      },
    },
  };
}

function extractInventoryItems(rawInventory: any): any[] {
  if (!rawInventory) return [];
  if (Array.isArray(rawInventory)) return rawInventory;
  if (Array.isArray(rawInventory.items)) return rawInventory.items;
  if (Array.isArray(rawInventory.inventory)) return rawInventory.inventory;
  if (Array.isArray(rawInventory.inventory?.items)) return rawInventory.inventory.items;
  return [];
}

async function getInventoryCounts(): Promise<InventoryCounts> {
  const counts: InventoryCounts = {
    seeds: new Map(),
    plants: new Map(),
    decors: new Map(),
    eggs: new Map(),
    tools: new Map(),
  };
  const toolEntries: InventoryDebugEntry[] = [];
  const potLikeEntries: InventoryDebugEntry[] = [];
  const typeCounts = new Map<string, number>();
  const toolRawItems: Array<Record<string, unknown>> = [];
  let itemsCount = 0;

  try {
    const inventory = await Store.select<any>("myInventoryAtom");
    const items = extractInventoryItems(inventory);
    itemsCount = items.length;
    const aliasMap = getPlantAliasMap();
    for (const entry of items) {
      if (!entry || typeof entry !== "object") continue;
      const source =
        (entry as any).item && typeof (entry as any).item === "object"
          ? (entry as any).item
          : entry;
      if (!source || typeof source !== "object") continue;
      const typeRaw = String(source.itemType ?? source.data?.itemType ?? "");
      const type = typeRaw.toLowerCase();
      const quantity = Number(source.quantity ?? source.count ?? 1);
      typeCounts.set(typeRaw || "(empty)", (typeCounts.get(typeRaw || "(empty)") || 0) + 1);
      if (type === "seed") {
        const rawSpecies = String(source.species ?? source.seedSpecies ?? source.data?.species ?? "");
        const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
        if (species) addCount(counts.seeds, species, quantity);
      } else if (type === "plant") {
        const rawSpecies = String(
          source.species ??
            source.plantSpecies ??
            source.seedSpecies ??
            source.cropSpecies ??
            source.baseSpecies ??
            source.data?.species ??
            ""
        );
        const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
        if (species) addCount(counts.plants, species, quantity);
      } else if (type === "decor") {
        const decorId = String(source.decorId ?? source.data?.decorId ?? "");
        if (decorId) addCount(counts.decors, decorId, quantity);
      } else if (type === "egg") {
        const eggId = String(source.eggId ?? source.data?.eggId ?? "");
        if (eggId) addCount(counts.eggs, eggId, quantity);
      } else if (type === "tool" || type === "item") {
        const itemName = String(
          source.name ??
            source.itemName ??
            source.toolId ??
            source.itemId ??
            source.data?.name ??
            source.data?.toolId ??
            source.data?.itemId ??
            ""
        );
        if (toolRawItems.length < 50) {
          toolRawItems.push({
            id: source.id,
            toolId: source.toolId,
            itemId: source.itemId,
            name: source.name,
            itemName: source.itemName,
            itemType: source.itemType ?? source.data?.itemType,
            dataName: source.data?.name,
            dataId: source.data?.id,
            dataToolId: source.data?.toolId,
            dataItemId: source.data?.itemId,
            rawKeys: Object.keys(source || {}),
            dataKeys: source.data && typeof source.data === "object" ? Object.keys(source.data) : [],
          });
        }
        if (itemName) {
          addCount(counts.tools, itemName, quantity);
          if (toolEntries.length < 50) {
            toolEntries.push({
              name: itemName,
              quantity,
              itemType: String(source.itemType ?? source.data?.itemType ?? ""),
              raw: {
                id: source.id,
                toolId: source.toolId,
                itemId: source.itemId,
                name: source.name,
                itemName: source.itemName,
                itemType: source.itemType,
                dataName: source.data?.name,
                dataId: source.data?.id,
                dataToolId: source.data?.toolId,
                dataItemId: source.data?.itemId,
              },
            });
          }
        }
      } else {
        const candidateName = String(source.name ?? source.itemName ?? source.data?.name ?? "");
        if (candidateName && /pot/i.test(candidateName)) {
          if (potLikeEntries.length < 50) {
            potLikeEntries.push({
              name: candidateName,
              quantity,
              itemType: typeRaw,
              raw: {
                id: source.id,
                  toolId: source.toolId,
                  itemId: source.itemId,
                name: source.name,
                itemName: source.itemName,
                itemType: source.itemType,
                dataName: source.data?.name,
                  dataId: source.data?.id,
                  dataToolId: source.data?.toolId,
                  dataItemId: source.data?.itemId,
              },
            });
          }
        }
      }
    }
  } catch {}

  lastInventoryDebug = {
    itemsCount,
    toolEntries,
    potLikeEntries,
    typeCounts: Object.fromEntries(typeCounts),
    toolRawItems,
  };
  try {
    (window as any).__GLC_LastInventoryDebug = lastInventoryDebug;
  } catch {}
  return counts;
}

async function getInventoryPlantMutationCounts(aliasMap: Map<string, string>): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const bySpecies = await readPlantInventoryBySpeciesWithMutations(aliasMap);
  for (const [species, items] of bySpecies.entries()) {
    for (const entry of items) {
      for (const mutation of entry.mutations) {
        addCount(counts, mutationKeyFor(species, mutation), 1);
      }
    }
  }
  return counts;
}

function addCount(map: Map<string, number>, key: string, qty: number) {
  if (!key) return;
  const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
  map.set(key, (map.get(key) || 0) + q);
}

async function buildMissingItems(garden: GardenState, inventory: InventoryCounts, current: GardenState | null): Promise<MissingItem[]> {
  const aliasMap = getPlantAliasMap();
  const requiredPlants = collectRequiredPlants(garden, aliasMap);
  const requiredDecors = new Map<string, number>();
  const requiredEggs = new Map<string, number>();

  const register = (map: Map<string, number>, id: string | null) => {
    if (!id) return;
    map.set(id, (map.get(id) || 0) + 1);
  };

  const mapEntries: Array<["Dirt" | "Boardwalk", Record<string, any>]> = [
    ["Dirt", garden?.tileObjects || {}],
    ["Boardwalk", garden?.boardwalkTileObjects || {}],
  ];
  for (const [tileType, map] of mapEntries) {
    const ignored = getIgnoredSet(garden, tileType);
    for (const [key, obj] of Object.entries(map)) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String((obj as any).objectType || "").toLowerCase();
      if (type === "decor") {
        const decorId = String((obj as any).decorId || (obj as any).id || "");
        register(requiredDecors, decorId || null);
      } else if (type === "egg") {
        const eggId = String((obj as any).eggId || (obj as any).id || "");
        register(requiredEggs, eggId || null);
      }
    }
  }

  const missing: MissingItem[] = [];
  const gardenPlantCounts = current ? countGardenPlants(current, aliasMap, getIgnoredSet(garden, "Dirt")) : new Map<string, number>();
  const linkedAvailability = await getLinkedAvailability(requiredPlants, current, aliasMap, garden);
  const gardenDecorCounts = current
    ? countGardenDecors(
        current,
		getIgnoredSet(garden, "Dirt"),
        getIgnoredSet(garden, "Boardwalk")
      )
    : new Map<string, number>();
  for (const entry of requiredPlants.values()) {
    const id = entry.id;
    const mutations = entry.mutations;
    const key = mutationSetKey(id, mutations);
    const have = mutations.length
      ? linkedAvailability.mutation.get(key) || 0
      : (inventory.plants.get(id) || 0) + (gardenPlantCounts.get(id) || 0);
    if (have < entry.needed) {
      missing.push({
        type: "plant",
        id,
        mutation: mutations.length ? mutations.join("+") : undefined,
        needed: entry.needed,
        have,
      });
    }
  }
  for (const [id, needed] of requiredDecors) {
    const have = (inventory.decors.get(id) || 0) + (gardenDecorCounts.get(id) || 0);
    if (have < needed) missing.push({ type: "decor", id, needed, have });
  }
  for (const [id, needed] of requiredEggs) {
    const have = inventory.eggs.get(id) || 0;
    if (have < needed) missing.push({ type: "egg", id, needed, have });
  }

  return missing;
}

function formatMissingSummary(missing: MissingItem[]): string {
  const lines = missing.slice(0, 6).map((m) => {
    const mutation = m.mutation ? ` (${m.mutation})` : "";
    return `${m.id}${mutation} (${m.have}/${m.needed})`;
  });
  if (missing.length > 6) lines.push(`+${missing.length - 6} more`);
  return lines.join(", ");
}

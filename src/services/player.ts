import { sendToGame } from "../core/webSocketBridge";

export type GardenState = {
  tileObjects: Record<string, any>;
  boardwalkTileObjects: Record<string, any>;
};

export const PlayerService = {
  async potPlant(slot: number) {
    try { sendToGame({ type: "PotPlant", slot }); } catch {}
  },
  async plantGardenPlant(slot: number, itemId: string) {
    try { sendToGame({ type: "PlantGardenPlant", slot, itemId }); } catch {}
  },
  async placeDecor(tileType: "Dirt" | "Boardwalk", localTileIndex: number, decorId: string, rotation: 0) {
    try { sendToGame({ type: "PlaceDecor", tileType, localTileIndex, decorId, rotation }); } catch {}
  },
  async pickupDecor(tileType: "Dirt" | "Boardwalk", localTileIndex: number) {
    try { sendToGame({ type: "PickupDecor", tileType, localTileIndex }); } catch {}
  },
};

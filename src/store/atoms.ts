export type GardenState = {
  tileObjects: Record<string, any>;
  boardwalkTileObjects: Record<string, any>;
  ignoredTiles?: {
    dirt?: number[];
    boardwalk?: number[];
  };
};

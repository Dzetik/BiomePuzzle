export type Edge = 'top' | 'right' | 'bottom' | 'left';

export type Rotation = 0 | 90 | 180 | 270;

export type Color = string; // Например '#FF0000' или 'red'

export interface EdgeColors {
  top: Color;
  right: Color;
  bottom: Color;
  left: Color;
}

export interface TileData {
  id: string;
  textureKey: string; // Ключ текстуры для маппинга в UI слое
  baseEdges?: EdgeColors; // Цвета рёбер в состоянии поворота 0
  activeSide?: Edge;
  canSpawnInSpawner?: boolean;
}
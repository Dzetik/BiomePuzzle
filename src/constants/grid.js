import { DEFAULT_TILE_SIZE } from './tile';

// Параметры сетки
export const GRID = {
  COLS: 8,
  ROWS: 12,
  CELL_SIZE: DEFAULT_TILE_SIZE.width,
};

// Смещение сетки на экране
export const GRID_OFFSET = {
  x: 0,
  y: 80, // отступ от статус-бара
};
import { DEFAULT_TILE_SIZE } from './tile';

// ========================================
// КОНФИГУРАЦИЯ СЕТКИ
// ========================================

// Базовые параметры сетки
export const BASE_GRID = {
  COLS: 8,                    // Количество колонок для рендера
  ROWS: 12,                   // Количество строк для рендера
  CELL_SIZE: DEFAULT_TILE_SIZE.width, // 90px - базовый размер ячейки
};

// Виртуальная сетка (бесконечная)
export const VIRTUAL_GRID = {
  MIN_COL: -100,              // Минимальная колонка (достаточно большое число)
  MAX_COL: 100,               // Максимальная колонка
  MIN_ROW: -100,
  MAX_ROW: 100,
};

// Ограничение на количество пустых ячеек от границы
export const MAX_EMPTY_CELLS = 5;

// Базовое смещение сетки относительно верхнего левого угла экрана
export const BASE_GRID_OFFSET = {
  x: 0,
  y: 80,
};

export const GRID = { ...BASE_GRID };
export const GRID_OFFSET = { ...BASE_GRID_OFFSET };
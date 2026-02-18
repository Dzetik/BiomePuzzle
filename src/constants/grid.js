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
  y: 80,
};

// ========================================
// Центры притяжения для плиток
// ========================================

/**
 * Получает центр конкретной ячейки сетки
 * @param {number} col - колонка (0-7)
 * @param {number} row - строка (0-11)
 * @returns {Object} координаты центра ячейки {x, y}
 */
export const getCellCenter = (col, row) => {
  return {
    x: GRID_OFFSET.x + col * GRID.CELL_SIZE + GRID.CELL_SIZE / 2,
    y: GRID_OFFSET.y + row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2,
  };
};

/**
 * Находит ближайшую ячейку по координатам центра плитки
 * @param {number} centerX - X центра плитки
 * @param {number} centerY - Y центра плитки
 * @returns {Object} {col, row, x, y} ближайшей ячейки
 */
export const findNearestCell = (centerX, centerY) => {
  // Переводим глобальные координаты в локальные относительно сетки
  const localX = centerX - GRID_OFFSET.x;
  const localY = centerY - GRID_OFFSET.y;
  
  // Определяем колонку и строку по положению центра
  let col = Math.floor(localX / GRID.CELL_SIZE);
  let row = Math.floor(localY / GRID.CELL_SIZE);
  
  // Ограничиваем границами сетки
  col = Math.max(0, Math.min(col, GRID.COLS - 1));
  row = Math.max(0, Math.min(row, GRID.ROWS - 1));
  
  const cellCenter = getCellCenter(col, row);
  
  return {
    col,
    row,
    x: cellCenter.x,
    y: cellCenter.y,
  };
};

// Вспомогательные функции
export const getCellSize = () => GRID.CELL_SIZE;
export const getGridCols = () => GRID.COLS;
export const getGridRows = () => GRID.ROWS;
export const getGridOffset = () => ({ ...GRID_OFFSET });
// src/utils/gridUtils.js
// ========================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С КООРДИНАТАМИ СЕТКИ
// ========================================

import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
import { DEFAULT_TILE_SIZE } from '../constants/tile';

/**
 * Вычисляет позицию левого верхнего угла ячейки с учётом смещения и зума
 * @param {number} col - колонка
 * @param {number} row - строка
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} { x: number, y: number }
 */
export const getCellCornerWithOffset = (col, row, scale, offsetX, offsetY) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;

  return {
    x: baseOffsetX + col * cellSize - offsetX,
    y: baseOffsetY + row * cellSize - offsetY,
  };
};

/**
 * Вычисляет позицию для "примагничивания" плитки к центру ячейки
 * @param {Object} tileSize - { width, height } размер плитки
 * @param {number} col - колонка
 * @param {number} row - строка
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} { x: number, y: number }
 */
export const getSnapToCellPosition = (tileSize, col, row, scale, offsetX, offsetY) => {
  const { x, y } = getCellCornerWithOffset(col, row, scale, offsetX, offsetY);
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  
  return {
    x: x + (cellSize - tileSize.width) / 2,
    y: y + (cellSize - tileSize.height) / 2,
  };
};

// ============================================================================
// 🔑 НОВЫЕ ФУНКЦИИ ДЛЯ ВАЛИДАЦИИ ГРАНИЦ ГРИДА
// ============================================================================

/**
 * Проверяет, находится ли ячейка в пределах допустимого грида
 * @param {number} col - колонка
 * @param {number} row - строка
 * @param {Object} bounds - опциональные кастомные границы
 *   @param {number} bounds.minCol - минимальная колонка (по умолчанию 0)
 *   @param {number} bounds.maxCol - максимальная колонка (по умолчанию BASE_GRID.COLS - 1)
 *   @param {number} bounds.minRow - минимальная строка (по умолчанию 0)
 *   @param {number} bounds.maxRow - максимальная строка (по умолчанию BASE_GRID.ROWS - 1)
 * @returns {boolean} true если ячейка в пределах грида
 */
export const isCellWithinGrid = (col, row, bounds = null) => {
  'worklet';
  
  const minCol = bounds?.minCol ?? 0;
  const maxCol = bounds?.maxCol ?? BASE_GRID.COLS - 1;
  const minRow = bounds?.minRow ?? 0;
  const maxRow = bounds?.maxRow ?? BASE_GRID.ROWS - 1;
  
  return (
    Number.isInteger(col) && 
    Number.isInteger(row) &&
    col >= minCol && 
    col <= maxCol && 
    row >= minRow && 
    row <= maxRow
  );
};

/**
 * Обёртка над getSnapToCellPosition с валидацией границ
 * Возвращает null, если позиция вне грида — плитка не должна размещаться
 * @param {Object} tileSize - { width, height }
 * @param {number} col - колонка
 * @param {number} row - строка
 * @param {number} scale - масштаб
 * @param {number} offsetX - смещение X
 * @param {number} offsetY - смещение Y
 * @param {Object} bounds - опциональные кастомные границы
 * @returns {Object | null} позиция для привязки или null если вне границ
 */
export const getValidatedSnapPosition = (
  tileSize,
  col,
  row,
  scale,
  offsetX,
  offsetY,
  bounds = null
) => {
  'worklet';
  
  if (!isCellWithinGrid(col, row, bounds)) {
    return null;
  }
  return getSnapToCellPosition(tileSize, col, row, scale, offsetX, offsetY);
};

/**
 * Получает дефолтные границы грида из констант
 * @returns {Object} { minCol, maxCol, minRow, maxRow }
 */
export const getDefaultGridBounds = () => ({
  minCol: 0,
  maxCol: BASE_GRID.COLS - 1,
  minRow: 0,
  maxRow: BASE_GRID.ROWS - 1,
});

/**
 * Преобразует экранные координаты в координаты ячейки грида
 * (обратная операция к getCellCornerWithOffset)
 * @param {number} screenX - координата X на экране
 * @param {number} screenY - координата Y на экране
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} { col: number, row: number, fractionalX: number, fractionalY: number }
 */
export const getGridCoordsFromScreen = (screenX, screenY, scale, offsetX, offsetY) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;

  // Учитываем, что offset инвертирован при панорамировании
  const gridX = (screenX + offsetX - baseOffsetX) / cellSize;
  const gridY = (screenY + offsetY - baseOffsetY) / cellSize;

  return {
    col: Math.floor(gridX),
    row: Math.floor(gridY),
    fractionalX: gridX % 1,
    fractionalY: gridY % 1,
  };
};

/**
 * Проверяет, находится ли точка экрана в пределах видимой области грида
 * @param {number} screenX - координата X на экране
 * @param {number} screenY - координата Y на экране
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @param {Object} bounds - опциональные кастомные границы
 * @returns {boolean}
 */
export const isScreenPointInGrid = (screenX, screenY, scale, offsetX, offsetY, bounds = null) => {
  const { col, row } = getGridCoordsFromScreen(screenX, screenY, scale, offsetX, offsetY);
  return isCellWithinGrid(col, row, bounds);
};

/**
 * Вычисляет расстояние между двумя ячейками (манхэттенское)
 * @param {Object} a - { col, row }
 * @param {Object} b - { col, row }
 * @returns {number}
 */
export const getCellDistance = (a, b) => {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
};

/**
 * Получает соседние ячейки для данной (4-направленные)
 * @param {number} col - колонка
 * @param {number} row - строка
 * @param {Object} bounds - опциональные границы для фильтрации
 * @returns {Array<{ col: number, row: number }>}
 */
export const getAdjacentCells = (col, row, bounds = null) => {
  const directions = [
    { col: 0, row: -1 }, // вверх
    { col: 0, row: 1 },  // вниз
    { col: -1, row: 0 }, // влево
    { col: 1, row: 0 },  // вправо
  ];

  return directions
    .map(dir => ({ col: col + dir.col, row: row + dir.row }))
    .filter(cell => isCellWithinGrid(cell.col, cell.row, bounds));
};

/**
 * Получает соседние ячейки для данной (8-направленные, включая диагонали)
 * @param {number} col - колонка
 * @param {number} row - строка
 * @param {Object} bounds - опциональные границы для фильтрации
 * @returns {Array<{ col: number, row: number }>}
 */
export const getAdjacentCells8 = (col, row, bounds = null) => {
  const directions = [
    { col: 0, row: -1 },   // вверх
    { col: 0, row: 1 },    // вниз
    { col: -1, row: 0 },   // влево
    { col: 1, row: 0 },    // вправо
    { col: -1, row: -1 },  // вверх-влево
    { col: 1, row: -1 },   // вверх-вправо
    { col: -1, row: 1 },   // вниз-влево
    { col: 1, row: 1 },    // вниз-вправо
  ];

  return directions
    .map(dir => ({ col: col + dir.col, row: row + dir.row }))
    .filter(cell => isCellWithinGrid(cell.col, cell.row, bounds));
};
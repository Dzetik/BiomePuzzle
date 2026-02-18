import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
import { isCenterOverSpawner, getSnapToSpawnerPosition } from './spawnerUtils';

// ========================================
// ВСЕ ФУНКЦИИ ДЛЯ РАБОТЫ С СЕТКОЙ
// ========================================

/**
 * Получает центр конкретной ячейки сетки с учетом масштаба
 */
export const getCellCenter = (col, row, scale = 1.0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const offsetX = BASE_GRID_OFFSET.x * scale;
  const offsetY = BASE_GRID_OFFSET.y * scale;
  
  return {
    x: offsetX + col * cellSize + cellSize / 2,
    y: offsetY + row * cellSize + cellSize / 2,
  };
};

/**
 * Получает координаты верхнего левого угла ячейки
 */
export const getCellCorner = (col, row, scale = 1.0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const offsetX = BASE_GRID_OFFSET.x * scale;
  const offsetY = BASE_GRID_OFFSET.y * scale;
  
  return {
    x: offsetX + col * cellSize,
    y: offsetY + row * cellSize,
  };
};

/**
 * Находит ближайшую ячейку по координатам центра плитки
 */
export const findNearestCell = (centerX, centerY, scale = 1.0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const offsetX = BASE_GRID_OFFSET.x * scale;
  const offsetY = BASE_GRID_OFFSET.y * scale;
  
  const localX = centerX - offsetX;
  const localY = centerY - offsetY;
  
  let col = Math.floor(localX / cellSize);
  let row = Math.floor(localY / cellSize);
  
  col = Math.max(0, Math.min(col, BASE_GRID.COLS - 1));
  row = Math.max(0, Math.min(row, BASE_GRID.ROWS - 1));
  
  const cellCenter = getCellCenter(col, row, scale);
  
  return {
    col,
    row,
    x: cellCenter.x,
    y: cellCenter.y,
  };
};

/**
 * Получает размер ячейки с учетом масштаба
 */
export const getCellSize = (scale = 1.0) => BASE_GRID.CELL_SIZE * scale;

/**
 * Получает количество колонок сетки
 */
export const getGridCols = () => BASE_GRID.COLS;

/**
 * Получает количество строк сетки
 */
export const getGridRows = () => BASE_GRID.ROWS;

/**
 * Получает смещение сетки с учетом масштаба
 */
export const getGridOffset = (scale = 1.0) => ({ 
  x: BASE_GRID_OFFSET.x * scale, 
  y: BASE_GRID_OFFSET.y * scale 
});

// ========================================
// ФУНКЦИИ ПРИТЯГИВАНИЯ
// ========================================

/**
 * Вычисляет позицию для притягивания к конкретной ячейке
 * @param {Object} position - текущая позиция плитки {x, y}
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {number} scale - текущий масштаб
 * @returns {Object} новая позиция {x, y} для притягивания
 */
const snapToGridPosition = (position, tileSize, scale) => {
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  
  const nearestCell = findNearestCell(centerX, centerY, scale);
  
  return {
    x: Math.round(nearestCell.x - tileSize.width / 2),
    y: Math.round(nearestCell.y - tileSize.height / 2),
  };
};

/**
 * Основная функция притягивания
 * @param {Object} position - текущая позиция плитки
 * @param {Object} tileSize - размер плитки
 * @param {number} scale - текущий масштаб
 * @returns {Object} позиция после притягивания
 */
export const snapToGrid = (position, tileSize = null, scale = 1.0) => {
  if (!position || !tileSize) return { ...position };
  
  if (isCenterOverSpawner(position, tileSize)) {
    return getSnapToSpawnerPosition(tileSize);
  }
  
  return snapToGridPosition(position, tileSize, scale);
};
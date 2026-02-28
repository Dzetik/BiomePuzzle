import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';

// ========================================
// ВСЕ ФУНКЦИИ ДЛЯ РАБОТЫ С СЕТКОЙ
// ========================================

/**
 * Получает центр конкретной ячейки сетки с учетом масштаба и смещения
 */
export const getCellCenter = (col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffset = BASE_GRID_OFFSET.x * scale;
  
  return {
    x: baseOffset + col * cellSize + cellSize / 2 - offsetX,
    y: baseOffset + row * cellSize + cellSize / 2 - offsetY,
  };
};

/**
 * Получает координаты верхнего левого угла ячейки с учетом смещения
 * ЭТА ФУНКЦИЯ НУЖНА ДЛЯ CellView
 */
export const getCellCornerWithOffset = (col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffset = BASE_GRID_OFFSET.x * scale;
  
  return {
    x: baseOffset + col * cellSize - offsetX,
    y: baseOffset + row * cellSize - offsetY,
  };
};

/**
 * Получает координаты верхнего левого угла ячейки (без смещения в названии для обратной совместимости)
 */
export const getCellCorner = (col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  return getCellCornerWithOffset(col, row, scale, offsetX, offsetY);
};

/**
 * Находит ближайшую ячейку по координатам центра плитки
 */
export const findNearestCell = (centerX, centerY, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffset = BASE_GRID_OFFSET.x * scale;
  
  // Переводим абсолютные координаты в координаты сетки
  const gridX = centerX + offsetX - baseOffset;
  const gridY = centerY + offsetY - baseOffset;
  
  let col = Math.floor(gridX / cellSize);
  let row = Math.floor(gridY / cellSize);
  
  return { col, row };
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
 */
const snapToGridPosition = (position, tileSize, scale, offsetX, offsetY) => {
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  
  const nearestCell = findNearestCell(centerX, centerY, scale, offsetX, offsetY);
  const cellCenter = getCellCenter(nearestCell.col, nearestCell.row, scale, offsetX, offsetY);
  
  return {
    x: Math.round(cellCenter.x - tileSize.width / 2),
    y: Math.round(cellCenter.y - tileSize.height / 2),
  };
};

/**
 * Основная функция притягивания
 */
export const snapToGrid = (position, tileSize = null, scale = 1.0, offsetX = 0, offsetY = 0) => {
  if (!position || !tileSize) return { ...position };
  
  // Проверка на спавнер должна быть здесь, но пока упростим
  return snapToGridPosition(position, tileSize, scale, offsetX, offsetY);
};
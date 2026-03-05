// ========================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С СЕТКОЙ
// ========================================
import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
// ✅ ОБНОВЛЕНО: импорт из SpawnerService вместо spawnerUtils
import { SpawnerService } from '../services/SpawnerService';

// ========================================
// ФУНКЦИИ СЕТКИ
// ========================================

/**
 * Получает центр конкретной ячейки сетки с учетом масштаба и смещения
 */
export const getCellCenter = (col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;
  
  return {
    x: baseOffsetX + col * cellSize + cellSize / 2 - offsetX,
    y: baseOffsetY + row * cellSize + cellSize / 2 - offsetY,
  };
};

/**
 * Получает координаты верхнего левого угла ячейки
 */
export const getCellCornerWithOffset = (col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;
  
  return {
    x: baseOffsetX + col * cellSize - offsetX,
    y: baseOffsetY + row * cellSize - offsetY,
  };
};

/**
 * Находит ближайшую ячейку по координатам центра плитки
 */
export const findNearestCell = (centerX, centerY, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;
  
  const gridX = (centerX + offsetX - baseOffsetX) / cellSize;
  const gridY = (centerY + offsetY - baseOffsetY) / cellSize;
  
  const col = Math.floor(gridX);
  const row = Math.floor(gridY);
  
  return { col, row };
};

/**
 * Получает размер ячейки с учетом масштаба
 */
export const getCellSize = (scale = 1.0) => BASE_GRID.CELL_SIZE * scale;

/**
 * Получает количество колонок для рендера
 */
export const getGridCols = () => BASE_GRID.COLS;

/**
 * Получает количество строк для рендера
 */
export const getGridRows = () => BASE_GRID.ROWS;

/**
 * Получает базовое смещение сетки с учетом масштаба
 */
export const getGridOffset = (scale = 1.0) => ({
  x: BASE_GRID_OFFSET.x * scale,
  y: BASE_GRID_OFFSET.y * scale
});

// ========================================
// ФУНКЦИИ ПРИТЯГИВАНИЯ (SNAP)
// ========================================

/**
 * Вычисляет позицию верхнего левого угла плитки для конкретной ячейки
 */
export const getSnapToCellPosition = (tileSize, col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;
  
  const centerX = baseOffsetX + col * cellSize + cellSize / 2 - offsetX;
  const centerY = baseOffsetY + row * cellSize + cellSize / 2 - offsetY;
  
  return {
    x: centerX - tileSize.width / 2,
    y: centerY - tileSize.height / 2,
  };
};

/**
 * Основная функция притягивания
 * Приоритет 1: спавнер (если в зоне притяжения)
 * Приоритет 2: сетка (ближайшая ячейка)
 */
export const snapToGrid = (position, tileSize = null, scale = 1.0, offsetX = 0, offsetY = 0, spawnerPos = null) => {
  if (!position || !tileSize) return { ...position };
  
  // ПРОВЕРКА СПАВНЕРА (приоритет 1)
  if (spawnerPos) {
    const centerX = position.x + tileSize.width / 2;
    const centerY = position.y + tileSize.height / 2;
    const spawnerCenterX = spawnerPos.x + spawnerPos.size / 2;
    const spawnerCenterY = spawnerPos.y + spawnerPos.size / 2;

    const distance = Math.sqrt(
      Math.pow(centerX - spawnerCenterX, 2) + 
      Math.pow(centerY - spawnerCenterY, 2)
    );

    const threshold = spawnerPos.size * 2;

    // ✅ ОБНОВЛЕНО: используем SpawnerService вместо isCenterOverSpawner
    if (distance < threshold || SpawnerService.isCenterOverSpawner(position, tileSize, spawnerPos)) {
      // ✅ ОБНОВЛЕНО: используем SpawnerService вместо getSnapToSpawnerPosition
      return SpawnerService.getSnapToSpawnerPosition(tileSize, spawnerPos);
    }
  }
  
  // ПРИТЯГИВАНИЕ К СЕТКЕ (приоритет 2)
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  const { col, row } = findNearestCell(centerX, centerY, scale, offsetX, offsetY);
  
  return getSnapToCellPosition(tileSize, col, row, scale, offsetX, offsetY);
};
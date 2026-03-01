import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
import { isCenterOverSpawner, getSnapToSpawnerPosition } from './spawnerUtils';

// ========================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С СЕТКОЙ
// 
// Содержат все функции для:
// - Получения координат ячеек (центр, углы)
// - Поиска ближайшей ячейки по координатам
// - Притягивания плитки к ячейкам
// - Работы с размерами и масштабом
// ========================================

/**
 * Получает центр конкретной ячейки сетки с учетом масштаба и смещения
 * @param {number} col - колонка ячейки
 * @param {number} row - строка ячейки
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} координаты центра ячейки {x, y}
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
 * Получает координаты верхнего левого угла ячейки с учетом смещения
 * Используется для отрисовки ячеек в GridView
 * @param {number} col - колонка ячейки
 * @param {number} row - строка ячейки
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} координаты угла ячейки {x, y}
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
 * @param {number} centerX - абсолютная координата X центра плитки
 * @param {number} centerY - абсолютная координата Y центра плитки
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} координаты ячейки {col, row}
 */
export const findNearestCell = (centerX, centerY, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;
  
  // Переводим абсолютные координаты в координаты сетки
  const gridX = (centerX + offsetX - baseOffsetX) / cellSize;
  const gridY = (centerY + offsetY - baseOffsetY) / cellSize;
  
  // floor даёт индекс ячейки (левая верхняя)
  const col = Math.floor(gridX);
  const row = Math.floor(gridY);
  
  return { col, row };
};

/**
 * Получает размер ячейки с учетом масштаба
 * @param {number} scale - текущий масштаб
 * @returns {number} размер ячейки в пикселях
 */
export const getCellSize = (scale = 1.0) => BASE_GRID.CELL_SIZE * scale;

/**
 * Получает количество колонок для рендера (из конфига)
 */
export const getGridCols = () => BASE_GRID.COLS;

/**
 * Получает количество строк для рендера (из конфига)
 */
export const getGridRows = () => BASE_GRID.ROWS;

/**
 * Получает базовое смещение сетки с учетом масштаба
 * @param {number} scale - текущий масштаб
 * @returns {Object} смещение {x, y}
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
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {number} col - колонка
 * @param {number} row - строка
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} позиция верхнего левого угла плитки {x, y}
 */
export const getSnapToCellPosition = (tileSize, col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;
  
  // Центр ячейки
  const centerX = baseOffsetX + col * cellSize + cellSize / 2 - offsetX;
  const centerY = baseOffsetY + row * cellSize + cellSize / 2 - offsetY;
  
  // Позиция верхнего левого угла плитки (центр - половина размера)
  return {
    x: centerX - tileSize.width / 2,
    y: centerY - tileSize.height / 2,
  };
};

/**
 * Основная функция притягивания
 * Определяет, куда должна переместиться плитка при отпускании:
 * - Приоритет 1: спавнер (если в зоне притяжения)
 * - Приоритет 2: сетка (ближайшая ячейка)
 * 
 * @param {Object} position - текущая позиция плитки {x, y}
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @param {Object} spawnerPos - позиция спавнера {x, y, size} (опционально)
 * @returns {Object} позиция после притягивания {x, y}
 */
export const snapToGrid = (position, tileSize = null, scale = 1.0, offsetX = 0, offsetY = 0, spawnerPos = null) => {
  if (!position || !tileSize) return { ...position };
  
  // ПРОВЕРКА СПАВНЕРА (приоритет 1)
  if (spawnerPos) {
    const centerX = position.x + tileSize.width / 2;
    const centerY = position.y + tileSize.height / 2;
    
    const spawnerCenterX = spawnerPos.x + spawnerPos.size / 2;
    const spawnerCenterY = spawnerPos.y + spawnerPos.size / 2;
    
    // Расстояние от центра плитки до центра спавнера
    const distance = Math.sqrt(
      Math.pow(centerX - spawnerCenterX, 2) + 
      Math.pow(centerY - spawnerCenterY, 2)
    );
    
    // Зона притяжения = 2 размера спавнера
    const threshold = spawnerPos.size * 2;
    
    if (distance < threshold || isCenterOverSpawner(position, tileSize, spawnerPos)) {
      return getSnapToSpawnerPosition(tileSize, spawnerPos);
    }
  }
  
  // ПРИТЯГИВАНИЕ К СЕТКЕ (приоритет 2)
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  const { col, row } = findNearestCell(centerX, centerY, scale, offsetX, offsetY);
  
  return getSnapToCellPosition(tileSize, col, row, scale, offsetX, offsetY);
};
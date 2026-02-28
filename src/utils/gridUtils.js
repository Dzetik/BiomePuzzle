import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
import { isCenterOverSpawner, getSnapToSpawnerPosition } from './spawnerUtils';

// ========================================
// ВСЕ ФУНКЦИИ ДЛЯ РАБОТЫ С СЕТКОЙ
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
  // Размер ячейки с учётом масштаба
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  // Базовый отступ сетки (от левого края) с учётом масштаба
  const baseOffset = BASE_GRID_OFFSET.x * scale;
  
  // Формула: базовый отступ + колонка*размер + половина размера - смещение камеры
  return {
    x: baseOffset + col * cellSize + cellSize / 2 - offsetX,
    y: baseOffset + row * cellSize + cellSize / 2 - offsetY,
  };
};

/**
 * Получает координаты верхнего левого угла ячейки с учетом смещения
 * ЭТА ФУНКЦИЯ НУЖНА ДЛЯ CellView
 * @param {number} col - колонка ячейки
 * @param {number} row - строка ячейки
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} координаты угла ячейки {x, y}
 */
export const getCellCornerWithOffset = (col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffset = BASE_GRID_OFFSET.x * scale;
  
  // Формула: базовый отступ + колонка*размер - смещение камеры
  return {
    x: baseOffset + col * cellSize - offsetX,
    y: baseOffset + row * cellSize - offsetY,
  };
};

/**
 * Получает координаты верхнего левого угла ячейки (синоним для обратной совместимости)
 */
export const getCellCorner = (col, row, scale = 1.0, offsetX = 0, offsetY = 0) => {
  return getCellCornerWithOffset(col, row, scale, offsetX, offsetY);
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
  const baseOffset = BASE_GRID_OFFSET.x * scale;
  
  // Переводим абсолютные координаты в координаты сетки
  // gridX = абсолютная позиция + смещение - базовый отступ
  const gridX = centerX + offsetX - baseOffset;
  const gridY = centerY + offsetY - baseOffset;
  
  // Делим на размер ячейки и округляем вниз
  const col = Math.floor(gridX / cellSize);
  const row = Math.floor(gridY / cellSize);
  
  return { col, row };
};

/**
 * Получает размер ячейки с учетом масштаба
 * @param {number} scale - текущий масштаб
 * @returns {number} размер ячейки в пикселях
 */
export const getCellSize = (scale = 1.0) => BASE_GRID.CELL_SIZE * scale;

/**
 * Получает количество колонок сетки (для обратной совместимости)
 */
export const getGridCols = () => BASE_GRID.COLS;

/**
 * Получает количество строк сетки (для обратной совместимости)
 */
export const getGridRows = () => BASE_GRID.ROWS;

/**
 * Получает смещение сетки с учетом масштаба (для обратной совместимости)
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
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {Object} новая позиция {x, y}
 */
const snapToGridPosition = (position, tileSize, scale, offsetX, offsetY) => {
  // Находим центр плитки
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  
  // Находим ближайшую ячейку к центру
  const nearestCell = findNearestCell(centerX, centerY, scale, offsetX, offsetY);
  
  // Получаем центр этой ячейки
  const cellCenter = getCellCenter(nearestCell.col, nearestCell.row, scale, offsetX, offsetY);
  
  // Вычисляем позицию верхнего левого угла плитки
  return {
    x: Math.round(cellCenter.x - tileSize.width / 2),
    y: Math.round(cellCenter.y - tileSize.height / 2),
  };
};

/**
 * Основная функция притягивания
 * Сначала проверяет спавнер (если передан), потом сетку
 * @param {Object} position - текущая позиция плитки
 * @param {Object} tileSize - размер плитки
 * @param {number} scale - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @param {Object} spawnerPos - позиция спавнера {x, y, size} (опционально)
 * @returns {Object} позиция после притягивания
 */
export const snapToGrid = (position, tileSize = null, scale = 1.0, offsetX = 0, offsetY = 0, spawnerPos = null) => {
  if (!position || !tileSize) return { ...position };
  
  // Всегда проверяем спавнер в первую очередь (приоритет)
  if (spawnerPos) {
    // Вычисляем центр плитки
    const centerX = position.x + tileSize.width / 2;
    const centerY = position.y + tileSize.height / 2;
    
    // Вычисляем центр спавнера
    const spawnerCenterX = spawnerPos.x + spawnerPos.size / 2;
    const spawnerCenterY = spawnerPos.y + spawnerPos.size / 2;
    
    // Вычисляем расстояние от центра плитки до центра спавнера
    const distance = Math.sqrt(
      Math.pow(centerX - spawnerCenterX, 2) + 
      Math.pow(centerY - spawnerCenterY, 2)
    );
    
    // Порог притяжения = 2 размера спавнера
    // Если плитка ближе этого расстояния - летит в спавнер
    const threshold = spawnerPos.size * 2;
    
    // Если плитка достаточно близко к спавнеру
    if (distance < threshold) {
      console.log('[snapToGrid] ПРИТЯГИВАЕМ К СПАВНЕРУ!');
      return getSnapToSpawnerPosition(tileSize, spawnerPos);
    }
    
    // Также проверяем прямое попадание центра в спавнер
    if (isCenterOverSpawner(position, tileSize, spawnerPos)) {
      console.log('[snapToGrid] Прямое попадание в спавнер');
      return getSnapToSpawnerPosition(tileSize, spawnerPos);
    }
  }
  
  // Если не притянулись к спавнеру - притягиваем к сетке
  return snapToGridPosition(position, tileSize, scale, offsetX, offsetY);
};
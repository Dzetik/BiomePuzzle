import { findNearestCell } from '../constants/grid';
import { isCenterOverSpawner, getSnapToSpawnerPosition } from './spawnerUtils';

// ========================================
// Утилиты для притягивания плиток к сетке
// ========================================

/**
 * Вычисляет позицию для притягивания к конкретной ячейке
 * @param {Object} position - текущая позиция плитки {x, y}
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {number} scale - текущий масштаб
 * @returns {Object} новая позиция {x, y} для притягивания
 */
const snapToGridPosition = (position, tileSize, scale) => {
  // Находим центр плитки
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  
  // Ищем ближайшую ячейку по центру
  const nearestCell = findNearestCell(centerX, centerY, scale);
  
  // Возвращаем позицию, где верхний левый угол плитки
  // совпадает с верхним левым углом ячейки
  return {
    x: Math.round(nearestCell.x - tileSize.width / 2),
    y: Math.round(nearestCell.y - tileSize.height / 2),
  };
};

/**
 * Основная функция притягивания - определяет, притягивать к сетке или спавнеру
 * @param {Object} position - текущая позиция плитки
 * @param {Object} tileSize - размер плитки
 * @param {number} scale - текущий масштаб
 * @returns {Object} позиция после притягивания
 */
export const snapToGrid = (position, tileSize = null, scale = 1.0) => {
  if (!position || !tileSize) return { ...position };
  
  // Если центр плитки над спавнером - притягиваем к спавнеру
  if (isCenterOverSpawner(position, tileSize)) {
    return getSnapToSpawnerPosition(tileSize);
  }
  
  // Иначе притягиваем к сетке
  return snapToGridPosition(position, tileSize, scale);
};
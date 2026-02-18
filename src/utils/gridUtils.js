import { findNearestCell } from '../constants/grid';
import { isCenterOverSpawner, getSnapToSpawnerPosition } from './spawnerUtils';

// ========================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С СЕТКОЙ
// ========================================

/**
 * Примагничивает позицию к ближайшей ячейке сетки
 */
const snapToGridPosition = (position, tileSize) => {
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  
  const nearestCell = findNearestCell(centerX, centerY);
  
  return {
    x: Math.round(nearestCell.x - tileSize.width / 2),
    y: Math.round(nearestCell.y - tileSize.height / 2),
  };
};

/**
 * Основная функция примагничивания
 */
export const snapToGrid = (position, tileSize = null) => {
  if (!position || !tileSize) return { ...position };
  
  if (isCenterOverSpawner(position, tileSize)) {
    return getSnapToSpawnerPosition(tileSize);
  }
  
  return snapToGridPosition(position, tileSize);
};
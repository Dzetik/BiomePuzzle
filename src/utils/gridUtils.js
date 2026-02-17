import { GRID, GRID_OFFSET } from '../constants/grid';
import { getCachedSpawnerPosition } from '../components/SpawnerCellView';

// ========================================
// Утилиты для работы с сеткой и примагничиванием
// ========================================

/**
 * Проверяет, находится ли центр плитки над спавнером
 * @param {Object} position - текущая позиция плитки {x, y}
 * @param {Object} tileSize - размер плитки {width, height}
 * @returns {boolean} true если центр плитки внутри спавнера
 */
export const isCenterOverSpawner = (position, tileSize) => {
  const spawnerPos = getCachedSpawnerPosition();
  if (!spawnerPos || !tileSize || !position) return false;
  
  // Вычисляем центр плитки
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  
  // Проверяем, попадает ли центр в границы спавнера
  return (
    centerX >= spawnerPos.x &&
    centerX <= spawnerPos.x + spawnerPos.size &&
    centerY >= spawnerPos.y &&
    centerY <= spawnerPos.y + spawnerPos.size
  );
};

/**
 * Вычисляет позицию для центрирования плитки относительно спавнера
 * @param {Object} tileSize - размер плитки {width, height}
 * @returns {Object} позиция {x, y} для размещения плитки по центру спавнера
 */
export const getSnapToSpawnerPosition = (tileSize) => {
  const spawnerPos = getCachedSpawnerPosition();
  if (!spawnerPos || !tileSize) return { x: 0, y: 0 };
  
  // Вычисляем центр спавнера
  const spawnerCenterX = spawnerPos.x + spawnerPos.size / 2;
  const spawnerCenterY = spawnerPos.y + spawnerPos.size / 2;
  
  // Возвращаем координаты левого верхнего угла плитки
  // при которых её центр совпадает с центром спавнера
  return {
    x: Math.round(spawnerCenterX - tileSize.width / 2),
    y: Math.round(spawnerCenterY - tileSize.height / 2)
  };
};

/**
 * Примагничивает позицию к ближайшей ячейке сетки
 * @param {Object} position - текущая позиция {x, y}
 * @returns {Object} позиция, выровненная по сетке
 */
const snapToGridPosition = (position) => {
  // Переводим глобальные координаты в координаты сетки
  const localX = position.x - GRID_OFFSET.x;
  const localY = position.y - GRID_OFFSET.y;
  
  // Определяем ближайшие колонку и строку
  const col = Math.round(localX / GRID.CELL_SIZE);
  const row = Math.round(localY / GRID.CELL_SIZE);
  
  // Ограничиваем границами сетки
  const clampedCol = Math.max(0, Math.min(col, GRID.COLS - 1));
  const clampedRow = Math.max(0, Math.min(row, GRID.ROWS - 1));
  
  // Возвращаем глобальные координаты выровненной позиции
  return {
    x: GRID_OFFSET.x + clampedCol * GRID.CELL_SIZE,
    y: GRID_OFFSET.y + clampedRow * GRID.CELL_SIZE,
  };
};

/**
 * Основная функция примагничивания
 * Определяет, к чему примагничивать плитку (спавнер или сетка)
 * @param {Object} position - текущая позиция
 * @param {Object} tileSize - размер плитки
 * @returns {Object} финальная позиция после примагничивания
 */
export const snapToGrid = (position, tileSize = null) => {
  if (!position || !tileSize) return { ...position };
  
  // Приоритет: если центр над спавнером - к спавнеру, иначе к сетке
  if (isCenterOverSpawner(position, tileSize)) {
    return getSnapToSpawnerPosition(tileSize);
  }
  
  return snapToGridPosition(position);
};
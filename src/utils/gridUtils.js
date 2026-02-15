import { GRID, GRID_OFFSET } from '../constants/grid';

/**
 * Преобразует координаты ячейки в пиксельные координаты НА ЭКРАНЕ
 * @param {number} col - колонка (0..COLS-1)
 * @param {number} row - строка (0..ROWS-1)
 * @returns {Object} { x, y } - координаты левого верхнего угла ячейки НА ЭКРАНЕ
 */
export const cellToPixel = (col, row) => ({
  x: GRID_OFFSET.x + col * GRID.CELL_SIZE,
  y: GRID_OFFSET.y + row * GRID.CELL_SIZE,
});

/**
 * Преобразует пиксельные координаты в ближайшую ячейку
 * @param {number} pixelX - X в пикселях (абсолютные координаты на экране)
 * @param {number} pixelY - Y в пикселях (абсолютные координаты на экране)
 * @returns {Object} { col, row } - индексы ближайшей ячейки
 */
export const pixelToCell = (pixelX, pixelY) => {
  // Вычитаем смещение сетки, чтобы перейти в локальные координаты сетки
  const localX = pixelX - GRID_OFFSET.x;
  const localY = pixelY - GRID_OFFSET.y;
  
  const col = Math.round(localX / GRID.CELL_SIZE);
  const row = Math.round(localY / GRID.CELL_SIZE);
  
  return {
    col: Math.max(0, Math.min(col, GRID.COLS - 1)),
    row: Math.max(0, Math.min(row, GRID.ROWS - 1)),
  };
};

/**
 * Привязывает позицию плитки к сетке
 * @param {Object} position - текущая позиция { x, y } (абсолютные координаты)
 * @returns {Object} - позиция, привязанная к сетке (абсолютные координаты)
 */
export const snapToGrid = (position) => {
  console.log('snapToGrid получил:', position);
  
  // Максимальная защита
  if (!position) {
    console.log('snapToGrid: position = null/undefined');
    return { x: GRID_OFFSET.x, y: GRID_OFFSET.y };
  }
  
  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    console.log('snapToGrid: position.x/y не числа', position);
    return { x: GRID_OFFSET.x, y: GRID_OFFSET.y };
  }
  
  if (isNaN(position.x) || isNaN(position.y)) {
    console.log('snapToGrid: position.x/y = NaN', position);
    return { x: GRID_OFFSET.x, y: GRID_OFFSET.y };
  }
  
  try {
    const { col, row } = pixelToCell(position.x, position.y);
    const result = cellToPixel(col, row);
    console.log('snapToGrid результат:', result);
    return result;
  } catch (error) {
    console.log('snapToGrid ошибка:', error.message);
    return { x: GRID_OFFSET.x, y: GRID_OFFSET.y };
  }
};
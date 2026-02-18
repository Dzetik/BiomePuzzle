import { DEFAULT_TILE_SIZE } from './tile';

// ========================================
// Конфигурация сетки игрового поля
// Все размеры базовые, масштабирование применяется через функции
// ========================================

// Базовые параметры сетки (не меняются при масштабировании)
const BASE_GRID = {
  COLS: 8,                    // Количество колонок
  ROWS: 12,                   // Количество строк
  CELL_SIZE: DEFAULT_TILE_SIZE.width, // 90px - базовый размер ячейки
};

// Базовое смещение сетки относительно верхнего левого угла экрана
const BASE_GRID_OFFSET = {
  x: 0,   // Сетка начинается от левого края
  y: 80,  // Отступ сверху для UI элементов
};

/**
 * Получает центр конкретной ячейки сетки с учетом масштаба
 * @param {number} col - колонка (0-7)
 * @param {number} row - строка (0-11)
 * @param {number} scale - текущий масштаб
 * @returns {Object} координаты центра ячейки {x, y}
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
 * Находит ближайшую ячейку по координатам центра плитки
 * @param {number} centerX - X центра проверяемого объекта
 * @param {number} centerY - Y центра проверяемого объекта
 * @param {number} scale - текущий масштаб
 * @returns {Object} {col, row, x, y} - индексы и координаты центра найденной ячейки
 */
export const findNearestCell = (centerX, centerY, scale = 1.0) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const offsetX = BASE_GRID_OFFSET.x * scale;
  const offsetY = BASE_GRID_OFFSET.y * scale;
  
  // Переводим глобальные координаты в локальные относительно сетки
  const localX = centerX - offsetX;
  const localY = centerY - offsetY;
  
  // Определяем индексы ячейки по положению центра
  let col = Math.floor(localX / cellSize);
  let row = Math.floor(localY / cellSize);
  
  // Ограничиваем границами сетки
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

// Вспомогательные функции для получения параметров сетки с учетом масштаба
export const getCellSize = (scale = 1.0) => BASE_GRID.CELL_SIZE * scale;
export const getGridCols = () => BASE_GRID.COLS;
export const getGridRows = () => BASE_GRID.ROWS;
export const getGridOffset = (scale = 1.0) => ({ 
  x: BASE_GRID_OFFSET.x * scale, 
  y: BASE_GRID_OFFSET.y * scale 
});

// Для обратной совместимости с компонентами, которые используют прямые константы
export const GRID = {
  COLS: BASE_GRID.COLS,
  ROWS: BASE_GRID.ROWS,
  CELL_SIZE: BASE_GRID.CELL_SIZE,
};

export const GRID_OFFSET = { ...BASE_GRID_OFFSET };
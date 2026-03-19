// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С КООРДИНАТАМИ СЕТКИ
// ============================================================================

import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';

/**
 * Вычисляет экранную позицию верхнего левого угла ячейки.
 *
 * Формула: `screenX = baseOffsetX + col * cellSize - offsetX`
 * Учитывает текущий масштаб и смещение при панорамировании.
 *
 * @param {number} col     - индекс колонки
 * @param {number} row     - индекс строки
 * @param {number} scale   - текущий масштаб (zoom)
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {{ x: number, y: number }} экранные координаты угла ячейки
 */
export const getCellCornerWithOffset = (col, row, scale, offsetX, offsetY) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;

  return {
    x: baseOffsetX + col * cellSize - offsetX,
    y: baseOffsetY + row * cellSize - offsetY,
  };
};

/**
 * Вычисляет экранную позицию для "примагничивания" плитки к центру ячейки.
 *
 * Центрирует плитку внутри ячейки: смещает от угла ячейки на половину
 * разницы между размером ячейки и размером плитки.
 *
 * @param {{ width: number, height: number }} tileSize - размер плитки в пикселях
 * @param {number} col     - индекс колонки
 * @param {number} row     - индекс строки
 * @param {number} scale   - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {{ x: number, y: number }} экранные координаты верхнего левого угла плитки
 */
export const getSnapToCellPosition = (tileSize, col, row, scale, offsetX, offsetY) => {
  const { x, y } = getCellCornerWithOffset(col, row, scale, offsetX, offsetY);
  const cellSize = BASE_GRID.CELL_SIZE * scale;

  return {
    x: x + (cellSize - tileSize.width) / 2,
    y: y + (cellSize - tileSize.height) / 2,
  };
};

// ============================================================================
// ВАЛИДАЦИЯ ГРАНИЦ СЕТКИ
// ============================================================================

/**
 * Проверяет, находится ли ячейка в пределах допустимых границ сетки.
 *
 * Помечена как 'worklet' для совместимости с Reanimated.
 * По умолчанию проверяет против BASE_GRID.COLS / BASE_GRID.ROWS.
 * Допускает целочисленные значения col и row.
 *
 * @param {number} col   - индекс колонки
 * @param {number} row   - индекс строки
 * @param {{ minCol?: number, maxCol?: number, minRow?: number, maxRow?: number } | null} bounds
 *   - кастомные границы (опционально); null использует значения по умолчанию
 * @returns {boolean} true если ячейка находится в пределах сетки
 */
export const isCellWithinGrid = (col, row, bounds = null) => {
  'worklet';

  const minCol = bounds?.minCol ?? 0;
  const maxCol = bounds?.maxCol ?? BASE_GRID.COLS - 1;
  const minRow = bounds?.minRow ?? 0;
  const maxRow = bounds?.maxRow ?? BASE_GRID.ROWS - 1;

  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= minCol &&
    col <= maxCol &&
    row >= minRow &&
    row <= maxRow
  );
};

/**
 * Возвращает позицию snap с предварительной проверкой границ.
 *
 * Если ячейка выходит за допустимые границы — возвращает null,
 * сигнализируя вызывающему коду, что размещение невозможно.
 *
 * @param {{ width: number, height: number }} tileSize - размер плитки
 * @param {number} col     - индекс колонки
 * @param {number} row     - индекс строки
 * @param {number} scale   - масштаб
 * @param {number} offsetX - смещение X
 * @param {number} offsetY - смещение Y
 * @param {Object | null} bounds - кастомные границы (опционально)
 * @returns {{ x: number, y: number } | null} позиция для snap или null если вне границ
 */
export const getValidatedSnapPosition = (
  tileSize,
  col,
  row,
  scale,
  offsetX,
  offsetY,
  bounds = null
) => {
  'worklet';

  if (!isCellWithinGrid(col, row, bounds)) {
    return null;
  }
  return getSnapToCellPosition(tileSize, col, row, scale, offsetX, offsetY);
};

/**
 * Возвращает стандартные границы сетки из констант BASE_GRID.
 *
 * @returns {{ minCol: number, maxCol: number, minRow: number, maxRow: number }}
 */
export const getDefaultGridBounds = () => ({
  minCol: 0,
  maxCol: BASE_GRID.COLS - 1,
  minRow: 0,
  maxRow: BASE_GRID.ROWS - 1,
});

/**
 * Преобразует экранные координаты в логические координаты ячейки сетки.
 *
 * Обратная операция к `getCellCornerWithOffset`. Возвращает также дробные
 * части (`fractionalX`, `fractionalY`) для определения позиции внутри ячейки.
 *
 * @param {number} screenX - координата X на экране
 * @param {number} screenY - координата Y на экране
 * @param {number} scale   - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @returns {{ col: number, row: number, fractionalX: number, fractionalY: number }}
 */
export const getGridCoordsFromScreen = (screenX, screenY, scale, offsetX, offsetY) => {
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffsetX = BASE_GRID_OFFSET.x * scale;
  const baseOffsetY = BASE_GRID_OFFSET.y * scale;

  // offsetX прибавляется (не вычитается) — компенсируем инверсию при панорамировании
  const gridX = (screenX + offsetX - baseOffsetX) / cellSize;
  const gridY = (screenY + offsetY - baseOffsetY) / cellSize;

  return {
    col: Math.floor(gridX),
    row: Math.floor(gridY),
    fractionalX: gridX % 1,
    fractionalY: gridY % 1,
  };
};

/**
 * Проверяет, попадает ли экранная точка в видимую область сетки.
 *
 * @param {number} screenX - координата X на экране
 * @param {number} screenY - координата Y на экране
 * @param {number} scale   - текущий масштаб
 * @param {number} offsetX - смещение сетки по X
 * @param {number} offsetY - смещение сетки по Y
 * @param {Object | null} bounds - кастомные границы (опционально)
 * @returns {boolean}
 */
export const isScreenPointInGrid = (screenX, screenY, scale, offsetX, offsetY, bounds = null) => {
  const { col, row } = getGridCoordsFromScreen(screenX, screenY, scale, offsetX, offsetY);
  return isCellWithinGrid(col, row, bounds);
};

/**
 * Вычисляет манхэттенское расстояние между двумя ячейками сетки.
 *
 * Манхэттенское расстояние = |Δcol| + |Δrow|. Используется для
 * определения "близости" ячеек при поиске соседей или путях.
 *
 * @param {{ col: number, row: number }} a - первая ячейка
 * @param {{ col: number, row: number }} b - вторая ячейка
 * @returns {number} расстояние в единицах ячеек
 */
export const getCellDistance = (a, b) => {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
};

/**
 * Возвращает список соседних ячеек по четырём направлениям (без диагоналей).
 *
 * Фильтрует ячейки за пределами допустимых границ.
 *
 * @param {number} col  - индекс колонки центральной ячейки
 * @param {number} row  - индекс строки центральной ячейки
 * @param {Object | null} bounds - кастомные границы (опционально)
 * @returns {Array<{ col: number, row: number }>} массив соседних ячеек
 */
export const getAdjacentCells = (col, row, bounds = null) => {
  const directions = [
    { col: 0, row: -1 }, // вверх
    { col: 0, row: 1 },  // вниз
    { col: -1, row: 0 }, // влево
    { col: 1, row: 0 },  // вправо
  ];

  return directions
    .map(dir => ({ col: col + dir.col, row: row + dir.row }))
    .filter(cell => isCellWithinGrid(cell.col, cell.row, bounds));
};

/**
 * Возвращает список соседних ячеек по восьми направлениям (включая диагонали).
 *
 * Фильтрует ячейки за пределами допустимых границ.
 *
 * @param {number} col  - индекс колонки центральной ячейки
 * @param {number} row  - индекс строки центральной ячейки
 * @param {Object | null} bounds - кастомные границы (опционально)
 * @returns {Array<{ col: number, row: number }>} массив соседних ячеек (до 8)
 */
export const getAdjacentCells8 = (col, row, bounds = null) => {
  const directions = [
    { col: 0, row: -1 },  // вверх
    { col: 0, row: 1 },   // вниз
    { col: -1, row: 0 },  // влево
    { col: 1, row: 0 },   // вправо
    { col: -1, row: -1 }, // вверх-влево
    { col: 1, row: -1 },  // вверх-вправо
    { col: -1, row: 1 },  // вниз-влево
    { col: 1, row: 1 },   // вниз-вправо
  ];

  return directions
    .map(dir => ({ col: col + dir.col, row: row + dir.row }))
    .filter(cell => isCellWithinGrid(cell.col, cell.row, bounds));
};

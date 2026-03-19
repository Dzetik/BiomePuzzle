// ============================================================================
// УТИЛИТЫ ОТЛАДОЧНОГО ЛОГИРОВАНИЯ
// ============================================================================

/**
 * Логирует состояние смещения и масштаба сетки.
 *
 * @param {string} message - описание точки вызова
 * @param {{ x: number, y: number }} offset - текущее смещение сетки
 * @param {number} scale - текущий масштаб
 */
export const logGrid = (message, offset, scale) => {
  console.log(`[Grid] ${message}:`, {
    offsetX: offset.x.toFixed(1),
    offsetY: offset.y.toFixed(1),
    scale: scale.toFixed(2),
  });
};

/**
 * Логирует экранную позицию ячейки сетки.
 *
 * @param {string} message  - описание точки вызова
 * @param {number} col      - индекс колонки
 * @param {number} row      - индекс строки
 * @param {{ x: number, y: number }} position - экранные координаты ячейки
 * @param {number} cellSize - размер ячейки в пикселях
 */
export const logCell = (message, col, row, position, cellSize) => {
  console.log(`[Cell ${col},${row}] ${message}:`, {
    left: position.x.toFixed(1),
    top: position.y.toFixed(1),
    size: cellSize.toFixed(1),
  });
};

/**
 * Логирует параметры жеста перетаскивания.
 *
 * @param {string} message - описание точки вызова
 * @param {{ dx?: number, dy?: number, moveX?: number, moveY?: number }} gesture - данные жеста
 */
export const logGesture = (message, gesture) => {
  console.log(`[Gesture] ${message}:`, {
    dx: gesture.dx?.toFixed(1) || 0,
    dy: gesture.dy?.toFixed(1) || 0,
    moveX: gesture.moveX?.toFixed(1) || 0,
    moveY: gesture.moveY?.toFixed(1) || 0,
  });
};

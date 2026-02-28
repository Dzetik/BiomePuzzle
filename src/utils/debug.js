// ВРЕМЕННЫЙ ФАЙЛ ДЛЯ ОТЛАДКИ
export const logGrid = (message, offset, scale) => {
  console.log(`[Grid] ${message}:`, {
    offsetX: offset.x.toFixed(1),
    offsetY: offset.y.toFixed(1),
    scale: scale.toFixed(2)
  });
};

export const logCell = (message, col, row, position, cellSize) => {
  console.log(`[Cell ${col},${row}] ${message}:`, {
    left: position.x.toFixed(1),
    top: position.y.toFixed(1),
    size: cellSize.toFixed(1)
  });
};

export const logGesture = (message, gesture) => {
  console.log(`[Gesture] ${message}:`, {
    dx: gesture.dx?.toFixed(1) || 0,
    dy: gesture.dy?.toFixed(1) || 0,
    moveX: gesture.moveX?.toFixed(1) || 0,
    moveY: gesture.moveY?.toFixed(1) || 0
  });
};
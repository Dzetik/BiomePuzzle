// ============================================================================
// УТИЛИТЫ ОГРАНИЧЕНИЙ И ГРАНИЦ
// ============================================================================

import { Dimensions } from 'react-native';

/**
 * Ограничивает числовое значение в заданном диапазоне [min, max].
 *
 * Помечена как 'worklet' для совместимости с Reanimated worklet-потоком.
 *
 * @param {number} value - входное значение
 * @param {number} min   - нижняя граница диапазона
 * @param {number} max   - верхняя граница диапазона
 * @returns {number} значение, ограниченное диапазоном [min, max]
 */
export const clamp = (value, min, max) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

/**
 * Ограничивает смещение (offset) панорамирования сетки допустимыми границами.
 *
 * Координатная система (React Native + Gesture Handler):
 * - Позиция левого края сетки на экране: `scaledBaseX - offsetX`
 * - `offsetX > 0` → сетка сдвигается влево на экране
 * - `offsetX < 0` → сетка сдвигается вправо на экране
 *
 * Алгоритм вычисления границ по X:
 * - Максимальный offset: `scaledBaseX + buffer`
 *   (левый край сетки не уходит левее начала экрана с учётом буфера)
 * - Минимальный offset: `scaledBaseX + gridWidth - screenWidth - buffer`
 *   (правый край сетки не уходит правее конца экрана)
 *
 * Если сетка меньше экрана — min и max нормализуются через min/max,
 * чтобы clamp не инвертировал диапазон.
 *
 * @param {number} offsetX    - текущее смещение по X
 * @param {number} offsetY    - текущее смещение по Y
 * @param {number} scale      - текущий масштаб (zoom)
 * @param {Object} gridConfig - конфигурация сетки: { cols, rows, cellSize, baseOffset: {x, y} }
 * @param {Object} screen     - размеры экрана: { width, height }
 * @param {number} buffer     - симметричный отступ от краёв экрана в пикселях (по умолчанию 0)
 * @returns {{ x: number, y: number }} ограниченное смещение
 */
export const clampOffsetToGridBounds = (
  offsetX,
  offsetY,
  scale,
  gridConfig,
  screen,
  buffer = 0
) => {
  'worklet';

  const { cols, rows, cellSize, baseOffset } = gridConfig;

  // Масштабируем параметры сетки под текущий zoom
  const scaledCellSize = cellSize * scale;
  const scaledBaseX = baseOffset.x * scale;
  const scaledBaseY = baseOffset.y * scale;

  const gridWidth = cols * scaledCellSize;
  const gridHeight = rows * scaledCellSize;

  // ============================================================================
  // ВЫЧИСЛЕНИЕ ГРАНИЦ ПО X
  // ============================================================================

  // Ограничение: левый край сетки не должен уходить левее -buffer
  // scaledBaseX - offsetX >= -buffer  =>  offsetX <= scaledBaseX + buffer
  const maxOffsetX = scaledBaseX + buffer;

  // Ограничение: правый край сетки не должен уходить правее screenWidth + buffer
  // scaledBaseX + gridWidth - offsetX <= screen.width + buffer  =>  offsetX >= ...
  const minOffsetX = scaledBaseX + gridWidth - screen.width - buffer;

  // Аналогично по Y
  const maxOffsetY = scaledBaseY + buffer;
  const minOffsetY = scaledBaseY + gridHeight - screen.height - buffer;

  // ============================================================================
  // НОРМАЛИЗАЦИЯ (если сетка меньше экрана — min > max, инвертируем)
  // ============================================================================
  const finalMinX = Math.min(minOffsetX, maxOffsetX);
  const finalMaxX = Math.max(minOffsetX, maxOffsetX);
  const finalMinY = Math.min(minOffsetY, maxOffsetY);
  const finalMaxY = Math.max(minOffsetY, maxOffsetY);

  return {
    x: clamp(offsetX, finalMinX, finalMaxX),
    y: clamp(offsetY, finalMinY, finalMaxY),
  };
};

/**
 * Возвращает текущие размеры окна приложения.
 *
 * @returns {{ width: number, height: number }} ширина и высота экрана в пикселях
 */
export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

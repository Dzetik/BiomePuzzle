// src/utils/constraints.js
// ========================================
// УТИЛИТЫ ОГРАНИЧЕНИЙ И ГРАНИЦ
// ========================================
import { Dimensions } from 'react-native';

/**
 * Ограничивает значение в заданных пределах
 */
export const clamp = (value, min, max) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

/**
 * 🔥 ФИНАЛЬНАЯ ВЕРСИЯ: Ограничивает смещение (offset) панорамирования
 * 
 * 📐 Координатная система (React Native + Gesture Handler):
 * - Позиция ячейки на экране: screenX = baseOffsetX + col * cellSize - offsetX
 * - offsetX > 0 → грид сдвигается ВЛЕВО на экране
 * - offsetX < 0 → грид сдвигается ВПРАВО на экране
 * 
 * @param {number} offsetX - текущее смещение по X
 * @param {number} offsetY - текущее смещение по Y
 * @param {number} scale - текущий масштаб (зум)
 * @param {Object} gridConfig - { cols, rows, cellSize, baseOffset: {x, y} }
 * @param {Object} screen - { width, height }
 * @param {number} buffer - отступ в пикселях от края экрана
 * 
 * @returns {Object} { x: clampedOffsetX, y: clampedOffsetY }
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
  
  // Масштабируем параметры
  const scaledCellSize = cellSize * scale;
  const scaledBaseX = baseOffset.x * scale;
  const scaledBaseY = baseOffset.y * scale;
  
  const gridWidth = cols * scaledCellSize;
  const gridHeight = rows * scaledCellSize;
  
  // ========================================
  // 🧮 ЛОГИКА ОГРАНИЧЕНИЙ (ПРОВЕРЕННАЯ)
  // ========================================
  // Позиция левого края грида на экране: scaledBaseX - offsetX
  // Позиция правого края грида на экране: scaledBaseX + gridWidth - offsetX
  
  // 🔹 Ограничение 1: Левый край не должен уходить левее (-buffer)
  // scaledBaseX - offsetX >= -buffer
  // => offsetX <= scaledBaseX + buffer
  const maxOffsetX = scaledBaseX + buffer;
  
  // 🔹 Ограничение 2: Правый край не должен уходить правее (screenWidth + buffer)
  // scaledBaseX + gridWidth - offsetX <= screen.width + buffer
  // => offsetX >= scaledBaseX + gridWidth - screen.width - buffer
  const minOffsetX = scaledBaseX + gridWidth - screen.width - buffer;
  
  // 🔹 То же самое для Y
  const maxOffsetY = scaledBaseY + buffer;
  const minOffsetY = scaledBaseY + gridHeight - screen.height - buffer;
  
  // ========================================
  // 🔄 НОРМАЛИЗАЦИЯ (если грид меньше экрана)
  // ========================================
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
 * Получает размеры экрана
 */
export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};
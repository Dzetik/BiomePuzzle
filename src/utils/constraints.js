import { Dimensions } from 'react-native';

/**
 * Получает границы экрана с учетом размера элемента
 * @param {number} elementWidth - ширина элемента
 * @param {number} elementHeight - высота элемента
 * @returns {Object} { minX, maxX, minY, maxY }
 */
export const getScreenBounds = (elementWidth, elementHeight) => {
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  return {
    minX: 0,
    maxX: screenWidth - elementWidth,
    minY: 0,
    maxY: screenHeight - elementHeight,
  };
};

/**
 * Ограничивает значение в заданных пределах
 * @param {number} value - исходное значение
 * @param {number} min - минимум
 * @param {number} max - максимум
 * @returns {number} ограниченное значение
 */
export const clamp = (value, min, max) => {
  'worklet'; // для возможной анимации позже
  return Math.min(Math.max(value, min), max);
};

/**
 * Ограничивает позицию в пределах экрана
 * @param {Object} position - { x, y }
 * @param {Object} bounds - { minX, maxX, minY, maxY }
 * @returns {Object} ограниченная позиция
 */
export const clampPosition = (position, bounds) => ({
  x: clamp(position.x, bounds.minX, bounds.maxX),
  y: clamp(position.y, bounds.minY, bounds.maxY),
});
// ========================================
// Хук для обработки жестов перетаскивания плитки
// Отвечает за:
// - Создание PanResponder для обработки касаний
// - Сохранение данных при начале перетаскивания (onGrant)
// - Обновление позиции при движении (onMove)
// - Завершение перетаскивания и вызов колбэка размещения (onRelease)
// - Обработку прерывания жеста (onTerminate)
// ========================================

import { useRef, useCallback } from 'react';
import { PanResponder } from 'react-native';
import { getScreenBounds, clampPosition } from '../../utils/constraints';

export const useTileDragHandler = ({
  tileId,                    // ID плитки для логирования (отладка)
  position,                   // Animated.ValueXY для обновления позиции в реальном времени
  currentTileSize,            // Ref с текущим размером {width, height} (синхронный доступ)
  currentPositionRef,         // Ref с текущей позицией {x, y} (синхронный доступ)
  correctPositionIfNeeded,    // Функция коррекции позиции перед началом перетаскивания
  onPlacement,                // Функция размещения, вызываемая при отпускании (спавнер или сетка)
  animateToPosition,          // Функция для плавного перемещения в целевую позицию
}) => {
  
  /**
   * Данные для перетаскивания (внутреннее состояние хука)
   * Используем useRef, чтобы не вызывать перерендер при обновлении
   */
  const dragData = useRef({
    basePosition: null,       // Базовая позиция плитки в момент касания {x, y}
    touchOffset: null,        // Смещение точки касания от левого верхнего угла плитки {x, y}
  });

  /**
   * Обработчик начала перетаскивания (палец коснулся экрана)
   * 
   * Логика:
   * 1. Останавливаем текущую анимацию (если плитка ещё двигалась)
   * 2. Корректируем позицию (на случай, если после панорамирования она "уплыла")
   * 3. Сохраняем базовую позицию и смещение касания для дальнейших расчётов
   * 
   * @param {Object} _ - событие (не используется, но требуется PanResponder)
   * @param {Object} gesture - данные жеста от PanResponder
   */
  const handleGrant = useCallback((_, gesture) => {
    console.log(`[Tile ${tileId}] Начало перетаскивания`);
    
    // Останавливаем текущую анимацию, чтобы не было конфликтов с движением пальца
    position.stopAnimation();
    
    // Корректируем позицию, если нужно (после панорамирования или зума)
    // Возвращает скорректированную позицию для использования в расчётах
    const adjustedPos = correctPositionIfNeeded();
    
    /**
     * Вычисляем смещение точки касания относительно угла плитки
     * Это нужно, чтобы плитка не "перескакивала" центром под палец,
     * а оставалась в том же месте относительно точки касания
     * 
     * gesture.x0, gesture.y0 - координаты точки касания на экране
     * adjustedPos.x, adjustedPos.y - координаты верхнего левого угла плитки
     */
    dragData.current = {
      basePosition: { ...adjustedPos },
      touchOffset: {
        x: gesture.x0 - adjustedPos.x, // Насколько правее/левее от угла коснулись
        y: gesture.y0 - adjustedPos.y, // Насколько ниже/выше от угла коснулись
      },
    };
    
    console.log(`[Tile ${tileId}] Базовая позиция:`, adjustedPos);
    console.log(`[Tile ${tileId}] Смещение касания:`, dragData.current.touchOffset);
  }, [tileId, position, correctPositionIfNeeded]);

  /**
   * Обработчик движения пальца по экрану
   * 
   * Логика:
   * 1. Получаем сохранённые при старте данные
   * 2. Вычисляем новую позицию: текущее положение пальца минус смещение
   * 3. Ограничиваем позицию границами экрана (чтобы плитка не улетала за края)
   * 4. Мгновенно обновляем позицию (без анимации, чтобы следовать за пальцем)
   * 
   * @param {Object} _ - событие (не используется)
   * @param {Object} gesture - данные жеста (содержит translationX, translationY)
   */
  const handleMove = useCallback((_, gesture) => {
    const { basePosition, touchOffset } = dragData.current;
    
    // Если нет данных (например, после прерывания) - игнорируем
    if (!basePosition || !touchOffset) return;
    
    /**
     * Вычисляем новую позицию:
     * Текущее положение пальца (начальное положение gesture.x0 + смещение gesture.dx)
     * минус смещение точки касания от угла плитки
     * 
     * Это даёт эффект, что плитка "прилипает" к пальцу в том же месте,
     * где пользователь за неё взялся
     */
    const newPosition = {
      x: gesture.x0 + gesture.dx - touchOffset.x,
      y: gesture.y0 + gesture.dy - touchOffset.y,
    };
    
    // Получаем границы экрана с учётом размера плитки
    // Чтобы плитка не уходила за верхний/левый край и не пропадала за нижний/правый
    const bounds = getScreenBounds(
      currentTileSize.current.width,
      currentTileSize.current.height
    );
    
    // Ограничиваем позицию этими границами
    const clampedPosition = clampPosition(newPosition, bounds);
    
    // Мгновенно обновляем позицию (без анимации, для плавного следования за пальцем)
    position.setValue(clampedPosition);
    
    // currentPositionRef обновится автоматически через слушатель в useTileAnimations
  }, [position, currentTileSize]);

  /**
   * Обработчик завершения перетаскивания (палец отпущен)
   * 
   * Логика:
   * 1. Вызываем колбэк размещения, который решает: спавнер или сетка
   * 2. Получаем целевую позицию для анимации
   * 3. Анимируем перемещение в эту позицию
   * 4. Сбрасываем данные перетаскивания
   */
  const handleRelease = useCallback(() => {
    console.log(`[Tile ${tileId}] Завершение перетаскивания`);
    
    // Вызываем логику размещения (из useTilePlacement)
    // Возвращает целевую позицию для анимации или null
    const targetPosition = onPlacement();
    
    if (targetPosition) {
      // Анимируем перемещение в целевую позицию (в спавнер или в ячейку сетки)
      animateToPosition(targetPosition);
    }
    
    // Сбрасываем данные перетаскивания для следующего раза
    dragData.current = { basePosition: null, touchOffset: null };
  }, [tileId, onPlacement, animateToPosition]);

  /**
   * Обработчик прерывания жеста
   * Вызывается, когда жест прерывается системой (например, пришло уведомление)
   * 
   * Просто сбрасываем данные, не вызывая размещение
   */
  const handleTerminate = useCallback(() => {
    console.log(`[Tile ${tileId}] Жест прерван`);
    dragData.current = { basePosition: null, touchOffset: null };
  }, [tileId]);

  /**
   * Создаём PanResponder для обработки всех событий касания
   * 
   * useRef гарантирует, что PanResponder создаётся только один раз
   * и не пересоздаётся при каждом рендере
   */
  const panResponder = useRef(
    PanResponder.create({
      // Всегда разрешаем начинать жест (плитка всегда перетаскиваема)
      onStartShouldSetPanResponder: () => true,
      
      // Привязываем наши обработчики
      onPanResponderGrant: handleGrant,
      onPanResponderMove: handleMove,
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleTerminate,
    })
  ).current; // Сразу берём .current, чтобы использовать готовый объект

  /**
   * Возвращаем обработчики для передачи в компонент
   * 
   * panHandlers нужно развернуть на Animated.View:
   * <Animated.View {...panHandlers}>
   */
  return {
    panHandlers: panResponder.panHandlers,
  };
};
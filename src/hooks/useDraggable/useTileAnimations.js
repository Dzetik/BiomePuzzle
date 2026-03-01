// ========================================
// ХУК АНИМАЦИЙ ПЛИТКИ
// Отвечает за:
// - Создание и управление анимированными значениями (позиция, размер)
// - Плавное перемещение и изменение размера плитки
// - Синхронизацию позиции с целевой ячейкой при зуме/панорамировании
// - Коррекцию позиции перед перетаскиванием
// ========================================

import { useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { getCellSize, getSnapToCellPosition } from '../../utils/gridUtils';

export const useTileAnimations = ({
  tileId,                    // ID плитки для отладки
  initialPosition,           // Начальная позиция {x, y} (в спавнере)
  initialSize,               // Начальный размер {width, height} (размер спавнера)
  scale,                     // Текущий масштаб из useZoom
  offset,                    // Текущее смещение сетки из GridContext
  isInSpawner,               // Флаг: сейчас в спавнере?
  targetCellRef,             // Ref с целевой ячейкой {col, row}
  isSpawnerReady,            // Флаг готовности спавнера
}) => {
  
  // ========================================
  // 1. АНИМИРОВАННЫЕ ЗНАЧЕНИЯ
  // ========================================
  
  /**
   * position - анимируемая позиция плитки (ValueXY)
   * widthAnim, heightAnim - анимируемые размеры
   */
  const position = useRef(new Animated.ValueXY(initialPosition)).current;
  const widthAnim = useRef(new Animated.Value(initialSize.width)).current;
  const heightAnim = useRef(new Animated.Value(initialSize.height)).current;
  
  // ========================================
  // 2. REFS ДЛЯ СИНХРОННОГО ДОСТУПА
  // ========================================
  
  /**
   * currentTileSize - синхронный доступ к размеру (без задержек анимации)
   * currentPositionRef - синхронный доступ к позиции
   * animationRef - для отслеживания текущей анимации (чтобы останавливать при новой)
   */
  const currentTileSize = useRef(initialSize);
  const currentPositionRef = useRef({ x: initialPosition.x, y: initialPosition.y });
  const animationRef = useRef(null);
  
  /**
   * ID слушателя анимации позиции (для отписки)
   */
  const listenerIdRef = useRef(null);

  // ========================================
  // 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ========================================

  /**
   * Получает размер плитки под текущий масштаб
   * @param {number} currentScale - текущий масштаб
   * @returns {Object} размер {width, height}
   */
  const getTileSize = useCallback((currentScale) => ({
    width: getCellSize(currentScale),
    height: getCellSize(currentScale)
  }), []);

  /**
   * Анимирует изменение размера плитки
   * @param {Object} targetSize - целевой размер
   * @param {boolean} immediate - true = мгновенно, false = плавно
   */
  const animateSize = useCallback((targetSize, immediate = false) => {
    console.log(`[Tile ${tileId}] animateSize:`, targetSize, immediate ? 'immediate' : 'animated');
    
    // Сразу обновляем ref для синхронного доступа
    currentTileSize.current = targetSize;
    
    if (immediate) {
      widthAnim.setValue(targetSize.width);
      heightAnim.setValue(targetSize.height);
    } else {
      // Плавная анимация пружинкой для натурального движения
      Animated.parallel([
        Animated.spring(widthAnim, { 
          toValue: targetSize.width, 
          useNativeDriver: false,
          friction: 7,
          tension: 40
        }),
        Animated.spring(heightAnim, { 
          toValue: targetSize.height, 
          useNativeDriver: false,
          friction: 7,
          tension: 40
        })
      ]).start();
    }
  }, [widthAnim, heightAnim, tileId]);

  /**
   * Анимирует перемещение плитки в целевую позицию
   * @param {Object} targetPosition - целевая позиция {x, y}
   * @param {boolean} immediate - true = мгновенно, false = плавно
   */
  const animateToPosition = useCallback((targetPosition, immediate = false) => {
    console.log(`[Tile ${tileId}] animateToPosition:`, targetPosition, immediate ? 'immediate' : 'animated');
    
    // Останавливаем текущую анимацию, чтобы избежать конфликтов
    if (animationRef.current) {
      animationRef.current.stop();
    }
    
    if (immediate) {
      position.setValue(targetPosition);
      currentPositionRef.current = targetPosition;
    } else {
      animationRef.current = Animated.spring(position, {
        toValue: targetPosition,
        useNativeDriver: false,
        friction: 7,
        tension: 40
      });
      animationRef.current.start(() => {
        animationRef.current = null;
      });
    }
  }, [position, tileId]);

  /**
   * Обновляет позицию плитки на основе целевой ячейки
   * Вызывается при изменении scale или offset (зум/панорамирование)
   */
  const updatePositionFromTargetCell = useCallback(() => {
    // Плитка в спавнере не привязана к ячейке
    if (isInSpawner || !isSpawnerReady) return;
    
    if (!targetCellRef.current) {
      console.log(`[Tile ${tileId}] Нет целевой ячейки для обновления позиции`);
      return;
    }
    
    // Вычисляем новый размер под текущий масштаб
    const newTileSize = getTileSize(scale);
    
    // Вычисляем новую позицию для текущей целевой ячейки
    const newPosition = getSnapToCellPosition(
      newTileSize,
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      offset.x,
      offset.y
    );
    
    console.log(`[Tile ${tileId}] Обновление позиции по ячейке [${targetCellRef.current.col},${targetCellRef.current.row}]:`, newPosition);
    
    // Если размер изменился - анимируем его
    if (newTileSize.width !== currentTileSize.current.width) {
      animateSize(newTileSize);
    }
    
    // Анимируем перемещение в новую позицию
    animateToPosition(newPosition);
    
  }, [scale, offset, isInSpawner, isSpawnerReady, targetCellRef, getTileSize, animateSize, animateToPosition, tileId]);

  /**
   * Корректирует позицию в начале перетаскивания
   * Исправляет возможное расхождение после панорамирования/зума
   * @returns {Object} актуальная позиция для использования в жестах
   */
  const correctPositionIfNeeded = useCallback(() => {
    const currentPos = currentPositionRef.current;
    
    // Для плитки в спавнере коррекция не нужна
    if (isInSpawner || !targetCellRef.current) {
      return currentPos;
    }
    
    // Вычисляем идеальную позицию для текущей ячейки
    const newTileSize = getTileSize(scale);
    const expectedPosition = getSnapToCellPosition(
      newTileSize,
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      offset.x,
      offset.y
    );
    
    // Если расхождение больше 0.5 пикселя - корректируем
    const threshold = 0.5;
    if (Math.abs(expectedPosition.x - currentPos.x) > threshold || 
        Math.abs(expectedPosition.y - currentPos.y) > threshold) {
      console.log(`[Tile ${tileId}] Коррекция позиции после панорамирования/зума`);
      position.setValue(expectedPosition);
      return expectedPosition;
    }
    
    return currentPos;
  }, [scale, offset, isInSpawner, targetCellRef, position, tileId, getTileSize]);

  // ========================================
  // 4. ЭФФЕКТЫ
  // ========================================

  /**
   * Подписка на изменения позиции
   * Обновляет currentPositionRef для синхронного доступа
   */
  useEffect(() => {
    if (listenerIdRef.current) {
      position.removeListener(listenerIdRef.current);
    }
    
    listenerIdRef.current = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y };
    });
    
    return () => {
      if (listenerIdRef.current) {
        position.removeListener(listenerIdRef.current);
      }
    };
  }, [position]);

  /**
   * Обновление при изменении масштаба или смещения
   * КЛЮЧЕВОЙ ЭФФЕКТ: синхронизирует плитку с сеткой при зуме/панорамировании
   */
  useEffect(() => {
    updatePositionFromTargetCell();
  }, [scale, offset, updatePositionFromTargetCell]);

  // ========================================
  // 5. ВОЗВРАЩАЕМЫЙ API
  // ========================================
  
  return {
    position,                    // Animated.ValueXY для позиции
    width: widthAnim,            // Animated.Value для ширины
    height: heightAnim,          // Animated.Value для высоты
    currentTileSize,             // Ref с актуальным размером
    currentPositionRef,          // Ref с актуальной позицией
    animateSize,                 // Функция анимации размера
    animateToPosition,           // Функция анимации перемещения
    getTileSize,                 // Функция получения размера под масштаб
    correctPositionIfNeeded,     // Коррекция перед перетаскиванием
    updatePositionFromTargetCell, // Принудительное обновление по ячейке
  };
};
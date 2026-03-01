// ========================================
// Хук для управления анимациями плитки
// Отвечает за:
// - Создание и управление анимированными значениями (позиция, ширина, высота)
// - Плавное изменение размера и позиции плитки
// - Обновление позиции при изменении масштаба или смещения сетки
// - Синхронизацию с целевой ячейкой
// ========================================

import { useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { getCellSize, getCellCenter } from '../../utils/gridUtils';

export const useTileAnimations = ({
  tileId,                    // ID плитки для логирования и отладки
  initialPosition,           // Начальная позиция {x, y} (обычно в спавнере)
  initialSize,               // Начальный размер {width, height} (размер спавнера)
  scale,                     // Текущий масштаб из useZoom (влияет на размер плитки)
  offset,                    // Текущее смещение сетки из GridContext
  isInSpawner,               // Флаг: находится ли плитка сейчас в спавнере
  targetCellRef,             // Ref с координатами целевой ячейки {col, row} или null
  isSpawnerReady,            // Флаг готовности спавнера (позиция известна)
  onPositionChange,          // Колбэк, вызываемый при каждом изменении позиции
}) => {
  // ========================================
  // Анимированные значения для React Native Animated
  // ========================================
  
  // Позиция плитки (анимируемая) - используем ValueXY для удобства работы с {x, y}
  const position = useRef(new Animated.ValueXY(initialPosition)).current;
  
  // Ширина и высота плитки (анимируемые)
  const widthAnim = useRef(new Animated.Value(initialSize.width)).current;
  const heightAnim = useRef(new Animated.Value(initialSize.height)).current;
  
  // ========================================
  // Refs для синхронного доступа к текущим значениям
  // (без задержек, связанных с анимацией)
  // ========================================
  
  // Текущий размер плитки (обновляется синхронно, в отличие от widthAnim)
  const currentTileSize = useRef(initialSize);
  
  // Текущая позиция плитки (обновляется синхронно через слушатель)
  const currentPositionRef = useRef({ x: initialPosition.x, y: initialPosition.y });
  
  // ID слушателя анимации позиции (для отписки)
  const listenerIdRef = useRef(null);

  // ========================================
  // Вспомогательные функции
  // ========================================

  /**
   * Получает размер плитки под текущий масштаб
   * @param {number} currentScale - текущий масштаб
   * @returns {Object} размер {width, height}
   */
  const getTileSize = useCallback((currentScale) => ({
    width: getCellSize(currentScale),
    height: getCellSize(currentScale)
  }), []); // getCellSize - чистая функция, зависимостей нет

  /**
   * Анимирует изменение размера плитки
   * @param {Object} targetSize - целевой размер {width, height}
   * @param {boolean} immediate - true = мгновенное изменение, false = плавная анимация
   */
  const animateSize = useCallback((targetSize, immediate = false) => {
    console.log(`[Tile ${tileId}] animateSize:`, targetSize, immediate ? 'immediate' : 'animated');
    
    // Сразу обновляем ref для синхронного доступа
    currentTileSize.current = targetSize;
    
    if (immediate) {
      // Мгновенное изменение (без анимации) - для начальной установки
      widthAnim.setValue(targetSize.width);
      heightAnim.setValue(targetSize.height);
    } else {
      // Плавная анимация пружинкой (spring) для натурального движения
      Animated.parallel([
        Animated.spring(widthAnim, { 
          toValue: targetSize.width, 
          useNativeDriver: false, // Важно: false, так как анимируем не transform
          friction: 7,            // Меньше трения = более упругая анимация
          tension: 40             // Натяжение пружины
        }),
        Animated.spring(heightAnim, { 
          toValue: targetSize.height, 
          useNativeDriver: false,
          friction: 7,
          tension: 40
        })
      ]).start(); // Запускаем параллельную анимацию
    }
  }, [widthAnim, heightAnim, tileId]);

  /**
   * Анимирует перемещение плитки в целевую позицию
   * @param {Object} targetPosition - целевая позиция {x, y}
   * @param {boolean} immediate - true = мгновенно, false = плавно
   */
  const animateToPosition = useCallback((targetPosition, immediate = false) => {
    console.log(`[Tile ${tileId}] animateToPosition:`, targetPosition, immediate ? 'immediate' : 'animated');
    
    if (immediate) {
      // Мгновенное перемещение
      position.setValue(targetPosition);
      currentPositionRef.current = targetPosition;
    } else {
      // Плавное перемещение пружинкой
      Animated.spring(position, {
        toValue: targetPosition,
        useNativeDriver: false,
        friction: 7,
        tension: 40
      }).start();
      // position обновит currentPositionRef через слушатель
    }
  }, [position, tileId]);

  /**
   * Обновляет позицию плитки на основе целевой ячейки, масштаба и смещения
   * Вызывается при изменении scale или offset
   */
  const updatePositionFromTargetCell = useCallback(() => {
    // Плитка в спавнере не привязана к ячейке сетки
    if (isInSpawner || !isSpawnerReady) return;
    
    // Нет целевой ячейки - не знаем, куда двигать
    if (!targetCellRef.current) {
      console.log(`[Tile ${tileId}] Нет целевой ячейки для обновления позиции`);
      return;
    }
    
    // Получаем новый размер под текущий масштаб
    const newTileSize = getTileSize(scale);
    
    // Получаем центр целевой ячейки с учётом текущего смещения и масштаба
    const cellCenter = getCellCenter(
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      offset.x,
      offset.y
    );
    
    // Вычисляем новую позицию верхнего левого угла плитки
    // (центр ячейки - половина размера плитки)
    const newPosition = {
      x: Math.round(cellCenter.x - newTileSize.width / 2),
      y: Math.round(cellCenter.y - newTileSize.height / 2),
    };
    
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
    
    const targetCell = targetCellRef.current;
    
    // Вычисляем идеальную позицию для текущей ячейки
    const cellCenter = getCellCenter(
      targetCell.col,
      targetCell.row,
      scale,
      offset.x,
      offset.y
    );
    
    const expectedPosition = {
      x: Math.round(cellCenter.x - currentTileSize.current.width / 2),
      y: Math.round(cellCenter.y - currentTileSize.current.height / 2),
    };
    
    // Если расхождение больше 1 пикселя - корректируем
    // Используем порог 1px, чтобы избежать бесконечных корректировок из-за округления
    if (Math.abs(expectedPosition.x - currentPos.x) > 1 || 
        Math.abs(expectedPosition.y - currentPos.y) > 1) {
      console.log(`[Tile ${tileId}] Корректировка позиции после панорамирования/зума`);
      // Мгновенно устанавливаем правильную позицию (без анимации)
      position.setValue(expectedPosition);
      return expectedPosition;
    }
    
    return currentPos;
  }, [scale, offset, isInSpawner, targetCellRef, position, tileId, currentTileSize]);

  // ========================================
  // Эффекты (побочные действия)
  // ========================================

  /**
   * Эффект: подписка на изменения позиции
   * Обновляет currentPositionRef и вызывает onPositionChange
   * Важно для синхронного доступа к текущей позиции в других хуках
   */
  useEffect(() => {
    // Удаляем предыдущего слушателя, если был
    if (listenerIdRef.current) {
      position.removeListener(listenerIdRef.current);
    }
    
    // Добавляем нового слушателя
    listenerIdRef.current = position.addListener((value) => {
      // Обновляем ref с актуальной позицией
      currentPositionRef.current = { x: value.x, y: value.y };
      
      // Вызываем колбэк, если передан (используется в спавнер логике)
      if (onPositionChange) {
        onPositionChange(value);
      }
    });
    
    // Очистка при размонтировании компонента
    return () => {
      if (listenerIdRef.current) {
        position.removeListener(listenerIdRef.current);
      }
    };
  }, [position, onPositionChange]); // Переподписываемся только при изменении position или колбэка

  /**
   * Эффект: обновление позиции при изменении масштаба или смещения сетки
   * Ключевой эффект для синхронизации плитки с сеткой при зуме и панорамировании
   */
  useEffect(() => {
    updatePositionFromTargetCell();
  }, [scale, offset, updatePositionFromTargetCell]); // Срабатывает при любом изменении scale или offset

  // ========================================
  // Возвращаемый API для родительского хука useDraggable
  // ========================================
  return {
    // Анимированные значения для компонента TileView
    position,           // Animated.ValueXY - позиция плитки
    width: widthAnim,   // Animated.Value - ширина плитки
    height: heightAnim, // Animated.Value - высота плитки
    
    // Refs для синхронного доступа (без задержек анимации)
    currentTileSize,    // Ref с актуальным размером
    currentPositionRef, // Ref с актуальной позицией
    
    // Методы управления анимациями
    animateSize,
    animateToPosition,
    getTileSize,
    
    // Вспомогательные методы
    correctPositionIfNeeded,   // Для начала перетаскивания
    updatePositionFromTargetCell, // Для принудительного обновления
  };
};
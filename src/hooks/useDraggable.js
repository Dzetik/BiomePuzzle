import { useRef, useEffect, useState, useCallback } from 'react';
import { PanResponder, Animated } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid } from '../utils/gridUtils';
import { getSpawnerSize } from '../constants/spawner';
import { isCenterOverSpawner } from '../utils/spawnerUtils';
import { useZoom } from './useZoom';
import { getCellSize, findNearestCell, getCellCenter } from '../constants/grid';

// ========================================
// Хук для управления перетаскиваемой плиткой
// Поддерживает: перетаскивание, притягивание к сетке, масштабирование
// ========================================

const useDraggable = (initialPosition = null) => {
  const { scale } = useZoom();
  const scaleRef = useRef(scale);
  
  const [isInSpawner, setIsInSpawner] = useState(true); // По умолчанию true, так как плитка стартует в спавнере
  
  // ЦЕЛЕВАЯ ячейка - плитка всегда должна быть в этой ячейке
  // Меняется ТОЛЬКО при ручном перемещении или выходе из спавнера
  const targetCellRef = useRef({ col: 0, row: 0 });
  
  // Размеры
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };
  
  // Функция получения размера плитки под текущий масштаб
  const getTileSize = useCallback((s) => ({
    width: getCellSize(s),
    height: getCellSize(s)
  }), []);
  
  // Начальные значения - сразу используем размер спавнера
  const defaultTileSize = getTileSize(scale);
  const startPosition = initialPosition || { x: 0, y: 0 };
  
  // Анимированные значения
  const widthAnim = useRef(new Animated.Value(spawnerTileSize.width)).current; // Стартуем с размером спавнера
  const heightAnim = useRef(new Animated.Value(spawnerTileSize.height)).current; // Стартуем с размером спавнера
  const position = useRef(new Animated.ValueXY(startPosition)).current;
  
  // Refs для синхронного доступа к текущим значениям (без задержек анимации)
  const currentTileSize = useRef(spawnerTileSize); // Стартуем с размером спавнера
  const currentPositionRef = useRef({ x: position.x._value, y: position.y._value });

  // Обновляем ref при изменении scale
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  /**
   * Обновляет целевую ячейку по текущей позиции плитки
   * Вызывается только при ручном перемещении или выходе из спавнера
   */
  const updateTargetCell = useCallback(() => {
    const pos = currentPositionRef.current;
    const size = currentTileSize.current;
    
    const center = {
      x: pos.x + size.width / 2,
      y: pos.y + size.height / 2
    };
    
    const cell = findNearestCell(center.x, center.y, scaleRef.current);
    targetCellRef.current = { col: cell.col, row: cell.row };
  }, []);

  /**
   * Анимирует изменение размера плитки
   */
  const animateSize = useCallback((targetSize) => {
    currentTileSize.current = targetSize;
    Animated.parallel([
      Animated.spring(widthAnim, { 
        toValue: targetSize.width, 
        useNativeDriver: false 
      }),
      Animated.spring(heightAnim, { 
        toValue: targetSize.height, 
        useNativeDriver: false 
      })
    ]).start();
  }, [widthAnim, heightAnim]);

  /**
   * Анимирует перемещение плитки в целевую позицию
   */
  const animateToPosition = useCallback((targetPosition) => {
    Animated.spring(position, {
      toValue: targetPosition,
      useNativeDriver: false,
    }).start();
  }, [position]);

  /**
   * Эффект: при изменении масштаба перемещаем плитку в целевую ячейку
   * Использует targetCellRef, который не меняется при зуме
   */
  useEffect(() => {
    if (isInSpawner) return; // В спавнере не двигаем плитку при зуме
    
    const newTileSize = getTileSize(scale);
    
    // Получаем центр целевой ячейки в новом масштабе
    const cellCenter = getCellCenter(
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale
    );
    
    // Вычисляем позицию верхнего левого угла плитки
    const newPosition = {
      x: Math.round(cellCenter.x - newTileSize.width / 2),
      y: Math.round(cellCenter.y - newTileSize.height / 2),
    };
    
    animateSize(newTileSize);
    animateToPosition(newPosition);
    
  }, [scale, isInSpawner, getTileSize, animateSize, animateToPosition]);

  /**
   * Эффект: отслеживание позиции для определения входа/выхода из спавнера
   */
  useEffect(() => {
    const listenerId = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y };
      
      const inSpawner = isCenterOverSpawner(value, currentTileSize.current);
      
      if (inSpawner !== isInSpawner) {
        setIsInSpawner(inSpawner);
        
        if (inSpawner) {
          // Вход в спавнер - меняем размер на размер спавнера
          animateSize(spawnerTileSize);
        } else {
          // Выход из спавнера - возвращаем обычный размер и запоминаем ячейку
          animateSize(getTileSize(scaleRef.current));
          updateTargetCell();
        }
      }
    });
    
    return () => position.removeListener(listenerId);
  }, [isInSpawner, spawnerTileSize, getTileSize, animateSize, updateTargetCell]);

  /**
   * PanResponder для обработки перетаскивания пальцем
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (_, gesture) => {
        position.stopAnimation();
        const currentPos = currentPositionRef.current;
        dragData.current = {
          basePosition: { ...currentPos },
          touchOffset: {
            x: gesture.x0 - currentPos.x,
            y: gesture.y0 - currentPos.y,
          },
        };
      },
      
      onPanResponderMove: (_, gesture) => {
        const { basePosition } = dragData.current;
        const newPosition = {
          x: basePosition.x + gesture.dx,
          y: basePosition.y + gesture.dy,
        };
        
        // Границы экрана применяются ТОЛЬКО при перетаскивании
        const bounds = getScreenBounds(
          currentTileSize.current.width,
          currentTileSize.current.height
        );
        const clampedPosition = clampPosition(newPosition, bounds);
        position.setValue(clampedPosition);
      },
      
      onPanResponderRelease: () => {
        const currentPos = currentPositionRef.current;
        if (!currentPos) return;
        
        // При отпускании притягиваем к ближайшей ячейке
        const snappedPosition = snapToGrid(
          currentPos, 
          currentTileSize.current, 
          scaleRef.current
        );
        animateToPosition(snappedPosition);
        // После ручного перемещения обновляем целевую ячейку
        updateTargetCell();
        dragData.current = { basePosition: null, touchOffset: null };
      },
    })
  ).current;

  // Данные для перетаскивания
  const dragData = useRef({ basePosition: null, touchOffset: null });

  return {
    position,           // Animated.ValueXY для позиции
    width: widthAnim,   // Animated.Value для ширины
    height: heightAnim, // Animated.Value для высоты
    panHandlers: panResponder.panHandlers, // Обработчики жестов
    isInSpawner,        // Флаг нахождения в спавнере
  };
};

export default useDraggable;
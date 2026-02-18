import { useRef, useEffect, useState } from 'react';
import { PanResponder, Animated } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid } from '../utils/gridUtils';
import { DEFAULT_TILE_SIZE, TILE_SIZES } from '../constants/tile';
import { getSpawnerSize } from '../constants/spawner';
import { isCenterOverSpawner } from '../utils/spawnerUtils';

// ========================================
// Хук для управления перетаскиванием плитки
// Содержит всю логику анимации, позиционирования и примагничивания
// ========================================

const useDraggable = (initialPosition = null, initialSize = null) => {
  // Состояние для отслеживания нахождения плитки в зоне спавнера
  const [isInSpawner, setIsInSpawner] = useState(false);
  
  // Получаем текущий размер спавнера из конфига
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };
  
  // Начальная позиция (если не передана - по умолчанию 0,0)
  const startPosition = initialPosition || { x: 0, y: 0 };
  
  // Начальный размер плитки:
  // - если передан initialSize - используем его
  // - иначе используем DEFAULT_TILE_SIZE (размер ячейки сетки)
  const startSize = initialSize || DEFAULT_TILE_SIZE;
  
  // Анимированные значения для ширины и высоты плитки
  const widthAnim = useRef(new Animated.Value(startSize.width)).current;
  const heightAnim = useRef(new Animated.Value(startSize.height)).current;
  
  // Ref для хранения текущего размера (нужен для синхронного доступа)
  const currentTileSize = useRef(startSize);
  
  // Анимированная позиция плитки
  const position = useRef(new Animated.ValueXY(startPosition)).current;
  
  // Ref для синхронного доступа к текущей позиции (без задержек анимации)
  const currentPositionRef = useRef({ x: position.x._value, y: position.y._value });
  
  // Границы экрана, за которые нельзя выйти при перетаскивании
  const boundsRef = useRef(getScreenBounds(
    DEFAULT_TILE_SIZE.width, 
    DEFAULT_TILE_SIZE.height
  ));
  
  // Временные данные во время перетаскивания
  const dragData = useRef({ 
    basePosition: null,    // Базовая позиция в начале перетаскивания
    touchOffset: null      // Смещение точки касания относительно угла плитки
  });

  /**
   * Анимирует изменение размера плитки
   * @param {Object} targetSize - целевой размер {width, height}
   */
  const animateSize = (targetSize) => {
    currentTileSize.current = targetSize;
    Animated.parallel([
      Animated.spring(widthAnim, { 
        toValue: targetSize.width, 
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      }),
      Animated.spring(heightAnim, { 
        toValue: targetSize.height, 
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      })
    ]).start();
  };

  /**
   * Слушаем изменения позиции для проверки зоны спавнера
   * и обновления размера при входе/выходе
   */
  useEffect(() => {
    const listenerId = position.addListener((value) => {
      // Обновляем ref с текущей позицией
      currentPositionRef.current = { x: value.x, y: value.y };
      
      // Проверяем, находится ли центр плитки над спавнером
      const inSpawner = isCenterOverSpawner(value, currentTileSize.current);
      
      // Если состояние изменилось - обновляем размер
      if (inSpawner !== isInSpawner) {
        setIsInSpawner(inSpawner);
        // При выходе из спавнера возвращаемся к РАЗМЕРУ ЯЧЕЙКИ (DEFAULT_TILE_SIZE)
        const targetSize = inSpawner ? spawnerTileSize : DEFAULT_TILE_SIZE;
        animateSize(targetSize);
      }
    });
    
    // Очищаем слушатель при размонтировании
    return () => position.removeListener(listenerId);
  }, [isInSpawner, spawnerSize]);

  /**
   * Анимирует перемещение плитки в целевую позицию
   * @param {Object} targetPosition - целевая позиция {x, y}
   */
  const animateToPosition = (targetPosition) => {
    Animated.spring(position, {
      toValue: targetPosition,
      useNativeDriver: false,
      friction: 8,
      tension: 80,
    }).start();
  };
  
  /**
   * PanResponder для обработки жестов перетаскивания
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
        const clampedPosition = clampPosition(newPosition, boundsRef.current);
        position.setValue(clampedPosition);
      },
      
      onPanResponderRelease: () => {
        const currentPos = currentPositionRef.current;
        if (!currentPos) return;
        
        const snappedPosition = snapToGrid(currentPos, currentTileSize.current);
        animateToPosition(snappedPosition);
        dragData.current = { basePosition: null, touchOffset: null };
      },
    })
  ).current;

  return {
    position,
    width: widthAnim,
    height: heightAnim,
    panHandlers: panResponder.panHandlers,
    isInSpawner,
  };
};

export default useDraggable;
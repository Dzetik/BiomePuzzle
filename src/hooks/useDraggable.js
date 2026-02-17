import { useRef, useEffect, useState } from 'react';
import { PanResponder, Animated } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid, isCenterOverSpawner } from '../utils/gridUtils';
import { DEFAULT_TILE_SIZE, TILE_SIZES } from '../constants/tile';
import { getSpawnerSize } from '../constants/spawner';

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
  
  // Начальный размер плитки (если передан - используем его, иначе стандартный)
  const startSize = initialSize || TILE_SIZES.medium;
  
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
        friction: 8,  // Меньше - больше пружинистость
        tension: 80,  // Больше - быстрее анимация
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
        const targetSize = inSpawner ? spawnerTileSize : TILE_SIZES.medium;
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
   * Содержит логику начала, процесса и окончания перетаскивания
   */
  const panResponder = useRef(
    PanResponder.create({
      // Всегда разрешаем начинать перетаскивание
      onStartShouldSetPanResponder: () => true,
      
      /**
       * Начало перетаскивания
       * Запоминаем базовую позицию и смещение касания
       */
      onPanResponderGrant: (_, gesture) => {
        position.stopAnimation(); // Останавливаем текущую анимацию
        const currentPos = currentPositionRef.current;
        dragData.current = {
          basePosition: { ...currentPos },
          touchOffset: {
            x: gesture.x0 - currentPos.x,
            y: gesture.y0 - currentPos.y,
          },
        };
      },
      
      /**
       * Процесс перетаскивания
       * Обновляем позицию в реальном времени
       */
      onPanResponderMove: (_, gesture) => {
        const { basePosition } = dragData.current;
        // Новая позиция = базовая + смещение жеста
        const newPosition = {
          x: basePosition.x + gesture.dx,
          y: basePosition.y + gesture.dy,
        };
        // Ограничиваем границами экрана
        const clampedPosition = clampPosition(newPosition, boundsRef.current);
        position.setValue(clampedPosition);
      },
      
      /**
       * Окончание перетаскивания
       * Примагничиваем плитку к ближайшей позиции
       */
      onPanResponderRelease: () => {
        const currentPos = currentPositionRef.current;
        if (!currentPos) return;
        
        // Вычисляем позицию для примагничивания
        const snappedPosition = snapToGrid(currentPos, currentTileSize.current);
        animateToPosition(snappedPosition);
        dragData.current = { basePosition: null, touchOffset: null };
      },
    })
  ).current;

  // Возвращаем всё необходимое для использования в компоненте
  return {
    position,           // Animated.ValueXY для позиции
    width: widthAnim,   // Animated.Value для ширины
    height: heightAnim, // Animated.Value для высоты
    panHandlers: panResponder.panHandlers, // Обработчики жестов
    isInSpawner,        // Флаг нахождения в спавнере
  };
};

export default useDraggable;
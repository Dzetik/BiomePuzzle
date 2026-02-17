import { useRef, useEffect } from 'react';
import { PanResponder, Animated } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid } from '../utils/gridUtils'; 
import { DEFAULT_TILE_SIZE } from '../constants/tile';
import { GRID_OFFSET } from '../constants/grid'; 

const useDraggable = () => {
  // Используем Animated.Value вместо обычного state
  const position = useRef(
    new Animated.ValueXY({ x: GRID_OFFSET.x, y: GRID_OFFSET.y })
  ).current;
  
  // Храним текущие координаты в ref для синхронного доступа
  const currentPositionRef = useRef({ x: GRID_OFFSET.x, y: GRID_OFFSET.y });
  
  // Границы экрана (зависят от размера экрана и плитки)
  const boundsRef = useRef(getScreenBounds(
    DEFAULT_TILE_SIZE.width, 
    DEFAULT_TILE_SIZE.height
  ));
  
  // Отдельный ref для временных данных перетаскивания
  const dragData = useRef({
    basePosition: null,
    touchOffset: null,
  });
  
  // Слушаем изменения Animated значения для синхронизации ref
  useEffect(() => {
    const listenerId = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y };
    });
    
    return () => {
      position.removeListener(listenerId);
    };
  }, []);
  
  /**
   * Обновляет позицию с анимацией (для snapToGrid)
   */
  const animateToPosition = (targetPosition) => {
    // БЫСТРАЯ спринг-анимация для плавного движения
    Animated.spring(position, {
      toValue: targetPosition,
      useNativeDriver: false,
      friction: 8,        // трение 
      tension: 100,       // натяжение 
      restDisplacementThreshold: 0.1,
      restSpeedThreshold: 0.1,
    }).start();
  };
  
  /**
   * Мгновенно обновляет позицию (для перетаскивания)
   */
  const moveToPosition = (newPosition) => {
    position.setValue(newPosition);
  };
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (_, gesture) => {
        // Останавливаем текущую анимацию
        position.stopAnimation();
        
        // Берем актуальную позицию из ref
        const currentPos = currentPositionRef.current;
        
        // Вычисляем смещение пальца относительно центра плитки
        const offset = {
          x: gesture.x0 - currentPos.x,
          y: gesture.y0 - currentPos.y,
        };
        
        // Сохраняем данные для перетаскивания
        dragData.current = {
          basePosition: { ...currentPos },
          touchOffset: { ...offset },
        };
      },
      
      onPanResponderMove: (_, gesture) => {
        // Берем актуальные значения из dragData
        const { basePosition, touchOffset } = dragData.current;

        // Вычисляем новую позицию с учётом смещения пальца
        const newPosition = {
          x: basePosition.x + gesture.dx,
          y: basePosition.y + gesture.dy,
        };
        
        // Ограничиваем границами экрана
        const clampedPosition = clampPosition(newPosition, boundsRef.current);
        
        // Мгновенно обновляем позицию (без анимации)
        moveToPosition(clampedPosition);
      },
      
      onPanResponderRelease: () => {
        // Получаем текущую позицию из ref
        const currentPos = currentPositionRef.current;
        if (!currentPos) return;
        
        // Вычисляем позицию, привязанную к сетке
        const snappedPosition = snapToGrid(currentPos);
        
        // БЫСТРО перемещаем к целевой позиции
        animateToPosition(snappedPosition);
        
        // Очищаем временные данные
        dragData.current = {
          basePosition: null,
          touchOffset: null,
        };
      },
      
      onPanResponderTerminate: () => {
        // Жест прерван (звонок, свайп и т.д.)
        dragData.current = {
          basePosition: null,
          touchOffset: null,
        };
      },
    })
  ).current;

  return {
    position,                    // Animated.ValueXY
    panHandlers: panResponder.panHandlers,
  };
};

export default useDraggable;
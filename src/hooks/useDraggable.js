import { useRef, useState, useEffect } from 'react';
import { PanResponder } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid } from '../utils/gridUtils'; 
import { DEFAULT_TILE_SIZE } from '../constants/tile';
import { GRID_OFFSET } from '../constants/grid'; 

const useDraggable = (
) => {
  // Храним текущую позицию элемента В STATE
  // Начальная позиция берется из GRID_OFFSET
  const [position, setPosition] = useState({ 
    x: GRID_OFFSET.x, 
    y: GRID_OFFSET.y 
  });
  
  // !!! ВСЁ важное для PanResponder храним в отдельных refs !!!
  const positionRef = useRef(position);
  const boundsRef = useRef(getScreenBounds(
    DEFAULT_TILE_SIZE.width, 
    DEFAULT_TILE_SIZE.height
  ));
  
  // Отдельный ref для временных данных перетаскивания
  const dragData = useRef({
    basePosition: null,
    touchOffset: null,
  });
  
  // Синхронизируем ref с state
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  const updatePosition = (newPosition) => {
    if (!newPosition) return;
    if (isNaN(newPosition.x) || isNaN(newPosition.y)) return;
    
    setPosition(newPosition);
  };
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (_, gesture) => {
        // Проверяем текущую позицию
        const currentPos = positionRef.current;
        console.log('Текущая позиция:', currentPos);
        
        // Вычисляем смещение
        const offset = {
          x: gesture.x0 - currentPos.x,
          y: gesture.y0 - currentPos.y,
        };
        
        // Сохраняем в dragData
        dragData.current = {
          basePosition: { ...currentPos }, // копируем, чтобы избежать мутаций
          touchOffset: { ...offset },
        };
      },
      
      onPanResponderMove: (_, gesture) => {
        // Берем актуальные значения из dragData
        const { basePosition, touchOffset } = dragData.current;

        // Вычисляем новую позицию
        const newPosition = {
          x: basePosition.x + gesture.dx,
          y: basePosition.y + gesture.dy,
        };
        
        // Ограничиваем границами экрана
        const clampedPosition = clampPosition(newPosition, boundsRef.current);
        updatePosition(clampedPosition);
      },
      
      onPanResponderRelease: () => {
        const currentPos = positionRef.current;
        if (!currentPos) return;
        
        const snappedPosition = snapToGrid(currentPos);
        updatePosition(snappedPosition);
        // Очищаем временные данные
        dragData.current = {
          basePosition: null,
          touchOffset: null,
        };
      },
      
      // Обработчик прерывания (звонок, свайп и т.д.)
      onPanResponderTerminate: () => {
        console.log('TERMINATE: жест прерван');
        dragData.current = {
          basePosition: null,
          touchOffset: null,
        };
      },
    })
  ).current;

  return {
    position,                    // для рендера
    panHandlers: panResponder.panHandlers,
  };
};

export default useDraggable;
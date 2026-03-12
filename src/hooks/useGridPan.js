import { Gesture } from 'react-native-gesture-handler';
import { useRef } from 'react';
import { useGrid } from '../context/GridContext';
import { useTiles } from '../context/TilesContext';
import { useZoom } from './useZoom';
import { clampOffset } from '../utils/virtualGrid';

export const useGridPan = () => {
  const { offset, updateOffset, setOffsetDirect } = useGrid();
  const { getOccupiedBounds } = useTiles();
  const { scale } = useZoom();
  
  const lastTranslationRef = useRef({ x: 0, y: 0 });
  const lastValidOffsetRef = useRef(offset);

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      console.log('[GridPan] Начало');
      lastTranslationRef.current = { x: 0, y: 0 };
      lastValidOffsetRef.current = offset;
    })
    .onUpdate((event) => {
      // Вычисляем изменение позиции пальца
      const deltaX = event.translationX - lastTranslationRef.current.x;
      const deltaY = event.translationY - lastTranslationRef.current.y;
      
      // ИНВЕРТИРУЕМ НАПРАВЛЕНИЕ: камера двигается противоположно пальцу
      // Палец вверх (+deltaY) -> камера вниз (-deltaY)
      // Палец вправо (+deltaX) -> камера влево (-deltaX)
      const dx = -deltaX;  // Инвертируем X
      const dy = -deltaY;  // Инвертируем Y
      
      // Пробуем обновить offset
      const newOffset = {
        x: lastValidOffsetRef.current.x + dx,
        y: lastValidOffsetRef.current.y + dy
      };
      
      // Проверяем границы (как и раньше)
      /*const bounds = getOccupiedBounds();
      if (bounds) {
        const clamped = clampOffset(newOffset.x, newOffset.y, scale, {
          minCol: bounds.minCol,
          maxCol: bounds.maxCol,
          minRow: bounds.minRow,
          maxRow: bounds.maxRow
        });
        
        if (clamped.x !== newOffset.x || clamped.y !== newOffset.y) {
          console.log('[GridPan] Достигнута граница');
        }
        
        setOffsetDirect(clamped);
        lastValidOffsetRef.current = clamped;
      } else {*/
        // Если нет плиток - нет ограничений
        updateOffset(dx, dy);
        lastValidOffsetRef.current = {
          x: lastValidOffsetRef.current.x + dx,
          y: lastValidOffsetRef.current.y + dy
        };
      //}
      
      lastTranslationRef.current = {
        x: event.translationX,
        y: event.translationY
      };
    })
    .onEnd(() => {
      console.log('[GridPan] Конец');
    });

  return panGesture;
};
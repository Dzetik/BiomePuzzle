import { Gesture } from 'react-native-gesture-handler';
import { useRef } from 'react';
import { useGrid } from '../context/GridContext';
import { useTiles } from '../context/TilesContext';
import { useZoom } from './useZoom';
import { clampOffset } from '../utils/virtualGrid';

export const useGridPan = () => {
  // Все хуки вызываются на верхнем уровне
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
      lastValidOffsetRef.current = offset; // Используем offset из замыкания
    })
    .onUpdate((event) => {
      const dx = event.translationX - lastTranslationRef.current.x;
      const dy = event.translationY - lastTranslationRef.current.y;
      
      // Пробуем обновить offset
      const newOffset = {
        x: lastValidOffsetRef.current.x + dx,
        y: lastValidOffsetRef.current.y + dy
      };
      
      // Проверяем, не выходит ли новый offset за пределы
      const bounds = getOccupiedBounds();
      if (bounds) {
        const clamped = clampOffset(newOffset.x, newOffset.y, scale, {
          minCol: bounds.minCol,
          maxCol: bounds.maxCol,
          minRow: bounds.minRow,
          maxRow: bounds.maxRow
        });
        
        // Если отличается от запрошенного - значит упёрлись в границу
        if (clamped.x !== newOffset.x || clamped.y !== newOffset.y) {
          console.log('[GridPan] Достигнута граница');
        }
        
        // Применяем ограниченный offset
        setOffsetDirect(clamped);
        lastValidOffsetRef.current = clamped;
      } else {
        // Если нет плиток - нет ограничений
        updateOffset(dx, dy);
        lastValidOffsetRef.current = {
          x: lastValidOffsetRef.current.x + dx,
          y: lastValidOffsetRef.current.y + dy
        };
      }
      
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
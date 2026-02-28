import { Gesture } from 'react-native-gesture-handler';
import { useRef } from 'react';
import { useGrid } from '../context/GridContext';

export const useGridPan = () => {
  const { updateOffset } = useGrid();
  const lastTranslationRef = useRef({ x: 0, y: 0 });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      console.log('[GridPan] Начало');
      lastTranslationRef.current = { x: 0, y: 0 };
    })
    .onUpdate((event) => {
      const dx = event.translationX - lastTranslationRef.current.x;
      const dy = event.translationY - lastTranslationRef.current.y;
      
      updateOffset(dx, dy);
      
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
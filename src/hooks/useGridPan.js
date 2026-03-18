// src/hooks/useGridPan.js
import { Gesture } from 'react-native-gesture-handler';
import { useRef } from 'react';
import { Dimensions } from 'react-native'; // Добавляем импорт
import { useGrid } from '../context/GridContext';
import { useTiles } from '../context/TilesContext';
import { useZoom } from './useZoom';
import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid'; // Импорт конфига
import { clampOffsetToGridBounds } from '../utils/constraints'; // Импорт новой функции

export const useGridPan = () => {
  const { offset, updateOffset, setOffsetDirect } = useGrid();
  const { scale } = useZoom(); // getOccupiedBounds больше не нужен для границ грида
  
  const lastTranslationRef = useRef({ x: 0, y: 0 });
  const lastValidOffsetRef = useRef(offset);

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      lastTranslationRef.current = { x: 0, y: 0 };
      lastValidOffsetRef.current = offset;
    })
    .onUpdate((event) => {
      const deltaX = event.translationX - lastTranslationRef.current.x;
      const deltaY = event.translationY - lastTranslationRef.current.y;
      
      const dx = -deltaX; 
      const dy = -deltaY; 
      
      const newOffset = {
        x: lastValidOffsetRef.current.x + dx,
        y: lastValidOffsetRef.current.y + dy
      };
      
      // ✅ ПРИМЕНЯЕМ ОГРАНИЧЕНИЯ
      const screen = Dimensions.get('window');
      const gridConfig = {
        cols: BASE_GRID.COLS,
        rows: BASE_GRID.ROWS,
        cellSize: BASE_GRID.CELL_SIZE,
        baseOffset: BASE_GRID_OFFSET,
      };
      
      // buffer = 20px, чтобы край грида не прилипал к краю экрана
      const clamped = clampOffsetToGridBounds(newOffset.x, newOffset.y, scale, gridConfig, screen, 0, 90*scale);
      
      setOffsetDirect(clamped);
      lastValidOffsetRef.current = clamped;
      
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
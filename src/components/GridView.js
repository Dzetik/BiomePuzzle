import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import CellView from './CellView';
import { useGridPan } from '../hooks/useGridPan';
import { useGrid } from '../context/GridContext';
import { useZoom } from '../hooks/useZoom';
import { useTiles } from '../context/TilesContext';
import { getVisibleBounds } from '../utils/virtualGrid';

const GridView = () => {
  const panGesture = useGridPan();
  const { offset } = useGrid();
  const { scale } = useZoom();
  const { isCellOccupied } = useTiles();
  
  // Используем ref для хранения предыдущих значений
  const prevBoundsRef = useRef({ startCol: 0, endCol: 0, startRow: 0, endRow: 0 });
  const [bounds, setBounds] = useState({ startCol: 0, endCol: 0, startRow: 0, endRow: 0 });
  
  // Вычисляем границы видимых ячеек только при изменении offset или scale
  useEffect(() => {
    const newBounds = getVisibleBounds(offset.x, offset.y, scale);
    
    // Проверяем, действительно ли изменились границы
    if (newBounds.startCol !== prevBoundsRef.current.startCol ||
        newBounds.endCol !== prevBoundsRef.current.endCol ||
        newBounds.startRow !== prevBoundsRef.current.startRow ||
        newBounds.endRow !== prevBoundsRef.current.endRow) {
      
      console.log('[GridView] Границы изменились:', newBounds);
      setBounds(newBounds);
      prevBoundsRef.current = newBounds;
    }
  }, [offset.x, offset.y, scale]); // Зависимости только от offset и scale
  
  // Мемоизируем создание ячеек
  const cells = useMemo(() => {
    const cellsArray = [];
    const startCol = bounds.startCol;
    const endCol = bounds.endCol;
    const startRow = bounds.startRow;
    const endRow = bounds.endRow;
    
    // Ограничиваем количество ячеек для производительности
    const maxCells = 500; // Максимальное количество ячеек за раз
    let cellCount = 0;
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (cellCount >= maxCells) {
          console.warn('[GridView] Достигнут лимит ячеек:', maxCells);
          break;
        }
        
        cellsArray.push(
          <CellView 
            key={`${row}-${col}`} 
            col={col} 
            row={row} 
            isOccupied={isCellOccupied(col, row)}
          />
        );
        cellCount++;
      }
    }
    
    console.log('[GridView] Создано ячеек:', cellsArray.length, 'bounds:', bounds);
    
    return cellsArray;
  }, [bounds.startCol, bounds.endCol, bounds.startRow, bounds.endRow, isCellOccupied]);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {cells}
      </View>
    </GestureDetector>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
};

export default GridView;
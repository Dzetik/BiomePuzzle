import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import CellView from './CellView';
import { getGridCols, getGridRows } from '../utils/gridUtils';
import { useGridPan } from '../hooks/useGridPan';
import { useGrid } from '../context/GridContext';

const GridView = () => {
  const cols = getGridCols();
  const rows = getGridRows();
  const panGesture = useGridPan();
  const { offset } = useGrid();
  
  useEffect(() => {
    console.log('[GridView] Получен новый offset:', offset);
  }, [offset]);
  
  const cells = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push(
        <CellView 
          key={`${row}-${col}`} 
          col={col} 
          row={row} 
        />
      );
    }
  }

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
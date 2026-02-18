import React from 'react';
import { View } from 'react-native';
import CellView from './CellView';
import { getGridCols, getGridRows } from '../constants/grid'; 

const GridView = () => {
  const cols = getGridCols();
  const rows = getGridRows();
  
  // Создаем массив ячеек
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
    <View>
      {cells}
    </View>
  );
};

export default GridView;
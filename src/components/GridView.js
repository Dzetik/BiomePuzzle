import React from 'react';
import { View } from 'react-native';
import CellView from './CellView';
import { GRID } from '../constants/grid';

const GridView = () => {
  // Создаем массив ячеек
  const cells = [];
  
  for (let row = 0; row < GRID.ROWS; row++) {
    for (let col = 0; col < GRID.COLS; col++) {
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
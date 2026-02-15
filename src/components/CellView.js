import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GRID, GRID_OFFSET } from '../constants/grid';

const CellView = ({ col, row, children }) => {
  // Вычисляем позицию на основе col, row и GRID_OFFSET
  const left = GRID_OFFSET.x + col * GRID.CELL_SIZE;
  const top = GRID_OFFSET.y + row * GRID.CELL_SIZE;

  return (
    <View
      style={[
        styles.cell,
        {
          left,
          top,
          width: GRID.CELL_SIZE,
          height: GRID.CELL_SIZE,
        }
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CellView;
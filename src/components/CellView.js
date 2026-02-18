import React from 'react';
import { View, StyleSheet } from 'react-native';
import { getCellSize, getGridOffset } from '../utils/gridUtils';
import { useZoom } from '../hooks/useZoom';

// ========================================
// Компонент отдельной ячейки сетки
// Автоматически масштабируется при изменении scale
// ========================================

const CellView = ({ col, row, children }) => {
  const { scale } = useZoom(); // Получаем текущий масштаб
  
  // Вычисляем позицию и размер с учетом масштаба
  const cellSize = getCellSize(scale);
  const offset = getGridOffset(scale);
  
  const left = offset.x + col * cellSize;
  const top = offset.y + row * cellSize;

  return (
    <View
      style={[
        styles.cell,
        {
          left,
          top,
          width: cellSize,
          height: cellSize,
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
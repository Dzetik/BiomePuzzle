import React, { memo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useZoom } from '../hooks/useZoom';
import { useGrid } from '../context/GridContext';
import { getCellCornerWithOffset } from '../utils/gridUtils';

const CellView = memo(({ col, row }) => {
  const { scale } = useZoom();
  const { offset } = useGrid();
  
  // Логируем только для угловых ячеек, чтобы не спамить
  useEffect(() => {
    if ((col === 0 && row === 0) || (col === 7 && row === 11)) {
      console.log(`[CellView ${col},${row}] Получила offset:`, offset);
    }
  }, [offset, col, row]);
  
  const position = getCellCornerWithOffset(col, row, scale, offset.x, offset.y);
  const cellSize = 90 * scale;

  // Логируем позицию для угловых ячеек
  useEffect(() => {
    if ((col === 0 && row === 0) || (col === 7 && row === 11)) {
      console.log(`[CellView ${col},${row}] Новая позиция:`, position);
    }
  }, [position.x, position.y, col, row]);

  return (
    <View
      style={[
        styles.cell,
        {
          width: cellSize,
          height: cellSize,
          left: position.x,
          top: position.y,
          borderWidth: 1 * scale,
        }
      ]}
    />
  );
});

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
  },
});

export default CellView;
// src/components/GridView.js
// ========================================
// КОМПОНЕНТ ИГРОВОЙ СЕТКИ
// Отрисовка всех ячеек базового грида (12×12)
// Без виртуализации — проще, надёжнее, нет мерцания при скролле
// ========================================
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import CellView from './CellView';
import { useGridPan } from '../hooks/useGridPan';
import { useTiles } from '../context/TilesContext';
import { BASE_GRID } from '../constants/grid';

const GridView = () => {
  const panGesture = useGridPan();
  const { isCellOccupied } = useTiles();
  
  // ✅ Мемоизируем создание всех ячеек базового грида
  // 12×12 = 144 ячейки — это достаточно мало для прямого рендера
  // Без виртуализации код проще, надёжнее и нет мерцания при скролле
  const cells = useMemo(() => {
    const cellsArray = [];
    
    for (let row = 0; row < BASE_GRID.ROWS; row++) {
      for (let col = 0; col < BASE_GRID.COLS; col++) {
        cellsArray.push(
          <CellView 
            key={`${row}-${col}`} 
            col={col} 
            row={row} 
            isOccupied={isCellOccupied(col, row)}
          />
        );
      }
    }
    
    return cellsArray;
  }, [isCellOccupied]); // Зависимость только от функции проверки занятости

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {cells}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    // ✅ Важно: pointerEvents 'box-none' позволяет жестам проходить сквозь контейнер
    // к ячейкам и плиткам, если это потребуется в будущем
    pointerEvents: 'box-none',
  },
});

export default GridView;
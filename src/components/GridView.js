// ============================================================================
// КОМПОНЕНТ ИГРОВОЙ СЕТКИ
// Отрисовка всех ячеек базового грида без виртуализации
// ============================================================================

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import CellView from './CellView';
import { useGridPan } from '../hooks/useGridPan';
import { useTiles } from '../context/TilesContext';
import { BASE_GRID } from '../constants/grid';

/**
 * Рендерит все ячейки игровой сетки и оборачивает их в GestureDetector для панорамирования.
 *
 * Список ячеек строится через `useMemo` и пересчитывается только при изменении
 * `isCellOccupied` — то есть когда меняется состояние заполненности сетки.
 * Для сеток небольшого размера (BASE_GRID.COLS × BASE_GRID.ROWS) виртуализация
 * не требуется; все ячейки рендерятся одновременно.
 *
 * Жест панорамирования предоставляется хуком `useGridPan` — он обновляет offset
 * в GridContext, который затем используют CellView и PlacedTile для вычисления
 * своих экранных позиций.
 *
 * Стиль контейнера: `pointerEvents: 'box-none'` — контейнер не перехватывает тапы
 * сам по себе, только дочерние элементы (CellView) могут их получать.
 */
const GridView = () => {
  const panGesture = useGridPan();
  const { isCellOccupied } = useTiles();

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
  }, [isCellOccupied]); 
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
    pointerEvents: 'box-none',
  },
});

export default GridView;
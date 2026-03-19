// ============================================================================
// КОМПОНЕНТ: ОТЛАДОЧНАЯ ЯЧЕЙКА СЕТКИ
// ============================================================================

import React, { memo, useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useZoom } from '../hooks/useZoom';
import { useGrid } from '../context/GridContext';
import { useTiles } from '../context/TilesContext';
import { getCellCornerWithOffset } from '../utils/gridUtils'; 
/**
 * Отображает одну ячейку логической сетки в дебаг-режиме.
 *
 * Используется исключительно для визуальной отладки: показывает границу
 * ячейки, координаты (col, row) и ID занимающей её плитки. В продакшене
 * ячейки невидимы (прозрачный фон), но их TouchableOpacity-области остаются
 * для hit-test при размещении плитки.
 *
 * Оборачивается в `memo` — перерисовывается только при изменении col/row
 * или при смене масштаба/смещения сетки.
 *
 * @param {number} col - индекс колонки ячейки (0-based)
 * @param {number} row - индекс строки ячейки (0-based)
 */
const CellView = memo(({ col, row }) => {
  const { scale } = useZoom();
  const { offset } = useGrid();
  const { getTileAt } = useTiles();
  
  const [isOccupied, setIsOccupied] = useState(false);
  const [tileId, setTileId] = useState(null);
  
  useEffect(() => {
    const tile = getTileAt(col, row);
    setIsOccupied(!!tile);
    setTileId(tile?.id || null);
  }, [col, row, getTileAt]);
  
  const position = getCellCornerWithOffset(col, row, scale, offset.x, offset.y);
  const cellSize = 90 * scale;

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
          backgroundColor: isOccupied ? 'rgba(0, 255, 0, 0.1)' : 'transparent',
        }
      ]}
    >
      <View style={styles.coordOverlay}>
        <Text style={[styles.coordText, { fontSize: 10 * scale }]}>
          {col},{row}
        </Text>
        {isOccupied && (
          <Text style={[styles.tileIdText, { fontSize: 8 * scale }]}>
            {tileId}
          </Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 2,
    borderRadius: 4,
  },
  coordText: {
    color: '#aaa',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tileIdText: {
    color: '#0f0',
    textAlign: 'center',
  },
});

export default CellView;
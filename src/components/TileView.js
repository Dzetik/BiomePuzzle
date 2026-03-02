// ========================================
// КОМПОНЕНТ ПЛИТКИ
// ========================================

import React from 'react';
import { Animated, Image, View, Text, StyleSheet } from 'react-native';
import { useGrid } from '../context/GridContext';
import { useZoom } from '../hooks/useZoom';
import { findNearestCell } from '../utils/gridUtils';

const TileView = ({ 
  textureSource,
  position,
  width,
  height,
  panHandlers,
  tileId = 'unknown'
}) => {
  
  const { offset } = useGrid();
  const { scale } = useZoom();
  
  const [debugInfo, setDebugInfo] = React.useState({ 
    x: 0, y: 0,
    col: 0, row: 0
  });
  
  // Отслеживание позиции
  React.useEffect(() => {
    if (!position || typeof position.addListener !== 'function') {
      return;
    }

    const listener = position.addListener((value) => {
      if (!value || typeof value.x === 'undefined') return;
      
      const currentWidth = typeof width.__getValue === 'function' ? width.__getValue() : width;
      const currentHeight = typeof height.__getValue === 'function' ? height.__getValue() : height;
      
      const centerX = value.x + currentWidth / 2;
      const centerY = value.y + currentHeight / 2;
      
      const cell = findNearestCell(
        centerX,
        centerY,
        scale,
        offset.x,
        offset.y
      );
      
      setDebugInfo({
        x: Math.round(value.x),
        y: Math.round(value.y),
        col: cell.col,
        row: cell.row
      });
    });
    
    return () => position.removeListener(listener);
  }, [position, width, height, offset, scale]);

  // Стиль для анимации
  const animatedStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y }
    ],
    width: width,
    height: height,
  };

  return (
    <Animated.View
      {...panHandlers}
      style={[
        styles.tile,
        animatedStyle
      ]}
    >
      <Image 
        source={textureSource} 
        style={styles.image}
        resizeMode="cover"
      />
      
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>
          {tileId} {/* Показываем ID плитки вместо ячейки */}
        </Text>
        <Text style={styles.debugTextSmall}>
          {debugInfo.col},{debugInfo.row}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
  },
  debugText: {
    color: 'yellow',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugTextSmall: {
    color: 'white',
    fontSize: 8,
    textAlign: 'center',
  },
});

export default TileView;
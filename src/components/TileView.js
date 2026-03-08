// src/components/TileView.js

import React from 'react';
import { Animated, Image, View, Text, StyleSheet } from 'react-native';
import { useGrid } from '../context/GridContext';
import { useZoom } from '../hooks/useZoom';

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
  
  const [debugInfo, setDebugInfo] = React.useState({ x: 0, y: 0, col: 0, row: 0 });
  
  React.useEffect(() => {
    if (!position || typeof position.x !== 'number') return;
    
    const w = typeof width === 'number' ? width : 50;
    const h = typeof height === 'number' ? height : 50;
    
    setDebugInfo({
      x: Math.round(position.x),
      y: Math.round(position.y),
    });
  }, [position, width, height]);

  const tileStyle = {
    position: 'absolute',
    left: position?.x || 0,
    top: position?.y || 0,
    width: typeof width === 'number' ? width : 50,
    height: typeof height === 'number' ? height : 50,
  };

  return (
    <Animated.View {...panHandlers} style={[styles.tile, tileStyle]}>
      <Image source={textureSource} style={styles.image} resizeMode="cover" />
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>{tileId}</Text>
        <Text style={styles.debugTextSmall}>{debugInfo.x},{debugInfo.y}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tile: {
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
  image: { width: '100%', height: '100%' },
  debugOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 4,
  },
  debugText: { color: 'yellow', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  debugTextSmall: { color: 'white', fontSize: 8, textAlign: 'center' },
});

export default TileView;
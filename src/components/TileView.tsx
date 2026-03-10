// src/components/TileView.tsx
import React from 'react';
import { Animated, Image, View, Text, StyleSheet } from 'react-native';
import { useGrid } from '../context/GridContext';
import { useZoom } from '../hooks/useZoom';

interface TileViewProps {
  textureSource: any;
  position: { x: number; y: number };
  width: number;
  height: number;
  gesture?: any;  // ← НОВОЕ: жест из gesture-handler
  tileId: string;
  rotation?: number;  // ← НОВОЕ: угол поворота
}

const TileView: React.FC<TileViewProps> = ({ 
  textureSource,
  position,
  width,
  height,
  gesture,
  tileId = 'unknown',
  rotation = 0,
}) => {
  const { offset } = useGrid();
  const { scale } = useZoom();
  
  const [debugInfo, setDebugInfo] = React.useState({ x: 0, y: 0 });
  
  React.useEffect(() => {
    if (!position || typeof position.x !== 'number') return;
    setDebugInfo({
      x: Math.round(position.x),
      y: Math.round(position.y),
    });
  }, [position]);

  const tileStyle = {
    position: 'absolute' as const,
    left: position?.x || 0,
    top: position?.y || 0,
    width: typeof width === 'number' ? width : 50,
    height: typeof height === 'number' ? height : 50,
    
    // ← НОВОЕ: применяем поворот через transform
    transform: [{ rotate: `${rotation}deg` }],
  };

  return (
    // ← НОВОЕ: оборачиваем в GestureDetector если есть жест
    <Animated.View style={[styles.tile, tileStyle]}>
      <Image source={textureSource} style={styles.image} resizeMode="cover" />
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>{tileId}</Text>
        <Text style={styles.debugTextSmall}>{debugInfo.x},{debugInfo.y}</Text>
        <Text style={styles.debugTextSmall}>🔄 {rotation}°</Text>
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
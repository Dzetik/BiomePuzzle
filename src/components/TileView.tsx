// src/components/TileView.tsx
import React from 'react';
import { Animated, Image, View, Text, StyleSheet } from 'react-native';
import { StyleProp, ViewStyle } from 'react-native'; 
import { useGrid } from '../context/GridContext';
import { useZoom } from '../hooks/useZoom';

interface TileViewProps {
  textureSource: any;
  position: { x: number; y: number };
  width: number;
  height: number;
  gesture?: any;
  tileId: string;
  rotation?: number;
  isInInventory?: boolean;
  debugLabel?: string;  // ← Для отладки
}

const TileView: React.FC<TileViewProps> = ({ 
  textureSource,
  position,
  width,
  height,
  gesture,
  tileId = 'unknown',
  rotation = 0,
  isInInventory = false,
  debugLabel = '',
}) => {
  const { offset } = useGrid();
  const { scale } = useZoom();
  
  // ============================================================================
  // 🔍 ОТЛАДКА: Лог рендера с координатами
  // ============================================================================
  React.useEffect(() => {
    if (__DEV__) {
      console.log(`[TileView] 🎬 MOUNTED:`, {
        tileId,
        debugLabel,
        isInInventory,
        position: { x: Math.round(position?.x || 0), y: Math.round(position?.y || 0) },
        zIndex: isInInventory ? 10000 : 999999,
      });
    }
  }, [tileId, debugLabel, isInInventory, position?.x, position?.y]);

  React.useEffect(() => {
    if (__DEV__) {
      console.log(`[TileView] 🎨 Render ${debugLabel}:`, {
        tileId,
        isInInventory,
        position: { x: Math.round(position?.x || 0), y: Math.round(position?.y || 0) },
        size: { width, height },
        rotation,
      });
    }
  }, [tileId, isInInventory, position?.x, position?.y, width, height, rotation, debugLabel]);

  const tileStyle = {
    position: (isInInventory ? 'relative' : 'absolute') as 'relative' | 'absolute',
    
    ...(!isInInventory && {
      left: typeof position?.x === 'number' ? position.x : 0,
      top: typeof position?.y === 'number' ? position.y : 0,
    }),
    
    width: typeof width === 'number' ? width : 50,
    height: typeof height === 'number' ? height : 50,
    transform: [{ rotate: `${rotation}deg` }],
    
    ...(isInInventory && {
      alignSelf: 'center' as const,
    }),
    
    zIndex: 9999, 
    elevation: 9999,
  } satisfies StyleProp<ViewStyle>;

  React.useEffect(() => {
    if (__DEV__ && !isInInventory) {
      console.log(`[TileView] 🎯 ABSOLUTE RENDER:`, {
        tileId,
        screenPos: { x: Math.round(position.x), y: Math.round(position.y) },
        appliedStyle: { left: position.x, top: position.y },
      });
    }
  }, [tileId, isInInventory, position?.x, position?.y]);

  return (
    <Animated.View style={[styles.tile, tileStyle]}>
      <Image 
        source={textureSource} 
        style={styles.image} 
        resizeMode="cover"
        onLoad={() => __DEV__ && console.log(`[TileView] ✅ Image loaded: ${tileId}`)}
        onError={(e) => __DEV__ && console.error(`[TileView] ❌ Image error: ${tileId}`, e.nativeEvent?.error)}
      />
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>{tileId}</Text>
        <Text style={styles.debugTextSmall}>{Math.round(position?.x || 0)},{Math.round(position?.y || 0)}</Text>
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
import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';
import useDraggable from './src/hooks/useDraggable';
import { useZoom, ZoomProvider } from './src/hooks/useZoom';
import { GridProvider } from './src/context/GridContext';
import { getSnapToSpawnerPosition } from './src/utils/spawnerUtils'; 
import { getSpawnerSize } from './src/constants/spawner';

const testTexture = require('./assets/images/textures/test1.png');

const GameContent = () => {
  const { scale, setScale, MIN_SCALE, MAX_SCALE } = useZoom();
  
  // Создаём пинч-жест здесь
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      console.log('[Pinch] Начало');
    })
    .onUpdate((event) => {
      const newScale = scale * event.scale;
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      setScale(clampedScale);
    })
    .onEnd(() => {
      console.log('[Pinch] Конец');
    });

  const spawnerSize = getSpawnerSize();
  const initialTileSize = { width: spawnerSize, height: spawnerSize };
  const initialPosition = getSnapToSpawnerPosition(initialTileSize);
  const { position, width, height, panHandlers: tilePanHandlers } = useDraggable(initialPosition);

  return (
    <GestureDetector gesture={pinchGesture}>
      <View style={styles.gameContainer}>
        <GridView />
        <SpawnerCellView />
        <TileView 
          textureSource={testTexture}
          position={position}
          width={width}
          height={height}
          panHandlers={tilePanHandlers}
        />
      </View>
    </GestureDetector>
  );
};

const App = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ZoomProvider>
        <GridProvider>
          <StatusBar hidden={true} />
          <GameContent />
        </GridProvider>
      </ZoomProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  gameContainer: {
    flex: 1,
  },
});

export default App;
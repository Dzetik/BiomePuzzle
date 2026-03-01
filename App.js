import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';
import useDraggable from './src/hooks/useDraggable';
import { useZoom, ZoomProvider } from './src/hooks/useZoom';
import { GridProvider } from './src/context/GridContext';
import { TilesProvider } from './src/context/TilesContext';
import { getSnapToSpawnerPosition } from './src/utils/spawnerUtils'; 
import { getSpawnerSize } from './src/constants/spawner';
import { useSpawner } from './src/hooks/useSpawner';

const testTexture = require('./assets/images/textures/test1.png');

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0] && args[0].stack) {
      console.log('FULL STACK:', args[0].stack);
    }
    originalConsoleError.apply(console, args);
  };
}

// Компонент с жестом зума
const ZoomHandler = ({ children }) => {
  const { scale, setScale, MIN_SCALE, MAX_SCALE } = useZoom();
  
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      console.log('[Pinch] Начало');
    })
    .onUpdate((event) => {
      const newScale = scale * event.scale;
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      console.log('[Pinch] Новый масштаб:', clampedScale);
      setScale(clampedScale);
    })
    .onEnd(() => {
      console.log('[Pinch] Конец');
    });

  return (
    <GestureDetector gesture={pinchGesture}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </GestureDetector>
  );
};

const GameContent = () => {
  const spawnerSize = getSpawnerSize();
  const spawnerPos = useSpawner(); 
  const initialTileSize = { width: spawnerSize, height: spawnerSize };
  const initialPosition = getSnapToSpawnerPosition(initialTileSize, spawnerPos);
  
  // Исправлено: получаем panHandlers из хука
  const { position, width, height, panHandlers } = useDraggable(initialPosition, 'tile-1');

  return (
    <View style={styles.gameContainer}>
      <GridView />
      <SpawnerCellView />
      <TileView 
        textureSource={testTexture}
        position={position}
        width={width}
        height={height}
        panHandlers={panHandlers} // Исправлено: panHandlers вместо tilePanHandlers
      />
    </View>
  );
};

const App = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ZoomProvider>
        <GridProvider>
          <TilesProvider>
            <StatusBar hidden={true} />
            <ZoomHandler>
              <GameContent />
            </ZoomHandler>
          </TilesProvider>
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
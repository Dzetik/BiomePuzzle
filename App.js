import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { GestureHandlerRootView, GestureDetector } from 'react-native-gesture-handler';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';
import useDraggable from './src/hooks/useDraggable';
import { useZoom, ZoomProvider } from './src/hooks/useZoom';
import usePinchZoom from './src/hooks/usePinchZoom';
import { getSnapToSpawnerPosition } from './src/utils/spawnerUtils'; 
import { getSpawnerSize } from './src/constants/spawner';

// Текстура для тестовой плитки
const testTexture = require('./assets/images/textures/test1.png');

// Основной компонент игры с жестами
const GameContent = () => {
  const { scale, setScale, MIN_SCALE, MAX_SCALE } = useZoom();
  const pinchGesture = usePinchZoom(scale, setScale, MIN_SCALE, MAX_SCALE);
  
  // Сбрасываем кэши при изменении размеров экрана
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      // Функции сброса кэша (если нужны)
    });
    return () => subscription?.remove();
  }, []);

  // Инициализация плитки в центре спавнера
  const spawnerSize = getSpawnerSize();
  const initialTileSize = { width: spawnerSize, height: spawnerSize };
  const initialPosition = getSnapToSpawnerPosition(initialTileSize);
  const { position, width, height, panHandlers } = useDraggable(initialPosition);

  return (
    <GestureHandlerRootView style={styles.gameContainer}>
      <GestureDetector gesture={pinchGesture}>
        <View style={styles.gameContainer}>
          <GridView />
          <SpawnerCellView />
          <TileView 
            textureSource={testTexture}
            position={position}
            width={width}
            height={height}
            panHandlers={panHandlers}
          />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const App = () => {
  return (
    <ZoomProvider>
      <View style={styles.container}>
        <StatusBar hidden={true} />
        <GameContent />
      </View>
    </ZoomProvider>
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
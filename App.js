import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';
import useDraggable from './src/hooks/useDraggable';
import { useZoom, ZoomProvider } from './src/hooks/useZoom';
import { GridProvider } from './src/context/GridContext';
import { TilesProvider, useTiles } from './src/context/TilesContext';
import { getSpawnerSize } from './src/constants/spawner';
import { useSpawner } from './src/hooks/useSpawner';
import { getSnapToSpawnerPosition } from './src/utils/spawnerUtils';

const testTexture = require('./assets/images/textures/test1.png');

// Компонент с жестом зума
const ZoomHandler = ({ children }) => {
  const { scale, setScale, MIN_SCALE, MAX_SCALE } = useZoom();
  
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = scale * event.scale;
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      setScale(clampedScale);
    });

  return (
    <GestureDetector gesture={pinchGesture}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </GestureDetector>
  );
};

// Компонент для отображения размещённых плиток
const PlacedTiles = () => {
  const { getAllTiles } = useTiles();
  const [tiles, setTiles] = useState([]);
  
  useEffect(() => {
    const placedTiles = getAllTiles();
    setTiles(placedTiles);
    console.log('[App] Размещённые плитки:', placedTiles.map(t => `${t.id}@[${t.col},${t.row}]`));
  }, [getAllTiles]);
  
  return null;
};

const GameContent = () => {
  const { getSpawnerTile, createSpawnerTile } = useTiles();
  const spawnerPos = useSpawner();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Инициализация спавнера
  useEffect(() => {
    if (spawnerPos?.size > 0 && !isInitialized) {
      console.log('[App] Инициализация спавнера');
      createSpawnerTile();
      setIsInitialized(true);
    }
  }, [spawnerPos, createSpawnerTile, isInitialized]);
  
  // Получаем текущую плитку из спавнера
  const spawnerTile = getSpawnerTile();
  console.log('[App] Текущая плитка в спавнере:', spawnerTile?.id);
  
  // Вычисляем начальную позицию
  const getInitialPosition = useCallback(() => {
    if (spawnerPos?.size > 0) {
      const spawnerSize = getSpawnerSize();
      const initialTileSize = { width: spawnerSize, height: spawnerSize };
      return getSnapToSpawnerPosition(initialTileSize, spawnerPos);
    }
    return { x: 0, y: 0 };
  }, [spawnerPos]);
  
  const initialPosition = getInitialPosition();
  
  // ВСЕГДА вызываем useDraggable, но передаём реальный ID только когда он есть
  const draggableTile = useDraggable(
    spawnerTile, 
    spawnerTile?.id, // может быть undefined, это нормально
    initialPosition
  );

  // Добавляем отладку позиции плитки
  useEffect(() => {
    if (draggableTile?.position && typeof draggableTile.position.addListener === 'function') {
      const listener = draggableTile.position.addListener((value) => {
        // console.log('[App] Позиция плитки:', value); // закомментировано
      });
      return () => draggableTile.position.removeListener(listener);
    }
  }, [draggableTile?.position]);

  return (
    <View style={styles.gameContainer}>
      <GridView />
      <SpawnerCellView />
      <PlacedTiles />
      
      {spawnerTile?.id && draggableTile?.position && (
        <TileView 
          textureSource={testTexture}
          position={draggableTile.position}
          width={draggableTile.width}
          height={draggableTile.height}
          panHandlers={draggableTile.panHandlers}
          tileId={spawnerTile.id}
        />
      )}
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
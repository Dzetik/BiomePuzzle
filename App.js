import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

// Компоненты
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';

// Хуки
import useDraggable from './src/hooks/useDraggable';
import { useZoom, ZoomProvider } from './src/hooks/useZoom';
import { useGrid } from './src/context/GridContext';
import { useSpawner } from './src/hooks/useSpawner';

// Контексты
import { TilesProvider, useTiles } from './src/context/TilesContext';
import { GridProvider } from './src/context/GridContext';

// Утилиты и константы
import { getSpawnerSize } from './src/constants/spawner';
import { DEFAULT_TILE_SIZE } from './src/constants/tile';
import { getSnapToSpawnerPosition } from './src/utils/spawnerUtils';
import { getSnapToCellPosition } from './src/utils/gridUtils';

const testTexture = require('./assets/images/textures/test1.png');

// ========================================
// Компонент с жестом зума
// ========================================
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

// ========================================
// Компонент для отрисовки размещённых плиток
// ========================================
const PlacedTiles = () => {
  const { getAllTiles } = useTiles();
  const { scale } = useZoom();
  const { offset } = useGrid();
  const [tiles, setTiles] = useState([]);
  
  useEffect(() => {
    const placedTiles = getAllTiles();
    setTiles(placedTiles);
    console.log('[App] Размещённые плитки:', placedTiles.map(t => `${t.id}@[${t.col},${t.row}]`));
  }, [getAllTiles]);
  
  return (
    <>
      {tiles.map((tile) => {
        const cellSize = DEFAULT_TILE_SIZE.width;
        const tileSize = { width: cellSize, height: cellSize };
        
        const position = getSnapToCellPosition(
          tileSize,
          tile.col,
          tile.row,
          scale,
          offset.x,
          offset.y
        );

        return (
          <TileView
            key={tile.id}
            textureSource={testTexture}
            position={position}
            width={cellSize}
            height={cellSize}
            panHandlers={{}}
            tileId={tile.id}
          />
        );
      })}
    </>
  );
};

// ========================================
// Основной игровой контент
// ========================================
const GameContent = () => {
  const { getSpawnerTile, createSpawnerTile } = useTiles();
  const spawnerPos = useSpawner();
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (spawnerPos?.size > 0 && !isInitialized) {
      console.log('[App] Инициализация спавнера');
      createSpawnerTile();
      setIsInitialized(true);
    }
  }, [spawnerPos, createSpawnerTile, isInitialized]);
  
  const spawnerTile = getSpawnerTile();
  console.log('[App] Текущая плитка в спавнере:', spawnerTile?.id);
  
  const getInitialPosition = useCallback(() => {
    if (spawnerPos?.size > 0) {
      const spawnerSize = getSpawnerSize();
      const initialTileSize = { width: spawnerSize, height: spawnerSize };
      return getSnapToSpawnerPosition(initialTileSize, spawnerPos);
    }
    return { x: 0, y: 0 };
  }, [spawnerPos]);
  
  const initialPosition = getInitialPosition();
  
  const draggableTile = useDraggable(
    spawnerTile, 
    spawnerTile?.id,
    initialPosition
  );

  useEffect(() => {
    if (draggableTile?.position && typeof draggableTile.position.addListener === 'function') {
      const listener = draggableTile.position.addListener((value) => {
        // console.log('[App] Позиция плитки:', value);
      });
      return () => draggableTile.position.removeListener(listener);
    }
  }, [draggableTile?.position]);

  return (
    <View style={styles.gameContainer}>
      <GridView />
      <SpawnerCellView />
      <PlacedTiles />
      
      {draggableTile?.position && (
        <TileView 
          textureSource={testTexture}
          position={draggableTile.position}
          // ✅ Размер всегда из анимации (корректный для текущего состояния)
          width={draggableTile.width}
          height={draggableTile.height}
          panHandlers={draggableTile.panHandlers}
          tileId={spawnerTile?.id}
        />
      )}
    </View>
  );
};

// ========================================
// Корневой компонент App
// ========================================
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
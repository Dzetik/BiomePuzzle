// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ - ИСПРАВЛЕННЫЙ
// ========================================
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { SpawnerService } from './src/services/SpawnerService';
import { getSnapToCellPosition } from './src/utils/gridUtils';

const testTexture = require('./assets/images/textures/test1.png');

// ========================================
// Компонент с жестом зума
// ========================================
const ZoomHandler = ({ children }) => {
  const { scale, setScale, MIN_SCALE, MAX_SCALE } = useZoom();

  const pinchGesture = Gesture.Pinch().onUpdate((event) => {
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
  }, [getAllTiles]);

  return (
    <>
      {tiles.map((tile) => {
        const cellSize = DEFAULT_TILE_SIZE.width;
        const tileSize = {
          width: cellSize * scale,
          height: cellSize * scale
        };

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
            width={cellSize * scale}
            height={cellSize * scale}
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
  
  // ✅ REFS ДЛЯ ОТСЛЕЖИВАНИЯ АКТИВНОЙ ПЛИТКИ
  const activeTileIdRef = useRef(null);
  const hasActiveTileRef = useRef(false);

  // Инициализация спавнера
  useEffect(() => {
    if (spawnerPos?.size > 0 && !isInitialized) {
      console.log('[App] Инициализация спавнера');
      const tile = createSpawnerTile();
      if (tile?.id) {
        activeTileIdRef.current = tile.id;
        hasActiveTileRef.current = true;
      }
      setIsInitialized(true);
    }
  }, [spawnerPos, createSpawnerTile, isInitialized]);

  const spawnerTile = getSpawnerTile();
  
  // ✅ Обновляем ref при изменении spawnerTile
  useEffect(() => {
    if (spawnerTile?.id) {
      activeTileIdRef.current = spawnerTile.id;
      hasActiveTileRef.current = true;
      console.log('[App] Обновлён activeTileId:', spawnerTile.id);
    }
  }, [spawnerTile?.id]);

  const getInitialPosition = useCallback(() => {
    if (spawnerPos?.size > 0) {
      const spawnerSize = getSpawnerSize();
      const initialTileSize = { width: spawnerSize, height: spawnerSize };
      return SpawnerService.getSnapToSpawnerPosition(initialTileSize, spawnerPos);
    }
    return { x: 0, y: 0 };
  }, [spawnerPos]);

  const initialPosition = useMemo(() => getInitialPosition(), [getInitialPosition]);

  // ✅ Всегда вызываем useDraggable с актуальным ID из ref
  const draggableTile = useDraggable(
    spawnerTile,
    activeTileIdRef.current,  // ✅ Используем ref, не spawnerTile?.id
    initialPosition
  );

  // Подписка на позицию
  useEffect(() => {
    if (draggableTile?.position && typeof draggableTile.position.addListener === 'function') {
      const listener = draggableTile.position.addListener((value) => {
        // console.log('[App] Позиция плитки:', value);
      });
      return () => draggableTile.position.removeListener(listener);
    }
  }, [draggableTile?.position]);

  // ✅ УСЛОВИЕ РЕНДЕРА: проверяем hasActiveTileRef, а не spawnerTile
  const shouldRenderActiveTile = hasActiveTileRef.current && draggableTile?.position;

  return (
    <View style={styles.gameContainer}>
      <GridView />
      <SpawnerCellView />
      <PlacedTiles />
      
      {shouldRenderActiveTile && (
        <TileView 
          textureSource={testTexture}
          position={draggableTile.position}
          width={draggableTile.width}
          height={draggableTile.height}
          panHandlers={draggableTile.panHandlers}
          tileId={activeTileIdRef.current || 'temp'}  // ✅ Используем ref
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
      <StatusBar hidden={true} />
      <ZoomProvider>
        <GridProvider>
          <TilesProvider>
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
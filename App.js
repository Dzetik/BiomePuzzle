// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ - FSM INTEGRATION
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

// FSM
import { FEATURE_FLAGS } from './src/state';

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
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
};

// ========================================
// Размещённые плитки (рендерятся из контекста)
// ========================================
const PlacedTiles = () => {
  const { getAllTiles } = useTiles();
  const { scale } = useZoom();
  const { offset } = useGrid();
  
  const tiles = getAllTiles();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[PlacedTiles] Рендер, плиток:', tiles.length);
  }

  return (
    <>
      {tiles.map((tile) => {
        const cellSize = DEFAULT_TILE_SIZE.width;
        const tileSize = {
          width: cellSize * scale,
          height: cellSize * scale,
        };

        const position = getSnapToCellPosition(
          tileSize,
          tile.col,
          tile.row,
          scale,
          offset?.x || 0,
          offset?.y || 0
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
  const { offset } = useGrid();
  const [isInitialized, setIsInitialized] = useState(false);

  const activeTileIdRef = useRef(null);
  const hasActiveTileRef = useRef(false);

  // Инициализация первой плитки в спавнере
  useEffect(() => {
    if (spawnerPos?.size > 0 && !isInitialized) {
      console.log('[App] 🟢 Инициализация спавнера');
      const tile = createSpawnerTile();
      if (tile?.id) {
        activeTileIdRef.current = tile.id;
        hasActiveTileRef.current = true;
      }
      setIsInitialized(true);
    }
  }, [spawnerPos, createSpawnerTile, isInitialized]);

  const spawnerTile = getSpawnerTile();

  useEffect(() => {
    if (spawnerTile?.id) {
      activeTileIdRef.current = spawnerTile.id;
      hasActiveTileRef.current = true;
    }
  }, [spawnerTile?.id]);

  // Вычисление начальной позиции плитки
  const getInitialPosition = useCallback(() => {
    if (spawnerPos?.size > 0) {
      const spawnerSize = getSpawnerSize();
      const initialTileSize = { width: spawnerSize, height: spawnerSize };
      return SpawnerService.getTilePosition(initialTileSize, spawnerPos);
    }
    return { x: 0, y: 0 };
  }, [spawnerPos]);

  const initialPosition = useMemo(() => getInitialPosition(), [getInitialPosition]);

  // 🔥 КОЛБЭК ПРИ РАЗМЕЩЕНИИ ПЛИТКИ
  const handleTilePlaced = useCallback((cell) => {
    console.log('🔥 [1] handleTilePlaced START');
    const newTile = createSpawnerTile();
    console.log('🔥 [2] createSpawnerTile вернул:', newTile?.id);
    if (newTile?.id) {
      activeTileIdRef.current = newTile.id;
      console.log('🔥 [3] activeTileIdRef обновлён');
    }
  }, [createSpawnerTile]);

  // 🔥 🔥 🔥 КЛЮЧЕВОЕ: Объявление draggableTile (БЫЛО ПРОПУЩЕНО!)
  const draggableTile = useDraggable(
    spawnerTile,
    activeTileIdRef.current,
    initialPosition,
    handleTilePlaced
  );

  // 🔥 Отладочное логирование (только смена состояния)
  const prevStateRef = useRef(null);
  useEffect(() => {
    if (draggableTile?.state !== prevStateRef.current) {
      console.log('[App] 🎮 FSM State:', draggableTile?.state);
      prevStateRef.current = draggableTile?.state;

      if (draggableTile?.state === 'PLACED') {
        console.log('[App] ✅ Tile placed:', draggableTile?.debug?.currentCell);
      }

      if (draggableTile?.state === 'SPAWNER_IDLE' && draggableTile?.isInSpawner) {
        console.log('[App] ✅ Tile is ACTIVE in spawner, ready for drag');
      }
    }
  }, [draggableTile?.state, draggableTile?.debug, draggableTile?.isInSpawner]);

  // 🔥 Показываем активную плитку ТОЛЬКО когда она не размещена
  const shouldRenderActiveTile =
    hasActiveTileRef.current && 
    draggableTile?.position && 
    draggableTile?.state !== 'PLACED';

  useEffect(() => {
    console.log('[App] 🔍 shouldRenderActiveTile:', {
      hasActiveTileRef: hasActiveTileRef.current,
      hasPosition: !!draggableTile?.position,
      state: draggableTile?.state,
      shouldRender: shouldRenderActiveTile,
    });
  }, [draggableTile?.state, draggableTile?.position]);

  return (
    <View style={styles.gameContainer}>
      {/* GridView и SpawnerCellView для инициализации контекстов */}
      <GridView />
      <SpawnerCellView />
      
      {/* Размещённые плитки из контекста */}
      <PlacedTiles />

      {/* Активная плитка (только если не PLACED) */}
      {shouldRenderActiveTile && (
        <GestureDetector gesture={draggableTile.panHandlers}>
          <TileView
            textureSource={testTexture}
            position={draggableTile.position}
            width={draggableTile.width}
            height={draggableTile.height}
            tileId={activeTileIdRef.current || 'temp'}
          />
        </GestureDetector>
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
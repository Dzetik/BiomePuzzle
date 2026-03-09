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

import { TEXTURE_MAP, DEFAULT_TEXTURE } from './src/constants/textures';
import { Tile } from './src/models/Tile';

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
  
  const tiles = getAllTiles(); // Возвращает PlacedTileInfo[]

  if (__DEV__) {
    console.log('[PlacedTiles] Рендер, плиток:', tiles.length);
  }

  return (
    <>
      {tiles.map((entry) => {
        const tile = entry.tile; // ← ЭКЗЕМПЛЯР Tile
        const cellSize = DEFAULT_TILE_SIZE.width;
        
        const position = getSnapToCellPosition(
          { width: cellSize * scale, height: cellSize * scale },
          entry.col,
          entry.row,
          scale,
          offset?.x || 0,
          offset?.y || 0
        );

        // ← Получаем текстуру из маппинга
        const textureSource = TEXTURE_MAP[tile.textureKey] || DEFAULT_TEXTURE;

        return (
          <TileView
            key={tile.id}
            textureSource={textureSource}
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
    spawnerTile?.id || null, 
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
  draggableTile?.position?.x !== undefined && 
  draggableTile?.position?.y !== undefined &&
  draggableTile?.state !== 'PLACED' &&
  spawnerTile !== null;

  useEffect(() => {
    if (__DEV__) {
      console.log('[App] 🔍 shouldRenderActiveTile DEBUG:', {
        hasActiveTileRef: hasActiveTileRef.current,
        position: draggableTile?.position,
        state: draggableTile?.state,
        spawnerTileId: spawnerTile?.id,
        shouldRender: shouldRenderActiveTile,
      });
    }
  }, [
    hasActiveTileRef.current,
    draggableTile?.position,
    draggableTile?.state,
    spawnerTile?.id,
    shouldRenderActiveTile,
  ]);

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
      {shouldRenderActiveTile && spawnerTile && (
        <GestureDetector gesture={draggableTile.panHandlers}>
          <TileView
            // ← ИСПРАВЛЕНО: используем TEXTURE_MAP
            textureSource={TEXTURE_MAP[spawnerTile.textureKey] || DEFAULT_TEXTURE}
            position={draggableTile.position}
            width={draggableTile.width}
            height={draggableTile.height}
            tileId={spawnerTile.id}
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
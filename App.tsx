// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ (ИСПРАВЛЕННЫЙ)
// ========================================
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, StatusBar, LogBox, Dimensions } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';
import InventoryStrip from './src/components/InventoryStrip';

import useDraggable from './src/hooks/useDraggable';
import { useZoom, ZoomProvider } from './src/hooks/useZoom';
import { useGrid } from './src/context/GridContext';
import { useSpawner } from './src/hooks/useSpawner';
import { TilesProvider, useTiles } from './src/context/TilesContext';
import { GridProvider } from './src/context/GridContext';

import { getSpawnerSize } from './src/constants/spawner';
import { DEFAULT_TILE_SIZE } from './src/constants/tile';
import { INVENTORY_CELL_SIZE, INVENTORY_CELL_SPACING } from './src/constants/inventory';
import { SpawnerService } from './src/services/SpawnerService';
import { getSnapToCellPosition } from './src/utils/gridUtils';
import { TEXTURE_MAP, DEFAULT_TEXTURE } from './src/constants/textures';
import { TileState } from './src/state';

import { INVENTORY_DROP_ZONE_TOTAL_HEIGHT, INVENTORY_DROP_ZONE_PADDING_BOTTOM } from './src/constants/inventory';

if (__DEV__) {
  LogBox.ignoreLogs([
    /Maximum update depth exceeded/,
    /Encountered two children with the same key/,
  ]);
}

// ========================================
// ZoomHandler
// ========================================
const ZoomHandler = ({ children }) => {
  const { scale, setScale, MIN_SCALE, MAX_SCALE } = useZoom();
  const pinchGesture = Gesture.Pinch().onUpdate((event) => {
    const newScale = scale * event.scale;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale)));
  });
  return (
    <GestureDetector gesture={pinchGesture}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
};

// ========================================
// PlacedTiles
// ========================================
const PlacedTiles = () => {
  const { getAllTiles } = useTiles();
  const { scale } = useZoom();
  const { offset } = useGrid();
  const tiles = getAllTiles();

  return (
    <>
      {tiles.map((entry) => {
        const tile = entry.tile;
        const cellSize = DEFAULT_TILE_SIZE.width;
        const position = getSnapToCellPosition(
          { width: cellSize * scale, height: cellSize * scale },
          entry.col, entry.row, scale,
          offset?.x || 0, offset?.y || 0
        );
        const textureSource = TEXTURE_MAP[tile.textureKey] || DEFAULT_TEXTURE;

        return (
          <TileView
            key={tile.id}
            textureSource={textureSource}
            position={position}
            width={cellSize * scale}
            height={cellSize * scale}
            tileId={tile.id}
            rotation={tile.rotation}
            debugLabel={`Placed[${entry.col},${entry.row}]`}
          />
        );
      })}
    </>
  );
};

// ========================================
// GameContent — ИСПРАВЛЕННЫЙ (с useState для синхронизации)
// ========================================
const GameContent = () => {
  // 🔑 ВСЕ ХУКИ — СТРОГО НА ВЕРХНЕМ УРОВНЕ
  const { 
    getSpawnerTile, 
    createSpawnerTile, 
    moveSpawnerTileToInventory,
    activeInventoryTileId,
    getInventoryTile,
    setActiveInventoryTileId,
    inventoryTiles,
  } = useTiles();
  
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const [isInitialized, setIsInitialized] = useState(false);
  const activeTileIdRef = useRef(null);
  const hasActiveTileRef = useRef(false);

  // ============================================================================
  // 🔑 НОВОЕ: State для синхронизации плавающей плитки (вместо ref!)
  // ============================================================================
  const [floatingTileState, setFloatingTileState] = useState<{
    position: { x: number; y: number };
    size: { width: number; height: number };
    rotation: number;
    isDragging: boolean;
    tileId: string | null;
  }>({
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    rotation: 0,
    isDragging: false,
    tileId: null,
  });

  // Инициализация спавнера
  useEffect(() => {
    if (spawnerPos?.size > 0 && !isInitialized) {
      console.log('[App] 🟢 Init spawner');
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

  const getInitialPosition = useCallback(() => {
    if (spawnerPos?.size > 0) {
      const spawnerSize = getSpawnerSize();
      return SpawnerService.getTilePosition(
        { width: spawnerSize, height: spawnerSize },
        spawnerPos
      );
    }
    return { x: 0, y: 0 };
  }, [spawnerPos]);

  const initialPosition = useMemo(() => getInitialPosition(), [getInitialPosition, spawnerTile?.id]); 

  const handleTilePlaced = useCallback((cell) => {
    console.log('🔥 [1] handleTilePlaced');
    const newTile = createSpawnerTile();
    if (newTile?.id) {
      activeTileIdRef.current = newTile.id;
      console.log('🔥 [2] New spawner tile:', newTile.id);
    }
  }, [createSpawnerTile]);

  const handleDroppedInInventory = useCallback(() => {
    if (__DEV__) console.log('[App] 📦 Dropped to inventory');
    const success = moveSpawnerTileToInventory();
    if (success) {
      if (__DEV__) console.log('[App] ✅ Added to inventory');
      const newTile = createSpawnerTile();
      if (newTile?.id) activeTileIdRef.current = newTile.id;
      return true;
    } else {
      if (__DEV__) console.log('[App] ❌ Inventory full');
      return false;
    }
  }, [moveSpawnerTileToInventory, createSpawnerTile]);

  // useDraggable для спавнера
  const draggableTile = useDraggable(
    spawnerTile,
    spawnerTile?.id || null, 
    initialPosition,
    handleTilePlaced,
    undefined,
    'SPAWNER',
    handleDroppedInInventory
  );

  // ============================================================================
  // 🔑 Активная плитка инвентаря
  // ============================================================================
  const activeInventoryTile = activeInventoryTileId ? getInventoryTile(activeInventoryTileId) : null;
  
  // ============================================================================
  // 🔑 НОВОЕ: Синхронизация с global через setInterval (polling)
  // ============================================================================
  // useEffect на ref не работает, поэтому используем polling для синхронизации
  // ============================================================================
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (global.inventoryDragState && global.inventoryDragState.tileId === activeInventoryTileId) {
        setFloatingTileState({
          position: { ...global.inventoryDragState.position },
          size: { ...global.inventoryDragState.size },
          rotation: global.inventoryDragState.rotation,
          isDragging: global.inventoryDragState.isDragging,
          tileId: global.inventoryDragState.tileId,
        });
      } else if (floatingTileState.isDragging && floatingTileState.tileId !== activeInventoryTileId) {
        // Сброс если плитка больше не активна
        setFloatingTileState(prev => ({ ...prev, isDragging: false, tileId: null }));
      }
    }, 16); // ~60 FPS
    
    return () => clearInterval(syncInterval);
  }, [activeInventoryTileId, floatingTileState.isDragging, floatingTileState.tileId]);
  
  // ============================================================================
  // 🔍 ОТЛАДКА: Лог плавающей плитки
  // ============================================================================
  useEffect(() => {
    if (__DEV__ && floatingTileState.isDragging && floatingTileState.tileId) {
      console.log(`[App] 🎯 Floating inventory tile:`, {
        tileId: floatingTileState.tileId,
        position: { x: Math.round(floatingTileState.position.x), y: Math.round(floatingTileState.position.y) },
        size: floatingTileState.size,
        isDragging: floatingTileState.isDragging,
      });
    }
  }, [floatingTileState.position.x, floatingTileState.position.y, floatingTileState.isDragging, floatingTileState.tileId]);

  const shouldRenderActiveTile =
    hasActiveTileRef.current && 
    draggableTile?.position?.x !== undefined && 
    draggableTile?.position?.y !== undefined &&
    draggableTile?.state !== 'PLACED' &&
    spawnerTile !== null;

  // ============================================================================
  // РЕНДЕР
  // ============================================================================
  return (
    <View style={styles.gameContainer}>
      <GridView />
      <SpawnerCellView />
      <PlacedTiles />
      <InventoryStrip />

      {/* Плитка спавнера */}
      {shouldRenderActiveTile && spawnerTile && draggableTile?.gesture && (
        <GestureDetector gesture={draggableTile.gesture}>
          <TileView
            textureSource={TEXTURE_MAP[spawnerTile.textureKey] || DEFAULT_TEXTURE}
            position={draggableTile.position}
            width={draggableTile.width}
            height={draggableTile.height}
            tileId={spawnerTile.id}
            rotation={spawnerTile?.rotation ?? 0}
            debugLabel="SpawnerActive"
          />
        </GestureDetector>
      )}
      
      {/* 🔑 Плитка инвентаря — рендерится через state (триггерит ре-рендер!) */}
      {floatingTileState.isDragging && floatingTileState.tileId && activeInventoryTile && (
        <TileView
          textureSource={TEXTURE_MAP[activeInventoryTile.textureKey] || DEFAULT_TEXTURE}
          position={floatingTileState.position}
          width={floatingTileState.size.width}
          height={floatingTileState.size.height}
          tileId={floatingTileState.tileId}
          rotation={floatingTileState.rotation}
          isInInventory={false}
          debugLabel="InventoryFloating"
        />
      )}
    </View>
  );
};
// ========================================
// App
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
    overflow: 'visible',
  },
  gameContainer: { 
    flex: 1,
    overflow: 'visible',
  },
});

export default App;
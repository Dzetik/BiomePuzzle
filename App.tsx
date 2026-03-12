// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ (ИСПРАВЛЕННЫЙ — Вариант А)
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
// GameContent — ФИНАЛЬНАЯ ВЕРСИЯ (с setInterval для ре-рендера)
// ========================================
const GameContent = () => {
  const { 
    getSpawnerTile, 
    createSpawnerTile, 
    moveSpawnerTileToInventory,
    activeInventoryTileId,
    getInventoryTile,
  } = useTiles();
  
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const [isInitialized, setIsInitialized] = useState(false);
  const activeTileIdRef = useRef(null);
  const hasActiveTileRef = useRef(false);

  // ============================================================================
  // 🔑 State для триггера ре-рендера при драге инвентаря
  // ============================================================================
  const [inventoryDragTick, setInventoryDragTick] = useState(0);

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
  // 🔑 setInterval для ре-рендера при драге инвентаря
  // ============================================================================
  useEffect(() => {
    const interval = setInterval(() => {
      if (global.inventoryDragState?.isDragging) {
        setInventoryDragTick(t => t + 1);
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, []);

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
      
      {/* ============================================================================ */}
      {/* 🔑 Плитка инвентаря — рендерится с inventoryDragTick */}
      {/* ============================================================================ */}
      {activeInventoryTile && global.inventoryDragState?.isDragging && (
        <TileView
          key={`inventory-floating-${inventoryDragTick}`}
          textureSource={TEXTURE_MAP[activeInventoryTile.textureKey] || DEFAULT_TEXTURE}
          position={global.inventoryDragState.position}
          width={INVENTORY_CELL_SIZE}
          height={INVENTORY_CELL_SIZE}
          tileId={activeInventoryTile.id}
          rotation={global.inventoryDragState.rotation || 0}
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
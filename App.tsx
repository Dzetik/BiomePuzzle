// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ (ФИНАЛЬНЫЙ)
// ========================================
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, StatusBar, LogBox, Text } from 'react-native';
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
import { INVENTORY_CELL_SIZE } from './src/constants/inventory';
import { SpawnerService } from './src/services/SpawnerService';
import { getSnapToCellPosition } from './src/utils/gridUtils';
import { TEXTURE_MAP, DEFAULT_TEXTURE } from './src/constants/textures';

import { useCrafting } from './src/hooks/useCrafting';
import { CRAFTING_CONFIG } from './src/constants/CraftingConfig';
import { CraftResult } from './src/services/CraftingService';
import { Tile } from './src/models';

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
// PlacedTiles — с поддержкой activeSide
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
            // 🔑 Передаём объект tile для отрисовки activeSide (стрелки)
            tile={tile}
            debugLabel={`Placed[${entry.col},${entry.row}]`}
          />
        );
      })}
    </>
  );
};

// ========================================
// GameContent
// ========================================
const GameContent = () => {
  const { 
    getSpawnerTile, 
    createSpawnerTile, 
    moveSpawnerTileToInventory,
    activeInventoryTileId,
    getInventoryTile,
    addTile,
    removeTile,
    getTileAt,
  } = useTiles();
  
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const [isInitialized, setIsInitialized] = useState(false);
  const activeTileIdRef = useRef<string | null>(null);
  const hasActiveTileRef = useRef(false);

  const [inventoryDragTick, setInventoryDragTick] = useState(0);
  const [craftFeedback, setCraftFeedback] = useState<{
    active: boolean;
    message?: string;
    recipeId?: string;
  }>({ active: false });

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

  // ============================================================================
  // 🔑 БАЗОВЫЙ колбэк размещения (только оригинальная логика)
  // ============================================================================
  const handleTilePlacedBase = useCallback((
    cell: { col: number; row: number },
    placedTile?: Tile  // ← 🔑 НОВОЕ: плитка передаётся из useDraggable
  ) => {
    console.log('🔥 [1] handleTilePlacedBase');
    
    // Оригинальная логика: создание новой плитки в спавнере
    // (теперь с учётом крафта — плитка может иметь activeSide)
    const newTile = createSpawnerTile();
    if (newTile?.id) {
      activeTileIdRef.current = newTile.id;
      console.log('🔥 [2] New spawner tile:', newTile.id, {
        texture: newTile.textureKey,
        activeSide: newTile.activeSide,
      });
    }
  }, [createSpawnerTile]);

  // ============================================================================
  // 🔑 ОБЁРТЫВАЕМ базовый колбэк через useCrafting
  // ============================================================================
  const handleTilePlaced = useCrafting(handleTilePlacedBase, {
    // Зависимости из контекста
    getTileAt,
    addTile,
    removeTile,
    generateTileId: () => `craft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    
    // Колбэки для визуальной обратной связи
    onCraftStart: (recipeId: string, ingredientIds: string[]) => {
      if (__DEV__) console.log(`[App] ✨ Крафт начался: ${recipeId}`, { ingredientIds });
      setCraftFeedback({ active: true, recipeId, message: 'Крафт...' });
    },
    
    onCraftComplete: (result: CraftResult) => {
      if (__DEV__) console.log(`[App] ✅ Крафт завершён:`, result.message);
      setCraftFeedback({ 
        active: true, 
        recipeId: result.recipeId, 
        message: result.message 
      });
      setTimeout(() => {
        setCraftFeedback(prev => prev.active ? { active: false } : prev);
      }, CRAFTING_CONFIG.chainDelayMs + 200);
    },
    
    onChainStart: (resultTile, depth) => {
      if (__DEV__) console.log(`[App] 🔗 Цепочка шаг ${depth}: ${resultTile.textureKey}`);
    },
});

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

  const draggableTile = useDraggable(
    spawnerTile,
    spawnerTile?.id || null, 
    initialPosition,
    handleTilePlaced,
    undefined,
    'SPAWNER',
    handleDroppedInInventory
  );

  const activeInventoryTile = activeInventoryTileId ? getInventoryTile(activeInventoryTileId) : null;

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

  return (
    <View style={styles.gameContainer}>
      <GridView />
      <SpawnerCellView />
      <PlacedTiles />
      <InventoryStrip />

      {/* Фидбек крафта */}
      {CRAFTING_CONFIG.animateMerge && craftFeedback.active && (
        <View style={styles.craftFeedback}>
          <Text style={styles.craftFeedbackText}>
            ✨ {craftFeedback.message || 'Крафт...'}
          </Text>
        </View>
      )}

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
            tile={spawnerTile}
            debugLabel="SpawnerActive"
          />
        </GestureDetector>
      )}
      
      {/* Плитка инвентаря */}
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
          tile={activeInventoryTile}
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
  craftFeedback: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  craftFeedbackText: {
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
    fontWeight: '600',
    elevation: 10,
  },
});

export default App;
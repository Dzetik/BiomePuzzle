// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ (ФИНАЛЬНЫЙ)
// ========================================
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, StatusBar, LogBox, Text, TouchableOpacity, Platform } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // 👈 Добавлено

import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';
import InventoryStrip from './src/components/InventoryStrip';
import RecipeBook from './src/components/RecipeBook';
import { PlacedTileActionModal } from './src/components/PlacedTileActionModal';
import { QuestBook } from './src/components/QuestBook';
import { QuestProvider, useQuests } from './src/context/QuestContext';

import useDraggable from './src/hooks/useDraggable';
import { useZoom, ZoomProvider } from './src/hooks/useZoom';
import { useGrid } from './src/context/GridContext';
import { useSpawner } from './src/hooks/useSpawner';
import { TilesProvider, useTiles } from './src/context/TilesContext';
import { GridProvider } from './src/context/GridContext';

import { getSpawnerSize } from './src/constants/spawner';
import { DEFAULT_TILE_SIZE } from './src/constants/tile';
import { INVENTORY_CELL_SIZE, INVENTORY_HEIGHT } from './src/constants/inventory';
import { SpawnerService } from './src/services/SpawnerService';
import { getSnapToCellPosition } from './src/utils/gridUtils';
import { TEXTURE_MAP, DEFAULT_TEXTURE } from './src/constants/textures';

import { useCrafting } from './src/hooks/useCrafting';
import { CRAFTING_CONFIG } from './src/constants/CraftingConfig';
import { CraftResult } from './src/services/CraftingService';
import { Tile } from './src/models/Tile';

if (__DEV__) {
  LogBox.ignoreLogs([
    /Maximum update depth exceeded/,
    /Encountered two children with the same key/,
    /Text strings must be rendered within a <Text> component/,
  ]);
}

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0;

const ZoomHandler = ({ children }) => {
  const { scale, setScale, MIN_SCALE, MAX_SCALE } = useZoom();
  const pinchGesture = Gesture.Pinch().onUpdate((event) => {
    const newScale = scale * event.scale;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale)));
  });
  return <GestureDetector gesture={pinchGesture}><View style={{ flex: 1 }}>{children}</View></GestureDetector>;
};

interface PlacedTilesProps {
  onPlacedTilePress?: (tile: Tile) => void;
}

const PlacedTiles: React.FC<PlacedTilesProps> = ({ onPlacedTilePress }) => {
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
          entry.col, entry.row, scale, offset?.x || 0, offset?.y || 0
        );
        const textureSource = TEXTURE_MAP[tile.textureKey] || DEFAULT_TEXTURE;

        return (
          <TileView
            key={`${tile.id}-${tile.rotation}`}
            textureSource={textureSource}
            position={position}
            width={cellSize * scale}
            height={cellSize * scale}
            tileId={tile.id}
            rotation={tile.rotation}
            tile={tile}
            debugLabel={`Placed[${entry.col},${entry.row}]`}
            isPlaced={true}
            onPlacedTilePress={onPlacedTilePress}
          />
        );
      })}
    </>
  );
};

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
    craftTiles,
    getAllTiles,
    movePlacedTileToInventory,
    submitTile,
    getTileCounts,
    removeTilesForQuest,
    rotateTileInInventory,
    rotateSpawnerTile,
  } = useTiles();
  
  const { activeQuest, refreshQuest, submitQuest } = useQuests();
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const [isInitialized, setIsInitialized] = useState(false);
  const activeTileIdRef = useRef<string | null>(null);
  const hasActiveTileRef = useRef(false);

  const [inventoryDragTick, setInventoryDragTick] = useState(0);
  const [craftFeedback, setCraftFeedback] = useState<{ active: boolean; message?: string; recipeId?: string }>({ active: false });
  const [showRecipeBook, setShowRecipeBook] = useState(false);
  const [showQuestBook, setShowQuestBook] = useState(false);
  const [selectedPlacedTile, setSelectedPlacedTile] = useState<Tile | null>(null);
  
  const handlePlacedTilePress = useCallback((tile: Tile) => {
    if (__DEV__) console.log('[App] 🎯 Плитка выбрана:', tile.id);
    setSelectedPlacedTile(tile);
  }, []);

  useEffect(() => {
    if (spawnerPos?.size > 0 && !isInitialized) {
      console.log('[App] 🟢 Init spawner');
      const tile = createSpawnerTile();
      if (tile?.id) { activeTileIdRef.current = tile.id; hasActiveTileRef.current = true; }
      setIsInitialized(true);
    }
  }, [spawnerPos, createSpawnerTile, isInitialized]);

  useEffect(() => { refreshQuest(); }, [refreshQuest]);

  const spawnerTile = getSpawnerTile();
  useEffect(() => {
    if (spawnerTile?.id) { activeTileIdRef.current = spawnerTile.id; hasActiveTileRef.current = true; }
  }, [spawnerTile?.id]);

  const getInitialPosition = useCallback(() => {
    if (spawnerPos?.size > 0) {
      const spawnerSize = getSpawnerSize();
      return SpawnerService.getTilePosition({ width: spawnerSize, height: spawnerSize }, spawnerPos);
    }
    return { x: 0, y: 0 };
  }, [spawnerPos]);

  const initialPosition = useMemo(() => getInitialPosition(), [getInitialPosition, spawnerTile?.id]); 

  const handleTilePlacedBase = useCallback((cell: { col: number; row: number }, placedTile?: Tile) => {
    if (__DEV__) console.log(`[App] 🔥 handleTilePlacedBase CALLED:`, { cell, placedTile: placedTile ? { id: placedTile.id, texture: placedTile.textureKey } : 'undefined' });
    console.log('🔥 [1] handleTilePlacedBase');
    const newTile = createSpawnerTile();
    if (newTile?.id) { activeTileIdRef.current = newTile.id; console.log('🔥 [2] New spawner tile:', newTile.id); }
  }, [createSpawnerTile]);

  const handleTilePlaced = useCrafting(handleTilePlacedBase, {
    getTileAt, addTile, removeTile, craftTiles,
    generateTileId: () => `craft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    onCraftStart: (recipeId: string) => { if (__DEV__) console.log(`[App] ✨ Крафт начался: ${recipeId}`); setCraftFeedback({ active: true, recipeId, message: 'Крафт...' }); },
    onCraftComplete: (result: CraftResult) => { if (__DEV__) console.log(`[App] ✅ Крафт завершён:`, result.message); setCraftFeedback({ active: true, recipeId: result.recipeId, message: result.message }); setTimeout(() => setCraftFeedback(prev => prev.active ? { active: false } : prev), CRAFTING_CONFIG.chainDelayMs + 200); },
    onChainStart: (resultTile, depth) => { if (__DEV__) console.log(`[App] 🔗 Цепочка шаг ${depth}: ${resultTile.textureKey}`); },
  });

  const handleDroppedInInventory = useCallback(() => {
    if (__DEV__) console.log('[App] 📦 Dropped to inventory');
    const success = moveSpawnerTileToInventory();
    if (success) {
      if (__DEV__) console.log('[App] ✅ Added to inventory');
      const newTile = createSpawnerTile();
      if (newTile?.id) activeTileIdRef.current = newTile.id;
      return true;
    } else { if (__DEV__) console.log('[App] ❌ Inventory full'); return false; }
  }, [moveSpawnerTileToInventory, createSpawnerTile]);

  // ============================================================================
  // 🔑 ОБРАБОТЧИК ПОВОРОТА ДЛЯ ИНВЕНТАРЯ (иммутабельный)
  // ============================================================================
  const handleInventoryRotate = useCallback((tileId: string) => {
    if (rotateTileInInventory) {
      rotateTileInInventory(tileId);
    }
  }, [rotateTileInInventory]);

  const draggableTile = useDraggable(
    spawnerTile,
    spawnerTile?.id || null, 
    initialPosition,
    handleTilePlaced,
    undefined,
    'SPAWNER',
    handleDroppedInInventory,
    rotateSpawnerTile  // 👈 ✅ Правильный колбэк для спавнера!
  );

  const activeInventoryTile = activeInventoryTileId ? getInventoryTile(activeInventoryTileId) : null;

  useEffect(() => {
    const interval = setInterval(() => {
      if (global.inventoryDragState?.isDragging) setInventoryDragTick(t => t + 1);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const shouldRenderActiveTile =
    hasActiveTileRef.current && 
    draggableTile?.position?.x !== undefined && 
    draggableTile?.position?.y !== undefined &&
    draggableTile?.state !== 'PLACED' &&
    spawnerTile !== null;

  const handleQuestSubmit = useCallback(() => {
    if (!activeQuest) return;
    const success = removeTilesForQuest(activeQuest.requirements);
    if (success) { submitQuest(getTileCounts()); if (__DEV__) console.log('[App] ✅ Квест сдан успешно'); }
  }, [activeQuest, removeTilesForQuest, submitQuest, getTileCounts]);

  return (
    <View style={styles.gameContainer}>
      <View style={styles.statusBarPlaceholder}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <View style={styles.statusBarBottomBorder} />
      </View>

      <GridView />
      <SpawnerCellView />
      <PlacedTiles onPlacedTilePress={handlePlacedTilePress} />
      <InventoryStrip />

      <TouchableOpacity style={styles.recipeBookButton} onPress={() => setShowRecipeBook(true)} activeOpacity={0.7}>
        <Text style={styles.recipeBookButtonText}>📖 Рецепты</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.questBookButton} onPress={() => setShowQuestBook(true)} activeOpacity={0.7}>
        <Text style={styles.questBookButtonText}>📜 Квесты</Text>
      </TouchableOpacity>

      <RecipeBook visible={showRecipeBook} onClose={() => setShowRecipeBook(false)} />
      <QuestBook visible={showQuestBook} onClose={() => setShowQuestBook(false)} tileCounts={getTileCounts()} onSubmitQuest={handleQuestSubmit} />

      {CRAFTING_CONFIG.animateMerge && craftFeedback.active && (
        <View style={styles.craftFeedback}><Text style={styles.craftFeedbackText}>✨ {craftFeedback.message || 'Крафт...'}</Text></View>
      )}

      {shouldRenderActiveTile && spawnerTile && draggableTile?.gesture && (
        <GestureDetector gesture={draggableTile.gesture}>
          <TileView
            key={`${spawnerTile.id}-${spawnerTile.rotation}`}
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

      <PlacedTileActionModal
        visible={!!selectedPlacedTile}
        tile={selectedPlacedTile}
        onClose={() => setSelectedPlacedTile(null)}
        onDelete={(tileId) => {
          const placed = getAllTiles().find(t => t.tile.id === tileId);
          if (placed) { removeTile(tileId); setSelectedPlacedTile(null); if (__DEV__) console.log('[App] 🗑️ Удалено:', tileId); }
        }}
        onToInventory={(tileId) => {
          const success = movePlacedTileToInventory(tileId);
          if (success) { setSelectedPlacedTile(null); if (__DEV__) console.log('[App] 📦 В инвентарь:', tileId); }
          else { if (__DEV__) console.warn('[App] ❌ Инвентарь полон'); }
        }}
        onSubmit={(tileId) => { submitTile(tileId); setSelectedPlacedTile(null); if (__DEV__) console.log('[App] ✅ Сдано:', tileId); }}
      />
    </View>
  );
};

// ============================================================================
// 🔑 ROOT COMPONENT С SafeAreaProvider
// ============================================================================
const App = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider> {/* 👈 Оборачиваем всё приложение */}
        <ZoomProvider>
          <GridProvider>
            <TilesProvider>
              <QuestProvider>
                <ZoomHandler>
                  <GameContent />
                </ZoomHandler>
              </QuestProvider>
            </TilesProvider>
          </GridProvider>
        </ZoomProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a', overflow: 'visible' },
  gameContainer: { flex: 1, overflow: 'visible' },
  statusBarPlaceholder: { position: 'absolute', top: 0, left: 0, right: 0, height: STATUS_BAR_HEIGHT, backgroundColor: '#1a1a1a', zIndex: 100000, elevation: 100 },
  statusBarBottomBorder: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: '#ffffff', opacity: 0.3 },
  craftFeedback: { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center', zIndex: 9999, pointerEvents: 'none' },
  craftFeedbackText: { backgroundColor: 'rgba(76, 175, 80, 0.95)', color: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, fontSize: 14, fontWeight: '600', elevation: 10 },
  recipeBookButton: { position: 'absolute', top: STATUS_BAR_HEIGHT + 4, right: 19, backgroundColor: 'rgba(100, 100, 150, 0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, zIndex: 99999, elevation: 99, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  recipeBookButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  questBookButton: { position: 'absolute', bottom: INVENTORY_HEIGHT, right: 1, backgroundColor: 'rgba(255, 152, 0, 0.9)', paddingHorizontal: 26, paddingVertical: 15, borderRadius: 10, zIndex: 99998, elevation: 98, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  questBookButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default App;
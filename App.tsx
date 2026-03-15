// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ (С УЧЁТОМ СТАТУС-БАРА)
// ========================================
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  LogBox,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView from './src/components/SpawnerCellView';
import InventoryStrip from './src/components/InventoryStrip';
import RecipeBook from './src/components/RecipeBook';
// ============================================================================
// 🔑 Импорт модального окна действий
// ============================================================================
import { PlacedTileActionModal } from './src/components/PlacedTileActionModal';
// ============================================================================
// 🔑 Импорт книги квестов и провайдера
// ============================================================================
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
import { INVENTORY_CELL_SIZE } from './src/constants/inventory';
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
  ]);
}

// ============================================================================
// 🔑 КОНСТАНТА: Высота статус-бара
// ============================================================================
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 25;

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
// PlacedTiles — с поддержкой onPress для размещённых плиток
// ========================================
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
            tile={tile}
            debugLabel={`Placed[${entry.col},${entry.row}]`}
            // 🔑 Пропсы для обработки нажатия на размещённую плитку
            isPlaced={true}
            onPlacedTilePress={onPlacedTilePress}
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
    craftTiles,
    getAllTiles,
    // ============================================================================
    // 🔑 МЕТОДЫ из контекста плиток
    // ============================================================================
    movePlacedTileToInventory,
    submitTile,
    getTileCounts,
    removeTilesForQuest,
  } = useTiles();
  
  // ============================================================================
  // 🔑 МЕТОДЫ из контекста квестов
  // ============================================================================
  const { activeQuest, refreshQuest, submitQuest } = useQuests();
  
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
  
  const [showRecipeBook, setShowRecipeBook] = useState(false);
  // ============================================================================
  // 🔑 Состояние для книги квестов
  // ============================================================================
  const [showQuestBook, setShowQuestBook] = useState(false);

  // ============================================================================
  // 🔑 Выбранная плитка для показа модального окна действий
  // ============================================================================
  const [selectedPlacedTile, setSelectedPlacedTile] = useState<Tile | null>(null);
  
  // ============================================================================
  // 🔑 Обработчик нажатия на размещённую плитку
  // ============================================================================
  const handlePlacedTilePress = useCallback((tile: Tile) => {
    if (__DEV__) console.log('[App] 🎯 Плитка выбрана:', tile.id);
    setSelectedPlacedTile(tile);
  }, []);

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

  // ============================================================================
  // 🔑 Инициализация квеста при старте
  // ============================================================================
  useEffect(() => {
    refreshQuest();
  }, [refreshQuest]);

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
  // 🔑 БАЗОВЫЙ колбэк размещения
  // ============================================================================
  const handleTilePlacedBase = useCallback((
    cell: { col: number; row: number },
    placedTile?: Tile
  ) => {
    if (__DEV__) {
      console.log(`[App] 🔥 handleTilePlacedBase CALLED:`, {
        cell,
        placedTile: placedTile ? {
          id: placedTile.id,
          texture: placedTile.textureKey,
          activeSide: placedTile.activeSide,
        } : 'undefined',
        source: placedTile ? 'from-inventory' : 'from-spawner',
      });
    }
    
    console.log('🔥 [1] handleTilePlacedBase');
    
    const newTile = createSpawnerTile();
    if (newTile?.id) {
      activeTileIdRef.current = newTile.id;
      console.log('🔥 [2] New spawner tile:', newTile.id);
    }
  }, [createSpawnerTile]);

  // ============================================================================
  // 🔑 ОБЁРТЫВАЕМ через useCrafting
  // ============================================================================
  const handleTilePlaced = useCrafting(handleTilePlacedBase, {
    getTileAt,
    addTile,
    removeTile,
    craftTiles,
    generateTileId: () => `craft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    
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

  // ============================================================================
  // 🔑 Обработчик сдачи квеста
  // ============================================================================
  const handleQuestSubmit = useCallback(() => {
    if (!activeQuest) return;
    
    const success = removeTilesForQuest(activeQuest.requirements);
    if (success) {
      submitQuest(getTileCounts());
      if (__DEV__) console.log('[App] ✅ Квест сдан успешно');
    }
  }, [activeQuest, removeTilesForQuest, submitQuest, getTileCounts]);

  return (
    <View style={styles.gameContainer}>
      {/* ==================================================================== */}
      {/* 🔑 Плашка статус-бара */}
      {/* ==================================================================== */}
      <View style={styles.statusBarPlaceholder}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        {/* ==================================================================== */}
        {/* 🔑 НОВОЕ: Белая линия по нижней границе */}
        {/* ==================================================================== */}
        <View style={styles.statusBarBottomBorder} />
      </View>

      <GridView />
      <SpawnerCellView />
      {/* 🔑 ПЕРЕДАЁМ onPlacedTilePress как проп */}
      <PlacedTiles onPlacedTilePress={handlePlacedTilePress} />
      <InventoryStrip />

      {/* ==================================================================== */}
      {/* 🔑 КНОПКА ОТКРЫТИЯ КНИГИ РЕЦЕПТОВ — над спавнером */}
      {/* ==================================================================== */}
      <TouchableOpacity
        style={styles.recipeBookButton}
        onPress={() => setShowRecipeBook(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.recipeBookButtonText}>📖 Рецепты</Text>
      </TouchableOpacity>

      {/* ==================================================================== */}
      {/* 🔑 КНОПКА ОТКРЫТИЯ КНИГИ КВЕСТОВ — справа над инвентарем */}
      {/* ==================================================================== */}
      <TouchableOpacity
        style={styles.questBookButton}
        onPress={() => setShowQuestBook(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.questBookButtonText}>📜 Квесты</Text>
      </TouchableOpacity>

      {/* ==================================================================== */}
      {/* 🔑 МОДАЛЬНОЕ ОКНО КНИГИ РЕЦЕПТОВ */}
      {/* ==================================================================== */}
      <RecipeBook
        visible={showRecipeBook}
        onClose={() => setShowRecipeBook(false)}
      />

      {/* ==================================================================== */}
      {/* 🔑 МОДАЛЬНОЕ ОКНО КНИГИ КВЕСТОВ */}
      {/* ==================================================================== */}
      <QuestBook
        visible={showQuestBook}
        onClose={() => setShowQuestBook(false)}
        tileCounts={getTileCounts()}
        onSubmitQuest={handleQuestSubmit}
      />

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

      {/* ==================================================================== */}
      {/* 🔑 МОДАЛЬНОЕ ОКНО ДЕЙСТВИЙ ДЛЯ РАЗМЕЩЁННОЙ ПЛИТКИ */}
      {/* ==================================================================== */}
      <PlacedTileActionModal
        visible={!!selectedPlacedTile}
        tile={selectedPlacedTile}
        onClose={() => setSelectedPlacedTile(null)}
        
        onDelete={(tileId) => {
          // ✅ Проверяем, что плитка ещё на гриде перед удалением
          const placed = getAllTiles().find(t => t.tile.id === tileId);
          if (placed) {
            removeTile(tileId);
            setSelectedPlacedTile(null);
            if (__DEV__) console.log('[App] 🗑️ Удалено:', tileId);
          }
        }}
        
        onToInventory={(tileId) => {
          const success = movePlacedTileToInventory(tileId);
          if (success) {
            setSelectedPlacedTile(null);
            if (__DEV__) console.log('[App] 📦 В инвентарь:', tileId);
          } else {
            // ❌ Инвентарь полон — не закрываем окно
            if (__DEV__) console.warn('[App] ❌ Инвентарь полон');
            // TODO: показать UI-уведомление пользователю
          }
        }}
        
        onSubmit={(tileId) => {
          submitTile(tileId);
          setSelectedPlacedTile(null);
          if (__DEV__) console.log('[App] ✅ Сдано:', tileId);
        }}
      />
    </View>
  );
};

// ========================================
// App
// ========================================
const App = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
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
    </GestureHandlerRootView>
  );
};

// ============================================================================
// СТИЛИ
// ============================================================================
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
  // ============================================================================
  // 🔑 Плашка статус-бара
  // ============================================================================
  statusBarPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: STATUS_BAR_HEIGHT,
    backgroundColor: '#1a1a1a',
    zIndex: 100000,
    elevation: 100,
  },
  // ============================================================================
  // 🔑 НОВОЕ: Белая линия по нижней границе плашки
  // ============================================================================
  statusBarBottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#ffffff',
    opacity: 0.3,  // Полупрозрачная белая линия
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
  // ============================================================================
  // 🔑 Кнопка рецептов — угловая с скруглёнными краями
  // ============================================================================
  recipeBookButton: {
    position: 'absolute',
    // 🔑 Позиция: над спавнером (справа вверху)
    top: STATUS_BAR_HEIGHT + 4,
    right: 19,
    backgroundColor: 'rgba(100, 100, 150, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 99999,
    elevation: 99,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  recipeBookButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // ============================================================================
  // 🔑 НОВОЕ: Кнопка квестов — справа над инвентарем
  // ============================================================================
  questBookButton: {
    position: 'absolute',
    bottom: 110,  // Над инвентарем
    right: 1,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    paddingHorizontal: 26,
    paddingVertical: 15,
    borderRadius: 10,
    zIndex: 99998,
    elevation: 98,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  questBookButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default App;
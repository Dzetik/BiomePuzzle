// ============================================================================
// КОРНЕВОЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ
// ============================================================================
// Точка входа в игру. Отвечает за:
//   - загрузку сохранения при старте и восстановление состояния квеста;
//   - инициализацию плитки спавнера после завершения загрузки;
//   - рендер игрового слоя: сетка, спавнер, размещённые плитки, инвентарь;
//   - рендер плавающих плиток при перетаскивании (спавнер и инвентарь);
//   - отображение модальных окон (книга рецептов, квесты, меню плитки).
// ============================================================================

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, StatusBar, LogBox, Text, TouchableOpacity, Platform } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAutoSave } from './src/hooks/useAutoSave';

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

import {
  loadGame as loadGameService,
  hasSave as hasSaveService,
} from './src/services/SaveService';
import { QUESTS } from './src/constants/quests';

// Подавляем заведомо известные предупреждения React в режиме разработки,
// не влияющие на логику игры.
if (__DEV__) {
  LogBox.ignoreLogs([
    /Maximum update depth exceeded/,
    /Encountered two children with the same key/,
  ]);
}

// Высота системной строки состояния: на iOS управляется SafeAreaProvider,
// на Android требуется явный отступ.
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0;

// ============================================================================
// КОМПОНЕНТ: ОБРАБОТЧИК ЖЕСТА МАСШТАБИРОВАНИЯ
// ============================================================================

/**
 * Оборачивает дочерние элементы в GestureDetector с Pinch-жестом.
 * Зажимает новый масштаб в диапазоне [MIN_SCALE, MAX_SCALE] и
 * передаёт его в ZoomContext через setScale.
 *
 * @param children - дочерние элементы игрового слоя
 */
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

// ============================================================================
// КОМПОНЕНТ: РАЗМЕЩЁННЫЕ ПЛИТКИ
// ============================================================================

interface PlacedTilesProps {
  /** Колбэк при нажатии на размещённую плитку — открывает меню действий. */
  onPlacedTilePress?: (tile: Tile) => void;
}

/**
 * Рендерит все плитки, размещённые на сетке.
 *
 * Берёт список плиток из TilesContext через getAllTiles(), вычисляет
 * экранную позицию каждой через getSnapToCellPosition с учётом текущего
 * масштаба и смещения грида. Ключ компонента включает rotation, чтобы
 * гарантировать корректный ре-рендер в сборке APK.
 */
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
            // Ключ с rotation обеспечивает корректный ре-рендер при повороте в APK-сборке
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

// ============================================================================
// КОМПОНЕНТ: ИГРОВОЙ ЭКРАН
// ============================================================================

/**
 * Основной игровой компонент. Содержит всю логику запуска, загрузки
 * сохранения, управления спавнером и обработки пользовательских действий.
 *
 * Порядок инициализации:
 * 1. Монтирование — запускается loadOnStart (асинхронная загрузка сохранения).
 * 2. По завершении loadOnStart флаг isLoadingSave становится false.
 * 3. После этого срабатывает useEffect инициализации спавнера.
 *
 * Плавающие плитки при перетаскивании:
 * - Спавнер: позиция берётся из useDraggable (draggableTile.position).
 * - Инвентарь: позиция берётся из global.inventoryDragState.position,
 *   обновляется через setInterval с частотой ~60 кадров/с.
 */
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
    saveGame,
    loadGame,
    hasSave,
  } = useTiles();

  const {
    activeQuest,
    refreshQuest,
    submitQuest,
    getQuestData,
    setQuestProgressFromSave,
    setActiveQuest,
  } = useQuests();

  const spawnerPos = useSpawner();
  const { offset } = useGrid();

  // true — загрузка сохранения ещё не завершена; спавнер не инициализируется до false
  const [isLoadingSave, setIsLoadingSave] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Рефы позволяют читать актуальное состояние внутри useCallback с пустыми зависимостями
  const activeTileIdRef = useRef<string | null>(null);
  const hasActiveTileRef = useRef(false);
  const spawnerTileRef = useRef<Tile | null>(null);

  // Счётчик для форс-рендера плавающей плитки инвентаря при каждом кадре перетаскивания
  const [inventoryDragTick, setInventoryDragTick] = useState(0);

  const [craftFeedback, setCraftFeedback] = useState<{ active: boolean; message?: string; recipeId?: string }>({ active: false });
  const [showRecipeBook, setShowRecipeBook] = useState(false);
  const [showQuestBook, setShowQuestBook] = useState(false);
  const [selectedPlacedTile, setSelectedPlacedTile] = useState<Tile | null>(null);

  // Автосохранение каждые 30 секунд через рекурсивный setTimeout
  useAutoSave(30000);

  /** Открывает модальное меню действий для выбранной размещённой плитки. */
  const handlePlacedTilePress = useCallback((tile: Tile) => {
    if (__DEV__) console.log('[App] Плитка выбрана:', tile.id);
    setSelectedPlacedTile(tile);
  }, []);

  // ============================================================================
  // ЗАГРУЗКА СОХРАНЕНИЯ ПРИ СТАРТЕ
  // ============================================================================
  useEffect(() => {
    /**
     * Асинхронно загружает сохранение из AsyncStorage.
     *
     * Алгоритм:
     * 1. Пауза 200ms — даёт React завершить первичный рендер до I/O операций.
     * 2. Читает данные квеста напрямую через loadGameService (минуя global),
     *    чтобы избежать race condition при инициализации QuestContext.
     * 3. Восстанавливает активный квест по id из QUESTS; если квест не найден
     *    или сохранения нет — создаёт новый через refreshQuest().
     */
    const loadOnStart = async () => {
      console.log('[App] loadOnStart: BEGIN');

      // Небольшая задержка, чтобы React Native успел выполнить первый рендер
      await new Promise(resolve => setTimeout(resolve, 200));

      try {
        const hasSavedGame = await hasSave();
        console.log('[App] hasSave result:', hasSavedGame);

        if (hasSavedGame) {
          console.log('[App] Save found, loading...');

          // Читаем сохранение напрямую через сервис, минуя global.questData,
          // так как QuestContext к этому моменту может ещё не быть инициализирован
          const saved = await loadGameService();

          if (saved) {
            const activeQuestId = saved.quest?.activeQuestId || null;
            const activeQuestProgress = saved.quest?.activeQuestProgress || {};
            const completedQuests = saved.quest?.completedQuests || [];

            console.log('[App] Data from save:', { activeQuestId, questProgress: activeQuestProgress });

            // Загружаем состояние плиток с передачей прогресса квеста
            const restored = await loadGame(activeQuestProgress);
            console.log('[App] loadGame result:', restored);

            if (restored) {
              setQuestProgressFromSave(activeQuestProgress);
              console.log('[App] Game loaded successfully');

              console.log('[App] Restoring quest:', { activeQuestId });

              if (activeQuestId) {
                const questToRestore = QUESTS.find(q => q.id === activeQuestId);
                console.log('[App] Quest search result:', {
                  found: !!questToRestore,
                  questId: questToRestore?.id,
                });

                if (questToRestore) {
                  setActiveQuest(questToRestore);
                  console.log(`[App] Quest restored: ${activeQuestId}`);
                } else {
                  console.log(`[App] Quest ${activeQuestId} not found in QUESTS, creating new`);
                  refreshQuest();
                }
              } else {
                console.log('[App] No active quest in save, creating new');
                refreshQuest();
              }
            } else {
              console.log('[App] Load failed, starting new game');
              refreshQuest();
            }
          } else {
            console.log('[App] No save data, starting new game');
            refreshQuest();
          }
        } else {
          console.log('[App] No save found, starting new game');
          refreshQuest();
        }
      } catch (error) {
        console.error('[App] Load error:', error);
        refreshQuest();
      } finally {
        setIsLoadingSave(false);
        console.log('[App] loadOnStart: END');
      }
    };

    loadOnStart();
  }, []);

  // Синхронизирует реф spawnerTileRef с текущей плиткой спавнера,
  // чтобы эффект инициализации не читал устаревшее значение через closure
  useEffect(() => {
    spawnerTileRef.current = getSpawnerTile();
  }, [getSpawnerTile()]);

  // ============================================================================
  // ИНИЦИАЛИЗАЦИЯ СПАВНЕРА
  // ============================================================================
  // Запускается только после завершения загрузки сохранения (isLoadingSave === false).
  // Если в сохранении уже была плитка спавнера, пропускаем создание новой.
  useEffect(() => {
    if (isLoadingSave) return;

    if (spawnerTileRef.current) {
      console.log('[App] Spawner tile already exists (restored from save), skipping init');
      setIsInitialized(true);
      return;
    }

    if (spawnerPos?.size > 0 && !isInitialized) {
      console.log('[App] Initializing spawner tile');
      const tile = createSpawnerTile();
      if (tile?.id) {
        activeTileIdRef.current = tile.id;
        hasActiveTileRef.current = true;
        spawnerTileRef.current = tile;
      }
      setIsInitialized(true);
    }
  }, [spawnerPos, createSpawnerTile, isInitialized, isLoadingSave]);

  // Отладочный лог при изменении активного квеста
  useEffect(() => {
    if (__DEV__) {
      console.log('[App] Quest state:', {
        activeQuestId: activeQuest?.id,
        hasQuest: !!activeQuest,
        globalQuestData: (global as any).questData,
      });
    }
  }, [activeQuest?.id]);

  // Сохранение при размонтировании компонента (страховочный вызов)
  useEffect(() => {
    return () => {
      saveGame();
    };
  }, []);

  // Синхронизация activeTileIdRef и hasActiveTileRef с текущей плиткой спавнера
  const spawnerTile = getSpawnerTile();
  useEffect(() => {
    if (spawnerTile?.id) {
      activeTileIdRef.current = spawnerTile.id;
      hasActiveTileRef.current = true;
    }
  }, [spawnerTile?.id]);

  /**
   * Возвращает начальную позицию плитки спавнера на экране.
   * Использует SpawnerService для центрирования плитки внутри ячейки спавнера.
   */
  const getInitialPosition = useCallback(() => {
    if (spawnerPos?.size > 0) {
      const spawnerSize = getSpawnerSize();
      return SpawnerService.getTilePosition({ width: spawnerSize, height: spawnerSize }, spawnerPos);
    }
    return { x: 0, y: 0 };
  }, [spawnerPos]);

  // Пересчитывается при смене плитки спавнера, чтобы новая плитка появилась в центре спавнера
  const initialPosition = useMemo(() => getInitialPosition(), [getInitialPosition, spawnerTile?.id]);

  /**
   * Вызывается после успешного размещения плитки на сетке.
   * Создаёт новую плитку спавнера для следующего хода.
   *
   * @param cell       - координаты ячейки, на которую была сброшена плитка
   * @param placedTile - объект размещённой плитки (опционально, для отладки)
   */
  const handleTilePlacedBase = useCallback((cell: { col: number; row: number }, placedTile?: Tile) => {
    if (__DEV__) console.log('[App] handleTilePlacedBase:', { cell, placedTile: placedTile ? { id: placedTile.id, texture: placedTile.textureKey } : 'undefined' });
    console.log('[1] handleTilePlacedBase');
    const newTile = createSpawnerTile();
    if (newTile?.id) {
      activeTileIdRef.current = newTile.id;
      console.log('[2] New spawner tile:', newTile.id);
    }
  }, [createSpawnerTile]);

  // Оборачивает базовый обработчик логикой крафта: проверяет соседей плитки,
  // инициирует цепочку крафта и уведомляет через setCraftFeedback
  const handleTilePlaced = useCrafting(handleTilePlacedBase, {
    getTileAt, addTile, removeTile, craftTiles,
    generateTileId: () => `craft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    onCraftStart: (recipeId: string) => {
      if (__DEV__) console.log(`[App] Craft started: ${recipeId}`);
      setCraftFeedback({ active: true, recipeId, message: 'Крафт...' });
    },
    onCraftComplete: (result: CraftResult) => {
      if (__DEV__) console.log('[App] Craft complete:', result.message);
      setCraftFeedback({ active: true, recipeId: result.recipeId, message: result.message });
      setTimeout(
        () => setCraftFeedback(prev => prev.active ? { active: false } : prev),
        CRAFTING_CONFIG.chainDelayMs + 200
      );
    },
    onChainStart: (resultTile, depth) => {
      if (__DEV__) console.log(`[App] Chain step ${depth}: ${resultTile.textureKey}`);
    },
  });

  /**
   * Вызывается при сбросе плитки спавнера в зону инвентаря.
   * Перемещает плитку в инвентарь и создаёт новую плитку спавнера.
   *
   * @returns true — перемещение выполнено; false — инвентарь полон
   */
  const handleDroppedInInventory = useCallback(() => {
    if (__DEV__) console.log('[App] Dropped to inventory');
    const success = moveSpawnerTileToInventory();
    if (success) {
      if (__DEV__) console.log('[App] Added to inventory');
      const newTile = createSpawnerTile();
      if (newTile?.id) activeTileIdRef.current = newTile.id;
      return true;
    } else {
      if (__DEV__) console.log('[App] Inventory full');
      return false;
    }
  }, [moveSpawnerTileToInventory, createSpawnerTile]);

  /** Поворачивает плитку инвентаря по её ID через TilesContext. */
  const handleInventoryRotate = useCallback((tileId: string) => {
    if (rotateTileInInventory) {
      rotateTileInInventory(tileId);
    }
  }, [rotateTileInInventory]);

  // Хук useDraggable управляет FSM, жестами и анимацией плитки спавнера
  const draggableTile = useDraggable(
    spawnerTile,
    spawnerTile?.id || null,
    initialPosition,
    handleTilePlaced,
    undefined,
    'SPAWNER',
    handleDroppedInInventory,
    rotateSpawnerTile
  );

  const activeInventoryTile = activeInventoryTileId ? getInventoryTile(activeInventoryTileId) : null;

  // Опрашивает global.inventoryDragState каждые ~16ms для обновления позиции
  // плавающей плитки инвентаря во время перетаскивания
  useEffect(() => {
    const interval = setInterval(() => {
      if (global.inventoryDragState?.isDragging) setInventoryDragTick(t => t + 1);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  // Условие рендера плитки спавнера: плитка существует, позиция известна,
  // плитка не в состоянии PLACED и не была сброшена
  const shouldRenderActiveTile =
    hasActiveTileRef.current &&
    draggableTile?.position?.x !== undefined &&
    draggableTile?.position?.y !== undefined &&
    draggableTile?.state !== 'PLACED' &&
    spawnerTile !== null;

  /**
   * Проверяет выполнение требований активного квеста и инициирует сдачу:
   * списывает плитки с поля и из инвентаря, обновляет прогресс в QuestContext.
   */
  const handleQuestSubmit = useCallback(() => {
    if (!activeQuest) return;
    const success = removeTilesForQuest(activeQuest.requirements);
    if (success) {
      submitQuest(getTileCounts());
      if (__DEV__) console.log('[App] Quest submitted successfully');
    }
  }, [activeQuest, removeTilesForQuest, submitQuest, getTileCounts]);

  // Отладочный лог текущей плитки спавнера перед рендером
  useEffect(() => {
    if (__DEV__ && spawnerTile) {
      console.log('[App] Spawner tile:', {
        id: spawnerTile.id,
        texture: spawnerTile.textureKey,
        rotation: spawnerTile.rotation,
      });
    }
  }, [spawnerTile]);

  return (
    <View style={styles.gameContainer}>
      {/* Заглушка строки состояния — гарантирует тёмный фон под StatusBar на Android */}
      <View style={styles.statusBarPlaceholder}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <View style={styles.statusBarBottomBorder} />
      </View>

      {/* Базовые игровые слои */}
      <GridView />
      <SpawnerCellView />
      <PlacedTiles onPlacedTilePress={handlePlacedTilePress} />
      <InventoryStrip />

      {/* Кнопки открытия модальных окон */}
      <TouchableOpacity style={styles.recipeBookButton} onPress={() => setShowRecipeBook(true)} activeOpacity={0.7}>
        <Text style={styles.recipeBookButtonText}>Рецепты</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.questBookButton} onPress={() => setShowQuestBook(true)} activeOpacity={0.7}>
        <Text style={styles.questBookButtonText}>Квесты</Text>
      </TouchableOpacity>

      {/* Модальные окна */}
      <RecipeBook visible={showRecipeBook} onClose={() => setShowRecipeBook(false)} />
      <QuestBook
        visible={showQuestBook}
        onClose={() => setShowQuestBook(false)}
        tileCounts={getTileCounts()}
        onSubmitQuest={handleQuestSubmit}
      />

      {/* Уведомление о результате крафта (показывается только при animateMerge=true) */}
      {CRAFTING_CONFIG.animateMerge && craftFeedback.active && (
        <View style={styles.craftFeedback}>
          <Text style={styles.craftFeedbackText}>{craftFeedback.message || 'Крафт...'}</Text>
        </View>
      )}

      {/* Плитка спавнера: рендерится только если shouldRenderActiveTile === true */}
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

      {/* Плавающая плитка инвентаря: позиция читается из global.inventoryDragState */}
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

      {/* Модальное меню действий для размещённой плитки */}
      <PlacedTileActionModal
        visible={!!selectedPlacedTile}
        tile={selectedPlacedTile}
        onClose={() => setSelectedPlacedTile(null)}
        onDelete={(tileId) => {
          const placed = getAllTiles().find(t => t.tile.id === tileId);
          if (placed) {
            removeTile(tileId);
            setSelectedPlacedTile(null);
            if (__DEV__) console.log('[App] Tile deleted:', tileId);
          }
        }}
        onToInventory={(tileId) => {
          const success = movePlacedTileToInventory(tileId);
          if (success) {
            setSelectedPlacedTile(null);
            if (__DEV__) console.log('[App] Tile moved to inventory:', tileId);
          } else {
            if (__DEV__) console.warn('[App] Move to inventory failed: inventory full');
          }
        }}
        onSubmit={(tileId) => {
          submitTile(tileId);
          setSelectedPlacedTile(null);
          if (__DEV__) console.log('[App] Tile submitted:', tileId);
        }}
      />
    </View>
  );
};

// ============================================================================
// КОРНЕВОЙ КОМПОНЕНТ
// ============================================================================

/**
 * Корневой компонент приложения.
 *
 * Устанавливает иерархию провайдеров:
 * GestureHandlerRootView > SafeAreaProvider > ZoomProvider > GridProvider
 *   > TilesProvider > QuestProvider > ZoomHandler > GameContent
 *
 * ZoomHandler должен находиться внутри всех провайдеров, так как использует
 * useZoom, useGrid и передаёт жест пинча в GestureDetector.
 */
const App = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
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
  // Перекрывает область StatusBar тёмным фоном; нижняя граница визуально
  // отделяет строку состояния от игровой области
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
  statusBarBottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#ffffff',
    opacity: 0.3,
  },
  // Всплывающее уведомление о крафте над инвентарём
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
  // Кнопка книги рецептов — верхний правый угол
  recipeBookButton: {
    position: 'absolute',
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
  // Кнопка книги квестов — над инвентарём справа
  questBookButton: {
    position: 'absolute',
    bottom: INVENTORY_HEIGHT,
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
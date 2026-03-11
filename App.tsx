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
import { TileState } from './src/state';
import InventoryStrip from './src/components/InventoryStrip';

import { INVENTORY_DROP_ZONE_TOTAL_HEIGHT, INVENTORY_DROP_ZONE_PADDING_BOTTOM } from './src/constants/inventory';

const testTexture = require('./assets/images/textures/test1.png');

// ========================================
// Компонент с жестом зума
// ========================================
const ZoomHandler = ({ children }: { children: React.ReactNode }) => {
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
            tileId={tile.id}
            rotation={tile.rotation}  // ← НОВОЕ: поворот для размещённых плиток
            // ← НЕ передаём gesture/panHandlers — размещённые плитки не интерактивны
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
  // ============================================================================
  // 🔥 ИМПОРТ ИЗ КОНТЕКСТА (все методы деструктурируются здесь, на верхнем уровне)
  // ============================================================================
  const { 
    getSpawnerTile, 
    createSpawnerTile, 
    moveSpawnerTileToInventory, 
    inventoryTiles,
    removeFromInventory  // ← НОВОЕ: для удаления при размещении из инвентаря
  } = useTiles();
  
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const [isInitialized, setIsInitialized] = useState(false);

  const activeTileIdRef = useRef<string | null>(null);
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

  const initialPosition = useMemo(() => getInitialPosition(), [getInitialPosition, spawnerTile?.id]); 

  // ============================================================================
  // 🔥 КОЛБЭК ПРИ РАЗМЕЩЕНИИ ПЛИТКИ (на грид)
  // ============================================================================
  // ВАЖНО: Сигнатура должна быть (cell) => void, как ожидает useDraggable
  // Удаление из инвентаря происходит в InventoryCell, не здесь!
  // ============================================================================
  const handleTilePlaced = useCallback((cell: { col: number; row: number }) => {
    console.log('🔥 [1] handleTilePlaced START');
    
    // ← Удаление из инвентаря НЕ здесь — это делает InventoryCell.tsx!
    // Здесь только создаём новую плитку в спавнере
    
    const newTile = createSpawnerTile();
    console.log('🔥 [2] createSpawnerTile вернул:', newTile?.id);
    if (newTile?.id) {
      activeTileIdRef.current = newTile.id;
      console.log('🔥 [3] activeTileIdRef обновлён');
    }
  }, [createSpawnerTile]);  // ← Только createSpawnerTile в зависимостях

  // ============================================================================
  // 🔥 КОЛБЭК: ПЛИТКА СБРОШЕНА В ИНВЕНТАРЬ
  // ============================================================================
  // Вызывается когда пользователь отпускает плитку из спавнера над зоной инвентаря.
  // Перемещает плитку из спавнера в инвентарь и создаёт новую в спавнере.
  // ============================================================================
  const handleDroppedInInventory = useCallback((): boolean => {  // ← Возвращаем boolean
    if (__DEV__) {
      console.log('[App] 📦 Плитка сброшена в инвентарь');
    }
    
    const success = moveSpawnerTileToInventory();
    
    if (success) {
      if (__DEV__) {
        console.log('[App] ✅ Плитка добавлена в инвентарь');
      }
      // Создаём новую плитку в спавнере
      const newTile = createSpawnerTile();
      if (newTile?.id) {
        activeTileIdRef.current = newTile.id;
      }
      return true;  // ← Возвращаем успех
    } else {
      if (__DEV__) {
        console.log('[App] ❌ Инвентарь полон, плитка не добавлена');
      }
      // НЕ создаём новую плитку — старая остаётся в спавнере
      return false;  // ← Возвращаем провал
    }
  }, [moveSpawnerTileToInventory, createSpawnerTile]);

  // ============================================================================
  // 🔥 🔥 🔥 КЛЮЧЕВОЕ: Объявление draggableTile для спавнера
  // ============================================================================
  // Для инвентаря будет отдельный экземпляр в InventoryCell
  // ============================================================================
  const draggableTile = useDraggable(
    spawnerTile,
    spawnerTile?.id || null, 
    initialPosition,
    handleTilePlaced,           // onPlaced: размещение на гриде
    undefined,                  // onReturned: пока не используется
    'SPAWNER',                  // source
    handleDroppedInInventory    // onDroppedInInventory: сброс в инвентарь
  );

  // ============================================================================
  // 🔥 Отладочное логирование (только смена состояния)
  // ============================================================================
  const prevStateRef = useRef<TileState | null>(null);
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

  // ============================================================================
  // 🔥 Показываем активную плитку ТОЛЬКО когда она не размещена
  // ============================================================================
  const shouldRenderActiveTile =
    hasActiveTileRef.current && 
    draggableTile?.position?.x !== undefined && 
    draggableTile?.position?.y !== undefined &&
    draggableTile?.state !== 'PLACED' &&
    spawnerTile !== null;

  useEffect(() => {
    if (__DEV__) {
      /*console.log('[App] 🔍 shouldRenderActiveTile DEBUG:', {
        hasActiveTileRef: hasActiveTileRef.current,
        position: draggableTile?.position,
        state: draggableTile?.state,
        spawnerTileId: spawnerTile?.id,
        shouldRender: shouldRenderActiveTile,
      });*/
    }
  }, [
    hasActiveTileRef.current,
    draggableTile?.position,
    draggableTile?.state,
    spawnerTile?.id,
    shouldRenderActiveTile,
  ]);

  // ============================================================================
  // РЕНДЕР
  // ============================================================================
  return (
    <View style={styles.gameContainer}>
      {/* GridView и SpawnerCellView для инициализации контекстов */}
      <GridView />
      <SpawnerCellView />
      
      {/* Размещённые плитки из контекста */}
      <PlacedTiles />

      {/* Активная плитка из спавнера (только если не PLACED) */}
      {shouldRenderActiveTile && spawnerTile && draggableTile?.gesture && (
        <GestureDetector gesture={draggableTile.gesture}>
          <TileView
            textureSource={TEXTURE_MAP[spawnerTile.textureKey] || DEFAULT_TEXTURE}
            position={draggableTile.position}
            width={draggableTile.width}
            height={draggableTile.height}
            tileId={spawnerTile.id}
            rotation={spawnerTile?.rotation ?? 0}
          />
        </GestureDetector>
      )}

      {/* ================================================================== */}
      {/* ИНВЕНТАРЬ (НОВОЕ)                                                  */}
      {/* ================================================================== */}
      <InventoryStrip />
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
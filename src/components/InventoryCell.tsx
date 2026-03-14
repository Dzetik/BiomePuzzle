// ============================================================================
// ЯЧЕЙКА ПЛИТКИ В ИНВЕНТАРЕ (с прямой проверкой крафта)
// ============================================================================

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { Tile } from '../models/Tile';
import TileView from './TileView';
import { TEXTURE_MAP, DEFAULT_TEXTURE } from '../constants/textures';
import { 
  INVENTORY_CELL_SIZE, 
  INVENTORY_CELL_SPACING, 
  INVENTORY_CELL_BACKGROUND_COLOR, 
  INVENTORY_CELL_BORDER_COLOR 
} from '../constants/inventory';
import { useDraggable } from '../hooks/useDraggable';
import { useTiles } from '../context/TilesContext';

// ============================================================================
// 🔑 Импорт системы крафта для прямой проверки
// ============================================================================
import { CraftingService } from '../services/CraftingService';
import { CRAFTING_CONFIG } from '../constants/CraftingConfig';

interface InventoryCellProps {
  tile: Tile;
  index: number;
  onTap: (tileId: string) => void;
  onDragStart: (tileId: string) => void;
}

const InventoryCell: React.FC<InventoryCellProps> = ({
  tile,
  index,
  onTap,
  onDragStart,
}) => {
  // ============================================================================
  // 🔑 Получаем ВСЕ необходимые методы из контекста (снаружи useCallback)
  // ============================================================================
  const { 
    removeFromInventory, 
    addToInventory, 
    setActiveInventoryTileId,
    getTileAt,
    addTile: ctxAddTile,
    removeTile: ctxRemoveTile,
  } = useTiles();
  
  const placementSuccessRef = useRef(false);
  const textureSource = TEXTURE_MAP[tile.textureKey] || DEFAULT_TEXTURE;
  
  // ============================================================================
  // ВЫЧИСЛЕНИЕ ПОЗИЦИИ ЯЧЕЙКИ НА ЭКРАНЕ
  // ============================================================================
  const initialPosition = useMemo(() => {
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    const buttonWidth = 40;
    const buttonMargin = 8;
    const counterWidth = 80;
    const cellSpacing = 8;
    
    const startX = buttonMargin + buttonWidth + buttonMargin + counterWidth;
    
    const pos = {
      x: startX + index * (INVENTORY_CELL_SIZE + cellSpacing),
      y: screenHeight - 110 + 15,
    };
    
    if (__DEV__) {
      console.log(`[InventoryCell] 📍 Cell ${index} initialPosition:`, pos);
    }
    return pos;
  }, [index]);
  
  // ============================================================================
  // КОЛБЭКИ
  // ============================================================================
  
  // 🔑 handlePlaced — с ПРЯМОЙ проверкой крафта через CraftingService
  const handlePlaced = useCallback((
    cell: { col: number; row: number },
    placedTile?: Tile
  ) => {
    placementSuccessRef.current = true;
    setActiveInventoryTileId(null);
    removeFromInventory(tile.id);
    
    if (__DEV__) {
      console.log(`[InventoryCell] ✅ Placed ${tile.id} at [${cell.col},${cell.row}]`, {
        texture: tile.textureKey,
        activeSide: tile.activeSide,
      });
    }
    
    // ========================================================================
    // 🔑 ПРЯМАЯ ПРОВЕРКА КРАФТА (не через onPlaced из App.tsx)
    // ========================================================================
    if (CRAFTING_CONFIG.enabled && CRAFTING_CONFIG.checkOnPlace) {
      if (__DEV__) {
        console.log(`[InventoryCell] 🔗 Direct craft check for ${tile.id}:`, {
          texture: tile.textureKey,
          position: `${cell.col},${cell.row}`,
          activeSide: tile.activeSide,
        });
      }
      
      try {
        const result = CraftingService.onTilePlaced(
          tile,  // Плитка из инвентаря
          cell.col,
          cell.row,
          getTileAt,  // Функция получения плитки по координатам
          {
            // Операции с плитками
            removeTile: ctxRemoveTile,
            addTile: ctxAddTile,
            generateTileId: () => `craft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          }
        );
        
        if (__DEV__ && result.crafted) {
          console.log(`[InventoryCell] ✅ Direct craft succeeded: ${result.results.length} crafts`);
          result.results.forEach(r => {
            console.log(`  - ${r.message}`);
          });
        }
      } catch (error) {
        console.error(`[InventoryCell] ❌ Craft check error:`, error);
      }
    }
  }, [
    tile, 
    tile.id, 
    removeFromInventory, 
    setActiveInventoryTileId,
    getTileAt,
    ctxAddTile,
    ctxRemoveTile,
  ]);
  
  // 🔑 handleReturned — определён!
  const handleReturned = useCallback(() => {
    setActiveInventoryTileId(null);
    if (__DEV__) {
      console.log(`[InventoryCell] 🔄 Returned ${tile.id} to inventory`);
    }
    // Плитка уже в инвентаре, просто сбрасываем состояние
  }, [tile.id, setActiveInventoryTileId]);
  
  // ============================================================================
  // useDraggable
  // ============================================================================
  const draggable = useDraggable(
    tile,
    tile.id,
    initialPosition,
    // ========================================================================
    // 🔑 Колбэк onPlaced — вызывает handlePlaced с двумя аргументами
    // ========================================================================
    (cell, placedTile) => {
      handlePlaced(cell, placedTile);
    },
    handleReturned,  // ← Теперь определён!
    'INVENTORY'
    // onDroppedInInventory не нужен для инвентаря
  );
  
  // ============================================================================
  // 🔑 Отслеживать состояние драга и обновлять global
  // ============================================================================
  useEffect(() => {
    if (draggable.state === 'DRAGGING') {
      setActiveInventoryTileId(tile.id);
      
      // Инициализировать global.inventoryDragState если не существует
      if (!global.inventoryDragState) {
        global.inventoryDragState = {
          isDragging: false,
          tileId: null,
          position: { x: 0, y: 0 },
          rotation: 0,
        };
      }
      
      global.inventoryDragState.isDragging = true;
      global.inventoryDragState.tileId = tile.id;
      global.inventoryDragState.rotation = draggable.rotation;
      
      // Это позиция где плитка была ДО начала перетаскивания
      global.inventoryDragState.position = {
        x: initialPosition.x,
        y: initialPosition.y,
      };
      
      if (__DEV__) {
        console.log(`[InventoryCell] 🚀 Drag START:`, {
          tileId: tile.id,
          isDragging: global.inventoryDragState.isDragging,
          startPosition: global.inventoryDragState.position,
        });
      }
    } else if (global.inventoryDragState?.tileId === tile.id) {
      // Драг закончился — сбрасываем флаги
      setActiveInventoryTileId(null);
      global.inventoryDragState.isDragging = false;
      global.inventoryDragState.tileId = null;
      global.inventoryDragState.rotation = 0;
      
      // ❌ НЕ сбрасываем position — он обновится при следующем драге
      
      if (__DEV__) {
        console.log(`[InventoryCell] 🛑 Drag END:`, {
          tileId: tile.id,
          isDragging: global.inventoryDragState.isDragging,
        });
      }
    }
  }, [draggable.state, tile.id, draggable.rotation, setActiveInventoryTileId, initialPosition]);
  
  // ============================================================================
  // РЕНДЕР — ТОЛЬКО СТАТИЧНАЯ ПЛИТКА
  // ============================================================================
  return (
    <View style={styles.cell}>
      <GestureDetector gesture={draggable.gesture}>
        <View style={{ 
          opacity: draggable.state === 'DRAGGING' ? 0 : 1 
        }}>
          <TileView
            textureSource={textureSource}
            position={{ x: 0, y: 0 }}
            width={INVENTORY_CELL_SIZE}
            height={INVENTORY_CELL_SIZE}
            tileId={tile.id}
            rotation={tile.rotation}
            isInInventory={true}
            tile={tile}  // ← Для отрисовки activeSide
            debugLabel={`InventoryCell[${index}]-static`}
          />
        </View>
      </GestureDetector>
    </View>
  );
};

// ============================================================================
// СТИЛИ
// ============================================================================
const styles = StyleSheet.create({
  cell: {
    width: INVENTORY_CELL_SIZE,
    height: INVENTORY_CELL_SIZE,
    borderRadius: 8,
    backgroundColor: INVENTORY_CELL_BACKGROUND_COLOR,
    borderColor: INVENTORY_CELL_BORDER_COLOR,
    borderWidth: 2,
    marginHorizontal: INVENTORY_CELL_SPACING / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
});

export default InventoryCell;
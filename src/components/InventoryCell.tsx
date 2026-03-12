// ============================================================================
// ЯЧЕЙКА ПЛИТКИ В ИНВЕНТАРЕ (ФИНАЛЬНАЯ ВЕРСИЯ)
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
  const { removeFromInventory, addToInventory, setActiveInventoryTileId } = useTiles();
  
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
  const handlePlaced = useCallback((cell: { col: number; row: number }) => {
    placementSuccessRef.current = true;
    setActiveInventoryTileId(null);
    removeFromInventory(tile.id);
    console.log(`[InventoryCell] ✅ Placed ${tile.id} at [${cell.col},${cell.row}]`);
  }, [tile.id, removeFromInventory, setActiveInventoryTileId]);
  
  const handleReturned = useCallback(() => {
    setActiveInventoryTileId(null);
    console.log(`[InventoryCell] 🔄 Returned ${tile.id} to inventory`);
    addToInventory(tile);
  }, [tile, addToInventory, setActiveInventoryTileId]);
  
  // ============================================================================
  // useDraggable
  // ============================================================================
  const draggable = useDraggable(
    tile,
    tile.id,
    initialPosition,
    handlePlaced,
    handleReturned,
    'INVENTORY'
  );
  
  // ============================================================================
  // 🔑 Отслеживать состояние драга и обновлять global
  // ============================================================================
  useEffect(() => {
    if (draggable.state === 'DRAGGING') {
      setActiveInventoryTileId(tile.id);
      if (global.inventoryDragState) {
        global.inventoryDragState.tileId = tile.id;
        global.inventoryDragState.rotation = draggable.rotation;
      }
    } else if (global.inventoryDragState?.tileId === tile.id) {
      setActiveInventoryTileId(null);
      global.inventoryDragState.isDragging = false;
      global.inventoryDragState.tileId = null;
    }
  }, [draggable.state, tile.id, draggable.rotation, setActiveInventoryTileId]);
  
  // ============================================================================
  // РЕНДЕР — ТОЛЬКО СТАТИЧНАЯ ПЛИТКА
  // ============================================================================
  return (
    <View style={styles.cell}>
      <GestureDetector gesture={draggable.gesture}>
        <View style={{ 
          opacity: draggable.state === 'DRAGGING' ? 0 : 1 }}>
          <TileView
            textureSource={textureSource}
            position={{ x: 0, y: 0 }}
            width={INVENTORY_CELL_SIZE}
            height={INVENTORY_CELL_SIZE}
            tileId={tile.id}
            rotation={tile.rotation}
            isInInventory={true}
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
// ============================================================================
// ЯЧЕЙКА ПЛИТКИ В ИНВЕНТАРЕ (ИСПРАВЛЕННАЯ ВЕРСИЯ — БЕЗ МИГАНИЯ)
// ============================================================================

// ============================================================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ ДЛЯ DRAG (временное решение)
// ============================================================================
declare global {
  var inventoryDragState: {
    position: { x: number; y: number };
    size: { width: number; height: number };
    rotation: number;
    isDragging: boolean;
    tileId: string | null;
  } | undefined;
}

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
  // 🔑 НОВОЕ: Refs для предотвращения перезаписи позиции от жеста
  // ============================================================================
  const hasInitializedPositionRef = useRef(false);
  
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
  // 🔑 Отслеживать состояние драга и сообщать контексту
  // ============================================================================
  useEffect(() => {
    if (draggable.state === 'DRAGGING') {
      setActiveInventoryTileId(tile.id);
      if (__DEV__) {
        console.log(`[InventoryCell] 🎯 START DRAG: ${tile.id}`);
      }
    } else if (
      draggable.state === 'INVENTORY_IDLE' || 
      draggable.state === 'PLACED' || 
      draggable.state === 'RETURNING_TO_INVENTORY'
    ) {
      setActiveInventoryTileId(null);
      if (__DEV__) {
        console.log(`[InventoryCell] 🏁 END DRAG: ${tile.id} (state: ${draggable.state})`);
      }
    }
  }, [draggable.state, tile.id, setActiveInventoryTileId]);
  
  // ============================================================================
  // 🔑 Обновление глобального состояния позиции для App (ИСПРАВЛЕННОЕ)
  // ============================================================================
  useEffect(() => {
    if (draggable.state === 'DRAGGING') {
      if (!global.inventoryDragState) {
        global.inventoryDragState = {
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 },
          rotation: 0,
          isDragging: false,
          tileId: null,
        };
      }
      
      // ============================================================================
      // 🔑 FIX: Не перезаписывать позицию, если жест уже установил правильную
      // ============================================================================
      // Жест в useDraggable.gestures.ts устанавливает позицию в onStart()
      // на основе e.absoluteX/Y (точка касания). Не перезаписываем её позицией
      // из draggable.position, которая может быть устаревшей (позиция ячейки).
      // ============================================================================
      const isFirstDragFrame = !hasInitializedPositionRef.current;
      const gestureAlreadySetPosition = global.inventoryDragState.isDragging && 
        (Math.abs(global.inventoryDragState.position.x - initialPosition.x) > 10 || 
         Math.abs(global.inventoryDragState.position.y - initialPosition.y) > 10);
      
      // Обновляем позицию ТОЛЬКО если:
      // 1. Это первый кадр драга (жест ещё не сработал), ИЛИ
      // 2. Жест ещё не установил позицию (разница < 10px = скорее всего ячейка)
      if (isFirstDragFrame || !gestureAlreadySetPosition) {
        global.inventoryDragState.position = { x: draggable.position.x, y: draggable.position.y };
      }
      
      // Эти поля обновляем всегда (они не конфликтуют с жестом)
      global.inventoryDragState.size = { width: draggable.width, height: draggable.height };
      global.inventoryDragState.rotation = draggable.rotation;
      global.inventoryDragState.isDragging = true;
      global.inventoryDragState.tileId = tile.id;
      
      // Помечаем что инициализировали (чтобы не сбрасывать позицию в следующих кадрах)
      hasInitializedPositionRef.current = true;
      
      if (__DEV__) {
        console.log(`[InventoryCell] 🌐 Updated global drag state:`, {
          tileId: tile.id,
          position: { x: Math.round(draggable.position.x), y: Math.round(draggable.position.y) },
          gestureAlreadySetPosition,
          isFirstDragFrame,
          finalPosition: { 
            x: Math.round(global.inventoryDragState.position.x), 
            y: Math.round(global.inventoryDragState.position.y) 
          },
        });
      }
    } else if (global.inventoryDragState?.tileId === tile.id) {
      // Сбрасываем при завершении драга
      global.inventoryDragState.isDragging = false;
      global.inventoryDragState.tileId = null;
      hasInitializedPositionRef.current = false;  // ← Сброс для следующего драга
    }
  }, [draggable.state, draggable.position.x, draggable.position.y, draggable.width, draggable.height, draggable.rotation, tile.id, initialPosition.x, initialPosition.y]);
  
  // ============================================================================
  // 🔍 ОТЛАДКА: Лог позиции во время драга
  // ============================================================================
  useEffect(() => {
    if (__DEV__ && draggable.state === 'DRAGGING') {
      console.log(`[InventoryCell] 📍 Drag position:`, {
        tileId: tile.id,
        position: { x: Math.round(draggable.position.x), y: Math.round(draggable.position.y) },
        state: draggable.state,
      });
    }
  }, [draggable.state, draggable.position.x, draggable.position.y, tile.id]);
  
  // ============================================================================
  // РЕНДЕР — ТОЛЬКО СТАТИЧНАЯ ПЛИТКА
  // ============================================================================
  return (
    <View style={styles.cell}>
      {/* 🔑 FIX: Скрываем статичную плитку при драге через opacity */}
      <GestureDetector gesture={draggable.gesture}>
        <View style={{ opacity: draggable.state === 'DRAGGING' ? 0 : 1 }}>
          <TileView
            textureSource={textureSource}
            position={{ x: 0, y: 0 }}  // (0,0) относительно ячейки
            width={INVENTORY_CELL_SIZE}
            height={INVENTORY_CELL_SIZE}
            tileId={tile.id}
            rotation={tile.rotation}
            isInInventory={true}  // relative positioning
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
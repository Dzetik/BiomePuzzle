// ============================================================================
// ЯЧЕЙКА ПЛИТКИ В ИНВЕНТАРЕ
// ============================================================================
// Этот компонент отображает отдельную плитку в инвентаре.
// Поддерживает:
// - Tap для поворота на 90°
// - Drag для перетаскивания на грид
// ============================================================================

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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
// ПРОПСЫ
// ============================================================================

interface InventoryCellProps {
  tile: Tile;                      // Экземпляр плитки
  index: number;                   // Визуальный индекс в видимом окне
  onTap: (tileId: string) => void; // Обработчик тапа (поворот)
  onDragStart: (tileId: string) => void; // Обработчик начала драга
}

// ============================================================================
// КОМПОНЕНТ
// ============================================================================

const InventoryCell: React.FC<InventoryCellProps> = ({
  tile,
  index,
  onTap,
  onDragStart,
}) => {
  const { removeFromInventory, addToInventory } = useTiles();
  
  // Ref для отслеживания успешности размещения
  const placementSuccessRef = useRef(false);
  
  // Получаем текстуру из маппинга
  const textureSource = TEXTURE_MAP[tile.textureKey] || DEFAULT_TEXTURE;
  
  // --------------------------------------------------------------------------
  // ВЫЧИСЛЕНИЕ ПОЗИЦИИ ПЛИТКИ В ИНВЕНТАРЕ
  // --------------------------------------------------------------------------
  // Позиция вычисляется динамически на основе индекса и конфига.
  // Это нужно для корректного перетаскивания на грид.
  // --------------------------------------------------------------------------
  const initialPosition = useMemo(() => {
    // Получаем размеры экрана для вычисления позиции
    const { width: screenWidth, height: screenHeight } = require('react-native').Dimensions.get('window');
    
    // Позиция: левый край + кнопки + счётчик + индекс * размер
    const buttonWidth = 40; // INVENTORY_SCROLL_BUTTON_SIZE
    const buttonMargin = 8; // INVENTORY_BUTTON_MARGIN
    const counterWidth = 80; // INVENTORY_CELL_SIZE
    const cellSpacing = 8; // INVENTORY_CELL_SPACING
    
    const startX = buttonMargin + buttonWidth + buttonMargin + counterWidth;
    
    return {
      x: startX + index * (INVENTORY_CELL_SIZE + cellSpacing),
      y: screenHeight - 110 + 15, // INVENTORY_HEIGHT + отступ
    };
  }, [index]);
  
  // --------------------------------------------------------------------------
  // КОЛБЭК: ПЛИТКА РАЗМЕЩЕНА НА ГРИДЕ
  // --------------------------------------------------------------------------
  const handlePlaced = useCallback((cell: { col: number; row: number }) => {
    placementSuccessRef.current = true;
    
    // Удаляем плитку из инвентаря при успешном размещении
    removeFromInventory(tile.id);
    
    console.log(`[InventoryCell] ✅ Плитка ${tile.id} размещена в [${cell.col},${cell.row}]`);
  }, [tile.id, removeFromInventory]);
  
  // --------------------------------------------------------------------------
  // КОЛБЭК: ПЛИТКА ВЕРНУЛАСЬ (НЕУДАЧНОЕ РАЗМЕЩЕНИЕ)
  // --------------------------------------------------------------------------
  const handleReturned = useCallback(() => {
    console.log(`[InventoryCell] 🔄 Плитка ${tile.id} вернулась в инвентарь`);
    // Возвращаем плитку обратно в инвентарь
    addToInventory(tile);
  }, [tile, addToInventory]);
  
  // --------------------------------------------------------------------------
  // ИНТЕГРАЦИЯ С useDraggable
  // --------------------------------------------------------------------------
  const draggable = useDraggable(
    tile,                                    // Экземпляр плитки
    tile.id,                                 // ID плитки
    initialPosition,                         // Начальная позиция
    handlePlaced,                            // onPlaced: размещение на гриде
    handleReturned,                          // onReturned: возврат в инвентарь
    'INVENTORY'                              // source
  );
  
  // ============================================================================
  // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ #1: Динамический isInInventory
  // ============================================================================
  // Плитка в инвентаре только когда НЕ в драге.
  // Во время драга используем абсолютное позиционирование для следования за пальцем.
  // ============================================================================
  const isInInventory = draggable.state !== 'DRAGGING';
  
  // --------------------------------------------------------------------------
  // РЕНДЕР
  // --------------------------------------------------------------------------
  return (
    <View style={styles.cell}>
      {draggable?.gesture ? (
        <GestureDetector gesture={draggable.gesture}>
          <TileView
            textureSource={textureSource}
            position={draggable.position}
            width={draggable.width}
            height={draggable.height}
            tileId={tile.id}
            // ============================================================================
            // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ #2: Используем tile.rotation вместо draggable.rotation
            // ============================================================================
            // tile.rotation — источник правды, обновляется при ре-рендере.
            // draggable.rotation может быть устаревшим из-за FSM-контекста.
            // ============================================================================
            rotation={tile.rotation}
            isInInventory={isInInventory}
          />
        </GestureDetector>
      ) : (
        // Fallback если жест не создан
        <TileView
          textureSource={textureSource}
          position={initialPosition}
          width={INVENTORY_CELL_SIZE}
          height={INVENTORY_CELL_SIZE}
          tileId={tile.id}
          rotation={tile.rotation}
          isInInventory={true}
        />
      )}
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
    overflow: 'hidden',
  },
});

// ============================================================================
// ЭКСПОРТ
// ============================================================================

export default InventoryCell;
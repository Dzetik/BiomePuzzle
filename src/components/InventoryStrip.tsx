// ============================================================================
// ГОРИЗОНТАЛЬНАЯ ПАНЕЛЬ ИНВЕНТАРЯ ПЛИТОК
// ============================================================================

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../hooks/useInventory';
import InventoryCell from './InventoryCell';
import {
  INVENTORY_HEIGHT,
  INVENTORY_BACKGROUND_COLOR,
  INVENTORY_COUNTER_BACKGROUND_COLOR,
  INVENTORY_COUNTER_TEXT_COLOR,
  INVENTORY_COUNTER_LABEL_COLOR,
  INVENTORY_BUTTON_BACKGROUND_COLOR,
  INVENTORY_BUTTON_TEXT_COLOR,
  INVENTORY_BUTTON_DISABLED_COLOR,
  INVENTORY_BUTTON_DISABLED_TEXT_COLOR,
  INVENTORY_SCROLL_BUTTON_SIZE,
  INVENTORY_BUTTON_MARGIN,
  INVENTORY_CELL_SPACING,
  INVENTORY_COUNTER_BORDER_COLOR,
} from '../constants/inventory';

const InventoryStrip: React.FC = () => {
  const insets = useSafeAreaInsets();
  
  // ============================================================================
  // 🔍 ОТЛАДКА: Проверяем, что insets работают
  // ============================================================================
  useEffect(() => {
    if (__DEV__) {
      console.log('[InventoryStrip] 🔍 SafeArea insets:', insets);
    }
  }, [insets]);
  
  const {
    freeSlots,
    visibleTiles,
    tiles,
    canScrollLeft,
    canScrollRight,
    scrollOffset,
    scrollLeft,
    scrollRight,
    rotateTile,
    removeTile,
    rotationTick,
  } = useInventory();

  useEffect(() => {
    if (__DEV__) {
      console.log('[InventoryStrip] 📊 State:', {
        totalTiles: tiles.length,
        visibleCount: visibleTiles.length,
        freeSlots,
        scrollOffset,
        rotationTick,
        tileIds: visibleTiles.map(t => t.id),
      });
    }
  }, [tiles.length, visibleTiles.length, freeSlots, scrollOffset, rotationTick]); 
  
  const handleTileTap = (tileId: string) => {
    rotateTile(tileId);
  };
  
  const handleTileDragStart = (tileId: string) => {
    if (__DEV__) {
        console.log(`[InventoryStrip] 🎯 Drag start: ${tileId}`);
    }
  };
  
  // ============================================================================
  // 🔑 ГИБРИДНЫЙ ОТСТУП: используем insets ИЛИ запасной 50px для Android
  // ============================================================================
  const safeBottom = Platform.OS === 'android' 
  ? Math.max(insets.bottom, 0)  // 👈 Минимум 50px для навигационной панели
  : (insets.bottom || 10);
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          // 👇 marginBottom сдвигает ВЕСЬ контейнер вверх
          marginBottom: safeBottom
        }
      ]} 
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[styles.scrollButton, !canScrollLeft && styles.scrollButtonDisabled]}
        onPress={scrollLeft}
        disabled={!canScrollLeft}
        activeOpacity={0.7}
      >
        <Text style={[styles.scrollButtonText, !canScrollLeft && styles.scrollButtonTextDisabled]}>◀</Text>
      </TouchableOpacity>
      
      <View style={styles.tilesContainer}>
        <View style={[styles.cell, styles.counterCell]}>
          <Text style={styles.counterText}>{freeSlots}</Text>
          <Text style={styles.counterLabel}>своб.</Text>
        </View>
        
        {visibleTiles.map((tile, index) => (
          <InventoryCell
            key={`${tile.id}-${rotationTick}`}
            tile={tile}
            index={index}
            onTap={handleTileTap}
            onDragStart={handleTileDragStart}
          />
        ))}
      </View>
      
      <TouchableOpacity
        style={[styles.scrollButton, !canScrollRight && styles.scrollButtonDisabled]}
        onPress={scrollRight}
        disabled={!canScrollRight}
        activeOpacity={0.7}
      >
        <Text style={[styles.scrollButtonText, !canScrollRight && styles.scrollButtonTextDisabled]}>▶</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: INVENTORY_HEIGHT,
    backgroundColor: INVENTORY_BACKGROUND_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: INVENTORY_BUTTON_MARGIN,
    borderTopWidth: 1,
    borderTopColor: '#444444',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
    overflow: 'visible', 
    // ❌ paddingBottom убран — используем marginBottom в инлайновом стиле
  },
  scrollButton: {
    width: INVENTORY_SCROLL_BUTTON_SIZE,
    height: INVENTORY_SCROLL_BUTTON_SIZE,
    borderRadius: INVENTORY_SCROLL_BUTTON_SIZE / 2,
    backgroundColor: INVENTORY_BUTTON_BACKGROUND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: INVENTORY_BUTTON_MARGIN / 2,
    overflow: 'visible', 
  },
  scrollButtonDisabled: {
    backgroundColor: INVENTORY_BUTTON_DISABLED_COLOR,
    overflow: 'visible', 
  },
  scrollButtonText: {
    color: INVENTORY_BUTTON_TEXT_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
    overflow: 'visible', 
  },
  scrollButtonTextDisabled: {
    color: INVENTORY_BUTTON_DISABLED_TEXT_COLOR,
  },
  tilesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  cell: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: INVENTORY_CELL_SPACING / 2,
    borderWidth: 2,
    overflow: 'visible', 
  },
  counterCell: {
    backgroundColor: INVENTORY_COUNTER_BACKGROUND_COLOR,
    borderColor: INVENTORY_COUNTER_BORDER_COLOR,
    overflow: 'visible', 
  },
  counterText: {
    color: INVENTORY_COUNTER_TEXT_COLOR,
    fontSize: 24,
    fontWeight: 'bold',
    overflow: 'visible', 
  },
  counterLabel: {
    color: INVENTORY_COUNTER_LABEL_COLOR,
    fontSize: 10,
    marginTop: 2,
    overflow: 'visible', 
  },
});

export default InventoryStrip;
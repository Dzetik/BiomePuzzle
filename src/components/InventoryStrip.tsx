// ============================================================================
// ГОРИЗОНТАЛЬНАЯ ПАНЕЛЬ ИНВЕНТАРЯ ПЛИТОК
// ============================================================================
// Этот компонент отображает:
// - Кнопки прокрутки влево/вправо
// - Счётчик свободных мест (первый слот)
// - Видимые плитки в текущем окне прокрутки
// ============================================================================

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

// ============================================================================
// КОМПОНЕНТ
// ============================================================================

const InventoryStrip: React.FC = () => {
  // ============================================================================
  // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ #3: Деструктурируем rotationTick
  // ============================================================================
  // rotationTick — стабильное useState-значение, которое гарантированно
  // меняется при любом повороте плитки. Используется в key для гарантированного
  // ре-рендера компонента при мутации объекта Tile.
  // ============================================================================
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
    rotationTick,  // ← НОВОЕ
  } = useInventory();

  /*useEffect(() => {
    if (__DEV__) {
      console.log('[InventoryStrip] 📊 Debug:', {
        totalTiles: tiles.length,
        visibleTiles: visibleTiles.length,
        scrollOffset,
        tileIds: tiles.map(t => t.id),
      });
    }
  }, [tiles, visibleTiles, scrollOffset]);*/
  
  // --------------------------------------------------------------------------
  // ОБРАБОТЧИК НАЖАТИЯ НА ПЛИТКУ (ПОВОРОТ)
  // --------------------------------------------------------------------------
  const handleTileTap = (tileId: string) => {
    rotateTile(tileId);
  };
  
  // --------------------------------------------------------------------------
  // ОБРАБОТЧИК НАЧАЛА DRAG
  // --------------------------------------------------------------------------
  const handleTileDragStart = (tileId: string) => {
    // Плитка удаляется только при успешном размещении (в handlePlaced)
    // Если нет — вернётся через onReturned
    if (__DEV__) {
        console.log(`[InventoryStrip] 🎯 Начало драга плитки: ${tileId}`);
    }
  };
  
  // --------------------------------------------------------------------------
  // РЕНДЕР
  // --------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* ==================================================================== */}
      {/* КНОПКА ПРОКРУТКИ ВЛЕВО                                              */}
      {/* ==================================================================== */}
      <TouchableOpacity
        style={[
          styles.scrollButton,
          !canScrollLeft && styles.scrollButtonDisabled,
        ]}
        onPress={scrollLeft}
        disabled={!canScrollLeft}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.scrollButtonText,
            !canScrollLeft && styles.scrollButtonTextDisabled,
          ]}
        >
          ◀
        </Text>
      </TouchableOpacity>
      
      {/* ==================================================================== */}
      {/* ОБЛАСТЬ С ПЛИТКАМИ (ВИДИМОЕ ОКНО)                                   */}
      {/* ==================================================================== */}
      <View style={styles.tilesContainer}>
        {/* Счётчик свободных мест (всегда первый) */}
        <View style={[styles.cell, styles.counterCell]}>
          <Text style={styles.counterText}>{freeSlots}</Text>
          <Text style={styles.counterLabel}>своб.</Text>
        </View>
        
        {/* ==================================================================== */}
        {visibleTiles.map((tile, index) => (
          <InventoryCell
            key={`${tile.id}-${rotationTick}`}  // ← ИСПРАВЛЕНО: rotationTick вместо tile.rotation
            tile={tile}
            index={index}
            onTap={handleTileTap}
            onDragStart={handleTileDragStart}
          />
        ))}
        
        {/* Пустые ячейки НЕ рендерятся (в отличие от грида) */}
      </View>
      
      {/* ==================================================================== */}
      {/* КНОПКА ПРОКРУТКИ ВПРАВО                                             */}
      {/* ==================================================================== */}
      <TouchableOpacity
        style={[
          styles.scrollButton,
          !canScrollRight && styles.scrollButtonDisabled,
        ]}
        onPress={scrollRight}
        disabled={!canScrollRight}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.scrollButtonText,
            !canScrollRight && styles.scrollButtonTextDisabled,
          ]}
        >
          ▶
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// СТИЛИ
// ============================================================================

const styles = StyleSheet.create({
  // Контейнер всей панели
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
  },
  
  // Кнопка прокрутки
  scrollButton: {
    width: INVENTORY_SCROLL_BUTTON_SIZE,
    height: INVENTORY_SCROLL_BUTTON_SIZE,
    borderRadius: INVENTORY_SCROLL_BUTTON_SIZE / 2,
    backgroundColor: INVENTORY_BUTTON_BACKGROUND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: INVENTORY_BUTTON_MARGIN / 2,
  },
  
  // Кнопка в неактивном состоянии
  scrollButtonDisabled: {
    backgroundColor: INVENTORY_BUTTON_DISABLED_COLOR,
  },
  
  // Текст кнопки
  scrollButtonText: {
    color: INVENTORY_BUTTON_TEXT_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Текст кнопки в неактивном состоянии
  scrollButtonTextDisabled: {
    color: INVENTORY_BUTTON_DISABLED_TEXT_COLOR,
  },
  
  // Контейнер для плиток (видимое окно)
  tilesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  
  // Ячейка (общий стиль)
  cell: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: INVENTORY_CELL_SPACING / 2,
    borderWidth: 2,
  },
  
  // Счётчик свободных мест
  counterCell: {
    backgroundColor: INVENTORY_COUNTER_BACKGROUND_COLOR,
    borderColor: INVENTORY_COUNTER_BORDER_COLOR,
  },
  
  // Текст счётчика (число)
  counterText: {
    color: INVENTORY_COUNTER_TEXT_COLOR,
    fontSize: 24,
    fontWeight: 'bold',
  },
  
  // Текст счётчика (подпись "своб.")
  counterLabel: {
    color: INVENTORY_COUNTER_LABEL_COLOR,
    fontSize: 10,
    marginTop: 2,
  },
});

// ============================================================================
// ЭКСПОРТ
// ============================================================================

export default InventoryStrip;
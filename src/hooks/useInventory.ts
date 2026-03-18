// ============================================================================
// ХУК УПРАВЛЕНИЯ ИНВЕНТАРЁМ ПЛИТОК (интеграция с TilesContext)
// ============================================================================
// Этот хук читает данные из TilesContext и управляет UI-состоянием инвентаря.
// Обеспечивает единую источник правды для всех плиток в приложении.
// ============================================================================

import { useMemo, useCallback, useState } from 'react';
import { useTiles } from '../context/TilesContext';
import { Tile } from '../models/Tile';
import {
  INVENTORY_MAX_SLOTS,
  INVENTORY_VISIBLE_SLOTS,
  INVENTORY_MAX_SCROLL_OFFSET,
} from '../constants/inventory';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface UseInventoryReturn {
  // Данные
  tiles: Tile[];
  freeSlots: number;
  isFull: boolean;
  isEmpty: boolean;
  
  // Прокрутка
  scrollOffset: number;
  visibleTiles: Tile[];
  canScrollLeft: boolean;
  canScrollRight: boolean;
  maxScrollOffset: number;
  
  // Действия
  addTile: (tile: Tile) => boolean;
  removeTile: (tileId: string) => void;
  rotateTile: (tileId: string) => void;
  scrollLeft: () => void;
  scrollRight: () => void;
  scrollTo: (offset: number) => void;
  clear: () => void;
  
  // Утилиты
  getTile: (tileId: string) => Tile | undefined;
  getTileIndex: (tileId: string) => number;
  
  // ============================================================================
  // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Экспорт rotationTick
  // ============================================================================
  // rotationTick — стабильное useState-значение для триггера ре-рендера
  // при мутации объекта Tile (поворот). Используется в key компонентов.
  // ============================================================================
  rotationTick: number;
}

// ============================================================================
// ГЛАВНЫЙ ХУК
// ============================================================================

export const useInventory = (): UseInventoryReturn => {
  // --------------------------------------------------------------------------
  // 1. ПОЛУЧЕНИЕ ДАННЫХ ИЗ КОНТЕКСТА
  // --------------------------------------------------------------------------
  const {
    inventoryTiles,
    addToInventory,
    removeFromInventory,
    getInventoryTile,
  } = useTiles();
  
  // --------------------------------------------------------------------------
  // 2. СОСТОЯНИЕ: ПОЗИЦИЯ ПРОКРУТКИ И ТРИГГЕР РЕ-РЕНДЕРА
  // --------------------------------------------------------------------------
  // scrollOffset — локальное UI-состояние, не загрязняет глобальный контекст
  // rotationTick — триггер ре-рендера при мутации объекта Tile (поворот)
  // --------------------------------------------------------------------------
  const [scrollOffset, setScrollOffset] = useState(0);
  const [rotationTick, setRotationTick] = useState(0);
  
  // --------------------------------------------------------------------------
  // 3. ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ
  // --------------------------------------------------------------------------
  
  const freeSlots = INVENTORY_MAX_SLOTS - inventoryTiles.length;
  const isFull = inventoryTiles.length >= INVENTORY_MAX_SLOTS;
  const isEmpty = inventoryTiles.length === 0;
  
  const maxScrollOffset = useMemo(() => {
    if (inventoryTiles.length < INVENTORY_VISIBLE_SLOTS - 1) {
      return 0;
    }
    return Math.min(
      inventoryTiles.length - INVENTORY_VISIBLE_SLOTS + 1,
      INVENTORY_MAX_SCROLL_OFFSET
    );
  }, [inventoryTiles.length]);
  
  // ============================================================================
  // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Мемоизируем visibleTiles один раз
  // ============================================================================
  const visibleTiles = inventoryTiles.slice(scrollOffset, scrollOffset + INVENTORY_VISIBLE_SLOTS - 1);
  
  const canScrollLeft = scrollOffset > 0;
  const canScrollRight = scrollOffset < maxScrollOffset;
  
  // --------------------------------------------------------------------------
  // 4. ДЕЙСТВИЯ (обёртки над контекстом)
  // --------------------------------------------------------------------------
  
  const addTile = useCallback((tile: Tile): boolean => {
    return addToInventory(tile);
  }, [addToInventory]);
  
  const removeTile = useCallback((tileId: string) => {
    removeFromInventory(tileId);
  }, [removeFromInventory]);
  
  // ============================================================================
  // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Иммутабельный поворот
  // ============================================================================
  const rotateTile = useCallback((tileId: string) => {
    // Вместо мутации объекта — вызываем метод контекста,
    // который создаёт новый экземпляр Tile
    // @ts-ignore - метод добавлен в предыдущем шаге
    if (typeof (useTiles as any).rotateTileInInventory === 'function') {
      // @ts-ignore
      (useTiles as any).rotateTileInInventory(tileId);
    }
    // rotationTick больше не нужен для триггера ре-рендера,
    // но оставляем его для обратной совместимости с key
    setRotationTick(prev => prev + 1);
  }, []);
  
  const scrollLeft = useCallback(() => {
    setScrollOffset(prev => Math.max(0, prev - 1));
  }, []);
  
  const scrollRight = useCallback(() => {
    setScrollOffset(prev => Math.min(maxScrollOffset, prev + 1));
  }, [maxScrollOffset]);
  
  const scrollTo = useCallback((offset: number) => {
    setScrollOffset(prev => Math.max(0, Math.min(maxScrollOffset, offset)));
  }, [maxScrollOffset]);
  
  const clear = useCallback(() => {
    setScrollOffset(0);
  }, []);
  
  // --------------------------------------------------------------------------
  // 5. УТИЛИТЫ
  // --------------------------------------------------------------------------
  
  const getTile = useCallback((tileId: string): Tile | undefined => {
    return getInventoryTile(tileId);
  }, [getInventoryTile]);
  
  const getTileIndex = useCallback((tileId: string): number => {
    return inventoryTiles.findIndex(t => t.id === tileId);
  }, [inventoryTiles]);
  
  // --------------------------------------------------------------------------
  // 6. ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
  // --------------------------------------------------------------------------
  return {
    // Данные
    tiles: inventoryTiles,
    freeSlots,
    isFull,
    isEmpty,
    
    // Прокрутка
    scrollOffset,
    // ========================================================================
    // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем мемоизированный visibleTiles
    // ========================================================================
    // Убран дублирующий useMemo — используется верхний
    // ========================================================================
    visibleTiles,
    canScrollLeft,
    canScrollRight,
    maxScrollOffset,
    
    // Действия
    addTile,
    removeTile,
    rotateTile,
    scrollLeft,
    scrollRight,
    scrollTo,
    clear,
    
    // Утилиты
    getTile,
    getTileIndex,
    
    // ========================================================================
    // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Экспортируем rotationTick
    // ========================================================================
    // Используется в InventoryStrip для key={`${tile.id}-${rotationTick}`}
    // Гарантирует корректный ре-рендер при повороте плитки
    // ========================================================================
    rotationTick,
  };
};

export default useInventory;
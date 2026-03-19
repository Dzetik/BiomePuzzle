// ============================================================================
// ХУК УПРАВЛЕНИЯ ИНВЕНТАРЁМ ПЛИТОК (интеграция с TilesContext)
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
  tiles: Tile[];
  freeSlots: number;
  scrollOffset: number;
  visibleTiles: Tile[];
  canScrollLeft: boolean;
  canScrollRight: boolean;
  rotateTile: (tileId: string) => void;
  scrollLeft: () => void;
  scrollRight: () => void;
  rotationTick: number;
}

// ============================================================================
// ГЛАВНЫЙ ХУК
// ============================================================================

export const useInventory = (): UseInventoryReturn => {
  const { inventoryTiles } = useTiles();

  const [scrollOffset, setScrollOffset] = useState(0);
  const [rotationTick, setRotationTick] = useState(0);

  const freeSlots = INVENTORY_MAX_SLOTS - inventoryTiles.length;

  const maxScrollOffset = useMemo(() => {
    if (inventoryTiles.length < INVENTORY_VISIBLE_SLOTS - 1) {
      return 0;
    }
    return Math.min(
      inventoryTiles.length - INVENTORY_VISIBLE_SLOTS + 1,
      INVENTORY_MAX_SCROLL_OFFSET
    );
  }, [inventoryTiles.length]);

  const visibleTiles = inventoryTiles.slice(scrollOffset, scrollOffset + INVENTORY_VISIBLE_SLOTS - 1);

  const canScrollLeft = scrollOffset > 0;
  const canScrollRight = scrollOffset < maxScrollOffset;

  const rotateTile = useCallback((_tileId: string) => {
    setRotationTick(prev => prev + 1);
  }, []);

  const scrollLeft = useCallback(() => {
    setScrollOffset(prev => Math.max(0, prev - 1));
  }, []);

  const scrollRight = useCallback(() => {
    setScrollOffset(prev => Math.min(maxScrollOffset, prev + 1));
  }, [maxScrollOffset]);

  return {
    tiles: inventoryTiles,
    freeSlots,
    scrollOffset,
    visibleTiles,
    canScrollLeft,
    canScrollRight,
    rotateTile,
    scrollLeft,
    scrollRight,
    rotationTick,
  };
};

export default useInventory;

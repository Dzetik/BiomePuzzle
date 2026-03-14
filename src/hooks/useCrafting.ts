// ============================================================================
// ХУК-ИНТЕГРАТОР СИСТЕМЫ КРАФТА
// ============================================================================

import { useCallback } from 'react';
import { Tile } from '../models/Tile';
import { CraftingService, CraftResult } from '../services/CraftingService';
import { CRAFTING_CONFIG } from '../constants/CraftingConfig';
import { PlacedTileInfo } from '../context/TilesContext';

export interface UseCraftingOptions {
  getTileAt: (col: number, row: number) => PlacedTileInfo | undefined;
  addTile: (col: number, row: number, tile: Tile) => void;
  removeTile: (tileId: string) => void;
  generateTileId: () => string;
  
  // 🔑 НОВОЕ: Атомарный крафт
  craftTiles?: (
    removeIds: string[],
    addInfo: { col: number; row: number; tile: Tile }
  ) => void;
  
  onCraftStart?: (recipeId: string, ingredientIds: string[]) => void;
  onCraftComplete?: (result: CraftResult) => void;
  onChainStart?: (resultTile: Tile, depth: number) => void;
}

export const useCrafting = (
  originalOnPlaced: (cell: { col: number; row: number }, tile?: Tile) => void,
  options: UseCraftingOptions
) => {
  // ========================================================================
  // 🔑 Деструктуризация опций ВНЕ useCallback
  // ========================================================================
  const {
    getTileAt,
    addTile,
    removeTile,
    generateTileId,
    craftTiles,  // ← В скоупе!
    onCraftStart,
    onCraftComplete,
    onChainStart,
  } = options;

  return useCallback((
    cell: { col: number; row: number },
    placedTile?: Tile
  ) => {
    
    originalOnPlaced(cell, placedTile);
    
    if (!CRAFTING_CONFIG.enabled || !CRAFTING_CONFIG.checkOnPlace) {
      return;
    }
    
    const tileToCheck = placedTile ?? getTileAt(cell.col, cell.row)?.tile;
    
    if (!tileToCheck) {
      if (__DEV__) console.warn('[Crafting] ⚠️ Плитка не найдена', { cell });
      return;
    }
    
    if (__DEV__) {
      console.log('[Crafting] 🔍 Проверка рецепта для:', {
        texture: tileToCheck.textureKey,
        position: `${cell.col},${cell.row}`,
        activeSide: tileToCheck.activeSide,
      });
    }
    
    try {
      const result = CraftingService.onTilePlaced(
        tileToCheck,
        cell.col,
        cell.row,
        getTileAt,
        {
          removeTile,
          addTile,
          generateTileId,
          craftTiles,  // ✅ Работает!
        },
        {
          onCraftStart: (recipe, matchedTiles) => {
            if (__DEV__) console.log(`[Crafting] ✨ Начало крафта: ${recipe.id}`);
            onCraftStart?.(recipe.id, matchedTiles.map(m => m.tile.id));
          },
          onCraftComplete: (craftResult) => {
            if (__DEV__) console.log(`[Crafting] ✅ Крафт завершён:`, craftResult.message);
            onCraftComplete?.(craftResult);
          },
          onChainStart: (resultTile, depth) => {
            if (__DEV__) console.log(`[Crafting] 🔗 Цепочка шаг ${depth}`);
            onChainStart?.(resultTile, depth);
          },
        }
      );
      
      if (__DEV__ && result.crafted) {
        console.log(`[Crafting] 🎉 Выполнено крафтов: ${result.results.length}`);
      }
      
    } catch (error) {
      console.error('[Crafting] ❌ Ошибка:', error);
    }
    
  }, [
    // ========================================================================
    // 🔑 Зависимости — все переменные в скоупе!
    // ========================================================================
    originalOnPlaced,
    getTileAt,
    addTile,
    removeTile,
    generateTileId,
    craftTiles,  // ✅ Работает!
    onCraftStart,
    onCraftComplete,
    onChainStart,
  ]);
};

export default useCrafting;
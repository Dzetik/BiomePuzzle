// ============================================================================
// ХУК-ИНТЕГРАТОР СИСТЕМЫ КРАФТА (Версия 2: с прямой передачей плитки)
// ============================================================================
// Оборачивает колбэк onPlaced и добавляет автоматическую проверку рецептов.
// Плитка передаётся напрямую вместо поиска по координатам — это решает проблему
// асинхронного обновления состояния React.
// ============================================================================

import { useCallback } from 'react';
import { Tile } from '../models/Tile';
import { CraftingService, CraftResult } from '../services/CraftingService';
import { CRAFTING_CONFIG } from '../constants/CraftingConfig';
import { PlacedTileInfo } from '../context/TilesContext';

export interface UseCraftingOptions {
  // === Обязательные зависимости из TilesContext ===
  getTileAt: (col: number, row: number) => PlacedTileInfo | undefined;
  addTile: (col: number, row: number, tile: Tile) => void;
  removeTile: (tileId: string) => void;
  generateTileId: () => string;
  
  // === Опциональные колбэки для визуальной/звуковой обратной связи ===
  onCraftStart?: (recipeId: string, ingredientIds: string[]) => void;
  onCraftComplete?: (result: CraftResult) => void;
  onChainStart?: (resultTile: Tile, depth: number) => void;
}

/**
 * Создаёт обёрнутую версию onPlaced с проверкой крафта.
 * 
 * @param originalOnPlaced - оригинальный колбэк размещения (базовая логика)
 * @param options - зависимости и колбэки
 * @returns обёрнутая функция (cell, tile) => void
 * 
 * @example
 * const handlePlacedBase = useCallback((cell, tile) => { /* базовая логика *\/ }, []);
 * const handlePlaced = useCrafting(handlePlacedBase, {
 *   getTileAt, addTile, removeTile, generateTileId,
 *   onCraftStart: (id, ids) => { /* визуализация *\/ },
 * });
 */
export const useCrafting = (
  originalOnPlaced: (
    cell: { col: number; row: number },
    tile?: Tile
  ) => void,
  options: UseCraftingOptions
) => {
  const {
    getTileAt,
    addTile,
    removeTile,
    generateTileId,
    onCraftStart,
    onCraftComplete,
    onChainStart,
  } = options;

  return useCallback((
    cell: { col: number; row: number },
    placedTile?: Tile  // ← 🔑 НОВОЕ: плитка передаётся напрямую
  ) => {
    
    // ========================================================================
    // ШАГ 1: Выполняем оригинальную логику размещения
    // ========================================================================
    originalOnPlaced(cell, placedTile);
    
    // ========================================================================
    // ШАГ 2: Проверяем: включён ли крафт в конфиге?
    // ========================================================================
    if (!CRAFTING_CONFIG.enabled || !CRAFTING_CONFIG.checkOnPlace) {
      return;  // Крафт отключён — выходим, ничего не ломаем
    }
    
    // ========================================================================
    // ШАГ 3: Используем переданную плитку ИЛИ ищем по координатам (fallback)
    // ========================================================================
    // 🔑 Ключевое изменение: плитка уже есть, не нужно ждать обновления состояния
    const tileToCheck = placedTile ?? getTileAt(cell.col, cell.row)?.tile;
    
    if (!tileToCheck) {
      if (__DEV__) {
        console.warn('[Crafting] ⚠️ Плитка не найдена для проверки крафта', { 
          cell,
          hasPlacedTile: !!placedTile,
        });
      }
      return;
    }
    
    // Логирование в режиме разработки
    if (__DEV__) {
      console.log('[Crafting] 🔍 Проверка рецепта для:', {
        texture: tileToCheck.textureKey,
        position: `${cell.col},${cell.row}`,
        activeSide: tileToCheck.activeSide,
        rotation: tileToCheck.rotation,
      });
    }
    
    // ========================================================================
    // ШАГ 4: Запускаем проверку и выполнение крафта через сервис
    // ========================================================================
    try {
      const result = CraftingService.onTilePlaced(
        tileToCheck,
        cell.col,
        cell.row,
        getTileAt,  // Функция получения плитки по координатам (для поиска соседей)
        {
          // Операции с плитками (делегирование в TilesContext)
          removeTile: (tileId: string) => removeTile(tileId),
          addTile: (col: number, row: number, tile: Tile) => addTile(col, row, tile),
          generateTileId: () => generateTileId(),
        },
        {
          // === Колбэки для внешней логики ===
          
          onCraftStart: (recipe, matchedTiles) => {
            if (__DEV__) {
              console.log(`[Crafting] ✨ Начало крафта: ${recipe.id}`, {
                ingredients: matchedTiles.map(m => m.tile.textureKey),
              });
            }
            onCraftStart?.(recipe.id, matchedTiles.map(m => m.tile.id));
          },
          
          onCraftComplete: (craftResult: CraftResult) => {
            if (__DEV__) {
              console.log(`[Crafting] ✅ Крафт завершён:`, craftResult.message);
            }
            onCraftComplete?.(craftResult);
          },
          
          onChainStart: (resultTile, depth) => {
            if (__DEV__) {
              console.log(`[Crafting] 🔗 Цепочка шаг ${depth}: ${resultTile.textureKey}`);
            }
            onChainStart?.(resultTile, depth);
          },
        }
      );
      
      // Логирование результата в __DEV__
      if (__DEV__ && result.crafted) {
        console.log(`[Crafting] 🎉 Выполнено крафтов: ${result.results.length}`);
        result.results.forEach(r => {
          console.log(`  - ${r.message}`);
        });
      }
      
    } catch (error) {
      // ======================================================================
      // ЗАЩИТА: Если крафт упал — не ломаем основную логику
      // ======================================================================
      console.error('[Crafting] ❌ Ошибка при выполнении крафта:', error);
      
      if (__DEV__) {
        // В режиме разработки показываем больше деталей
        console.error('[Crafting] Контекст ошибки:', {
          tileToCheck: {
            id: tileToCheck.id,
            textureKey: tileToCheck.textureKey,
            activeSide: tileToCheck.activeSide,
          },
          cell,
        });
      }
    }
    
  }, [
    // === Зависимости для useCallback ===
    originalOnPlaced,
    getTileAt,
    addTile,
    removeTile,
    generateTileId,
    onCraftStart,
    onCraftComplete,
    onChainStart,
  ]);
};

export default useCrafting;
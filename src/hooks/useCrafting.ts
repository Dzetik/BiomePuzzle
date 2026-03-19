// ============================================================================
// ХУК-ИНТЕГРАТОР СИСТЕМЫ КРАФТА
// ============================================================================

import { useCallback } from 'react';
import { Tile } from '../models/Tile';
import { CraftingService, CraftResult } from '../services/CraftingService';
import { CRAFTING_CONFIG } from '../constants/CraftingConfig';
import { PlacedTileInfo } from '../context/TilesContext';

/**
 * Зависимости хука useCrafting — операции над состоянием игры,
 * необходимые CraftingService для выполнения крафта.
 */
export interface UseCraftingOptions {
  /** Возвращает PlacedTileInfo по координатам ячейки или undefined. */
  getTileAt: (col: number, row: number) => PlacedTileInfo | undefined;
  /** Размещает плитку на сетке в указанной ячейке. */
  addTile: (col: number, row: number, tile: Tile) => void;
  /** Удаляет плитку с сетки по ID. */
  removeTile: (tileId: string) => void;
  /** Генерирует уникальный ID для новой плитки-результата крафта. */
  generateTileId: () => string;

  /**
   * Атомарная замена нескольких плиток одной (результат крафта).
   * Предпочтительнее связки addTile+removeTile: вызывает один setState.
   */
  craftTiles?: (
    removeIds: string[],
    addInfo: { col: number; row: number; tile: Tile }
  ) => void;

  /** Вызывается при начале крафта с ID рецепта и ID ингредиентов. */
  onCraftStart?: (recipeId: string, ingredientIds: string[]) => void;
  /** Вызывается при завершении одного крафта с его результатом. */
  onCraftComplete?: (result: CraftResult) => void;
  /** Вызывается при переходе на новый шаг цепочки крафтов. */
  onChainStart?: (resultTile: Tile, depth: number) => void;
}

/**
 * Хук-обёртка над CraftingService для интеграции с React-компонентами.
 *
 * Возвращает мемоизированный обработчик размещения плитки, который:
 * 1. Вызывает оригинальный обработчик размещения (`originalOnPlaced`).
 * 2. Если крафт включён в конфигурации — запускает проверку рецептов
 *    через CraftingService.onTilePlaced().
 * 3. Транслирует колбэки CraftingService в пользовательские обработчики.
 *
 * Деструктуризация `options` выполняется вне useCallback намеренно:
 * все поля оказываются в лексическом скоупе хука и могут быть
 * корректно перечислены в массиве зависимостей useCallback.
 *
 * @param originalOnPlaced - исходный обработчик события «плитка размещена»
 * @param options          - зависимости: функции доступа к состоянию и колбэки
 * @returns мемоизированная функция-обработчик размещения плитки
 */
export const useCrafting = (
  originalOnPlaced: (cell: { col: number; row: number }, tile?: Tile) => void,
  options: UseCraftingOptions
) => {
  // Деструктуризация вне useCallback: все переменные попадают в скоуп хука
  // и корректно отслеживаются в массиве зависимостей
  const {
    getTileAt,
    addTile,
    removeTile,
    generateTileId,
    craftTiles,
    onCraftStart,
    onCraftComplete,
    onChainStart,
  } = options;

  return useCallback((
    cell: { col: number; row: number },
    placedTile?: Tile
  ) => {

    // Всегда вызываем оригинальный обработчик (удаление из инвентаря и т.д.)
    originalOnPlaced(cell, placedTile);

    // Если крафт отключён в конфигурации — выходим
    if (!CRAFTING_CONFIG.enabled || !CRAFTING_CONFIG.checkOnPlace) {
      return;
    }

    // Определяем плитку для проверки: либо переданная явно, либо читаем из состояния
    const tileToCheck = placedTile ?? getTileAt(cell.col, cell.row)?.tile;

    if (!tileToCheck) {
      if (__DEV__) console.warn('[Crafting] Плитка не найдена', { cell });
      return;
    }

    if (__DEV__) {
      console.log('[Crafting] Проверка рецепта для:', {
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
          // craftTiles передаётся для атомарного обновления состояния
          craftTiles,
        },
        {
          onCraftStart: (recipe, matchedTiles) => {
            if (__DEV__) console.log(`[Crafting] Начало крафта: ${recipe.id}`);
            onCraftStart?.(recipe.id, matchedTiles.map(m => m.tile.id));
          },
          onCraftComplete: (craftResult) => {
            if (__DEV__) console.log(`[Crafting] Крафт завершён:`, craftResult.message);
            onCraftComplete?.(craftResult);
          },
          onChainStart: (resultTile, depth) => {
            if (__DEV__) console.log(`[Crafting] Цепочка шаг ${depth}`);
            onChainStart?.(resultTile, depth);
          },
        }
      );

      if (__DEV__ && result.crafted) {
        console.log(`[Crafting] Выполнено крафтов: ${result.results.length}`);
      }

    } catch (error) {
      console.error('[Crafting] Ошибка:', error);
    }

  }, [
    originalOnPlaced,
    getTileAt,
    addTile,
    removeTile,
    generateTileId,
    craftTiles,
    onCraftStart,
    onCraftComplete,
    onChainStart,
  ]);
};

export default useCrafting;

// ============================================================================
// СЕРВИС КРАФТА — ЯДРО ЛОГИКИ
// ============================================================================
// Отвечает за:
// - Поиск подходящего рецепта при размещении плитки
// - Валидацию цепочки через активные стороны плиток
// - Выполнение крафта (удаление ингредиентов + создание результата)
// - Рекурсивную проверку цепочек (результат → новый стартер)
// ============================================================================
// ВАЖНО: Сервис не зависит от React/FSM — только данные и правила.
// Интеграция с приложением происходит через хук useCrafting.
// ============================================================================

import { Tile } from '../models/Tile';
import { Edge } from '../models/Tile.types';
import { Recipe, getRecipesWithLastIngredient, getRecipesWhereTextureIsNotLast } from '../constants/recipes';
import { PlacedTileInfo } from '../context/TilesContext';

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Результат поиска цепочки для рецепта
 */
export interface ChainMatch {
  recipe: Recipe;
  matchedTiles: MatchedTile[];  // Плитки в порядке последовательности рецепта
  resultPosition: { col: number; row: number };  // Где появится результат
}

/**
 * Плитка с дополнительной информацией о её позиции в цепочке
 */
export interface MatchedTile {
  tile: Tile;
  col: number;
  row: number;
  sequenceIndex: number;  // Позиция в recipe.sequence (0, 1, 2...)
}

/**
 * Результат выполнения крафта
 */
export interface CraftResult {
  success: boolean;
  recipeId?: string;
  removedTileIds: string[];  // ID удалённых ингредиентов
  createdTile?: {  // Если крафт успешен
    tile: Tile;
    col: number;
    row: number;
  };
  chainContinues: boolean;  // Нужно ли проверять цепочку дальше
  message?: string;  // Для отладки
}

/**
 * Колбэки для внешней логики (опционально)
 */
export interface CraftingCallbacks {
  onCraftStart?: (recipe: Recipe, matchedTiles: MatchedTile[]) => void;
  onCraftComplete?: (result: CraftResult) => void;
  onChainStart?: (resultTile: Tile, depth: number) => void;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Получить направление от ячейки A к ячейке B
 * Возвращает Edge или null если ячейки не являются соседями
 */
const getDirectionFromTo = (
  fromCol: number, fromRow: number,
  toCol: number, toRow: number
): Edge | null => {
  const dx = toCol - fromCol;
  const dy = toRow - fromRow;
  
  // Соседи только если разница ровно 1 по одной оси и 0 по другой
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'bottom';
  if (dx === 0 && dy === -1) return 'top';
  
  return null;  // Не соседи
};

/**
 * Проверить: указывает ли activeSide плитки НА целевую ячейку
 * Пример: плитка на (5,5) с activeSide="right" указывает на (6,5)
 */
const doesActiveSidePointTo = (
  tile: Tile,
  tileCol: number, tileRow: number,
  targetCol: number, targetRow: number
): boolean => {
  // Если у плитки нет activeSide — она не может участвовать в упорядоченных рецептах
  const activeSide = (tile as any).activeSide as Edge | undefined;
  if (!activeSide) return false;
  
  // Вычисляем куда "смотрит" activeSide
  let expectedTargetCol = tileCol;
  let expectedTargetRow = tileRow;
  
  switch (activeSide) {
    case 'top': expectedTargetRow--; break;
    case 'bottom': expectedTargetRow++; break;
    case 'left': expectedTargetCol--; break;
    case 'right': expectedTargetCol++; break;
  }
  
  // Сравниваем с целевой позицией
  return expectedTargetCol === targetCol && expectedTargetRow === targetRow;
};

/**
 * Получить соседние ячейки в порядке приоритета (для детерминированного поиска)
 */
const getNeighborPositions = (col: number, row: number): Array<{ col: number; row: number; direction: Edge }> => {
  return [
    { col: col + 1, row, direction: 'right' },
    { col: col - 1, row, direction: 'left' },
    { col, row: row + 1, direction: 'bottom' },
    { col, row: row - 1, direction: 'top' },
  ];
};

// ============================================================================
// КЛАСС СЕРВИСА
// ============================================================================

export class CraftingService {
  
  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЙ МЕТОД: Проверка рецепта при размещении плитки
  // --------------------------------------------------------------------------
  /**
   * Вызывается после размещения плитки на гриде.
   * Ищет рецепт где размещённая плитка — последний ингредиент.
   * 
   * @param placedTile - только что размещённая плитка
   * @param col, row - координаты размещения
   * @param getTileAt - функция получения плитки по координатам (из TilesContext)
   * @returns ChainMatch | null
   */
  static findMatchingRecipe(
    placedTile: Tile,
    col: number,
    row: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): ChainMatch | null {
    // 1. Получить все рецепты где placedTile.textureKey — последний шаг
    const candidateRecipes = getRecipesWithLastIngredient(placedTile.textureKey);
    if (candidateRecipes.length === 0) {
      if (__DEV__) console.log(`[Crafting] Нет рецептов где "${placedTile.textureKey}" — последний шаг`);
      return null;
    }
    
    // 2. Проверить каждый рецепт (по приоритету)
    for (const recipe of candidateRecipes) {
      const match = this.validateChain(recipe, placedTile, col, row, getTileAt);
      if (match) {
        if (__DEV__) console.log(`[Crafting] ✅ Рецепт найден: ${recipe.id}`, {
          sequence: recipe.sequence,
          matchedTiles: match.matchedTiles.map(t => ({
            texture: t.tile.textureKey,
            pos: `${t.col},${t.row}`,
            activeSide: (t.tile as any).activeSide,
          })),
        });
        return match;
      }
    }
    
    if (__DEV__) console.log(`[Crafting] ❌ Ни один рецепт не подошел для "${placedTile.textureKey}"`);
    return null;
  }
  
  // --------------------------------------------------------------------------
  // ПРИВАТНЫЙ МЕТОД: Валидация цепочки для конкретного рецепта
  // --------------------------------------------------------------------------
  /**
   * Проверяет: образует ли размещённая плитка + соседи валидную цепочку для рецепта.
   * Идёт ОБРАТНО от последнего шага к первому, проверяя активные стороны.
   */
  private static validateChain(
    recipe: Recipe,
    lastTile: Tile,
    lastCol: number,
    lastRow: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): ChainMatch | null {
    const sequence = recipe.sequence;
    const matchedTiles: MatchedTile[] = [];
    
    // Шаг 1: Последний ингредиент (уже размещённая плитка)
    matchedTiles.push({
      tile: lastTile,
      col: lastCol,
      row: lastRow,
      sequenceIndex: sequence.length - 1,
    });
    
    // Шаг 2: Идём назад по цепочке (от N-1 к 0)
    let currentCol = lastCol;
    let currentRow = lastRow;
    
    for (let step = sequence.length - 2; step >= 0; step--) {
      const expectedTexture = sequence[step];
      
      // Ищем среди 4 соседей текущей позиции
      const neighbors = getNeighborPositions(currentCol, currentRow);
      let found = false;
      
      for (const neighbor of neighbors) {
        const neighborInfo = getTileAt(neighbor.col, neighbor.row);
        if (!neighborInfo) continue;
        
        const neighborTile = neighborInfo.tile;
        
        // Проверка 1: Текстура совпадает?
        if (neighborTile.textureKey !== expectedTexture) continue;
        
        // ======================================================================
        // 🔑 ИСПРАВЛЕНИЕ: Проверка относительной связи
        // ======================================================================
        // Вместо проверки конкретного направления (right/top/etc),
        // проверяем: указывает ли activeSide соседа НА текущую позицию?
        // ======================================================================
        if (!this.doesActiveSidePointTo(neighborTile, neighbor.col, neighbor.row, currentCol, currentRow)) {
          continue;
        }
        
        // Проверка 3: Плитка ещё не использована в этой цепочке?
        if (matchedTiles.some(m => m.tile.id === neighborTile.id)) continue;
        
        // ✅ Все проверки пройдены
        matchedTiles.push({
          tile: neighborTile,
          col: neighbor.col,
          row: neighbor.row,
          sequenceIndex: step,
        });
        
        // Переходим к следующей итерации
        currentCol = neighbor.col;
        currentRow = neighbor.row;
        found = true;
        break;
      }
      
      // Если не нашли подходящий сосед для этого шага — рецепт не подходит
      if (!found) {
        if (__DEV__) console.log(`[Crafting] Шаг ${step} ("${expectedTexture}") не найден для рецепта ${recipe.id}`);
        return null;
      }
    }
    
    // ✅ Вся цепочка валидна! Сортируем по порядку рецепта (0, 1, 2...)
    matchedTiles.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    
    const resultPosition = this.calculateResultPosition(recipe, matchedTiles);
    
    return {
      recipe,
      matchedTiles,
      resultPosition,
    };
  }

  // ============================================================================
  // 🔑 ИСПРАВЛЕННЫЙ МЕТОД: Проверка — указывает ли activeSide НА целевую ячейку
  // ============================================================================
  private static doesActiveSidePointTo(
    tile: Tile,
    tileCol: number,
    tileRow: number,
    targetCol: number,
    targetRow: number
  ): boolean {
    // Если у плитки нет activeSide — она не может участвовать в упорядоченных рецептах
    const activeSide = (tile as any).activeSide as Edge | undefined;
    if (!activeSide) return false;
    
    // Вычисляем куда "смотрит" activeSide с учётом поворота плитки
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const baseIndex = edges.indexOf(activeSide);
    const steps = tile.rotation / 90;
    const finalIndex = (baseIndex + steps) % 4;
    const finalEdge = edges[finalIndex];
    
    // Вычисляем целевую позицию на основе finalEdge
    let expectedTargetCol = tileCol;
    let expectedTargetRow = tileRow;
    
    switch (finalEdge) {
      case 'top': expectedTargetRow--; break;
      case 'bottom': expectedTargetRow++; break;
      case 'left': expectedTargetCol--; break;
      case 'right': expectedTargetCol++; break;
    }
    
    // Сравниваем с целевой позицией
    return expectedTargetCol === targetCol && expectedTargetRow === targetRow;
  }

  
  // --------------------------------------------------------------------------
  // ПРИВАТНЫЙ МЕТОД: Расчёт позиции для результирующей плитки
  // --------------------------------------------------------------------------
  private static calculateResultPosition(
    recipe: Recipe,
    matchedTiles: MatchedTile[]
  ): { col: number; row: number } {
    const strategy = recipe.execution?.resultPosition ?? 'last';
    
    switch (strategy) {
      case 'first':
        return { col: matchedTiles[0].col, row: matchedTiles[0].row };
      
      case 'center':
        // Для чётного количества — берём левый центр
        const centerIndex = Math.floor(matchedTiles.length / 2);
        return { col: matchedTiles[centerIndex].col, row: matchedTiles[centerIndex].row };
      
      case 'last':
      default:
        return { col: matchedTiles[matchedTiles.length - 1].col, row: matchedTiles[matchedTiles.length - 1].row };
    }
  }
  
  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЙ МЕТОД: Выполнение крафта
  // --------------------------------------------------------------------------
  /**
   * Удаляет ингредиенты и создаёт результирующую плитку.
   * 
   * @param match - результат findMatchingRecipe()
   * @param callbacks - опциональные колбэки для внешней логики
   * @param tileOperations - функции для изменения состояния (из TilesContext)
   * @returns CraftResult
   */
  static executeRecipe(
    match: ChainMatch,
    tileOperations: {
      removeTile: (tileId: string) => void;
      addTile: (col: number, row: number, tile: Tile) => void;
      generateTileId: () => string;
      craftTiles?: (removeIds: string[], addInfo: { col: number; row: number; tile: Tile }) => void;
    },
    callbacks?: CraftingCallbacks
  ): CraftResult {
    const { recipe, matchedTiles, resultPosition } = match;
    const { removeTile, addTile, generateTileId, craftTiles } = tileOperations;
    
    callbacks?.onCraftStart?.(recipe, matchedTiles);
    
    // Собираем ID удаляемых плиток
    const removedIds: string[] = matchedTiles.map(mt => mt.tile.id);
    
    // Создаём результирующую плитку
    const resultTile = new Tile({
      id: generateTileId(),
      textureKey: recipe.result.textureKey,
      rotation: recipe.result.rotation ?? 0,
    });
    
    if (recipe.result.activeSide) {
      (resultTile as any).activeSide = recipe.result.activeSide;
    }
    
    // ========================================================================
    // 🔑 АТОМАРНОЕ ОБНОВЛЕНИЕ — всё за один вызов!
    // ========================================================================
    if (craftTiles) {
      // Используем новый метод
      craftTiles(removedIds, {
        col: resultPosition.col,
        row: resultPosition.row,
        tile: resultTile,
      });
    } else {
      // Fallback на старый метод (с задержкой)
      for (const id of removedIds) {
        removeTile(id);
      }
      setTimeout(() => {
        addTile(resultPosition.col, resultPosition.row, resultTile);
      }, 50);
    }
    
    // ========================================================================
    // Колбэки
    // ========================================================================
    const result: CraftResult = {
      success: true,
      recipeId: recipe.id,
      removedTileIds: removedIds,
      createdTile: {
        tile: resultTile,
        col: resultPosition.col,
        row: resultPosition.row,
      },
      chainContinues: recipe.chaining?.enabled ?? false,
      message: `Crafted ${recipe.result.textureKey} from ${recipe.sequence.join(' → ')}`,
    };
    
    callbacks?.onCraftComplete?.(result);
    
    return result;
  }
  
  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЙ МЕТОД: Проверка цепочки (рекурсивно)
  // --------------------------------------------------------------------------
  /**
   * После выполнения крафта проверяет: может ли результат участвовать в новом рецепте.
   * Вызывается рекурсивно пока есть совпадения.
   * 
   * @param resultTile - только что созданная плитка
   * @param col, row - её позиция
   * @param depth - текущая глубина цепочки (для отладки)
   * @param visitedIds - ID плиток созданных в этой цепочке (защита от зацикливания)
   * @param getTileAt, tileOperations, callbacks - как в executeRecipe
   * @returns массив результатов всех выполненных крафтов в цепочке
   */
  static checkChain(
    resultTile: Tile,
    col: number,
    row: number,
    depth: number,
    visitedIds: Set<string>,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined,
    tileOperations: {
      removeTile: (tileId: string) => void;
      addTile: (col: number, row: number, tile: Tile) => void;
      generateTileId: () => string;
    },
    callbacks?: CraftingCallbacks
  ): CraftResult[] {
    const results: CraftResult[] = [];
    
    // Защита: если плитка уже участвовала в этой цепочке — стоп
    if (visitedIds.has(resultTile.id)) {
      if (__DEV__) console.warn(`[Crafting] ⚠️ Цикл обнаружен: плитка ${resultTile.id} уже в цепочке`);
      return results;
    }
    visitedIds.add(resultTile.id);
    
    // Уведомление о начале шага цепочки
    callbacks?.onChainStart?.(resultTile, depth);
    
    // 1. Найти рецепты где resultTile может быть НЕ последним шагом
    // (т.е. она может быть шагом 1, 2, ... N-1 в новой цепочке)
    const candidateRecipes = getRecipesWhereTextureIsNotLast(resultTile.textureKey);
    if (candidateRecipes.length === 0) {
      if (__DEV__ && depth > 0) console.log(`[Crafting] 🔗 Цепочка завершена на глубине ${depth}: нет рецептов для "${resultTile.textureKey}"`);
      return results;
    }
    
    // 2. Для каждого рецепта проверить: может ли resultTile быть частью цепочки
    // Здесь логика сложнее: resultTile может быть на любой позиции кроме последней
    for (const recipe of candidateRecipes) {
      // Ищем позицию resultTile в последовательности рецепта
      const tileIndex = recipe.sequence.indexOf(resultTile.textureKey);
      if (tileIndex === -1 || tileIndex === recipe.sequence.length - 1) continue;
      
      // Проверяем: может ли resultTile быть "якорем" для этого рецепта
      // Для этого нужно проверить соседей в обоих направлениях:
      // - Вперёд: ищем шаг tileIndex+1, tileIndex+2... до конца
      // - Назад: ищем шаг tileIndex-1, tileIndex-2... до начала
      
      const match = this.validateChainFromAnchor(
        recipe,
        tileIndex,
        resultTile,
        col,
        row,
        getTileAt
      );
      
      if (match) {
        // ✅ Рецепт подходит — выполняем крафт
        const craftResult = this.executeRecipe(match, tileOperations, callbacks);
        results.push(craftResult);
        
        // Если крафт успешен и цепочка может продолжаться — рекурсивный вызов
        if (craftResult.success && craftResult.chainContinues && craftResult.createdTile) {
          const delay = recipe.chaining?.delayBetweenSteps ?? 150;
          
          // В реальном приложении здесь был бы setTimeout для анимации
          // Для синхронного теста вызываем сразу:
          const chainResults = this.checkChain(
            craftResult.createdTile.tile,
            craftResult.createdTile.col,
            craftResult.createdTile.row,
            depth + 1,
            visitedIds,
            getTileAt,
            tileOperations,
            callbacks
          );
          results.push(...chainResults);
        }
        
        // После первого успешного крафта выходим (один результат за раз)
        break;
      }
    }
    
    return results;
  }
  
  // --------------------------------------------------------------------------
  // ПРИВАТНЫЙ МЕТОД: Валидация цепочки от "якорной" плитки
  // --------------------------------------------------------------------------
  /**
   * Специальная версия validateChain для когда плитка может быть в середине последовательности.
   * Проверяет соседей в обоих направлениях от якоря.
   */
  private static validateChainFromAnchor(
    recipe: Recipe,
    anchorIndex: number,  // Позиция anchorTile в recipe.sequence
    anchorTile: Tile,
    anchorCol: number,
    anchorRow: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): ChainMatch | null {
    const sequence = recipe.sequence;
    const matchedTiles: MatchedTile[] = [];
    
    // Шаг 1: Добавить якорную плитку
    matchedTiles.push({
      tile: anchorTile,
      col: anchorCol,
      row: anchorRow,
      sequenceIndex: anchorIndex,
    });
    
    // Шаг 2: Идём ВПЕРЁД от якоря (к последнему шагу рецепта)
    let currentCol = anchorCol;
    let currentRow = anchorRow;
    
    for (let step = anchorIndex + 1; step < sequence.length; step++) {
      const expectedTexture = sequence[step];
      const found = this.findNextInChain(expectedTexture, currentCol, currentRow, getTileAt, matchedTiles);
      
      if (!found) return null;
      currentCol = found.col;
      currentRow = found.row;
      
      matchedTiles.push({
        tile: found.tile,
        col: found.col,
        row: found.row,
        sequenceIndex: step,
      });
    }
    
    // Шаг 3: Идём НАЗАД от якоря (к первому шагу рецепта)
    currentCol = anchorCol;
    currentRow = anchorRow;
    
    for (let step = anchorIndex - 1; step >= 0; step--) {
      const expectedTexture = sequence[step];
      const found = this.findPrevInChain(expectedTexture, currentCol, currentRow, getTileAt, matchedTiles);
      
      if (!found) return null;
      currentCol = found.col;
      currentRow = found.row;
      
      matchedTiles.push({
        tile: found.tile,
        col: found.col,
        row: found.row,
        sequenceIndex: step,
      });
    }
    
    // ✅ Вся цепочка собрана
    matchedTiles.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    const resultPosition = this.calculateResultPosition(recipe, matchedTiles);
    
    return { recipe, matchedTiles, resultPosition };
  }
  
  // ============================================================================
  // 🔑 ИСПРАВЛЕННЫЙ МЕТОД: Поиск следующего шага в цепочке (вперёд)
  // ============================================================================
  private static findNextInChain(
    expectedTexture: string,
    fromCol: number,
    fromRow: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined,
    excludeTiles: MatchedTile[]
  ): { tile: Tile; col: number; row: number } | null {
    const neighbors = getNeighborPositions(fromCol, fromRow);
    
    for (const neighbor of neighbors) {
      const neighborInfo = getTileAt(neighbor.col, neighbor.row);
      if (!neighborInfo) continue;
      
      const neighborTile = neighborInfo.tile;
      
      // Проверка 1: Текстура совпадает?
      if (neighborTile.textureKey !== expectedTexture) continue;
      
      // Проверка 2: Плитка ещё не использована?
      if (excludeTiles.some(m => m.tile.id === neighborTile.id)) continue;
      
      // ======================================================================
      // 🔑 Ключевое: activeSide ТЕКУЩЕЙ плитки должна указывать НА соседа
      // ======================================================================
      const fromTileInfo = getTileAt(fromCol, fromRow);
      if (!fromTileInfo) continue;
      
      if (!this.doesActiveSidePointTo(fromTileInfo.tile, fromCol, fromRow, neighbor.col, neighbor.row)) {
        continue;
      }
      
      return { tile: neighborTile, col: neighbor.col, row: neighbor.row };
    }
    
    return null;
  }
  
  // ============================================================================
  // 🔑 ИСПРАВЛЕННЫЙ МЕТОД: Поиск предыдущего шага в цепочке (назад)
  // ============================================================================
  private static findPrevInChain(
    expectedTexture: string,
    fromCol: number,
    fromRow: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined,
    excludeTiles: MatchedTile[]
  ): { tile: Tile; col: number; row: number } | null {
    const neighbors = getNeighborPositions(fromCol, fromRow);
    
    for (const neighbor of neighbors) {
      const neighborInfo = getTileAt(neighbor.col, neighbor.row);
      if (!neighborInfo) continue;
      
      const neighborTile = neighborInfo.tile;
      
      // Проверки
      if (neighborTile.textureKey !== expectedTexture) continue;
      if (excludeTiles.some(m => m.tile.id === neighborTile.id)) continue;
      
      // ======================================================================
      // 🔑 Ключевое: activeSide СОСЕДА должна указывать НА текущую плитку
      // ======================================================================
      if (!this.doesActiveSidePointTo(neighborTile, neighbor.col, neighbor.row, fromCol, fromRow)) {
        continue;
      }
      
      return { tile: neighborTile, col: neighbor.col, row: neighbor.row };
    }
    
    return null;
  }

  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЙ МЕТОД: Полная обработка размещения плитки
  // --------------------------------------------------------------------------
  /**
   * Высокоуровневый метод: проверка + выполнение + цепочка.
   * Удобно для вызова из useCrafting хука.
   */
  static onTilePlaced(
    placedTile: Tile,
    col: number,
    row: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined,
    tileOperations: {
      removeTile: (tileId: string) => void;
      addTile: (col: number, row: number, tile: Tile) => void;
      generateTileId: () => string;
      craftTiles?: (  // ← 🔑 НОВОЕ: опциональный метод
        removeIds: string[],
        addInfo: { col: number; row: number; tile: Tile }
      ) => void;
    },
    callbacks?: CraftingCallbacks
  ): { crafted: boolean; results: CraftResult[] } {
    // 1. Проверить рецепт
    const match = this.findMatchingRecipe(placedTile, col, row, getTileAt);
    if (!match) {
      return { crafted: false, results: [] };
    }
    
    // 2. Выполнить крафт
    const firstResult = this.executeRecipe(match, tileOperations, callbacks);
    const results: CraftResult[] = [firstResult];
    
    // 3. Если цепочка может продолжаться — проверить рекурсивно
    if (firstResult.chainContinues && firstResult.createdTile) {
      const visitedIds = new Set<string>(firstResult.removedTileIds);
      
      const chainResults = this.checkChain(
        firstResult.createdTile.tile,
        firstResult.createdTile.col,
        firstResult.createdTile.row,
        1,  // depth
        visitedIds,
        getTileAt,
        tileOperations,
        callbacks
      );
      results.push(...chainResults);
    }
    
    return { crafted: true, results };
  }
}

export default CraftingService;
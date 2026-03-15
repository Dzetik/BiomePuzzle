// ============================================================================
// СЕРВИС КРАФТА — ЯДРО ЛОГИКИ
// ============================================================================
// Отвечает за:
// - Поиск рецептов при размещении плитки (на ЛЮБОЙ позиции в цепочке)
// - Валидацию цепочек через активные стороны плиток (с учётом rotation!)
// - Выполнение крафта (удаление ингредиентов + создание результата)
// - Рекурсивную проверку цепочек (результат → новый стартер)
// ============================================================================

import { Tile } from '../models/Tile';
import { Edge } from '../models/Tile.types';
import { Recipe, RECIPES } from '../constants/recipes';
import { PlacedTileInfo } from '../context/TilesContext';
import { CRAFTING_CONFIG } from '../constants/CraftingConfig';

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

const MAX_CHAIN_DEPTH = CRAFTING_CONFIG.maxChainDepth ?? 10;

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
  createdTile?: {
    tile: Tile;
    col: number;
    row: number;
  };
  chainContinues: boolean;  // Нужно ли проверять цепочку дальше
  message?: string;
}

/**
 * Колбэки для внешней логики
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
 */
const getDirectionFromTo = (
  fromCol: number, fromRow: number,
  toCol: number, toRow: number
): Edge | null => {
  const dx = toCol - fromCol;
  const dy = toRow - fromRow;
  
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'bottom';
  if (dx === 0 && dy === -1) return 'top';
  
  return null;
};

/**
 * Повернуть направление с учётом rotation плитки (0, 90, 180, 270)
 * activeSide хранится в локальных координатах плитки, rotation — поворот по часовой
 */
const rotateDirection = (direction: Edge, rotation: number): Edge => {
  const rotations = Math.round((rotation ?? 0) / 90) % 4;
  const directions: Edge[] = ['top', 'right', 'bottom', 'left'];
  const currentIndex = directions.indexOf(direction);
  if (currentIndex === -1) return direction;
  const newIndex = (currentIndex + rotations + 4) % 4;
  return directions[newIndex];
};

/**
 * Проверить: указывает ли activeSide плитки (с учётом rotation) НА целевую ячейку
 */
const doesActiveSidePointTo = (
  tile: Tile,
  tileCol: number, tileRow: number,
  targetCol: number, targetRow: number
): boolean => {
  const activeSide = (tile as any).activeSide as Edge | undefined;
  if (!activeSide) return false;
  
  // 🔑 Применяем rotation к activeSide для получения реального направления на сетке
  const actualDirection = rotateDirection(activeSide, tile.rotation ?? 0);
  
  let expectedTargetCol = tileCol;
  let expectedTargetRow = tileRow;
  
  switch (actualDirection) {
    case 'top': expectedTargetRow--; break;
    case 'bottom': expectedTargetRow++; break;
    case 'left': expectedTargetCol--; break;
    case 'right': expectedTargetCol++; break;
  }
  
  return expectedTargetCol === targetCol && expectedTargetRow === targetRow;
};

/**
 * Получить соседние ячейки в порядке приоритета
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
  
  // Кэш рецептов по textureKey для оптимизации поиска
  private static recipeCache = new Map<string, Recipe[]>();
  
  // ============================================================================
  // ПУБЛИЧНЫЙ МЕТОД: Очистка кэша рецептов (при горячем обновлении)
  // ============================================================================
  static invalidateRecipeCache(): void {
    this.recipeCache.clear();
  }
  
  // ============================================================================
  // ПУБЛИЧНЫЙ МЕТОД: Проверка рецепта при размещении плитки
  // ============================================================================
  /**
   * Вызывается после размещения плитки на гриде.
   * Ищет ЛЮБУЮ валидную цепочку где размещённая плитка — ЛЮБОЙ шаг рецепта.
   * Порядок размещения НЕ важен — важна только финальная расстановка на поле.
   * 
   * 🔑 Плитки должны указывать activeSide (с учётом rotation) на следующий шаг!
   */
  static findMatchingRecipe(
    placedTile: Tile,
    col: number,
    row: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): ChainMatch | null {
    // 1. Получаем ВСЕ рецепты где есть эта текстура (не только последние!)
    const candidateRecipes = this.getRecipesWithTexture(placedTile.textureKey);
    
    if (candidateRecipes.length === 0) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] Нет рецептов где есть "${placedTile.textureKey}"`);
      }
      return null;
    }
    
    // 2. Проверяем каждый рецепт где плитка может быть на ЛЮБОЙ позиции
    for (const recipe of candidateRecipes) {
      // Находим все позиции где textureKey встречается в рецепте
      const possiblePositions = this.findAllPositionsInSequence(
        recipe.sequence,
        placedTile.textureKey
      );
      
      // Проверяем каждую возможную позицию
      for (const positionIndex of possiblePositions) {
        const match = this.validateChainFromPosition(
          recipe,
          positionIndex,
          placedTile,
          col,
          row,
          getTileAt
        );
        
        if (match) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(`[Crafting] ✅ Рецепт найден: ${recipe.id}`, {
              sequence: recipe.sequence,
              placedTilePosition: positionIndex,
              matchedTiles: match.matchedTiles.map(t => ({
                texture: t.tile.textureKey,
                pos: `${t.col},${t.row}`,
                activeSide: (t.tile as any).activeSide,
                rotation: t.tile.rotation,
              })),
            });
          }
          return match;
        }
      }
    }
    
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[Crafting] ❌ Ни один рецепт не подошел для "${placedTile.textureKey}"`);
    }
    return null;
  }
  
  // ============================================================================
  // ПРИВАТНЫЙ МЕТОД: Получить все рецепты где текстура есть в sequence
  // ============================================================================
  private static getRecipesWithTexture(textureKey: string): Recipe[] {
    // Проверяем кэш
    if (this.recipeCache.has(textureKey)) {
      return this.recipeCache.get(textureKey)!;
    }
    
    // Вычисляем и кэшируем
    const recipes = RECIPES.filter(recipe => 
      recipe.sequence.includes(textureKey)
    ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    this.recipeCache.set(textureKey, recipes);
    return recipes;
  }
  
  // ============================================================================
  // ПРИВАТНЫЙ МЕТОД: Найти все позиции где текстура встречается в sequence
  // ============================================================================
  private static findAllPositionsInSequence(
    sequence: string[],
    textureKey: string
  ): number[] {
    const positions: number[] = [];
    for (let i = 0; i < sequence.length; i++) {
      if (sequence[i] === textureKey) {
        positions.push(i);
      }
    }
    return positions;
  }
  
  // ============================================================================
  // ПРИВАТНЫЙ МЕТОД: Проверка цепочки от размещённой плитки на ЛЮБОЙ позиции
  // ============================================================================
  /**
   * Проверяет: образует ли размещённая плитка + соседи валидную цепочку
   * где размещённая плитка находится на указанной позиции в рецепте.
   * 
   * 🔑 Проверяет направления activeSide с учётом rotation каждой плитки!
   */
  private static validateChainFromPosition(
    recipe: Recipe,
    placedTilePosition: number,
    placedTile: Tile,
    placedCol: number,
    placedRow: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): ChainMatch | null {
    const sequence = recipe.sequence;
    const matchedTiles: MatchedTile[] = [];
    
    // Добавляем размещённую плитку
    matchedTiles.push({
      tile: placedTile,
      col: placedCol,
      row: placedRow,
      sequenceIndex: placedTilePosition,
    });
    
    // ========================================================================
    // Проверяем ВПЕРЁД от размещённой плитки (к следующим шагам рецепта)
    // 🔑 activeSide ТЕКУЩЕЙ плитки (с учётом rotation) должна указывать НА соседа
    // ========================================================================
    let currentCol = placedCol;
    let currentRow = placedRow;
    
    for (let step = placedTilePosition + 1; step < sequence.length; step++) {
      const expectedTexture = sequence[step];
      const found = this.findNextInChain(
        expectedTexture,
        currentCol,
        currentRow,
        getTileAt,
        matchedTiles
      );
      
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
    
    // ========================================================================
    // Проверяем НАЗАД от размещённой плитки (к предыдущим шагам рецепта)
    // 🔑 activeSide СОСЕДА (с учётом rotation) должна указывать НА текущую плитку
    // ========================================================================
    currentCol = placedCol;
    currentRow = placedRow;
    
    for (let step = placedTilePosition - 1; step >= 0; step--) {
      const expectedTexture = sequence[step];
      const found = this.findPrevInChain(
        expectedTexture,
        currentCol,
        currentRow,
        getTileAt,
        matchedTiles
      );
      
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
    
    // 🔍 Валидация: длина цепочки должна совпадать с рецептом
    if (matchedTiles.length !== sequence.length) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Crafting] ❌ Несоответствие длины цепочки: ожидалось ${sequence.length}, получено ${matchedTiles.length}`);
      }
      return null;
    }
    
    // ✅ Вся цепочка собрана
    matchedTiles.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    const resultPosition = this.calculateResultPosition(recipe, matchedTiles);
    
    return { recipe, matchedTiles, resultPosition };
  }
  
  // ============================================================================
  // ПРИВАТНЫЙ МЕТОД: Поиск следующего шага в цепочке (вперёд)
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
      
      // Проверка 3: activeSide ТЕКУЩЕЙ плитки (с учётом rotation!) должна указывать НА соседа
      const fromTileInfo = getTileAt(fromCol, fromRow);
      if (!fromTileInfo) continue;
      
      const isValidDirection = doesActiveSidePointTo(fromTileInfo.tile, fromCol, fromRow, neighbor.col, neighbor.row);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] 🔍 Проверка направления (вперёд):`, {
          from: `${fromCol},${fromRow}`,
          activeSide: (fromTileInfo.tile as any).activeSide,
          rotation: fromTileInfo.tile.rotation,
          to: `${neighbor.col},${neighbor.row}`,
          expectedTexture,
          foundTexture: neighborTile.textureKey,
          valid: isValidDirection,
        });
      }
      
      if (!isValidDirection) {
        continue;
      }
      
      return { tile: neighborTile, col: neighbor.col, row: neighbor.row };
    }
    
    return null;
  }
  
  // ============================================================================
  // ПРИВАТНЫЙ МЕТОД: Поиск предыдущего шага в цепочке (назад)
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
      
      // Проверка 1: Текстура совпадает?
      if (neighborTile.textureKey !== expectedTexture) continue;
      
      // Проверка 2: Плитка ещё не использована?
      if (excludeTiles.some(m => m.tile.id === neighborTile.id)) continue;
      
      // Проверка 3: activeSide СОСЕДА (с учётом rotation!) должна указывать НА текущую плитку
      const isValidDirection = doesActiveSidePointTo(neighborTile, neighbor.col, neighbor.row, fromCol, fromRow);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] 🔍 Проверка направления (назад):`, {
          from: `${neighbor.col},${neighbor.row}`,
          activeSide: (neighborTile as any).activeSide,
          rotation: neighborTile.rotation,
          to: `${fromCol},${fromRow}`,
          expectedTexture,
          foundTexture: neighborTile.textureKey,
          valid: isValidDirection,
        });
      }
      
      if (!isValidDirection) {
        continue;
      }
      
      return { tile: neighborTile, col: neighbor.col, row: neighbor.row };
    }
    
    return null;
  }
  
  // ============================================================================
  // ПРИВАТНЫЙ МЕТОД: Расчёт позиции для результирующей плитки
  // ============================================================================
  private static calculateResultPosition(
    recipe: Recipe,
    matchedTiles: MatchedTile[]
  ): { col: number; row: number } {
    const strategy = recipe.execution?.resultPosition ?? 'last';
    
    switch (strategy) {
      case 'first':
        return { col: matchedTiles[0].col, row: matchedTiles[0].row };
      
      case 'center':
        const centerIndex = Math.floor(matchedTiles.length / 2);
        return { col: matchedTiles[centerIndex].col, row: matchedTiles[centerIndex].row };
      
      case 'last':
      default:
        return { col: matchedTiles[matchedTiles.length - 1].col, row: matchedTiles[matchedTiles.length - 1].row };
    }
  }
  
  // ============================================================================
  // ПУБЛИЧНЫЙ МЕТОД: Выполнение крафта
  // ============================================================================
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
    
    const removedIds: string[] = matchedTiles.map(mt => mt.tile.id);
    
    // Создаём результирующую плитку с activeSide сразу в конструкторе
    const resultTile = new Tile({
      id: generateTileId(),
      textureKey: recipe.result.textureKey,
      rotation: recipe.result.rotation ?? 0,
      activeSide: recipe.result.activeSide,
    });
    
    // ========================================================================
    // АТОМАРНОЕ ОБНОВЛЕНИЕ (если доступно)
    // ========================================================================
    const usedCraftTiles = !!craftTiles;
    
    if (craftTiles) {
      craftTiles(removedIds, {
        col: resultPosition.col,
        row: resultPosition.row,
        tile: resultTile,
      });
    } else {
      // Fallback на раздельные вызовы
      for (const id of removedIds) {
        removeTile(id);
      }
      addTile(resultPosition.col, resultPosition.row, resultTile);
    }
    
    const chainEnabled = recipe.chaining?.enabled ?? false;
    const chainContinues = chainEnabled && this.getRecipesWhereTextureIsNotLast(recipe.result.textureKey).length > 0;
    
    const result: CraftResult = {
      success: true,
      recipeId: recipe.id,
      removedTileIds: removedIds,
      createdTile: {
        tile: resultTile,
        col: resultPosition.col,
        row: resultPosition.row,
      },
      chainContinues,
      message: `Crafted ${recipe.result.textureKey} from ${recipe.sequence.join(' → ')}`,
    };
    
    callbacks?.onCraftComplete?.(result);
    
    return result;
  }
  
  // ============================================================================
  // ПУБЛИЧНЫЙ МЕТОД: Проверка цепочки (рекурсивно)
  // ============================================================================
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
      craftTiles?: (removeIds: string[], addInfo: { col: number; row: number; tile: Tile }) => void;
    },
    callbacks?: CraftingCallbacks
  ): CraftResult[] {
    const results: CraftResult[] = [];
    
    // 🔒 Защита от зацикливания
    if (visitedIds.has(resultTile.id)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Crafting] ⚠️ Цикл обнаружен: плитка ${resultTile.id} уже в цепочке`);
      }
      return results;
    }
    visitedIds.add(resultTile.id);
    
    // 🔒 Защита от переполнения стека (лимит глубины)
    if (depth >= MAX_CHAIN_DEPTH) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Crafting] ⚠️ Достигнут лимит глубины цепочки: ${depth} (max: ${MAX_CHAIN_DEPTH})`);
      }
      return results;
    }
    
    callbacks?.onChainStart?.(resultTile, depth);
    
    const candidateRecipes = this.getRecipesWhereTextureIsNotLast(resultTile.textureKey);
    if (candidateRecipes.length === 0) {
      if (typeof __DEV__ !== 'undefined' && __DEV__ && depth > 0) {
        console.log(`[Crafting] 🔗 Цепочка завершена на глубине ${depth}`);
      }
      return results;
    }
    
    const getTileAtWithResult: (c: number, r: number) => PlacedTileInfo | undefined = (c, r) => {
      if (c === col && r === row) {
        return { tile: resultTile, col: c, row: r };
      }
      return getTileAt(c, r);
    };
    
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[Crafting] 🔗 checkChain глубина ${depth}:`, {
        texture: resultTile.textureKey,
        pos: `${col},${row}`,
        activeSide: resultTile.activeSide,
        rotation: resultTile.rotation,
        candidateRecipes: candidateRecipes.map(r => r.id),
      });
    }
    
    for (const recipe of candidateRecipes) {
      // 🔑 FIX: Проверяем ВСЕ позиции где текстура встречается в рецепте
      // (а не только первую через indexOf)
      const possiblePositions = this.findAllPositionsInSequence(
        recipe.sequence,
        resultTile.textureKey
      );
      
      for (const tileIndex of possiblePositions) {
        // Пропускаем если текстура на последней позиции (не может быть ингредиентом)
        if (tileIndex === recipe.sequence.length - 1) continue;
        
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[Crafting] 🔍 Проверка позиции ${tileIndex} в рецепте ${recipe.id}:`, {
            sequence: recipe.sequence,
            expectedNext: recipe.sequence[tileIndex + 1],
          });
        }
        
        const match = this.validateChainFromPosition(
          recipe,
          tileIndex,
          resultTile,
          col,
          row,
          getTileAtWithResult  // ← 🔑 используем обёртку с resultTile
        );
        
        if (match) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(`[Crafting] ✅ Цепочка найдена для ${recipe.id}:`, {
              matchedTiles: match.matchedTiles.map(t => `${t.tile.textureKey}@${t.col},${t.row}`),
            });
          }
          
          const craftResult = this.executeRecipe(match, tileOperations, callbacks);
          results.push(craftResult);
          
          if (craftResult.success && craftResult.chainContinues && craftResult.createdTile) {
            const chainResults = this.checkChain(
              craftResult.createdTile.tile,
              craftResult.createdTile.col,
              craftResult.createdTile.row,
              depth + 1,
              visitedIds,
              getTileAt, // для следующих уровней используем оригинальный getTileAt
              tileOperations,
              callbacks
            );
            results.push(...chainResults);
          }
          
          break; // рецепт найден, переходим к следующему
        }
      }
    }
    
    return results;
  }
  
  // ============================================================================
  // ПРИВАТНЫЙ МЕТОД: Рецепты где текстура НЕ последняя (для цепочек)
  // ============================================================================
  private static getRecipesWhereTextureIsNotLast(textureKey: string): Recipe[] {
    return RECIPES.filter(recipe => {
      const lastIndex = recipe.sequence.length - 1;
      const index = recipe.sequence.indexOf(textureKey);
      return index !== -1 && index !== lastIndex;
    }).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
  
  // ============================================================================
  // ПУБЛИЧНЫЙ МЕТОД: Полная обработка размещения плитки
  // ============================================================================
  /**
   * 🔑 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ:
   * 1. Проверяем цепочки где размещённая плитка — часть рецепта (оригинальная логика)
   * 2. 🔥 ДОПОЛНИТЕЛЬНО: проверяем всех соседей — если их activeSide (с rotation) 
   *    указывает на размещённую плитку, запускаем валидацию от этого соседа.
   *    Это позволяет размещать плитки в любом порядке: если новая плитка "замыкает"
   *    цепочку, которую "ждал" сосед — крафт сработает.
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
      craftTiles?: (removeIds: string[], addInfo: { col: number; row: number; tile: Tile }) => void;
    },
    callbacks?: CraftingCallbacks
  ): { crafted: boolean; results: CraftResult[] } {
    const results: CraftResult[] = [];
    const checkedRecipes = new Set<string>();
    
    // ------------------------------------------------------------------------
    // 1️⃣ Проверяем цепочки где размещённая плитка — часть рецепта
    // ------------------------------------------------------------------------
    const primaryMatch = this.findMatchingRecipe(placedTile, col, row, getTileAt);
    if (primaryMatch) {
      checkedRecipes.add(primaryMatch.recipe.id);
      const firstResult = this.executeRecipe(primaryMatch, tileOperations, callbacks);
      results.push(firstResult);
      
      // 🔑 FIX: Вызываем checkChain только если chainContinues=true И есть createdTile
      if (firstResult.chainContinues && firstResult.createdTile) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[Crafting] 🔗 Запускаем checkChain для созданной плитки:`, {
            texture: firstResult.createdTile.tile.textureKey,
            pos: `${firstResult.createdTile.col},${firstResult.createdTile.row}`,
            activeSide: firstResult.createdTile.tile.activeSide,
          });
        }
        
        const visitedIds = new Set<string>(firstResult.removedTileIds);
        
        // 🔑 FIX: Создаём обёртку getTileAt, которая гарантированно вернёт созданную плитку
        const getTileAtWithResult: (c: number, r: number) => PlacedTileInfo | undefined = (c, r) => {
          if (c === firstResult.createdTile!.col && r === firstResult.createdTile!.row) {
            return { tile: firstResult.createdTile!.tile, col: c, row: r };
          }
          return getTileAt(c, r);
        };
        
        const chainResults = this.checkChain(
          firstResult.createdTile.tile,
          firstResult.createdTile.col,
          firstResult.createdTile.row,
          1,
          visitedIds,
          getTileAtWithResult,  // ← 🔑 используем обёртку!
          tileOperations,
          callbacks
        );
        results.push(...chainResults);
      }
    }
    
    // ------------------------------------------------------------------------
    // 2️⃣ Проверяем соседей: если их activeSide указывает на размещённую плитку
    // ------------------------------------------------------------------------
    const neighbors = getNeighborPositions(col, row);
    for (const neighbor of neighbors) {
      const neighborInfo = getTileAt(neighbor.col, neighbor.row);
      if (!neighborInfo) continue;
      
      const neighborTile = neighborInfo.tile;
      
      if (!doesActiveSidePointTo(neighborTile, neighbor.col, neighbor.row, col, row)) {
        continue;
      }
      
      const neighborMatch = this.findMatchingRecipe(neighborTile, neighbor.col, neighbor.row, getTileAt);
      
      if (!neighborMatch || checkedRecipes.has(neighborMatch.recipe.id)) {
        continue;
      }
      
      checkedRecipes.add(neighborMatch.recipe.id);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] 🎯 Сосед ${neighborTile.textureKey}@${neighbor.col},${neighbor.row} указывает на новую плитку`);
      }
      
      const craftResult = this.executeRecipe(neighborMatch, tileOperations, callbacks);
      results.push(craftResult);
      
      if (craftResult.chainContinues && craftResult.createdTile) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[Crafting] 🔗 Запускаем checkChain для созданной плитки (от соседа):`, {
            texture: craftResult.createdTile.tile.textureKey,
            pos: `${craftResult.createdTile.col},${craftResult.createdTile.row}`,
          });
        }
        
        const visitedIds = new Set<string>([...craftResult.removedTileIds, craftResult.createdTile.tile.id]);
        
        const getTileAtWithResult: (c: number, r: number) => PlacedTileInfo | undefined = (c, r) => {
          if (c === craftResult.createdTile!.col && r === craftResult.createdTile!.row) {
            return { tile: craftResult.createdTile!.tile, col: c, row: r };
          }
          return getTileAt(c, r);
        };
        
        const chainResults = this.checkChain(
          craftResult.createdTile.tile,
          craftResult.createdTile.col,
          craftResult.createdTile.row,
          1,
          visitedIds,
          getTileAtWithResult,  // ← 🔑 используем обёртку!
          tileOperations,
          callbacks
        );
        results.push(...chainResults);
      }
    }
    
    return { crafted: results.length > 0, results };
  }
}

export default CraftingService;
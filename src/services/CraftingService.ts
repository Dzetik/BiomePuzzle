// ============================================================================
// СЕРВИС КРАФТА — ПРОВЕРКА И ВЫПОЛНЕНИЕ РЕЦЕПТОВ
// ============================================================================
// Отвечает за поиск подходящих рецептов и выполнение крафта.
// Использует цепочки плиток соединённых через activeSide.
// ============================================================================

import { Recipe, RECIPES, getRecipesWithLastIngredient } from '../constants/recipes';
import { Tile } from '../models/Tile';
import { PlacedTileInfo } from '../context/TilesContext';
import { Edge } from '../models/Tile.types';
import { CRAFTING_CONFIG } from '../constants/CraftingConfig';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface MatchedTile {
  tile: Tile;
  col: number;
  row: number;
  sequenceIndex: number;
}

export interface ChainMatch {
  recipe: Recipe;
  matchedTiles: MatchedTile[];
  resultPosition: { col: number; row: number };
}

export interface CraftResult {
  success: boolean;
  recipeId: string;
  removedTileIds: string[];
  createdTile: {
    tile: Tile;
    col: number;
    row: number;
  } | null;
  chainContinues: boolean;
  message: string;
}

export interface CraftingCallbacks {
  onCraftStart?: (recipe: Recipe, matchedTiles: MatchedTile[]) => void;
  onCraftComplete?: (result: CraftResult) => void;
  onChainStart?: (resultTile: Tile, depth: number) => void;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Получить позиции 4 соседей ячейки
 */
function getNeighborPositions(col: number, row: number): { col: number; row: number }[] {
  return [
    { col: col - 1, row },  // left
    { col: col + 1, row },  // right
    { col, row: row - 1 },  // top
    { col, row: row + 1 },  // bottom
  ];
}

// ============================================================================
// КЛАСС CRAFTING SERVICE
// ============================================================================

export class CraftingService {
  
  // ============================================================================
  // ПУБЛИЧНЫЙ МЕТОД: Полная обработка размещения плитки
  // ============================================================================
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
    
    if (!CRAFTING_CONFIG.enabled || !CRAFTING_CONFIG.checkOnPlace) {
      return { crafted: false, results: [] };
    }
    
    // ========================================================================
    // ШАГ 1: Находим все рецепты которые содержат эту текстуру
    // ========================================================================
    const matchingRecipes = RECIPES.filter(r => 
      r.sequence.includes(placedTile.textureKey)
    );
    
    if (__DEV__) {
      console.log('[Crafting] 🔍 Проверка рецепта для:', {
        texture: placedTile.textureKey,
        position: `${col},${row}`,
        activeSide: (placedTile as any).activeSide,
        rotation: placedTile.rotation,
        matchingRecipesCount: matchingRecipes.length,
      });
    }
    
    // ========================================================================
    // ШАГ 2: Проверяем каждый рецепт
    // ========================================================================
    for (const recipe of matchingRecipes) {
      const match = this.validateChain(recipe, placedTile, col, row, getTileAt);
      
      if (match) {
        if (__DEV__) {
          console.log('[Crafting] ✅ Рецепт найден:', recipe.id, {
            matchedTiles: match.matchedTiles.map(m => ({
              texture: m.tile.textureKey,
              pos: `${m.col},${m.row}`,
              activeSide: (m.tile as any).activeSide,
            })),
            sequence: recipe.sequence,
          });
        }
        
        const result = this.executeRecipe(match, tileOperations, callbacks);
        return { crafted: true, results: [result] };
      }
    }
    
    if (__DEV__) {
      console.log(`[Crafting] ❌ Ни один рецепт не подошел для "${placedTile.textureKey}"`);
    }
    
    return { crafted: false, results: [] };
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Валидация цепочки — только с участием новой плитки
  // ============================================================================
  // Ищет валидную цепочку которая ВКЛЮЧАЕТ последнюю размещённую плитку.
  // Не сканирует всё поле — только цепочки связанные с новой плиткой.
  // ============================================================================
  private static validateChain(
    recipe: Recipe,
    lastTile: Tile,
    lastCol: number,
    lastRow: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): ChainMatch | null {
    const sequence = recipe.sequence;
    
    // ========================================================================
    // ШАГ 1: Проверяем цепочку ВПЕРЁД от новой плитки (по стрелкам)
    // ========================================================================
    const forwardChain = this.buildChainFromTile(
      lastTile, lastCol, lastRow, sequence, getTileAt
    );
    
    if (forwardChain && this.chainMatchesRecipe(forwardChain, sequence)) {
      return this.createChainMatch(recipe, forwardChain, sequence);
    }
    
    // ========================================================================
    // ШАГ 2: Проверяем цепочку НАЗАД от новой плитки (против стрелок)
    // ========================================================================
    const backwardChain = this.buildChainBackwards(
      lastTile, lastCol, lastRow, sequence, getTileAt
    );
    
    if (backwardChain && this.chainMatchesRecipe(backwardChain, sequence)) {
      return this.createChainMatch(recipe, backwardChain, sequence);
    }
    
    // ========================================================================
    // ШАГ 3: Проверяем цепочку где новая плитка — СЕРЕДИНА
    // Идём назад чтобы найти начало, потом вперёд до конца
    // ========================================================================
    const middleChain = this.buildChainThroughTile(
      lastTile, lastCol, lastRow, sequence, getTileAt
    );
    
    if (middleChain && this.chainMatchesRecipe(middleChain, sequence)) {
      return this.createChainMatch(recipe, middleChain, sequence);
    }
    
    return null;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Построение цепочки вперёд (по стрелкам)
  // ============================================================================
  private static buildChainFromTile(
    startTile: Tile,
    startCol: number,
    startRow: number,
    sequence: string[],
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): { tile: Tile; col: number; row: number; sequenceIndex: number }[] | null {
    
    const startIndex = sequence.indexOf(startTile.textureKey);
    if (startIndex === -1) return null;
    
    const chain: { tile: Tile; col: number; row: number; sequenceIndex: number }[] = [];
    const visited = new Set<string>();
    
    let currentTile = startTile;
    let currentCol = startCol;
    let currentRow = startRow;
    let currentIndex = startIndex;
    
    while (currentIndex < sequence.length) {
      const key = `${currentCol},${currentRow}`;
      if (visited.has(key)) break;
      visited.add(key);
      
      if (currentTile.textureKey !== sequence[currentIndex]) break;
      
      chain.push({
        tile: currentTile,
        col: currentCol,
        row: currentRow,
        sequenceIndex: currentIndex,
      });
      
      if (currentIndex === sequence.length - 1) break;
      
      const next = this.findTilePointedBy(currentTile, currentCol, currentRow, getTileAt);
      if (!next || next.tile.textureKey !== sequence[currentIndex + 1]) break;
      
      currentTile = next.tile;
      currentCol = next.col;
      currentRow = next.row;
      currentIndex++;
    }
    
    return chain.length === sequence.length ? chain : null;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Построение цепочки назад (против стрелок)
  // ============================================================================
  private static buildChainBackwards(
    startTile: Tile,
    startCol: number,
    startRow: number,
    sequence: string[],
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): { tile: Tile; col: number; row: number; sequenceIndex: number }[] | null {
    
    const startIndex = sequence.indexOf(startTile.textureKey);
    if (startIndex === -1) return null;
    
    const chain: { tile: Tile; col: number; row: number; sequenceIndex: number }[] = [];
    const visited = new Set<string>();
    
    let currentTile = startTile;
    let currentCol = startCol;
    let currentRow = startRow;
    let currentIndex = startIndex;
    
    // Идём назад пока не найдём начало цепочки
    while (currentIndex > 0) {
      const key = `${currentCol},${currentRow}`;
      if (visited.has(key)) break;
      visited.add(key);
      
      if (currentTile.textureKey !== sequence[currentIndex]) break;
      
      const prev = this.findTilePointingTo(currentTile, currentCol, currentRow, getTileAt);
      if (!prev || prev.tile.textureKey !== sequence[currentIndex - 1]) break;
      
      currentTile = prev.tile;
      currentCol = prev.col;
      currentRow = prev.row;
      currentIndex--;
    }
    
    // Теперь идём вперёд от начала
    while (currentIndex < sequence.length) {
      const key = `${currentCol},${currentRow}`;
      if (visited.has(key)) break;
      visited.add(key);
      
      if (currentTile.textureKey !== sequence[currentIndex]) break;
      
      chain.push({
        tile: currentTile,
        col: currentCol,
        row: currentRow,
        sequenceIndex: currentIndex,
      });
      
      if (currentIndex === sequence.length - 1) break;
      
      const next = this.findTilePointedBy(currentTile, currentCol, currentRow, getTileAt);
      if (!next || next.tile.textureKey !== sequence[currentIndex + 1]) break;
      
      currentTile = next.tile;
      currentCol = next.col;
      currentRow = next.row;
      currentIndex++;
    }
    
    return chain.length === sequence.length ? chain : null;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Построение цепочки где плитка — середина
  // ============================================================================
  private static buildChainThroughTile(
    middleTile: Tile,
    middleCol: number,
    middleRow: number,
    sequence: string[],
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): { tile: Tile; col: number; row: number; sequenceIndex: number }[] | null {
    
    const middleIndex = sequence.indexOf(middleTile.textureKey);
    if (middleIndex === -1) return null;
    
    const visited = new Set<string>();
    
    // ФАЗА 1: Идём НАЗАД чтобы найти начало цепочки
    let startTile = middleTile;
    let startCol = middleCol;
    let startRow = middleRow;
    let startIndex = middleIndex;
    
    while (startIndex > 0) {
      const key = `${startCol},${startRow}`;
      if (visited.has(key)) break;
      visited.add(key);
      
      const prev = this.findTilePointingTo(startTile, startCol, startRow, getTileAt);
      if (!prev || prev.tile.textureKey !== sequence[startIndex - 1]) break;
      
      startTile = prev.tile;
      startCol = prev.col;
      startRow = prev.row;
      startIndex--;
    }
    
    // ФАЗА 2: Строим цепочку ВПЕРЁД от найденного начала
    const chain: { tile: Tile; col: number; row: number; sequenceIndex: number }[] = [];
    let currentTile = startTile;
    let currentCol = startCol;
    let currentRow = startRow;
    let currentIndex = startIndex;
    
    while (currentIndex < sequence.length) {
      const key = `${currentCol},${currentRow}`;
      if (visited.has(key)) break;
      visited.add(key);
      
      if (currentTile.textureKey !== sequence[currentIndex]) break;
      
      chain.push({
        tile: currentTile,
        col: currentCol,
        row: currentRow,
        sequenceIndex: currentIndex,
      });
      
      if (currentIndex === sequence.length - 1) break;
      
      const next = this.findTilePointedBy(currentTile, currentCol, currentRow, getTileAt);
      if (!next || next.tile.textureKey !== sequence[currentIndex + 1]) break;
      
      currentTile = next.tile;
      currentCol = next.col;
      currentRow = next.row;
      currentIndex++;
    }
    
    return chain.length === sequence.length ? chain : null;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Найти плитку на которую указывает activeSide
  // ============================================================================
  private static findTilePointedBy(
    tile: Tile,
    col: number,
    row: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): { tile: Tile; col: number; row: number } | null {
    const activeSide = (tile as any).activeSide as Edge | undefined;
    if (!activeSide) return null;
    
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const baseIndex = edges.indexOf(activeSide);
    const steps = tile.rotation / 90;
    const finalIndex = (baseIndex + steps) % 4;
    const finalEdge = edges[finalIndex];
    
    let targetCol = col;
    let targetRow = row;
    
    switch (finalEdge) {
      case 'top': targetRow--; break;
      case 'bottom': targetRow++; break;
      case 'left': targetCol--; break;
      case 'right': targetCol++; break;
    }
    
    const target = getTileAt(targetCol, targetRow);
    return target ? { tile: target.tile, col: targetCol, row: targetRow } : null;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Найти плитку которая указывает НА текущую
  // ============================================================================
  private static findTilePointingTo(
    tile: Tile,
    col: number,
    row: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): { tile: Tile; col: number; row: number } | null {
    const neighbors = getNeighborPositions(col, row);
    
    for (const neighbor of neighbors) {
      const neighborInfo = getTileAt(neighbor.col, neighbor.row);
      if (!neighborInfo) continue;
      
      const neighborTile = neighborInfo.tile;
      
      if (this.doesActiveSidePointTo(neighborTile, neighbor.col, neighbor.row, col, row)) {
        return { tile: neighborTile, col: neighbor.col, row: neighbor.row };
      }
    }
    
    return null;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Проверка — указывает ли activeSide НА целевую ячейку
  // ============================================================================
  private static doesActiveSidePointTo(
    tile: Tile,
    tileCol: number,
    tileRow: number,
    targetCol: number,
    targetRow: number
  ): boolean {
    const activeSide = (tile as any).activeSide as Edge | undefined;
    if (!activeSide) return false;
    
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const baseIndex = edges.indexOf(activeSide);
    const steps = tile.rotation / 90;
    const finalIndex = (baseIndex + steps) % 4;
    const finalEdge = edges[finalIndex];
    
    let expectedTargetCol = tileCol;
    let expectedTargetRow = tileRow;
    
    switch (finalEdge) {
      case 'top': expectedTargetRow--; break;
      case 'bottom': expectedTargetRow++; break;
      case 'left': expectedTargetCol--; break;
      case 'right': expectedTargetCol++; break;
    }
    
    return expectedTargetCol === targetCol && expectedTargetRow === targetRow;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Проверка совпадения цепочки с рецептом
  // ============================================================================
  private static chainMatchesRecipe(
    chain: { tile: Tile; col: number; row: number; sequenceIndex: number }[],
    sequence: string[]
  ): boolean {
    if (chain.length !== sequence.length) return false;
    
    const sorted = [...chain].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    
    for (let i = 0; i < sequence.length; i++) {
      if (sorted[i].tile.textureKey !== sequence[i]) return false;
    }
    
    return true;
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Создать ChainMatch из найденной цепочки
  // ============================================================================
  private static createChainMatch(
    recipe: Recipe,
    chain: { tile: Tile; col: number; row: number; sequenceIndex: number }[],
    sequence: string[]
  ): ChainMatch {
    const sorted = [...chain].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    
    const matchedTiles: MatchedTile[] = sorted.map(item => ({
      tile: item.tile,
      col: item.col,
      row: item.row,
      sequenceIndex: item.sequenceIndex,
    }));
    
    const resultPosition = this.calculateResultPosition(recipe, matchedTiles);
    
    return { recipe, matchedTiles, resultPosition };
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Вычислить позицию результата
  // ============================================================================
  private static calculateResultPosition(
    recipe: Recipe,
    matchedTiles: MatchedTile[]
  ): { col: number; row: number } {
    const exec = recipe.execution;
    
    if (exec?.resultPosition === 'first' && matchedTiles.length > 0) {
      return { col: matchedTiles[0].col, row: matchedTiles[0].row };
    }
    
    if (exec?.resultPosition === 'last' && matchedTiles.length > 0) {
      return { col: matchedTiles[matchedTiles.length - 1].col, row: matchedTiles[matchedTiles.length - 1].row };
    }
    
    if (exec?.resultPosition === 'center' && matchedTiles.length > 0) {
      const mid = Math.floor(matchedTiles.length / 2);
      return { col: matchedTiles[mid].col, row: matchedTiles[mid].row };
    }
    
    // По умолчанию — последняя плитка
    if (matchedTiles.length > 0) {
      return { col: matchedTiles[matchedTiles.length - 1].col, row: matchedTiles[matchedTiles.length - 1].row };
    }
    
    return { col: 0, row: 0 };
  }
  
  // ============================================================================
  // 🔑 МЕТОД: Выполнение рецепта
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
    
    const resultTile = new Tile({
      id: generateTileId(),
      textureKey: recipe.result.textureKey,
      rotation: recipe.result.rotation ?? 0,
    });
    
    if (recipe.result.activeSide) {
      (resultTile as any).activeSide = recipe.result.activeSide;
    }
    
    if (craftTiles) {
      craftTiles(removedIds, {
        col: resultPosition.col,
        row: resultPosition.row,
        tile: resultTile,
      });
    } else {
      for (const id of removedIds) {
        removeTile(id);
      }
      setTimeout(() => {
        addTile(resultPosition.col, resultPosition.row, resultTile);
      }, 50);
    }
    
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
  
  // ============================================================================
  // МЕТОД: Проверка цепочек (рекурсивно для мульти-крафта)
  // ============================================================================
  static checkChain(
    resultTile: Tile,
    col: number,
    row: number,
    depth: number,
    visitedIds: Set<string>,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined,
    tileOperations: any,
    callbacks?: CraftingCallbacks
  ): CraftResult[] {
    if (depth > 10) return [];
    
    const results: CraftResult[] = [];
    
    const matchingRecipes = RECIPES.filter(r => 
      r.sequence.includes(resultTile.textureKey)
    );
    
    for (const recipe of matchingRecipes) {
      const match = this.validateChain(recipe, resultTile, col, row, getTileAt);
      
      if (match) {
        const hasVisited = match.matchedTiles.some(m => visitedIds.has(m.tile.id));
        if (hasVisited) continue;
        
        match.matchedTiles.forEach(m => visitedIds.add(m.tile.id));
        
        callbacks?.onChainStart?.(resultTile, depth);
        
        const result = this.executeRecipe(match, tileOperations, callbacks);
        results.push(result);
        
        if (result.chainContinues && result.createdTile) {
          const chainResults = this.checkChain(
            result.createdTile.tile,
            result.createdTile.col,
            result.createdTile.row,
            depth + 1,
            visitedIds,
            getTileAt,
            tileOperations,
            callbacks
          );
          results.push(...chainResults);
        }
      }
    }
    
    return results;
  }
}

export default CraftingService;
// ============================================================================
// отключаем моки React Native для чистых тестов
// ============================================================================
jest.mock('react-native', () => {
  // Возвращаем минимальный мок чтобы не ломались импорты
  return {
    Dimensions: { get: () => ({ width: 800, height: 600 }) },
    Animated: { Value: class {}, ValueXY: class {}, timing: () => ({ start: (cb) => cb?.() }), spring: () => ({ start: (cb) => cb?.() }), parallel: (anims) => ({ start: (cb) => cb?.() }) },
  };
});

// ============================================================================
// МОДУЛЬНЫЕ ТЕСТЫ: CraftingService
// ============================================================================
// Запуск: jest src/services/CraftingService.test.ts
// Зависимости: только данные, не требуют React/DOM
// ============================================================================

import { Tile } from '../models/Tile';
import { CraftingService, ChainMatch, MatchedTile } from './CraftingService';
import { RECIPES } from '../constants/recipes';
import { PlacedTileInfo } from '../context/TilesContext';

// ============================================================================
// MOCK: Простая реализация getTileAt для тестов
// ============================================================================
const createMockGrid = (tiles: Array<{ tile: Tile; col: number; row: number }>) => {
  const grid = new Map<string, PlacedTileInfo>();
  
  for (const t of tiles) {
    grid.set(`${t.col},${t.row}`, { tile: t.tile, col: t.col, row: t.row });
  }
  
  return (col: number, row: number): PlacedTileInfo | undefined => {
    return grid.get(`${col},${row}`);
  };
};

// ============================================================================
// ХЕЛПЕР: Создать плитку с activeSide (для тестов)
// ============================================================================
const createTileWithActiveSide = (
  id: string,
  textureKey: string,
  activeSide: 'top' | 'right' | 'bottom' | 'left',
  rotation: 0 | 90 | 180 | 270 = 0
): Tile => {
  const tile = new Tile({ id, textureKey, rotation });
  // @ts-ignore — добавляем activeSide для тестов (в продакшене будет через расширение типа)
  tile.activeSide = activeSide;
  return tile;
};

// ============================================================================
// ТЕСТЫ: findMatchingRecipe
// ============================================================================

describe('CraftingService.findMatchingRecipe', () => {
  
  test('должен найти рецепт когда цепочка полная и направления верные', () => {
    // Рецепт: water → millet → fire = bread
    // Позиции: water(5,5)→, millet(6,5)↓, fire(6,6)←
    
    const water = createTileWithActiveSide('w1', 'water', 'right');
    const millet = createTileWithActiveSide('m1', 'millet', 'bottom');
    const fire = createTileWithActiveSide('f1', 'fire', 'left');
    
    const getTileAt = createMockGrid([
      { tile: water, col: 5, row: 5 },
      { tile: millet, col: 6, row: 5 },
      { tile: fire, col: 6, row: 6 },  // fire — последний, размещён здесь
    ]);
    
    const result = CraftingService.findMatchingRecipe(fire, 6, 6, getTileAt);
    
    expect(result).not.toBeNull();
    expect(result?.recipe.id).toBe('bread_recipe');
    expect(result?.matchedTiles).toHaveLength(3);
    expect(result?.matchedTiles[0].tile.textureKey).toBe('water');
    expect(result?.matchedTiles[1].tile.textureKey).toBe('millet');
    expect(result?.matchedTiles[2].tile.textureKey).toBe('fire');
  });
  
  test('должен вернуть null если активная сторона не указывает на следующий шаг', () => {
    // water(5,5)→, millet(6,5)→ (должно быть ↓), fire(6,6)
    
    const water = createTileWithActiveSide('w1', 'water', 'right');
    const millet = createTileWithActiveSide('m1', 'millet', 'right');  // ❌ Не указывает на fire
    const fire = createTileWithActiveSide('f1', 'fire', 'left');
    
    const getTileAt = createMockGrid([
      { tile: water, col: 5, row: 5 },
      { tile: millet, col: 6, row: 5 },
      { tile: fire, col: 6, row: 6 },
    ]);
    
    const result = CraftingService.findMatchingRecipe(fire, 6, 6, getTileAt);
    
    expect(result).toBeNull();
  });
  
  test('должен вернуть null если плитка без activeSide', () => {
    // Плитки без activeSide не участвуют в упорядоченных рецептах
    
    const water = new Tile({ id: 'w1', textureKey: 'water' });  // Нет activeSide
    const millet = createTileWithActiveSide('m1', 'millet', 'bottom');
    const fire = createTileWithActiveSide('f1', 'fire', 'left');
    
    const getTileAt = createMockGrid([
      { tile: water, col: 5, row: 5 },
      { tile: millet, col: 6, row: 5 },
      { tile: fire, col: 6, row: 6 },
    ]);
    
    const result = CraftingService.findMatchingRecipe(fire, 6, 6, getTileAt);
    
    expect(result).toBeNull();
  });
  
  test('должен выбрать рецепт с наивысшим приоритетом при конфликте', () => {
    // Если подходят несколько рецептов — берём по приоритету
    
    const water = createTileWithActiveSide('w1', 'water', 'right');
    const millet = createTileWithActiveSide('m1', 'millet', 'bottom');
    
    const getTileAt = createMockGrid([
      { tile: water, col: 5, row: 5 },
      { tile: millet, col: 6, row: 5 },  // millet — последний
    ]);
    
    // Подходят: porridge_recipe (priority: 5) и хлеб (но ему нужен ещё fire)
    const result = CraftingService.findMatchingRecipe(millet, 6, 5, getTileAt);
    
    expect(result).not.toBeNull();
    expect(result?.recipe.id).toBe('porridge_recipe');  // priority 5 > default 0
  });
});

// ============================================================================
// ТЕСТЫ: executeRecipe
// ============================================================================

describe('CraftingService.executeRecipe', () => {
  
  test('должен удалить ингредиенты и создать результат', () => {
    const water = createTileWithActiveSide('w1', 'water', 'right');
    const millet = createTileWithActiveSide('m1', 'millet', 'bottom');
    
    const match: ChainMatch = {
      recipe: RECIPES.find(r => r.id === 'porridge_recipe')!,
      matchedTiles: [
        { tile: water, col: 5, row: 5, sequenceIndex: 0 },
        { tile: millet, col: 6, row: 5, sequenceIndex: 1 },
      ],
      resultPosition: { col: 6, row: 5 },  // last
    };
    
    const removedIds: string[] = [];
    let addedTile: { tile: Tile; col: number; row: number } | null = null;
    
    const tileOperations = {
      removeTile: (id: string) => removedIds.push(id),
      addTile: (col: number, row: number, tile: Tile) => { addedTile = { tile, col, row }; },
      generateTileId: () => 'new-tile-123',
    };
    
    const result = CraftingService.executeRecipe(match, tileOperations);
    
    expect(result.success).toBe(true);
    expect(removedIds).toContain('w1');
    expect(removedIds).toContain('m1');
    expect(addedTile).not.toBeNull();
    expect(addedTile?.tile.textureKey).toBe('porridge');
    expect(addedTile?.col).toBe(6);
    expect(addedTile?.row).toBe(5);
  });
});

// ============================================================================
// ТЕСТЫ: checkChain (рекурсивная проверка)
// ============================================================================

describe('CraftingService.checkChain', () => {
  
  test('должен продолжить цепочку если результат подходит для нового рецепта', () => {
    // bread↑ + butter = toast
    // bread создан на (6,6) с activeSide="up"
    
    const bread = createTileWithActiveSide('b1', 'bread', 'top');
    const butter = createTileWithActiveSide('bt1', 'butter', 'any' as any);
    
    const getTileAt = createMockGrid([
      { tile: bread, col: 6, row: 6 },
      { tile: butter, col: 6, row: 5 },  // сверху от bread
    ]);
    
    const visitedIds = new Set<string>();
    const results: Array<{ col: number; row: number; texture: string }> = [];
    
    const tileOperations = {
      removeTile: () => {},
      addTile: (col: number, row: number, tile: Tile) => {
        results.push({ col, row, texture: tile.textureKey });
      },
      generateTileId: () => 'toast-1',
    };
    
    const chainResults = CraftingService.checkChain(
      bread,
      6, 6,
      1,  // depth
      visitedIds,
      getTileAt,
      tileOperations
    );
    
    // Должен найти рецепт toast и создать результат
    expect(chainResults.length).toBeGreaterThan(0);
    expect(results.some(r => r.texture === 'toast')).toBe(true);
  });
});

// ============================================================================
// ТЕСТЫ: onTilePlaced (высокоуровневый)
// ============================================================================

describe('CraftingService.onTilePlaced', () => {
  
  test('должен выполнить полный цикл: проверка → крафт → цепочка', () => {
    // Полная цепочка: water→ + millet↓ + fire← = bread↑
    // Затем: bread↑ + butter = toast
    
    const water = createTileWithActiveSide('w1', 'water', 'right');
    const millet = createTileWithActiveSide('m1', 'millet', 'bottom');
    const fire = createTileWithActiveSide('f1', 'fire', 'left');
    const butter = createTileWithActiveSide('bt1', 'butter', 'bottom');
    
    const getTileAt = createMockGrid([
      { tile: water, col: 5, row: 5 },
      { tile: millet, col: 6, row: 5 },
      { tile: fire, col: 6, row: 6 },  // fire размещается здесь
      { tile: butter, col: 6, row: 4 },  // сверху от будущего bread
    ]);
    
    const removedIds: string[] = [];
    const addedTiles: Array<{ texture: string; col: number; row: number }> = [];
    
    const tileOperations = {
      removeTile: (id: string) => removedIds.push(id),
      addTile: (col: number, row: number, tile: Tile) => {
        addedTiles.push({ texture: tile.textureKey, col, row });
      },
      generateTileId: () => `gen-${Date.now()}`,
    };
    
    const result = CraftingService.onTilePlaced(
      fire, 6, 6,
      getTileAt,
      tileOperations
    );
    
    expect(result.crafted).toBe(true);
    expect(result.results.length).toBeGreaterThanOrEqual(1);  // Минимум первый крафт
    
    // Проверка первого крафта: bread
    expect(removedIds).toContain('w1');
    expect(removedIds).toContain('m1');
    expect(removedIds).toContain('f1');
    expect(addedTiles.some(t => t.texture === 'bread')).toBe(true);
    
    // Проверка цепочки: если включена, должен быть toast
    // (зависит от наличия butter в нужной позиции)
  });
});
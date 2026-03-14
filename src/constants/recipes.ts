// ============================================================================
// КОНФИГУРАЦИЯ РЕЦЕПТОВ КРАФТА
// ============================================================================
// Все рецепты описываются данными, не кодом.
// sequence: упорядоченный массив textureKey (порядок важен!)
// Направления связей определяются динамически через activeSide плиток.
// ============================================================================

import { Edge } from '../models/Tile.types';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface RecipeIngredient {
  textureKey: string;  // Текстура ингредиента
}

export interface RecipeResult {
  textureKey: string;      // Текстура результата
  activeSide?: Edge;       // Направление стрелки у результата (опционально)
  rotation?: 0 | 90 | 180 | 270;  // Начальный поворот (по умолчанию 0)
  meta?: Record<string, any>;    // Доп. данные для внешней логики
}

export interface Recipe {
  id: string;  // Уникальный идентификатор
  
  // УПОРЯДОЧЕННАЯ последовательность ингредиентов (только текстуры!)
  // Порядок ВАЖЕН: [water, millet, fire] ≠ [fire, millet, water]
  sequence: string[];  // Array<TextureKey>
  
  result: RecipeResult;  // Что получится в итоге
  
  // Настройки выполнения
  execution?: {
    resultPosition?: 'first' | 'last' | 'center';  // Где появится результат
    consumeAll?: boolean;  // Удалять ли все ингредиенты (по умолчанию true)
    animationDuration?: number;  // Длительность анимации в мс
  };
  
  // Настройки цепочек
  chaining?: {
    enabled?: boolean;  // Может ли результат участвовать в дальнейших крафтах
    delayBetweenSteps?: number;  // Задержка между шагами цепочки (мс)
  };
  
  // Приоритет при конфликтах (чем выше, тем важнее)
  priority?: number;  // По умолчанию 0
  
  // Условия доступности (опционально)
  conditions?: {
    minPlayerLevel?: number;
    requiredUnlock?: string;
  };
}

// ============================================================================
// БАЗОВЫЕ РЕЦЕПТЫ (ТЕСТОВЫЕ)
// ============================================================================

export const RECIPES: Recipe[] = [
  // --------------------------------------------------------------------------
  // Рецепт: ХЛЕБ (вода → пшено → огонь)
  // --------------------------------------------------------------------------
  {
    id: 'bread_recipe',
    sequence: ['water', 'millet', 'fire'],  // Порядок ВАЖЕН!
    result: {
      textureKey: 'bread',
      activeSide: 'top',  // У хлеба стрелка смотрит вверх (для цепочек)
      rotation: 0,
    },
    execution: {
      resultPosition: 'last',  // Результат появляется на позиции последнего ингредиента
      consumeAll: true,
      animationDuration: 300,
    },
    chaining: {
      enabled: true,  // Хлеб может участвовать в дальнейших крафтах
      delayBetweenSteps: 150,  // 150мс между шагами цепочки
    },
    priority: 10,
  },
  
  // --------------------------------------------------------------------------
  // Рецепт: КАША (вода + пшено, порядок не важен для 2 ингредиентов)
  // --------------------------------------------------------------------------
  /*{
    id: 'porridge_recipe',
    sequence: ['water', 'millet'],
    result: {
      textureKey: 'porridge',
      activeSide: 'right',
      rotation: 0,
    },
    execution: {
      resultPosition: 'last',
      consumeAll: true,
      animationDuration: 300,
    },
    chaining: {
      enabled: false,  // Каша — финальный продукт
    },
    priority: 5,
  },*/
  
  // --------------------------------------------------------------------------
  // Рецепт: ТОСТ (хлеб ↑ + масло)
  // --------------------------------------------------------------------------
  {
    id: 'toast_recipe',
    sequence: ['bread', 'butter'],
    result: {
      textureKey: 'toast',
      activeSide: 'right',
      rotation: 0,
    },
    execution: {
      resultPosition: 'last',
      consumeAll: true,
      animationDuration: 300,
    },
    chaining: {
      enabled: true,
      delayBetweenSteps: 150,
    },
    priority: 10,
  },
  
  // --------------------------------------------------------------------------
  // Рецепт: СЭНДВИЧ (тост → + сыр)
  // --------------------------------------------------------------------------
  {
    id: 'sandwich_recipe',
    sequence: ['toast', 'cheese'],
    result: {
      textureKey: 'sandwich',
      rotation: 0,
    },
    execution: {
      resultPosition: 'last',
      consumeAll: true,
      animationDuration: 300,
    },
    chaining: {
      enabled: false,  // Сэндвич — финальный продукт
    },
    priority: 10,
  },
  
  // --------------------------------------------------------------------------
  // Рецепт: СОК (фрукт + фрукт + вода = любой порядок для 2 фруктов)
  // Демонстрация рецепта с повторяющимися ингредиентами
  // --------------------------------------------------------------------------
  {
    id: 'juice_recipe',
    sequence: ['apple', 'apple', 'water'],  // Два яблока + вода
    result: {
      textureKey: 'juice',
      rotation: 0,
    },
    execution: {
      resultPosition: 'center',  // Результат в центре цепочки
      consumeAll: true,
      animationDuration: 300,
    },
    chaining: {
      enabled: false,
    },
    priority: 5,
  },
];

// ============================================================================
// ХЕЛПЕРЫ
// ============================================================================

/**
 * Получить рецепт по ID
 */
export const getRecipeById = (id: string): Recipe | undefined => {
  return RECIPES.find(r => r.id === id);
};

/**
 * Получить все рецепты где указанная текстура — последний ингредиент
 * (для оптимизации проверки при размещении плитки)
 */
export const getRecipesWithLastIngredient = (textureKey: string): Recipe[] => {
  return RECIPES.filter(recipe => {
    const last = recipe.sequence[recipe.sequence.length - 1];
    return last === textureKey;
  }).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));  // Сортировка по приоритету
};

/**
 * Получить все рецепты где указанная текстура — НЕ последний ингредиент
 * (для проверки цепочек: результат может быть шагом 1, 2, ... N-1)
 */
export const getRecipesWhereTextureIsNotLast = (textureKey: string): Recipe[] => {
  return RECIPES.filter(recipe => {
    const lastIndex = recipe.sequence.length - 1;
    const index = recipe.sequence.indexOf(textureKey);
    return index !== -1 && index !== lastIndex;
  }).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
};

// ============================================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================================

export default RECIPES;
// ============================================================================
// СЕРВИС КРАФТА
// ============================================================================
// Отвечает за поиск рецептов при размещении плитки, валидацию цепочек
// через активные стороны плиток (с учётом поворота) и выполнение крафта
// (удаление ингредиентов, создание результирующей плитки).
// Поддерживает рекурсивные цепочки: результат крафта может стать
// ингредиентом следующего рецепта.
// ============================================================================

import { Tile } from '../models/Tile';
import { Edge } from '../models/Tile.types';
import { Recipe, RECIPES } from '../constants/recipes';
import { PlacedTileInfo } from '../context/TilesContext';
import { CRAFTING_CONFIG } from '../constants/CraftingConfig';

// Максимальная глубина рекурсивных цепочек крафта
const MAX_CHAIN_DEPTH = CRAFTING_CONFIG.maxChainDepth ?? 10;

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Результат поиска совпадения рецепта на игровом поле.
 * Содержит найденный рецепт, упорядоченный список задействованных плиток
 * и позицию, куда будет помещена результирующая плитка.
 */
export interface ChainMatch {
  recipe: Recipe;
  /** Плитки в порядке последовательности рецепта */
  matchedTiles: MatchedTile[];
  /** Координаты ячейки, в которой появится результат */
  resultPosition: { col: number; row: number };
}

/**
 * Плитка, участвующая в цепочке крафта, с её позицией на поле
 * и индексом в последовательности рецепта.
 */
export interface MatchedTile {
  tile: Tile;
  col: number;
  row: number;
  /** Позиция данной плитки в массиве recipe.sequence */
  sequenceIndex: number;
}

/**
 * Результат выполнения одного шага крафта.
 */
export interface CraftResult {
  success: boolean;
  recipeId?: string;
  /** Идентификаторы удалённых плиток-ингредиентов */
  removedTileIds: string[];
  /** Созданная результирующая плитка с её координатами */
  createdTile?: {
    tile: Tile;
    col: number;
    row: number;
  };
  /** Признак того, что результат может участвовать в дальнейшей цепочке */
  chainContinues: boolean;
  message?: string;
}

/**
 * Колбэки для реакции внешнего кода на события крафта.
 */
export interface CraftingCallbacks {
  /** Вызывается в момент начала выполнения рецепта */
  onCraftStart?: (recipe: Recipe, matchedTiles: MatchedTile[]) => void;
  /** Вызывается после завершения выполнения рецепта */
  onCraftComplete?: (result: CraftResult) => void;
  /** Вызывается при переходе на новый шаг цепочки */
  onChainStart?: (resultTile: Tile, depth: number) => void;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Определяет направление от ячейки A к соседней ячейке B.
 * Возвращает null, если ячейки не являются соседями по горизонтали или вертикали.
 *
 * @param fromCol - колонка ячейки A
 * @param fromRow - строка ячейки A
 * @param toCol   - колонка ячейки B
 * @param toRow   - строка ячейки B
 * @returns направление ('top' | 'right' | 'bottom' | 'left') или null
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
 * Применяет поворот плитки к направлению activeSide,
 * возвращая реальное направление стрелки на игровом поле.
 *
 * activeSide хранится в локальных координатах плитки (до поворота).
 * Каждые 90 градусов поворота смещают индекс направления на 1 позицию
 * в порядке ['top', 'right', 'bottom', 'left'].
 *
 * @param direction - базовое направление в локальных координатах плитки
 * @param rotation  - угол поворота плитки (0, 90, 180, 270)
 * @returns направление с учётом поворота
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
 * Проверяет, указывает ли активная сторона плитки (с учётом её поворота)
 * на целевую ячейку.
 *
 * Вычисляет фактическое направление стрелки с учётом rotation,
 * затем определяет ожидаемую позицию соседа и сравнивает с targetCol/targetRow.
 *
 * @param tile       - плитка, чья activeSide проверяется
 * @param tileCol    - текущая колонка плитки
 * @param tileRow    - текущая строка плитки
 * @param targetCol  - колонка проверяемого соседа
 * @param targetRow  - строка проверяемого соседа
 * @returns true, если стрелка плитки указывает на целевую ячейку
 */
const doesActiveSidePointTo = (
  tile: Tile,
  tileCol: number, tileRow: number,
  targetCol: number, targetRow: number
): boolean => {
  const activeSide = (tile as any).activeSide as Edge | undefined;
  if (!activeSide) return false;

  // Применяем поворот плитки к базовому направлению стрелки
  const actualDirection = rotateDirection(activeSide, tile.rotation ?? 0);

  let expectedTargetCol = tileCol;
  let expectedTargetRow = tileRow;

  switch (actualDirection) {
    case 'top':    expectedTargetRow--; break;
    case 'bottom': expectedTargetRow++; break;
    case 'left':   expectedTargetCol--; break;
    case 'right':  expectedTargetCol++; break;
  }

  return expectedTargetCol === targetCol && expectedTargetRow === targetRow;
};

/**
 * Возвращает список четырёх соседних ячеек в порядке приоритета проверки.
 *
 * @param col - колонка центральной ячейки
 * @param row - строка центральной ячейки
 * @returns массив объектов { col, row, direction }
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

/**
 * Статический сервис системы крафта.
 *
 * Основной метод — onTilePlaced: вызывается после каждого размещения плитки
 * на поле и запускает полный цикл поиска и выполнения рецептов, включая
 * рекурсивные цепочки.
 *
 * Порядок размещения ингредиентов не важен — важна лишь итоговая
 * расстановка плиток и направления их activeSide.
 */
export class CraftingService {

  // Кэш рецептов по textureKey для ускорения повторных поисков
  private static recipeCache = new Map<string, Recipe[]>();

  /**
   * Сбрасывает кэш рецептов.
   * Необходимо вызывать при изменении конфигурации RECIPES в runtime
   * (например, при горячей перезагрузке в режиме разработки).
   */
  static invalidateRecipeCache(): void {
    this.recipeCache.clear();
  }

  /**
   * Ищет рецепт, в котором размещённая плитка образует валидную цепочку
   * с соседями на поле.
   *
   * Плитка может находиться на любой позиции в последовательности рецепта —
   * алгоритм проверяет все варианты. Направления activeSide каждой плитки
   * (с учётом rotation) должны образовывать непрерывную цепочку.
   *
   * @param placedTile - только что размещённая плитка
   * @param col        - колонка размещения
   * @param row        - строка размещения
   * @param getTileAt  - функция получения плитки по координатам
   * @returns объект ChainMatch при успехе или null
   */
  static findMatchingRecipe(
    placedTile: Tile,
    col: number,
    row: number,
    getTileAt: (col: number, row: number) => PlacedTileInfo | undefined
  ): ChainMatch | null {
    // Получаем все рецепты, в которых присутствует данная текстура
    const candidateRecipes = this.getRecipesWithTexture(placedTile.textureKey);

    if (candidateRecipes.length === 0) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] Нет рецептов где есть "${placedTile.textureKey}"`);
      }
      return null;
    }

    // Перебираем рецепты и проверяем все позиции, на которых может стоять плитка
    for (const recipe of candidateRecipes) {
      const possiblePositions = this.findAllPositionsInSequence(
        recipe.sequence,
        placedTile.textureKey
      );

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
            console.log(`[Crafting] Рецепт найден: ${recipe.id}`, {
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
      console.log(`[Crafting] Ни один рецепт не подошел для "${placedTile.textureKey}"`);
    }
    return null;
  }

  /**
   * Возвращает все рецепты, в последовательности которых присутствует
   * указанная текстура. Результат кэшируется по textureKey.
   *
   * @param textureKey - ключ текстуры плитки
   * @returns отсортированный по приоритету массив рецептов
   */
  private static getRecipesWithTexture(textureKey: string): Recipe[] {
    if (this.recipeCache.has(textureKey)) {
      return this.recipeCache.get(textureKey)!;
    }

    const recipes = RECIPES.filter(recipe =>
      recipe.sequence.includes(textureKey)
    ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.recipeCache.set(textureKey, recipes);
    return recipes;
  }

  /**
   * Находит все индексы, на которых textureKey встречается в последовательности.
   * Один и тот же ключ может встречаться несколько раз (например, два яблока).
   *
   * @param sequence   - массив текстурных ключей рецепта
   * @param textureKey - искомый ключ
   * @returns массив индексов вхождений
   */
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

  /**
   * Проверяет, образуют ли размещённая плитка и соседние плитки на поле
   * полную цепочку для указанного рецепта, начиная с позиции placedTilePosition.
   *
   * Алгоритм работает в двух направлениях:
   * - вперёд (от placedTilePosition к концу sequence): activeSide текущей
   *   плитки должна указывать на следующую;
   * - назад (от placedTilePosition к началу sequence): activeSide соседа
   *   должна указывать на текущую плитку.
   *
   * @param recipe              - проверяемый рецепт
   * @param placedTilePosition  - индекс размещённой плитки в recipe.sequence
   * @param placedTile          - сама размещённая плитка
   * @param placedCol           - колонка размещения
   * @param placedRow           - строка размещения
   * @param getTileAt           - функция получения плитки по координатам
   * @returns объект ChainMatch при успехе или null
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

    // Добавляем размещённую плитку как точку отсчёта
    matchedTiles.push({
      tile: placedTile,
      col: placedCol,
      row: placedRow,
      sequenceIndex: placedTilePosition,
    });

    // Проход вперёд: ищем плитки на позициях (placedTilePosition+1 .. конец)
    // activeSide каждой текущей плитки должна указывать на следующую в цепочке
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

    // Проход назад: ищем плитки на позициях (placedTilePosition-1 .. начало)
    // activeSide соседа должна указывать на текущую плитку
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

    // Длина собранной цепочки должна точно совпадать с длиной рецепта
    if (matchedTiles.length !== sequence.length) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Crafting] Несоответствие длины цепочки: ожидалось ${sequence.length}, получено ${matchedTiles.length}`);
      }
      return null;
    }

    // Сортируем по sequenceIndex перед возвратом
    matchedTiles.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    const resultPosition = this.calculateResultPosition(recipe, matchedTiles);

    return { recipe, matchedTiles, resultPosition };
  }

  /**
   * Ищет следующий шаг цепочки (поиск вперёд).
   *
   * Среди соседей ячейки (fromCol, fromRow) находит плитку с текстурой
   * expectedTexture, на которую указывает activeSide плитки в ячейке
   * (fromCol, fromRow) с учётом её поворота.
   *
   * @param expectedTexture - ожидаемая текстура следующего ингредиента
   * @param fromCol         - колонка текущей плитки цепочки
   * @param fromRow         - строка текущей плитки цепочки
   * @param getTileAt       - функция получения плитки по координатам
   * @param excludeTiles    - уже задействованные плитки (не рассматриваются повторно)
   * @returns найденная плитка с координатами или null
   */
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

      // Проверяем совпадение текстуры
      if (neighborTile.textureKey !== expectedTexture) continue;

      // Исключаем плитки, уже включённые в цепочку
      if (excludeTiles.some(m => m.tile.id === neighborTile.id)) continue;

      // activeSide текущей плитки (с учётом rotation) должна указывать на соседа
      const fromTileInfo = getTileAt(fromCol, fromRow);
      if (!fromTileInfo) continue;

      const isValidDirection = doesActiveSidePointTo(fromTileInfo.tile, fromCol, fromRow, neighbor.col, neighbor.row);

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] Проверка направления (вперёд):`, {
          from: `${fromCol},${fromRow}`,
          activeSide: (fromTileInfo.tile as any).activeSide,
          rotation: fromTileInfo.tile.rotation,
          to: `${neighbor.col},${neighbor.row}`,
          expectedTexture,
          foundTexture: neighborTile.textureKey,
          valid: isValidDirection,
        });
      }

      if (!isValidDirection) continue;

      return { tile: neighborTile, col: neighbor.col, row: neighbor.row };
    }

    return null;
  }

  /**
   * Ищет предыдущий шаг цепочки (поиск назад).
   *
   * Среди соседей ячейки (fromCol, fromRow) находит плитку с текстурой
   * expectedTexture, чья activeSide (с учётом поворота) указывает
   * обратно на ячейку (fromCol, fromRow).
   *
   * @param expectedTexture - ожидаемая текстура предыдущего ингредиента
   * @param fromCol         - колонка текущей плитки цепочки
   * @param fromRow         - строка текущей плитки цепочки
   * @param getTileAt       - функция получения плитки по координатам
   * @param excludeTiles    - уже задействованные плитки (не рассматриваются повторно)
   * @returns найденная плитка с координатами или null
   */
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

      if (neighborTile.textureKey !== expectedTexture) continue;

      if (excludeTiles.some(m => m.tile.id === neighborTile.id)) continue;

      // activeSide соседа (с учётом его rotation) должна указывать на текущую плитку
      const isValidDirection = doesActiveSidePointTo(neighborTile, neighbor.col, neighbor.row, fromCol, fromRow);

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] Проверка направления (назад):`, {
          from: `${neighbor.col},${neighbor.row}`,
          activeSide: (neighborTile as any).activeSide,
          rotation: neighborTile.rotation,
          to: `${fromCol},${fromRow}`,
          expectedTexture,
          foundTexture: neighborTile.textureKey,
          valid: isValidDirection,
        });
      }

      if (!isValidDirection) continue;

      return { tile: neighborTile, col: neighbor.col, row: neighbor.row };
    }

    return null;
  }

  /**
   * Вычисляет ячейку, в которой появится результирующая плитка.
   * Стратегия определяется полем recipe.execution.resultPosition:
   * 'first' — позиция первого ингредиента,
   * 'center' — позиция среднего ингредиента,
   * 'last' — позиция последнего ингредиента (по умолчанию).
   *
   * @param recipe       - рецепт с настройками исполнения
   * @param matchedTiles - отсортированный список плиток цепочки
   * @returns координаты ячейки результата
   */
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

  /**
   * Выполняет рецепт: удаляет плитки-ингредиенты и создаёт результирующую плитку.
   *
   * Если передан метод craftTiles, используется атомарное обновление состояния
   * (удаление и добавление в одной операции). Иначе — раздельные вызовы.
   *
   * @param match          - результат поиска совпадения с рецептом
   * @param tileOperations - методы работы с плитками на поле
   * @param callbacks      - опциональные колбэки для внешней реакции
   * @returns объект CraftResult с описанием выполненной операции
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

    const removedIds: string[] = matchedTiles.map(mt => mt.tile.id);

    // Создаём результирующую плитку с параметрами из рецепта
    const resultTile = new Tile({
      id: generateTileId(),
      textureKey: recipe.result.textureKey,
      rotation: recipe.result.rotation ?? 0,
      activeSide: recipe.result.activeSide,
    });

    if (craftTiles) {
      // Атомарное обновление: удаление ингредиентов и добавление результата
      // происходят в одном вызове setState, исключая промежуточные рендеры
      craftTiles(removedIds, {
        col: resultPosition.col,
        row: resultPosition.row,
        tile: resultTile,
      });
    } else {
      // Резервный путь: раздельные вызовы removeTile и addTile
      for (const id of removedIds) {
        removeTile(id);
      }
      addTile(resultPosition.col, resultPosition.row, resultTile);
    }

    // Цепочка продолжается только если рецепт разрешает chaining
    // и результирующая текстура является ингредиентом в другом рецепте
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
      message: `Crafted ${recipe.result.textureKey} from ${recipe.sequence.join(' -> ')}`,
    };

    callbacks?.onCraftComplete?.(result);

    return result;
  }

  /**
   * Рекурсивно проверяет, может ли результат крафта стать ингредиентом
   * следующего рецепта (цепочка крафтов).
   *
   * Защита от зацикливания: множество visitedIds исключает повторную
   * обработку уже использованных плиток. Параметр depth ограничивает
   * глубину рекурсии значением MAX_CHAIN_DEPTH.
   *
   * @param resultTile     - результирующая плитка предыдущего крафта
   * @param col            - её колонка на поле
   * @param row            - её строка на поле
   * @param depth          - текущая глубина рекурсии
   * @param visitedIds     - множество уже обработанных идентификаторов плиток
   * @param getTileAt      - функция получения плитки по координатам
   * @param tileOperations - методы работы с плитками
   * @param callbacks      - опциональные колбэки
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
      craftTiles?: (removeIds: string[], addInfo: { col: number; row: number; tile: Tile }) => void;
    },
    callbacks?: CraftingCallbacks
  ): CraftResult[] {
    const results: CraftResult[] = [];

    // Защита от зацикливания: плитка уже была задействована в этой цепочке
    if (visitedIds.has(resultTile.id)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Crafting] Цикл обнаружен: плитка ${resultTile.id} уже в цепочке`);
      }
      return results;
    }
    visitedIds.add(resultTile.id);

    // Защита от переполнения стека вызовов
    if (depth >= MAX_CHAIN_DEPTH) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Crafting] Достигнут лимит глубины цепочки: ${depth} (max: ${MAX_CHAIN_DEPTH})`);
      }
      return results;
    }

    callbacks?.onChainStart?.(resultTile, depth);

    const candidateRecipes = this.getRecipesWhereTextureIsNotLast(resultTile.textureKey);
    if (candidateRecipes.length === 0) {
      if (typeof __DEV__ !== 'undefined' && __DEV__ && depth > 0) {
        console.log(`[Crafting] Цепочка завершена на глубине ${depth}`);
      }
      return results;
    }

    // Создаём обёртку getTileAt, которая возвращает resultTile для её ячейки,
    // поскольку в реальном состоянии она может ещё не быть доступна
    const getTileAtWithResult: (c: number, r: number) => PlacedTileInfo | undefined = (c, r) => {
      if (c === col && r === row) {
        return { tile: resultTile, col: c, row: r };
      }
      return getTileAt(c, r);
    };

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[Crafting] checkChain глубина ${depth}:`, {
        texture: resultTile.textureKey,
        pos: `${col},${row}`,
        activeSide: resultTile.activeSide,
        rotation: resultTile.rotation,
        candidateRecipes: candidateRecipes.map(r => r.id),
      });
    }

    for (const recipe of candidateRecipes) {
      // Проверяем все позиции, где текстура встречается в рецепте (не только первую)
      const possiblePositions = this.findAllPositionsInSequence(
        recipe.sequence,
        resultTile.textureKey
      );

      for (const tileIndex of possiblePositions) {
        // Позиция последнего элемента не может быть ингредиентом цепочки
        if (tileIndex === recipe.sequence.length - 1) continue;

        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[Crafting] Проверка позиции ${tileIndex} в рецепте ${recipe.id}:`, {
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
          getTileAtWithResult
        );

        if (match) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(`[Crafting] Цепочка найдена для ${recipe.id}:`, {
              matchedTiles: match.matchedTiles.map(t => `${t.tile.textureKey}@${t.col},${t.row}`),
            });
          }

          const craftResult = this.executeRecipe(match, tileOperations, callbacks);
          results.push(craftResult);

          if (craftResult.success && craftResult.chainContinues && craftResult.createdTile) {
            // Продолжаем цепочку от созданной плитки
            const chainResults = this.checkChain(
              craftResult.createdTile.tile,
              craftResult.createdTile.col,
              craftResult.createdTile.row,
              depth + 1,
              visitedIds,
              // На следующих уровнях используем оригинальный getTileAt,
              // так как созданная плитка уже должна быть в реальном состоянии
              getTileAt,
              tileOperations,
              callbacks
            );
            results.push(...chainResults);
          }

          // Рецепт выполнен — переходим к следующему кандидату
          break;
        }
      }
    }

    return results;
  }

  /**
   * Возвращает все рецепты, в которых указанная текстура присутствует
   * не на последней позиции (то есть является промежуточным ингредиентом).
   * Используется для определения возможности продолжения цепочки.
   *
   * @param textureKey - ключ текстуры
   * @returns отсортированный по приоритету массив рецептов
   */
  private static getRecipesWhereTextureIsNotLast(textureKey: string): Recipe[] {
    return RECIPES.filter(recipe => {
      const lastIndex = recipe.sequence.length - 1;
      const index = recipe.sequence.indexOf(textureKey);
      return index !== -1 && index !== lastIndex;
    }).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Обрабатывает размещение плитки: запускает полный цикл поиска и
   * выполнения рецептов, включая рекурсивные цепочки.
   *
   * Алгоритм:
   * 1. Проверяет рецепты, в которых размещённая плитка участвует как ингредиент.
   * 2. Если рецепт выполнен и результат может продолжить цепочку — запускает
   *    рекурсивную проверку через checkChain.
   * 3. Дополнительно проверяет соседей: если activeSide соседа указывает на
   *    новую плитку, запускает поиск рецепта от этого соседа.
   *    Это позволяет выполнять крафт при размещении плиток в произвольном порядке.
   *
   * @param placedTile     - только что размещённая плитка
   * @param col            - колонка размещения
   * @param row            - строка размещения
   * @param getTileAt      - функция получения плитки по координатам
   * @param tileOperations - методы работы с плитками
   * @param callbacks      - опциональные колбэки
   * @returns объект с признаком наличия крафта и массивом результатов
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
    // Отслеживаем уже проверенные рецепты, чтобы не выполнять их повторно
    const checkedRecipes = new Set<string>();

    // --- Шаг 1: проверяем рецепты с участием размещённой плитки ---
    const primaryMatch = this.findMatchingRecipe(placedTile, col, row, getTileAt);
    if (primaryMatch) {
      checkedRecipes.add(primaryMatch.recipe.id);
      const firstResult = this.executeRecipe(primaryMatch, tileOperations, callbacks);
      results.push(firstResult);

      if (firstResult.chainContinues && firstResult.createdTile) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[Crafting] Запускаем checkChain для созданной плитки:`, {
            texture: firstResult.createdTile.tile.textureKey,
            pos: `${firstResult.createdTile.col},${firstResult.createdTile.row}`,
            activeSide: firstResult.createdTile.tile.activeSide,
          });
        }

        const visitedIds = new Set<string>(firstResult.removedTileIds);

        // Обёртка гарантирует доступность созданной плитки при рекурсивном поиске
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
          getTileAtWithResult,
          tileOperations,
          callbacks
        );
        results.push(...chainResults);
      }
    }

    // --- Шаг 2: проверяем соседей, чьи стрелки указывают на новую плитку ---
    // Это нужно для случаев, когда новая плитка «замыкает» цепочку,
    // которую ожидал сосед, размещённый раньше.
    const neighbors = getNeighborPositions(col, row);
    for (const neighbor of neighbors) {
      const neighborInfo = getTileAt(neighbor.col, neighbor.row);
      if (!neighborInfo) continue;

      const neighborTile = neighborInfo.tile;

      // Сосед интересен только если его стрелка направлена на новую плитку
      if (!doesActiveSidePointTo(neighborTile, neighbor.col, neighbor.row, col, row)) {
        continue;
      }

      const neighborMatch = this.findMatchingRecipe(neighborTile, neighbor.col, neighbor.row, getTileAt);

      // Пропускаем уже выполненные рецепты
      if (!neighborMatch || checkedRecipes.has(neighborMatch.recipe.id)) {
        continue;
      }

      checkedRecipes.add(neighborMatch.recipe.id);

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[Crafting] Сосед ${neighborTile.textureKey}@${neighbor.col},${neighbor.row} указывает на новую плитку`);
      }

      const craftResult = this.executeRecipe(neighborMatch, tileOperations, callbacks);
      results.push(craftResult);

      if (craftResult.chainContinues && craftResult.createdTile) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[Crafting] Запускаем checkChain для созданной плитки (от соседа):`, {
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
          getTileAtWithResult,
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

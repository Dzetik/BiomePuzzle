// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ ПЛИТКАМИ (с синхронизацией GridService + сохранения)
// ============================================================================

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { Tile } from '../models/Tile';
import { getRandomTileDefinition } from '../data/tileDefinitions';
import { INVENTORY_MAX_SLOTS } from '../constants/inventory';
import { GridService } from '../services/GridService';
import { Rotation } from '../models/Tile.types';
import {
  saveGame as saveGameService,
  loadGame as loadGameService,
  hasSave as hasSaveService,
  serializeGame,
  deserializeGame,
  SavedGame
} from '../services/SaveService';

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Данные об одной плитке, размещённой на игровой сетке.
 * Хранит ссылку на объект Tile и его логические координаты.
 */
export interface PlacedTileInfo {
  tile: Tile;
  col: number;
  row: number;
}

/**
 * Публичный интерфейс контекста плиток.
 *
 * Предоставляет доступ к состоянию и операциям над тремя игровыми зонами:
 * спавнер, игровая сетка (грид) и инвентарь. Также содержит методы
 * для работы с квестами и сохранением/загрузкой игры.
 */
export interface TilesContextType {
  // Спавнер
  spawnerTile: Tile | null;
  createSpawnerTile: (tile?: Tile) => Tile;
  getSpawnerTile: () => Tile | null;
  clearSpawnerTile: () => void;
  moveSpawnerTileToInventory: () => boolean;

  // Размещённые плитки (грид)
  placedTiles: Map<string, PlacedTileInfo>;
  addTile: (col: number, row: number, tile: Tile) => void;
  removeTile: (tileId: string) => void;
  getAllTiles: () => PlacedTileInfo[];
  isCellFree: (col: number, row: number) => boolean;
  isCellOccupied: (col: number, row: number) => boolean;
  getTileAt: (col: number, row: number) => PlacedTileInfo | undefined;
  rotateTileInInventory: (tileId: string) => void;
  rotateSpawnerTile: () => void;

  // Атомарное обновление для крафта
  craftTiles: (
    removeIds: string[],
    addInfo: { col: number; row: number; tile: Tile }
  ) => void;

  // Инвентарь
  inventoryTiles: Tile[];
  addToInventory: (tile: Tile) => boolean;
  removeFromInventory: (tileId: string) => void;
  getInventoryTile: (tileId: string) => Tile | undefined;

  // Активная плитка
  activeInventoryTileId: string | null;
  setActiveInventoryTileId: (id: string | null) => void;

  // Действия с размещёнными плитками
  movePlacedTileToInventory: (tileId: string) => boolean;
  submitTile: (tileId: string) => void;

  // Для системы квестов
  getTileCounts: () => Record<string, number>;
  removeTilesForQuest: (requirements: Array<{ textureKey: string; required: number }>) => boolean;

  // Сохранения
  saveGame: () => Promise<boolean>;
  loadGame: (questProgress?: Record<string, number>) => Promise<boolean>;
  hasSave: () => Promise<boolean>;
}

// ============================================================================
// КОНТЕКСТ
// ============================================================================

const TilesContext = createContext<TilesContextType | undefined>(undefined);

// ============================================================================
// ПРОВАЙДЕР
// ============================================================================

interface TilesProviderProps {
  children: ReactNode;
}

/**
 * Провайдер контекста плиток.
 *
 * Управляет тремя игровыми зонами (спавнер, грид, инвентарь) и предоставляет
 * все операции над ними через React Context. Синхронизирует состояние с
 * GridService для hit-test и snap-логики. Реализует сохранение/загрузку
 * через SaveService + AsyncStorage.
 *
 * Ref-переменные (`spawnerTileRef`, `inventoryTilesRef`, `placedTilesRef`)
 * используются внутри useCallback с пустым массивом зависимостей, чтобы
 * избежать пересоздания функций при каждом рендере и при этом всегда
 * иметь доступ к актуальным данным (обход проблемы stale closure).
 */
export const TilesProvider: React.FC<TilesProviderProps> = ({ children }) => {
  const [spawnerTile, setSpawnerTile] = useState<Tile | null>(null);
  const [placedTiles, setPlacedTiles] = useState<Map<string, PlacedTileInfo>>(new Map());
  const [inventoryTiles, setInventoryTiles] = useState<Tile[]>([]);
  const [activeInventoryTileId, setActiveInventoryTileId] = useState<string | null>(null);

  // Refs для актуальных значений внутри useCallback с пустыми зависимостями.
  // Решают проблему stale closure: функция создаётся один раз, но всегда
  // обращается к текущему состоянию через ref, а не через захваченное замыкание.
  const spawnerTileRef = useRef<Tile | null>(null);
  const inventoryTilesRef = useRef<Tile[]>([]);
  const placedTilesRef = useRef<Map<string, PlacedTileInfo>>(new Map());

  // Синхронизация ref с React-состоянием при каждом обновлении
  useEffect(() => { spawnerTileRef.current = spawnerTile; }, [spawnerTile]);
  useEffect(() => { inventoryTilesRef.current = inventoryTiles; }, [inventoryTiles]);
  useEffect(() => { placedTilesRef.current = placedTiles; }, [placedTiles]);

  // --------------------------------------------------------------------------
  // МЕТОДЫ: СПАВНЕР
  // --------------------------------------------------------------------------

  /**
   * Создаёт новую плитку для спавнера и сохраняет её в состоянии.
   *
   * Если передан готовый объект Tile, он используется напрямую.
   * Иначе выбирается случайное определение плитки из TILE_DEFINITIONS
   * и создаётся новый экземпляр с уникальным ID.
   *
   * @param tile - готовая плитка (опционально); если не передана — генерируется случайная
   * @returns созданный или переданный экземпляр Tile
   */
  const createSpawnerTile = useCallback((tile?: Tile): Tile => {
    if (tile) {
      setSpawnerTile(tile);
      return tile;
    }

    const definition = getRandomTileDefinition();
    // Уникальный ID: префикс + timestamp + случайное число для предотвращения коллизий
    const instanceId = `tile-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const newTile = new Tile({
      id: instanceId,
      textureKey: definition.textureKey,
      baseEdges: definition.baseEdges,
      activeSide: definition.activeSide,
      rotation: 0,
    });

    setSpawnerTile(newTile);
    return newTile;
  }, []);

  /**
   * Возвращает текущую плитку спавнера.
   * Используется там, где нужен прямой доступ без подписки на состояние.
   */
  const getSpawnerTile = useCallback(() => spawnerTile, [spawnerTile]);

  /** Очищает спавнер (устанавливает null). */
  const clearSpawnerTile = useCallback(() => setSpawnerTile(null), []);

  /**
   * Поворачивает плитку в инвентаре на 90 градусов по часовой стрелке.
   *
   * Использует иммутабельный метод `tile.rotated()`, возвращающий новый
   * экземпляр Tile, что безопасно для React-состояния.
   *
   * @param tileId - идентификатор плитки в инвентаре
   */
  const rotateTileInInventory = useCallback((tileId: string) => {
    setInventoryTiles(prev => prev.map(tile => {
      if (tile.id === tileId) {
        // rotated() возвращает новый объект — React обнаружит изменение по ссылке
        return tile.rotated();
      }
      return tile;
    }));
  }, []);

  /**
   * Поворачивает плитку в спавнере на 90 градусов по часовой стрелке.
   * Аналогично rotateTileInInventory использует иммутабельный метод rotated().
   */
  const rotateSpawnerTile = useCallback(() => {
    setSpawnerTile(prev => {
      if (!prev) return prev;
      return prev.rotated();
    });
  }, []);

  // --------------------------------------------------------------------------
  // МЕТОДЫ: РАЗМЕЩЁННЫЕ ПЛИТКИ
  // --------------------------------------------------------------------------

  /**
   * Размещает плитку на сетке в указанной ячейке.
   *
   * Обновляет React-состояние и синхронно помечает ячейку как занятую
   * в GridService (для дальнейших hit-test проверок).
   *
   * @param col  - индекс колонки целевой ячейки
   * @param row  - индекс строки целевой ячейки
   * @param tile - плитка для размещения
   */
  const addTile = useCallback((col: number, row: number, tile: Tile) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.set(tile.id, { tile, col, row });
      // Обновляем ref синхронно внутри updater-функции для немедленной доступности
      placedTilesRef.current = newMap;
      GridService.occupyCell(col, row, tile.id);
      return newMap;
    });
  }, []);

  /**
   * Удаляет плитку с игровой сетки по её ID.
   *
   * Освобождает занятую ячейку в GridService и обновляет ref.
   *
   * @param tileId - идентификатор удаляемой плитки
   */
  const removeTile = useCallback((tileId: string) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(tileId);
      newMap.delete(tileId);
      placedTilesRef.current = newMap;
      if (entry) {
        GridService.releaseCell(entry.col, entry.row);
      }
      return newMap;
    });
  }, []);

  /**
   * Атомарно удаляет несколько плиток и добавляет одну новую (результат крафта).
   *
   * Выполняется в рамках одного вызова setState, гарантируя единый рендер.
   * Используется CraftingService для атомарной замены исходных плиток на
   * скрафченную без промежуточных состояний.
   *
   * @param removeIds - ID плиток, участвовавших в крафте (будут удалены)
   * @param addInfo   - данные новой плитки (результат крафта) с её позицией
   */
  const craftTiles = useCallback((
    removeIds: string[],
    addInfo: { col: number; row: number; tile: Tile }
  ) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);

      // Удаляем исходные плитки и освобождаем их ячейки
      for (const id of removeIds) {
        const entry = newMap.get(id);
        if (entry) {
          GridService.releaseCell(entry.col, entry.row);
          newMap.delete(id);
        }
      }

      // Добавляем результирующую плитку и занимаем её ячейку
      newMap.set(addInfo.tile.id, {
        tile: addInfo.tile,
        col: addInfo.col,
        row: addInfo.row,
      });
      GridService.occupyCell(addInfo.col, addInfo.row, addInfo.tile.id);

      placedTilesRef.current = newMap;
      return newMap;
    });
  }, []);

  /**
   * Возвращает все размещённые плитки в виде массива.
   * Удобен для итерации там, где Map неудобен.
   */
  const getAllTiles = useCallback(() => Array.from(placedTiles.values()), [placedTiles]);

  /**
   * Проверяет, свободна ли ячейка сетки.
   *
   * Использует ref для чтения актуального состояния без зависимости
   * от React-цикла рендера.
   *
   * @param col - индекс колонки
   * @param row - индекс строки
   * @returns true если ячейка не занята
   */
  const isCellFree = useCallback((col: number, row: number): boolean => {
    for (const [, info] of placedTilesRef.current) {
      if (info.col === col && info.row === row) return false;
    }
    return true;
  }, []);

  /**
   * Проверяет, занята ли ячейка сетки.
   * Является инвертированным псевдонимом isCellFree.
   */
  const isCellOccupied = useCallback((col: number, row: number): boolean => {
    return !isCellFree(col, row);
  }, [isCellFree]);

  /**
   * Возвращает данные плитки, занимающей указанную ячейку, или undefined.
   *
   * Использует ref для чтения без зависимости от React-цикла.
   *
   * @param col - индекс колонки
   * @param row - индекс строки
   */
  const getTileAt = useCallback((col: number, row: number): PlacedTileInfo | undefined => {
    for (const [, info] of placedTilesRef.current) {
      if (info.col === col && info.row === row) return info;
    }
    return undefined;
  }, []);

  // --------------------------------------------------------------------------
  // МЕТОДЫ: ИНВЕНТАРЬ
  // --------------------------------------------------------------------------

  /**
   * Добавляет плитку в инвентарь.
   *
   * Новая плитка помещается в начало массива (prepend), чтобы
   * последние добавленные отображались первыми.
   *
   * @param tile - плитка для добавления
   * @returns true при успехе, false если инвентарь заполнен
   */
  const addToInventory = useCallback((tile: Tile): boolean => {
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] Инвентарь полон');
      return false;
    }
    // Новая плитка добавляется в начало для приоритетного отображения
    setInventoryTiles(prev => [tile, ...prev]);
    return true;
  }, [inventoryTiles.length]);

  /**
   * Удаляет плитку из инвентаря по её ID.
   *
   * @param tileId - идентификатор удаляемой плитки
   */
  const removeFromInventory = useCallback((tileId: string) => {
    setInventoryTiles(prev => prev.filter(t => t.id !== tileId));
  }, []);

  /**
   * Ищет плитку в инвентаре по ID.
   *
   * @param tileId - идентификатор плитки
   * @returns экземпляр Tile или undefined если не найдена
   */
  const getInventoryTile = useCallback((tileId: string): Tile | undefined =>
    inventoryTiles.find(t => t.id === tileId), [inventoryTiles]);

  // --------------------------------------------------------------------------
  // МЕТОДЫ: ПЕРЕМЕЩЕНИЕ МЕЖДУ ЗОНАМИ
  // --------------------------------------------------------------------------

  /**
   * Перемещает текущую плитку из спавнера в инвентарь.
   *
   * Создаёт копию плитки спавнера (сохраняя activeSide и rotation),
   * добавляет её в инвентарь и очищает спавнер.
   *
   * @returns true при успехе, false если спавнер пуст или инвентарь полон
   */
  const moveSpawnerTileToInventory = useCallback((): boolean => {
    if (!spawnerTile) {
      console.warn('[TilesContext] Нет плитки в спавнере');
      return false;
    }
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] Инвентарь полон');
      return false;
    }

    // Явное копирование с сохранением всех параметров исходной плитки
    const tileCopy = new Tile({
      id: spawnerTile.id,
      textureKey: spawnerTile.textureKey,
      activeSide: spawnerTile.activeSide,
      rotation: spawnerTile.rotation,
    });

    setInventoryTiles(prev => [tileCopy, ...prev]);
    setSpawnerTile(null);

    return true;
  }, [spawnerTile, inventoryTiles.length]);

  /**
   * Перемещает размещённую плитку с сетки в инвентарь.
   *
   * Освобождает ячейку в GridService и обновляет оба состояния:
   * placedTiles (удаление) и inventoryTiles (добавление).
   *
   * @param tileId - идентификатор плитки на сетке
   * @returns true при успехе, false если плитка не найдена или инвентарь полон
   */
  const movePlacedTileToInventory = useCallback((tileId: string): boolean => {
    const entry = placedTilesRef.current.get(tileId);
    if (!entry) {
      console.warn('[TilesContext] Плитка не найдена на гриде:', tileId);
      return false;
    }
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] Инвентарь полон');
      return false;
    }

    const tile = entry.tile;

    // Добавляем в инвентарь до удаления с грида, чтобы избежать мигания UI
    setInventoryTiles(prev => [tile, ...prev]);

    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(tileId);
      placedTilesRef.current = newMap;
      GridService.releaseCell(entry.col, entry.row);
      return newMap;
    });

    if (__DEV__) {
      console.log('[TilesContext] Плитка перемещена в инвентарь:', tileId);
    }
    return true;
  }, [inventoryTiles.length]);

  /**
   * Удаляет размещённую плитку с сетки без добавления в инвентарь.
   *
   * Используется системой квестов для "сдачи" плитки в счёт выполнения
   * условия квеста.
   *
   * @param tileId - идентификатор сдаваемой плитки
   */
  const submitTile = useCallback((tileId: string) => {
    const entry = placedTilesRef.current.get(tileId);
    if (!entry) {
      console.warn('[TilesContext] Плитка не найдена для сдачи:', tileId);
      return;
    }

    if (__DEV__) {
      console.log('[TilesContext] Плитка сдана:', {
        tileId,
        textureKey: entry.tile.textureKey,
      });
    }

    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(tileId);
      placedTilesRef.current = newMap;
      GridService.releaseCell(entry.col, entry.row);
      return newMap;
    });
  }, []);

  // --------------------------------------------------------------------------
  // МЕТОДЫ: КВЕСТЫ
  // --------------------------------------------------------------------------

  /**
   * Подсчитывает количество плиток каждого типа во всей игре.
   *
   * Учитывает плитки как на сетке, так и в инвентаре.
   * Возвращает словарь { textureKey -> количество }, используемый системой
   * квестов для проверки выполнимости требований.
   *
   * @returns объект вида { "wood": 3, "stone": 1, ... }
   */
  const getTileCounts = useCallback((): Record<string, number> => {
    const counts: Record<string, number> = {};

    // Плитки на сетке
    for (const [, info] of placedTilesRef.current) {
      const key = info.tile.textureKey;
      counts[key] = (counts[key] || 0) + 1;
    }

    // Плитки в инвентаре
    for (const tile of inventoryTiles) {
      const key = tile.textureKey;
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }, [inventoryTiles]);

  /**
   * Удаляет плитки, соответствующие требованиям квеста.
   *
   * Алгоритм двухпроходной:
   * 1. Проверяет выполнимость: у игрока должно быть достаточно каждого типа.
   * 2. Выполняет удаление: сначала с сетки, затем (при нехватке) из инвентаря.
   *
   * @param requirements - список требований: { textureKey, required }
   * @returns true если все требования выполнены и плитки удалены; false если ресурсов недостаточно
   */
  const removeTilesForQuest = useCallback((
    requirements: Array<{ textureKey: string; required: number }>
  ): boolean => {
    const counts = getTileCounts();

    // Проверка: хватает ли плиток каждого типа до начала удаления
    for (const req of requirements) {
      if ((counts[req.textureKey] || 0) < req.required) {
        return false;
      }
    }

    for (const req of requirements) {
      let remaining = req.required;

      // Первый приоритет — плитки с сетки
      const tilesToRemove: string[] = [];
      for (const [tileId, info] of placedTilesRef.current) {
        if (remaining <= 0) break;
        if (info.tile.textureKey === req.textureKey) {
          tilesToRemove.push(tileId);
          remaining--;
        }
      }

      if (tilesToRemove.length > 0) {
        setPlacedTiles(prev => {
          const newMap = new Map(prev);
          for (const tileId of tilesToRemove) {
            const entry = newMap.get(tileId);
            if (entry) {
              GridService.releaseCell(entry.col, entry.row);
              newMap.delete(tileId);
            }
          }
          placedTilesRef.current = newMap;
          return newMap;
        });
      }

      // Второй приоритет — плитки из инвентаря (если с сетки не хватило)
      if (remaining > 0) {
        setInventoryTiles(prev => {
          let removed = 0;
          return prev.filter(tile => {
            if (tile.textureKey === req.textureKey && removed < remaining) {
              removed++;
              return false;
            }
            return true;
          });
        });
      }
    }

    return true;
  }, [getTileCounts]);

  // --------------------------------------------------------------------------
  // МЕТОДЫ: СОХРАНЕНИЕ / ЗАГРУЗКА
  // --------------------------------------------------------------------------

  /**
   * Сохраняет текущее состояние игры в AsyncStorage.
   *
   * Читает данные через ref-переменные (а не из замыкания), чтобы гарантировать
   * актуальность данных независимо от времени создания коллбэка. Данные квеста
   * берутся из `global.questData` — разделяемого состояния между TilesContext
   * и QuestContext.
   *
   * @returns true при успешном сохранении, false при ошибке
   */
  const saveGame = useCallback(async (): Promise<boolean> => {
    // global.questData — bridge между TilesContext и QuestContext
    const questData = (global as any).questData || {
      activeQuestId: null,
      completedQuests: [],
      activeQuestProgress: {},
    };

    // Используем ref вместо захваченных в замыкании state-переменных,
    // чтобы всегда сохранять актуальные данные
    const savedData = serializeGame(
      Array.from(placedTilesRef.current.values()),
      inventoryTilesRef.current,
      spawnerTileRef.current,
      questData
    );

    if (__DEV__) {
      console.log('[TilesContext] Saving:', {
        gridCount: savedData.grid.length,
        inventoryCount: savedData.inventory.length,
        spawnerId: savedData.spawner?.tileId,
        questId: savedData.quest.activeQuestId,
      });
    }

    return await saveGameService(savedData);
  }, []); // Пустой массив зависимостей: функция стабильна, данные читаются через ref

  /**
   * Загружает сохранение из AsyncStorage и восстанавливает игровое состояние.
   *
   * Создаёт новые экземпляры Tile из сырых данных сохранения через фабрику
   * `createTileFromSave`. Прогресс активного квеста при необходимости
   * инжектируется через `global.questData`.
   *
   * @param questProgress - прогресс активного квеста для восстановления (опционально)
   * @returns true при успешном восстановлении, false если сохранения нет или ошибка
   */
  const loadGame = useCallback(async (questProgress?: Record<string, number>): Promise<boolean> => {
    const saved = await loadGameService();
    if (!saved) return false;

    try {
      // Фабрика плиток: создаёт Tile из плоских данных сохранения
      const createTileFromSave = (data: { textureKey: string; rotation: number; activeSide?: string }) => {
        return new Tile({
          // Новый уникальный ID при каждой загрузке — старые ID из сохранения не используются
          id: `restored-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          textureKey: data.textureKey,
          rotation: data.rotation as Rotation,
          activeSide: data.activeSide as any,
        });
      };

      const restored = deserializeGame(saved, createTileFromSave);

      console.log('[TilesContext] Restored:', {
        gridCount: restored.grid.length,
        inventoryCount: restored.inventory.length,
        // restored.spawner — экземпляр Tile, поэтому .id, а не .tileId
        spawnerId: restored.spawner?.id,
        spawnerTexture: restored.spawner?.textureKey,
        questId: restored.quest.activeQuestId,
      });

      // Восстанавливаем грид: строим Map<tileId, PlacedTileInfo>
      const newPlacedMap = new Map<string, PlacedTileInfo>();
      restored.grid.forEach(item => {
        newPlacedMap.set(item.tile.id, {
          tile: item.tile,
          col: item.col,
          row: item.row,
        });
      });
      setPlacedTiles(newPlacedMap);
      // Синхронизируем ref немедленно, не дожидаясь useEffect
      placedTilesRef.current = newPlacedMap;

      setInventoryTiles(restored.inventory);
      setSpawnerTile(restored.spawner);

      // Если передан прогресс квеста — обновляем global.questData
      if (questProgress && restored.quest.activeQuestId) {
        (global as any).questData = {
          ...(global as any).questData,
          activeQuestProgress: questProgress,
        };
      }

      console.log('[TilesContext] Game restored');
      return true;
    } catch (error) {
      console.error('[TilesContext] Restore failed:', error);
      return false;
    }
  }, []);

  /**
   * Проверяет наличие сохранения в AsyncStorage.
   *
   * @returns true если сохранение существует
   */
  const hasSave = useCallback(async (): Promise<boolean> => {
    return await hasSaveService();
  }, []);

  // --------------------------------------------------------------------------
  // ЗНАЧЕНИЕ КОНТЕКСТА
  // --------------------------------------------------------------------------

  const contextValue: TilesContextType = {
    spawnerTile,
    createSpawnerTile,
    getSpawnerTile,
    clearSpawnerTile,
    moveSpawnerTileToInventory,

    placedTiles,
    addTile,
    removeTile,
    getAllTiles,
    isCellFree,
    isCellOccupied,
    getTileAt,
    rotateTileInInventory,
    rotateSpawnerTile,

    craftTiles,

    inventoryTiles,
    addToInventory,
    removeFromInventory,
    getInventoryTile,
    activeInventoryTileId,
    setActiveInventoryTileId,

    movePlacedTileToInventory,
    submitTile,

    getTileCounts,
    removeTilesForQuest,

    saveGame,
    loadGame,
    hasSave,
  };

  return (
    <TilesContext.Provider value={contextValue}>
      {children}
    </TilesContext.Provider>
  );
};

// ============================================================================
// ХУК ДЛЯ ИСПОЛЬЗОВАНИЯ КОНТЕКСТА
// ============================================================================

/**
 * Хук для доступа к TilesContext.
 *
 * Выбрасывает ошибку, если используется вне дерева TilesProvider,
 * что помогает обнаружить неправильную структуру провайдеров на этапе разработки.
 *
 * @returns значение TilesContextType
 * @throws Error если вызван вне TilesProvider
 */
export const useTiles = (): TilesContextType => {
  const context = useContext(TilesContext);
  if (!context) {
    throw new Error('useTiles must be used within a TilesProvider');
  }
  return context;
};

export default TilesContext;

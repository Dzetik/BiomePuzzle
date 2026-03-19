// ============================================================================
// СЕРВИС СОХРАНЕНИЙ ИГРЫ
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tile } from '../models/Tile';
import { PlacedTileInfo } from '../context/TilesContext';

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Полная структура сохранения игры, записываемая в AsyncStorage.
 *
 * Содержит снимок всех изменяемых игровых состояний: плитки на сетке,
 * инвентарь, текущую плитку спавнера, прогресс квестов и статистику.
 */
export interface SavedGame {
  /** Версия формата сохранения. Используется при миграции данных. */
  version: number;
  /** Временная метка сохранения в формате ISO 8601. */
  savedAt: string;

  /** Плитки, размещённые на игровой сетке. */
  grid: Array<{
    col: number;
    row: number;
    tileId: string;
    textureKey: string;
    rotation: number;
    activeSide?: 'top' | 'right' | 'bottom' | 'left';
  }>;

  /** Плитки в инвентаре игрока. */
  inventory: Array<{
    tileId: string;
    textureKey: string;
    rotation: number;
    activeSide?: 'top' | 'right' | 'bottom' | 'left';
  }>;

  /** Текущая плитка в спавнере, либо null если спавнер пуст. */
  spawner: {
    tileId: string;
    textureKey: string;
    rotation: number;
    activeSide?: 'top' | 'right' | 'bottom' | 'left';
  } | null;

  /** Состояние системы квестов. */
  quest: {
    activeQuestId: string | null;
    completedQuests: string[];
    /** Прогресс активного квеста: ключ — textureKey, значение — количество. */
    activeQuestProgress?: {
      [textureKey: string]: number;
    };
  };

  /** Статистика игровой сессии (необязательное поле). */
  stats?: {
    tilesPlaced: number;
    questsCompleted: number;
    playTime: number;
  };
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

/** Ключ AsyncStorage, под которым хранится сохранение. */
const SAVE_KEY = '@BiomePuzzle:savegame';

/** Текущая версия формата сохранения. Увеличивать при изменении структуры SavedGame. */
const SAVE_VERSION = 1;

// ============================================================================
// СЕРИАЛИЗАЦИЯ
// ============================================================================

/**
 * Преобразует текущее состояние игры в объект SavedGame для записи в хранилище.
 *
 * Извлекает из объектов Tile только примитивные поля (id, textureKey, rotation,
 * activeSide), исключая методы и вычисляемые свойства, которые не нужны при
 * восстановлении.
 *
 * @param placedTiles  - список размещённых плиток с их позициями на сетке
 * @param inventoryTiles - плитки в инвентаре
 * @param spawnerTile  - текущая плитка спавнера (null если пуст)
 * @param questData    - текущее состояние квестов
 * @returns сериализованный объект SavedGame
 */
export const serializeGame = (
  placedTiles: PlacedTileInfo[],
  inventoryTiles: Tile[],
  spawnerTile: Tile | null,
  questData: {
    activeQuestId: string | null;
    completedQuests: string[];
    activeQuestProgress?: Record<string, number>;
  }
): SavedGame => {
  return {
    version: SAVE_VERSION,
    // Метка времени для информационных целей (не используется при загрузке)
    savedAt: new Date().toISOString(),

    grid: placedTiles.map(entry => ({
      col: entry.col,
      row: entry.row,
      tileId: entry.tile.id,
      textureKey: entry.tile.textureKey,
      rotation: entry.tile.rotation,
      activeSide: entry.tile.activeSide,
    })),

    inventory: inventoryTiles.map(tile => ({
      tileId: tile.id,
      textureKey: tile.textureKey,
      rotation: tile.rotation,
      activeSide: tile.activeSide,
    })),

    spawner: spawnerTile ? {
      tileId: spawnerTile.id,
      textureKey: spawnerTile.textureKey,
      rotation: spawnerTile.rotation,
      activeSide: spawnerTile.activeSide,
    } : null,

    quest: {
      activeQuestId: questData.activeQuestId,
      completedQuests: questData.completedQuests,
      // Fallback на пустой объект, если прогресс квеста ещё не инициализирован
      activeQuestProgress: questData.activeQuestProgress || {},
    },

    stats: {
      tilesPlaced: 0,
      questsCompleted: questData.completedQuests.length,
      playTime: 0,
    },
  };
};

/**
 * Восстанавливает игровые объекты из сохранённого формата.
 *
 * Принимает фабричную функцию `createTile`, чтобы не зависеть от конкретного
 * способа создания экземпляров Tile (обычно передаётся из TilesContext).
 *
 * @param saved      - десериализованный объект сохранения
 * @param createTile - фабрика: принимает сырые данные плитки, возвращает Tile
 * @returns восстановленное состояние: grid, inventory, spawner, quest
 */
export const deserializeGame = (
  saved: SavedGame,
  createTile: (data: { textureKey: string; rotation: number; activeSide?: string }) => Tile
) => {
  return {
    grid: saved.grid.map(item => ({
      col: item.col,
      row: item.row,
      tile: createTile({
        textureKey: item.textureKey,
        rotation: item.rotation,
        activeSide: item.activeSide,
      }),
    })),

    inventory: saved.inventory.map(item =>
      createTile({
        textureKey: item.textureKey,
        rotation: item.rotation,
        activeSide: item.activeSide,
      })
    ),

    spawner: saved.spawner ? createTile({
      textureKey: saved.spawner.textureKey,
      rotation: saved.spawner.rotation,
      activeSide: saved.spawner.activeSide,
    }) : null,

    quest: {
      activeQuestId: saved.quest.activeQuestId,
      completedQuests: saved.quest.completedQuests,
      activeQuestProgress: saved.quest.activeQuestProgress || {},
    },
  };
};

// ============================================================================
// СОХРАНЕНИЕ / ЗАГРУЗКА
// ============================================================================

/**
 * Записывает сохранение игры в AsyncStorage.
 *
 * После записи выполняет верификацию: перечитывает ключ из хранилища и
 * логирует длину строки, чтобы подтвердить факт сохранения.
 *
 * @param savedGame - объект сохранения, полученный из serializeGame()
 * @returns true при успешной записи, false при любой ошибке
 */
export const saveGame = async (savedGame: SavedGame): Promise<boolean> => {
  try {
    console.log('[SaveService] Saving data:', {
      version: savedGame.version,
      gridCount: savedGame.grid.length,
      inventoryCount: savedGame.inventory.length,
      spawnerId: savedGame.spawner?.tileId,
      questId: savedGame.quest.activeQuestId,
    });

    // Сериализация и запись в AsyncStorage
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(savedGame));

    // Верификация: убеждаемся, что данные действительно записались
    const verify = await AsyncStorage.getItem(SAVE_KEY);
    console.log('[SaveService] Verify save:', verify ? 'OK, length: ' + verify.length : 'FAILED');

    console.log('[SaveService] Game saved');
    return true;
  } catch (error) {
    console.error('[SaveService] Save failed:', error);
    return false;
  }
};

/**
 * Загружает сохранение игры из AsyncStorage.
 *
 * Проверяет версию формата: при несовпадении выводит предупреждение в консоль
 * (место для будущей логики миграции). Возвращает null, если сохранение
 * отсутствует или произошла ошибка.
 *
 * @returns объект SavedGame при успехе, null если сохранения нет или ошибка
 */
export const loadGame = async (): Promise<SavedGame | null> => {
  try {
    const data = await AsyncStorage.getItem(SAVE_KEY);
    if (!data) {
      console.log('[SaveService] No save found');
      return null;
    }

    const parsed = JSON.parse(data) as SavedGame;

    // Проверка версии — точка расширения для будущих миграций формата
    if (parsed.version !== SAVE_VERSION) {
      console.warn('[SaveService] Save version mismatch:', parsed.version);
    }

    console.log('[SaveService] Game loaded');
    return parsed;
  } catch (error) {
    console.error('[SaveService] Load failed:', error);
    return null;
  }
};

/**
 * Удаляет сохранение из AsyncStorage.
 *
 * Используется при сбросе прогресса или во время разработки.
 * Ошибки подавляются — удаление несуществующего ключа безопасно.
 */
export const deleteSave = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SAVE_KEY);
    console.log('[SaveService] Save deleted');
  } catch (error) {
    console.error('[SaveService] Delete failed:', error);
  }
};

/**
 * Проверяет наличие сохранения в AsyncStorage.
 *
 * @returns true если сохранение существует, false в противном случае или при ошибке
 */
export const hasSave = async (): Promise<boolean> => {
  try {
    const data = await AsyncStorage.getItem(SAVE_KEY);
    return data !== null;
  } catch {
    return false;
  }
};

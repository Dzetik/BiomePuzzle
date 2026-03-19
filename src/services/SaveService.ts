// ============================================================================
// СЕРВИС СОХРАНЕНИЙ ИГРЫ
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tile } from '../models/Tile';
import { PlacedTileInfo } from '../context/TilesContext';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface SavedGame {
  version: number;
  savedAt: string;
  
  // Сетка
  grid: Array<{
    col: number;
    row: number;
    tileId: string;
    textureKey: string;
    rotation: number;
    activeSide?: 'top' | 'right' | 'bottom' | 'left';
  }>;
  
  // Инвентарь
  inventory: Array<{
    tileId: string;
    textureKey: string;
    rotation: number;
    activeSide?: 'top' | 'right' | 'bottom' | 'left';
  }>;
  
  // Спавнер
  spawner: {
    tileId: string;
    textureKey: string;
    rotation: number;
    activeSide?: 'top' | 'right' | 'bottom' | 'left';
  } | null;
  
  // Квест
  quest: {
    activeQuestId: string | null;
    completedQuests: string[];
    activeQuestProgress?: {
      [textureKey: string]: number; // Например: { "wood": 3, "stone": 1 }
    };
  };
  
  // Статистика (опционально)
  stats?: {
    tilesPlaced: number;
    questsCompleted: number;
    playTime: number;
  };
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const SAVE_KEY = '@BiomePuzzle:savegame';
const SAVE_VERSION = 1;

// ============================================================================
// СЕРИАЛИЗАЦИЯ
// ============================================================================

/**
 * Преобразует данные игры в формат для сохранения
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
      activeQuestProgress: questData.activeQuestProgress || {}, 
    },
    
    stats: {
      tilesPlaced: 0, // Заполни из своего контекста статистики
      questsCompleted: questData.completedQuests.length,
      playTime: 0,
    },
  };
};

/**
 * Восстанавливает данные игры из сохранённого формата
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

export const saveGame = async (savedGame: SavedGame): Promise<boolean> => {
  try {
    // 👇 ДОБАВЬ ЭТО:
    console.log('[SaveService] 📦 Saving data:', {
      version: savedGame.version,
      gridCount: savedGame.grid.length,
      inventoryCount: savedGame.inventory.length,
      spawnerId: savedGame.spawner?.tileId,
      questId: savedGame.quest.activeQuestId,
    });
    
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(savedGame));
    
    // 👇 И ЭТО:
    const verify = await AsyncStorage.getItem(SAVE_KEY);
    console.log('[SaveService] 🔍 Verify save:', verify ? 'OK, length: ' + verify.length : 'FAILED');
    
    console.log('[SaveService] ✅ Game saved');
    return true;
  } catch (error) {
    console.error('[SaveService] ❌ Save failed:', error);
    return false;
  }
};

export const loadGame = async (): Promise<SavedGame | null> => {
  try {
    const data = await AsyncStorage.getItem(SAVE_KEY);
    if (!data) {
      console.log('[SaveService] ℹ️ No save found');
      return null;
    }
    
    const parsed = JSON.parse(data) as SavedGame;
    
    // Проверка версии (для будущих обновлений формата)
    if (parsed.version !== SAVE_VERSION) {
      console.warn('[SaveService] ⚠️ Save version mismatch:', parsed.version);
      // Здесь можно добавить миграцию данных
    }
    
    console.log('[SaveService] ✅ Game loaded');
    return parsed;
  } catch (error) {
    console.error('[SaveService] ❌ Load failed:', error);
    return null;
  }
};

export const deleteSave = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SAVE_KEY);
    console.log('[SaveService] 🗑️ Save deleted');
  } catch (error) {
    console.error('[SaveService] ❌ Delete failed:', error);
  }
};

export const hasSave = async (): Promise<boolean> => {
  try {
    const data = await AsyncStorage.getItem(SAVE_KEY);
    return data !== null;
  } catch {
    return false;
  }
};
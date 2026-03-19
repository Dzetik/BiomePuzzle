// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ ПЛИТКАМИ (с синхронизацией GridService + сохранения)
// ============================================================================

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { Tile } from '../models/Tile';
import { getRandomTileDefinition } from '../data/tileDefinitions';
import { INVENTORY_MAX_SLOTS } from '../constants/inventory';
import { GridService } from '../services/GridService';
import { Rotation } from '../models/Tile.types';
// ============================================================================
// 🔑 Импорт сервиса сохранений
// ============================================================================
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

export interface PlacedTileInfo {
  tile: Tile;
  col: number;
  row: number;
}

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
  getOccupiedBounds: () => { minCol: number; maxCol: number; minRow: number; maxRow: number } | null;
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
  getInventoryTiles: () => Tile[];
  isInventoryFull: () => boolean;
  getInventoryFreeSlots: () => number;
  clearInventory: () => void;
  
  // Активная плитка
  activeInventoryTileId: string | null;
  setActiveInventoryTileId: (id: string | null) => void;
  
  // ============================================================================
  // 🔑 Действия с размещёнными плитками
  // ============================================================================
  movePlacedTileToInventory: (tileId: string) => boolean;
  submitTile: (tileId: string) => void;
  
  // ============================================================================
  // 🔑 Для системы квестов
  // ============================================================================
  getTileCounts: () => Record<string, number>;
  removeTilesForQuest: (requirements: Array<{ textureKey: string; required: number }>) => boolean;
  
  // ============================================================================
  // 🔑 НОВОЕ: Сохранения
  // ============================================================================
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

export const TilesProvider: React.FC<TilesProviderProps> = ({ children }) => {
  const [spawnerTile, setSpawnerTile] = useState<Tile | null>(null);
  const [placedTiles, setPlacedTiles] = useState<Map<string, PlacedTileInfo>>(new Map());
  const [inventoryTiles, setInventoryTiles] = useState<Tile[]>([]);
  const [activeInventoryTileId, setActiveInventoryTileId] = useState<string | null>(null);
  
  // ============================================================================
  // 🔑 НОВОЕ: Ref для актуальных значений в saveGame (решение проблемы замыканий)
  // ============================================================================
  const spawnerTileRef = useRef<Tile | null>(null);
  const inventoryTilesRef = useRef<Tile[]>([]);
  const placedTilesRef = useRef<Map<string, PlacedTileInfo>>(new Map());
  
  // Синхронизация ref с состояниями
  useEffect(() => { spawnerTileRef.current = spawnerTile; }, [spawnerTile]);
  useEffect(() => { inventoryTilesRef.current = inventoryTiles; }, [inventoryTiles]);
  useEffect(() => { placedTilesRef.current = placedTiles; }, [placedTiles]);
  
  // --------------------------------------------------------------------------
  // МЕТОДЫ: СПАВНЕР
  // --------------------------------------------------------------------------
  
  const createSpawnerTile = useCallback((tile?: Tile): Tile => {
    if (tile) {
      setSpawnerTile(tile);
      return tile;
    }
    
    const definition = getRandomTileDefinition();
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
  
  const getSpawnerTile = useCallback(() => spawnerTile, [spawnerTile]);
  const clearSpawnerTile = useCallback(() => setSpawnerTile(null), []);
  
  // ============================================================================
  // 🔑 Иммутабельный поворот плитки в инвентаре
  // ============================================================================
  const rotateTileInInventory = useCallback((tileId: string) => {
    setInventoryTiles(prev => prev.map(tile => {
      if (tile.id === tileId) {
        return tile.rotated();
      }
      return tile;
    }));
  }, []);

  const rotateSpawnerTile = useCallback(() => {
    setSpawnerTile(prev => {
      if (!prev) return prev;
      return prev.rotated();
    });
  }, []);

  // --------------------------------------------------------------------------
  // МЕТОДЫ: РАЗМЕЩЁННЫЕ ПЛИТКИ
  // --------------------------------------------------------------------------
  
  const addTile = useCallback((col: number, row: number, tile: Tile) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.set(tile.id, { tile, col, row });
      placedTilesRef.current = newMap;
      GridService.occupyCell(col, row, tile.id);
      return newMap;
    });
  }, []);
  
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
  
  // ============================================================================
  // Атомарное обновление для крафта
  // ============================================================================
  const craftTiles = useCallback((
    removeIds: string[],
    addInfo: { col: number; row: number; tile: Tile }
  ) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      
      for (const id of removeIds) {
        const entry = newMap.get(id);
        if (entry) {
          GridService.releaseCell(entry.col, entry.row);
          newMap.delete(id);
        }
      }
      
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
  
  const getAllTiles = useCallback(() => Array.from(placedTiles.values()), [placedTiles]);
  
  const isCellFree = useCallback((col: number, row: number): boolean => {
    for (const [, info] of placedTilesRef.current) {
      if (info.col === col && info.row === row) return false;
    }
    return true;
  }, []);

  const isCellOccupied = useCallback((col: number, row: number): boolean => {
    return !isCellFree(col, row);
  }, [isCellFree]);

  const getTileAt = useCallback((col: number, row: number): PlacedTileInfo | undefined => {
    for (const [, info] of placedTilesRef.current) {
      if (info.col === col && info.row === row) return info;
    }
    return undefined;
  }, []);

  const getOccupiedBounds = useCallback(() => {
    if (placedTiles.size === 0) return null;
    
    let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
    for (const [, info] of placedTiles) {
      minCol = Math.min(minCol, info.col);
      maxCol = Math.max(maxCol, info.col);
      minRow = Math.min(minRow, info.row);
      maxRow = Math.max(maxRow, info.row);
    }
    return { minCol, maxCol, minRow, maxRow };
  }, [placedTiles]);
  
  // --------------------------------------------------------------------------
  // МЕТОДЫ: ИНВЕНТАРЬ
  // --------------------------------------------------------------------------
  
  const addToInventory = useCallback((tile: Tile): boolean => {
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] ❌ Инвентарь полон');
      return false;
    }
    setInventoryTiles(prev => [tile, ...prev]);
    return true;
  }, [inventoryTiles.length]);
  
  const removeFromInventory = useCallback((tileId: string) => {
    setInventoryTiles(prev => prev.filter(t => t.id !== tileId));
  }, []);
  
  const getInventoryTile = useCallback((tileId: string): Tile | undefined => 
    inventoryTiles.find(t => t.id === tileId), [inventoryTiles]);
  
  const getInventoryTiles = useCallback(() => inventoryTiles, [inventoryTiles]);
  const isInventoryFull = useCallback(() => inventoryTiles.length >= INVENTORY_MAX_SLOTS, [inventoryTiles.length]);
  const getInventoryFreeSlots = useCallback(() => Math.max(0, INVENTORY_MAX_SLOTS - inventoryTiles.length), [inventoryTiles.length]);
  const clearInventory = useCallback(() => setInventoryTiles([]), []);

  // ============================================================================
  // МЕТОД: ПЕРЕМЕЩЕНИЕ ПЛИТКИ ИЗ СПАВНЕРА В ИНВЕНТАРЬ
  // ============================================================================
  const moveSpawnerTileToInventory = useCallback((): boolean => {
    if (!spawnerTile) {
      console.warn('[TilesContext] ❌ Нет плитки в спавнере');
      return false;
    }
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] ❌ Инвентарь полон');
      return false;
    }
    
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
  
  // ============================================================================
  // 🔑 Перемещение размещённой плитки в инвентарь
  // ============================================================================
  const movePlacedTileToInventory = useCallback((tileId: string): boolean => {
    const entry = placedTilesRef.current.get(tileId);
    if (!entry) {
      console.warn('[TilesContext] ❌ Плитка не найдена на гриде:', tileId);
      return false;
    }
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] ❌ Инвентарь полон');
      return false;
    }
    
    const tile = entry.tile;
    
    setInventoryTiles(prev => [tile, ...prev]);
    
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(tileId);
      placedTilesRef.current = newMap;
      GridService.releaseCell(entry.col, entry.row);
      return newMap;
    });
    
    if (__DEV__) {
      console.log('[TilesContext] ✅ Плитка перемещена в инвентарь:', tileId);
    }
    return true;
  }, [inventoryTiles.length]);

  // ============================================================================
  // 🔑 «Сдать» плитку
  // ============================================================================
  const submitTile = useCallback((tileId: string) => {
    const entry = placedTilesRef.current.get(tileId);
    if (!entry) {
      console.warn('[TilesContext] ❌ Плитка не найдена для сдачи:', tileId);
      return;
    }
    
    if (__DEV__) {
      console.log('[TilesContext] 🎯 Плитка сдана:', {
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
  
  // ============================================================================
  // 🔑 Подсчёт плиток по типам (для квестов)
  // ============================================================================
  const getTileCounts = useCallback((): Record<string, number> => {
    const counts: Record<string, number> = {};
    
    for (const [, info] of placedTilesRef.current) {
      const key = info.tile.textureKey;
      counts[key] = (counts[key] || 0) + 1;
    }
    
    for (const tile of inventoryTiles) {
      const key = tile.textureKey;
      counts[key] = (counts[key] || 0) + 1;
    }
    
    return counts;
  }, [inventoryTiles]);

  // ============================================================================
  // 🔑 Удаление плиток для квеста
  // ============================================================================
  const removeTilesForQuest = useCallback((
    requirements: Array<{ textureKey: string; required: number }>
  ): boolean => {
    const counts = getTileCounts();
    
    for (const req of requirements) {
      if ((counts[req.textureKey] || 0) < req.required) {
        return false;
      }
    }
    
    for (const req of requirements) {
      let remaining = req.required;
      
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
  
  // ============================================================================
  // 🔑 НОВОЕ: ФУНКЦИИ СОХРАНЕНИЯ (исправленные с использованием ref)
  // ============================================================================
  
  const saveGame = useCallback(async (): Promise<boolean> => {
    const questData = (global as any).questData || {
      activeQuestId: null,
      completedQuests: [],
      activeQuestProgress: {},
    };
    
    // 🔑 ИСПОЛЬЗУЕМ REF ДЛЯ АКТУАЛЬНЫХ ЗНАЧЕНИЙ (решение проблемы замыканий)
    const savedData = serializeGame(
      Array.from(placedTilesRef.current.values()),  // 👈 Ref вместо placedTiles
      inventoryTilesRef.current,                     // 👈 Ref вместо inventoryTiles
      spawnerTileRef.current,                        // 👈 Ref вместо spawnerTile
      questData
    );
    
    // 🔑 Лог для отладки
    if (__DEV__) {
      console.log('[TilesContext] 📦 Saving:', {
        gridCount: savedData.grid.length,
        inventoryCount: savedData.inventory.length,
        spawnerId: savedData.spawner?.tileId,
        questId: savedData.quest.activeQuestId,
      });
    }
    
    return await saveGameService(savedData);
  }, []); // 👈 ПУСТОЙ МАССИВ — функция не пересоздаётся, ref всегда актуален
  
  const loadGame = useCallback(async (questProgress?: Record<string, number>): Promise<boolean> => {
    const saved = await loadGameService();
    if (!saved) return false;
    
    try {
      // 🔑 Хелпер для создания плитки из сохранённых данных
      const createTileFromSave = (data: { textureKey: string; rotation: number; activeSide?: string }) => {
        return new Tile({
          id: `restored-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          textureKey: data.textureKey,
          rotation: data.rotation as Rotation,
          activeSide: data.activeSide as any,
        });
      };
      
      const restored = deserializeGame(saved, createTileFromSave);

      console.log('[TilesContext] 📦 Restored:', {
        gridCount: restored.grid.length,
        inventoryCount: restored.inventory.length,
        // 👇 ИСПРАВЛЕНО: restored.spawner — это Tile, у него .id, а не .tileId
        spawnerId: restored.spawner?.id,
        spawnerTexture: restored.spawner?.textureKey,
        questId: restored.quest.activeQuestId,
      });
      
      // Восстанавливаем грид
      const newPlacedMap = new Map<string, PlacedTileInfo>();
      restored.grid.forEach(item => {
        newPlacedMap.set(item.tile.id, {
          tile: item.tile,
          col: item.col,
          row: item.row,
        });
      });
      setPlacedTiles(newPlacedMap);
      placedTilesRef.current = newPlacedMap;
      
      // Восстанавливаем инвентарь
      setInventoryTiles(restored.inventory);
      
      // Восстанавливаем спавнер
      setSpawnerTile(restored.spawner);
      
      // Восстанавливаем прогресс квеста
      if (questProgress && restored.quest.activeQuestId) {
        (global as any).questData = {
          ...(global as any).questData,
          activeQuestProgress: questProgress,
        };
      }
      
      console.log('[TilesContext] ✅ Game restored');
      return true;
    } catch (error) {
      console.error('[TilesContext] ❌ Restore failed:', error);
      return false;
    }
  }, []);
  
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
    getOccupiedBounds,
    rotateTileInInventory,
    rotateSpawnerTile,
    
    craftTiles,
    
    inventoryTiles,
    addToInventory,
    removeFromInventory,
    getInventoryTile,
    getInventoryTiles,
    isInventoryFull,
    getInventoryFreeSlots,
    clearInventory,
    
    activeInventoryTileId,
    setActiveInventoryTileId,
    
    movePlacedTileToInventory,
    submitTile,
    
    getTileCounts,
    removeTilesForQuest,
    
    // ============================================================================
    // 🔑 ЭКСПОРТ ФУНКЦИЙ СОХРАНЕНИЯ
    // ============================================================================
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

export const useTiles = (): TilesContextType => {
  const context = useContext(TilesContext);
  if (!context) {
    throw new Error('useTiles must be used within a TilesProvider');
  }
  return context;
};

export default TilesContext;
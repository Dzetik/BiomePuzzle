// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ ПЛИТКАМИ (с поддержкой инвентаря)
// ============================================================================

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Tile } from '../models/Tile';
import { getRandomTileDefinition } from '../data/tileDefinitions';
import { INVENTORY_MAX_SLOTS } from '../constants/inventory';

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
  
  // Инвентарь
  inventoryTiles: Tile[];
  addToInventory: (tile: Tile) => boolean;
  removeFromInventory: (tileId: string) => void;
  getInventoryTile: (tileId: string) => Tile | undefined;
  getInventoryTiles: () => Tile[];
  isInventoryFull: () => boolean;
  getInventoryFreeSlots: () => number;
  clearInventory: () => void;
  
  // 🔑 НОВОЕ: Активная плитка (которую тащат)
  activeInventoryTileId: string | null;
  setActiveInventoryTileId: (id: string | null) => void;
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
  // --------------------------------------------------------------------------
  // 1. СОСТОЯНИЕ: СПАВНЕР
  // --------------------------------------------------------------------------
  const [spawnerTile, setSpawnerTile] = useState<Tile | null>(null);
  
  // --------------------------------------------------------------------------
  // 2. СОСТОЯНИЕ: РАЗМЕЩЁННЫЕ ПЛИТКИ (ГРИД)
  // --------------------------------------------------------------------------
  const [placedTiles, setPlacedTiles] = useState<Map<string, PlacedTileInfo>>(new Map());
  
  // --------------------------------------------------------------------------
  // 3. СОСТОЯНИЕ: ИНВЕНТАРЬ
  // --------------------------------------------------------------------------
  const [inventoryTiles, setInventoryTiles] = useState<Tile[]>([]);
  
  // --------------------------------------------------------------------------
  // 4. 🔑 НОВОЕ: СОСТОЯНИЕ: АКТИВНАЯ ПЛИТКА ИНВЕНТАРЯ
  // --------------------------------------------------------------------------
  const [activeInventoryTileId, setActiveInventoryTileId] = useState<string | null>(null);
  
  // ============================================================================
  // 🔍 ОТЛАДКА: Лог изменений активной плитки
  // ============================================================================
  if (__DEV__ && activeInventoryTileId) {
    console.log(`[TilesContext] 🎯 Active inventory tile:`, activeInventoryTileId);
  }
  
  // --------------------------------------------------------------------------
  // 5. МЕТОДЫ: СПАВНЕР
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
  
  const getSpawnerTile = useCallback(() => {
    return spawnerTile;
  }, [spawnerTile]);
  
  const clearSpawnerTile = useCallback(() => {
    setSpawnerTile(null);
  }, []);
  
  // --------------------------------------------------------------------------
  // 6. МЕТОДЫ: РАЗМЕЩЁННЫЕ ПЛИТКИ
  // --------------------------------------------------------------------------
  
  const addTile = useCallback((col: number, row: number, tile: Tile) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.set(tile.id, { tile, col, row });
      return newMap;
    });
  }, []);
  
  const removeTile = useCallback((tileId: string) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(tileId);
      return newMap;
    });
  }, []);
  
  const getAllTiles = useCallback(() => {
    return Array.from(placedTiles.values());
  }, [placedTiles]);
  
  const isCellFree = useCallback((col: number, row: number): boolean => {
    for (const [, info] of placedTiles) {
      if (info.col === col && info.row === row) {
        return false;
      }
    }
    return true;
  }, [placedTiles]);

  const isCellOccupied = useCallback((col: number, row: number): boolean => {
    return !isCellFree(col, row);
  }, [isCellFree]);

  const getTileAt = useCallback((col: number, row: number): PlacedTileInfo | undefined => {
    for (const [key, info] of placedTiles) {
      if (info.col === col && info.row === row) {
        return info;
      }
    }
    return undefined;
  }, [placedTiles]);

  const getOccupiedBounds = useCallback(() => {
    if (placedTiles.size === 0) {
      return null;
    }
    
    let minCol = Infinity;
    let maxCol = -Infinity;
    let minRow = Infinity;
    let maxRow = -Infinity;
    
    for (const [, info] of placedTiles) {
      minCol = Math.min(minCol, info.col);
      maxCol = Math.max(maxCol, info.col);
      minRow = Math.min(minRow, info.row);
      maxRow = Math.max(maxRow, info.row);
    }
    
    return { minCol, maxCol, minRow, maxRow };
  }, [placedTiles]);
  
  // --------------------------------------------------------------------------
  // 7. МЕТОДЫ: ИНВЕНТАРЬ
  // --------------------------------------------------------------------------
  
  const addToInventory = useCallback((tile: Tile): boolean => {
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] ❌ Инвентарь полон, нельзя добавить плитку');
      return false;
    }
    
    setInventoryTiles(prev => [tile, ...prev]);
    return true;
  }, [inventoryTiles.length]);
  
  const removeFromInventory = useCallback((tileId: string) => {
    setInventoryTiles(prev => prev.filter(t => t.id !== tileId));
    console.log(`[TilesContext] 🗑️ Плитка ${tileId} удалена из инвентаря`);
  }, []);
  
  const getInventoryTile = useCallback((tileId: string): Tile | undefined => {
    return inventoryTiles.find(t => t.id === tileId);
  }, [inventoryTiles]);
  
  const getInventoryTiles = useCallback(() => {
    return inventoryTiles;
  }, [inventoryTiles]);
  
  const isInventoryFull = useCallback(() => {
    return inventoryTiles.length >= INVENTORY_MAX_SLOTS;
  }, [inventoryTiles.length]);
  
  const getInventoryFreeSlots = useCallback(() => {
    return Math.max(0, INVENTORY_MAX_SLOTS - inventoryTiles.length);
  }, [inventoryTiles.length]);
  
  const clearInventory = useCallback(() => {
    setInventoryTiles([]);
  }, []);

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
    });

    (tileCopy as any)._rotation = spawnerTile.rotation; 
    
    setInventoryTiles(prev => [tileCopy, ...prev]);
    setSpawnerTile(null);
    
    console.log(`[TilesContext] ✅ Плитка ${spawnerTile.id} перемещена в инвентарь (копия)`);
    return true;
  }, [spawnerTile, inventoryTiles.length]);
  
  // --------------------------------------------------------------------------
  // 8. ЗНАЧЕНИЕ КОНТЕКСТА
  // --------------------------------------------------------------------------
  
  const contextValue: TilesContextType = {
    // Спавнер
    spawnerTile,
    createSpawnerTile,
    getSpawnerTile,
    clearSpawnerTile,
    moveSpawnerTileToInventory,
    
    // Размещённые плитки
    placedTiles,
    addTile,
    removeTile,
    getAllTiles,
    isCellFree,
    isCellOccupied,
    getTileAt,
    getOccupiedBounds,
    
    // Инвентарь
    inventoryTiles,
    addToInventory,
    removeFromInventory,
    getInventoryTile,
    getInventoryTiles,
    isInventoryFull,
    getInventoryFreeSlots,
    clearInventory,
    
    // 🔑 НОВОЕ: Активная плитка
    activeInventoryTileId,
    setActiveInventoryTileId,
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
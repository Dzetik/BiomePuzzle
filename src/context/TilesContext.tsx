// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ ПЛИТКАМИ (с синхронизацией GridService)
// ============================================================================

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { Tile } from '../models/Tile';
import { getRandomTileDefinition } from '../data/tileDefinitions';
import { INVENTORY_MAX_SLOTS } from '../constants/inventory';
import { GridService } from '../services/GridService';

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
  // 🔑 НОВОЕ: Действия с размещёнными плитками
  // ============================================================================
  movePlacedTileToInventory: (tileId: string) => boolean;
  submitTile: (tileId: string) => void;
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
  
  const placedTilesRef = useRef<Map<string, PlacedTileInfo>>(new Map());
  
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
  
  // --------------------------------------------------------------------------
  // МЕТОДЫ: РАЗМЕЩЁННЫЕ ПЛИТКИ (с синхронизацией GridService)
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
  // Атомарное обновление для крафта (с синхронизацией GridService)
  // ============================================================================
  const craftTiles = useCallback((
    removeIds: string[],
    addInfo: { col: number; row: number; tile: Tile }
  ) => {
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      
      // Удаляем ингредиенты и освобождаем ячейки в GridService
      for (const id of removeIds) {
        const entry = newMap.get(id);
        if (entry) {
          GridService.releaseCell(entry.col, entry.row);
          newMap.delete(id);
        }
      }
      
      // Добавляем результат и занимаем ячейку в GridService
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
  // 🔑 НОВОЕ: Перемещение размещённой плитки в инвентарь
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
    
    // 🔹 Перемещаем сам объект плитки (не копию!) — избегаем дублирования ID
    const tile = entry.tile;
    
    // 1. Добавляем в инвентарь
    setInventoryTiles(prev => [tile, ...prev]);
    
    // 2. Удаляем с грида и освобождаем ячейку
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
  // 🔑 НОВОЕ: «Сдать» плитку (заглушка под экономику)
  // ============================================================================
  const submitTile = useCallback((tileId: string) => {
    const entry = placedTilesRef.current.get(tileId);
    if (!entry) {
      console.warn('[TilesContext] ❌ Плитка не найдена для сдачи:', tileId);
      return;
    }
    
    // 🔹 Здесь будет логика начисления ресурсов
    // Пример: addResources(getTileReward(entry.tile.textureKey));
    
    if (__DEV__) {
      console.log('[TilesContext] 🎯 Плитка сдана:', {
        tileId,
        textureKey: entry.tile.textureKey,
      });
    }
    
    // Удаляем плитку с грида
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(tileId);
      placedTilesRef.current = newMap;
      GridService.releaseCell(entry.col, entry.row);
      return newMap;
    });
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
    
    // ============================================================================
    // 🔑 НОВЫЕ МЕТОДЫ
    // ============================================================================
    movePlacedTileToInventory,
    submitTile,
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
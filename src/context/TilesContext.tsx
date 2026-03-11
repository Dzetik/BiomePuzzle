// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ ПЛИТКАМИ (с поддержкой инвентаря)
// ============================================================================
// Этот контекст хранит всё состояние плиток в приложении:
// - spawnerTile: активная плитка в спавнере
// - placedTiles: размещённые на гриде плитки
// - inventoryTiles: плитки в инвентаре (НОВОЕ)
// ============================================================================

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Tile } from '../models/Tile';
import { getRandomTileDefinition } from '../data/tileDefinitions';

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
  
  // Инвентарь (НОВОЕ)
  inventoryTiles: Tile[];
  addToInventory: (tile: Tile) => boolean;
  removeFromInventory: (tileId: string) => void;
  getInventoryTile: (tileId: string) => Tile | undefined;
  getInventoryTiles: () => Tile[];
  isInventoryFull: () => boolean;
  getInventoryFreeSlots: () => number;
  clearInventory: () => void;
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const INVENTORY_MAX_SLOTS = 6; // Должно совпадать с inventory.ts

// ============================================================================
// СОЗДАНИЕ КОНТЕКСТА
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
  // 3. СОСТОЯНИЕ: ИНВЕНТАРЬ (НОВОЕ)
  // --------------------------------------------------------------------------
  const [inventoryTiles, setInventoryTiles] = useState<Tile[]>([]);
  
  // --------------------------------------------------------------------------
  // 4. МЕТОДЫ: СПАВНЕР
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
      rotation: 0,  // ← Не используем spread, явно передаём только нужные поля
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
  // 5. МЕТОДЫ: РАЗМЕЩЁННЫЕ ПЛИТКИ
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
    // Просто инвертируем результат isCellFree
    return !isCellFree(col, row);
  }, [isCellFree]);

  // ============================================================================
  // Возвращает информацию о плитке в указанной ячейке или undefined.
  // ============================================================================
  const getTileAt = useCallback((col: number, row: number): PlacedTileInfo | undefined => {
    // Ищем плитку по координатам в Map
    for (const [key, info] of placedTiles) {
      if (info.col === col && info.row === row) {
        return info;
      }
    }
    return undefined;
  }, [placedTiles]);

  // ============================================================================
  // Возвращает минимальные и максимальные координаты занятых ячеек.
  // Используется для определения области грида которую нужно отрендерить.
  // ============================================================================
  
  const getOccupiedBounds = useCallback(() => {
    if (placedTiles.size === 0) {
      return null;  // Нет плиток — нет границ
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
  // 6. МЕТОДЫ: ИНВЕНТАРЬ (НОВОЕ)
  // --------------------------------------------------------------------------
  
  const addToInventory = useCallback((tile: Tile): boolean => {
    // Проверяем что инвентарь не полон
    if (inventoryTiles.length >= INVENTORY_MAX_SLOTS) {
      console.warn('[TilesContext] ❌ Инвентарь полон, нельзя добавить плитку');
      return false;
    }
    
    // Добавляем в начало массива (после счётчика)
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
    return INVENTORY_MAX_SLOTS - inventoryTiles.length;
  }, [inventoryTiles.length]);
  
  const clearInventory = useCallback(() => {
    setInventoryTiles([]);
  }, []);

  // ============================================================================
  // МЕТОД: ПЕРЕМЕЩЕНИЕ ПЛИТКИ ИЗ СПАВНЕРА В ИНВЕНТАРЬ
  // ============================================================================
  // Удаляет плитку из спавнера и добавляет в инвентарь.
  // Возвращает true если успешно, false если инвентарь полон или нет плитки.
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
      //baseEdges: spawnerTile.baseEdges,  // ← Важно: копируйте edges если есть
    });

    (tileCopy as any)._rotation = spawnerTile.rotation; 
    
    // Добавляем копию в инвентарь
    setInventoryTiles(prev => [tileCopy, ...prev]);
    // Очищаем спавнер (оригинал больше не нужен)
    setSpawnerTile(null);
    
    console.log(`[TilesContext] ✅ Плитка ${spawnerTile.id} перемещена в инвентарь (копия)`);
    return true;
  }, [spawnerTile, inventoryTiles.length]);
  
  // --------------------------------------------------------------------------
  // 7. ЗНАЧЕНИЕ КОНТЕКСТА
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
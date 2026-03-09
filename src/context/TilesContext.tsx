// src/context/TilesContext.ts
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
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
  // Размещённые плитки
  placedTiles: Map<string, PlacedTileInfo>;
  addTile: (col: number, row: number, tile: Tile) => void;
  removeTile: (col: number, row: number) => void;
  moveTile: (fromCol: number, fromRow: number, toCol: number, toRow: number, tile: Tile) => void;
  isCellOccupied: (col: number, row: number) => boolean;
  getTileAt: (col: number, row: number) => PlacedTileInfo | undefined;
  getAllTiles: () => PlacedTileInfo[];
  getOccupiedBounds: () => { minCol: number; maxCol: number; minRow: number; maxRow: number } | null;
  
  // Спавнер
  spawnerTile: Tile | null;
  createSpawnerTile: (tile?: Tile) => Tile;
  removeSpawnerTile: () => void;
  takeTileFromSpawner: () => Tile | null;
  returnTileToSpawner: (tile: Tile) => void;
  hasTileInSpawner: () => boolean;
  getSpawnerTile: () => Tile | null;
}

// ============================================================================
// УТИЛИТЫ
// ============================================================================

const TILE_ID_PREFIX = 'tile';
let tileCounter = 1;

const generateTileId = () => `${TILE_ID_PREFIX}-${Date.now()}-${tileCounter++}`;
const makeKey = (col: number, row: number): string => `${col},${row}`;

// ============================================================================
// КОНТЕКСТ
// ============================================================================

const TilesContext = createContext<TilesContextType | null>(null);

// ============================================================================
// ПРОВАЙДЕР
// ============================================================================

interface TilesProviderProps {
  children: ReactNode;
}

export const TilesProvider: React.FC<TilesProviderProps> = ({ children }) => {
  const [placedTiles, setPlacedTiles] = useState<Map<string, PlacedTileInfo>>(new Map());
  const [spawnerTile, setSpawnerTile] = useState<Tile | null>(null);

  // ============================================================================
  // ФУНКЦИИ ДЛЯ РАЗМЕЩЁННЫХ ПЛИТОК
  // ============================================================================

  const addTile = useCallback((col: number, row: number, tile: Tile) => {
    const key = makeKey(col, row);
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      
      const existingEntry = Array.from(newMap.entries()).find(
        ([_, value]) => value.tile.id === tile.id
      );
      
      if (existingEntry) {
        const [existingKey] = existingEntry;
        newMap.delete(existingKey);
        if (__DEV__) {
          console.log(`[Tiles] Удалена старая запись ${existingKey} для плитки ${tile.id}`);
        }
      }
      
      newMap.set(key, { tile, col, row });
      if (__DEV__) {
        console.log(`[Tiles] Добавлена плитка ${tile.id} в [${col},${row}]`);
      }
      return newMap;
    });
  }, []);

  const removeTile = useCallback((col: number, row: number) => {
    const key = makeKey(col, row);
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

  const moveTile = useCallback((fromCol: number, fromRow: number, toCol: number, toRow: number, tile: Tile) => {
    const fromKey = makeKey(fromCol, fromRow);
    const toKey = makeKey(toCol, toRow);
    
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(fromKey);
      
      const otherEntries = Array.from(newMap.entries()).filter(
        ([_, value]) => value.tile.id === tile.id
      );
      otherEntries.forEach(([key]) => {
        newMap.delete(key);
        if (__DEV__) {
          console.log(`[Tiles] Удалена дублирующаяся запись ${key}`);
        }
      });
      
      newMap.set(toKey, { tile, col: toCol, row: toRow });
      
      if (__DEV__) {
        console.log(`[Tiles] Перемещена плитка ${tile.id} из [${fromCol},${fromRow}] в [${toCol},${toRow}]`);
      }
      return newMap;
    });
  }, []);

  const isCellOccupied = useCallback((col: number, row: number): boolean => {
    const key = makeKey(col, row);
    return placedTiles.has(key);
  }, [placedTiles]);

  const getTileAt = useCallback((col: number, row: number): PlacedTileInfo | undefined => {
    const key = makeKey(col, row);
    return placedTiles.get(key);
  }, [placedTiles]);

  const getAllTiles = useCallback((): PlacedTileInfo[] => {
    return Array.from(placedTiles.values());
  }, [placedTiles]);

  const getOccupiedBounds = useCallback(() => {
    if (placedTiles.size === 0) return null;
    
    let minCol = Infinity, maxCol = -Infinity;
    let minRow = Infinity, maxRow = -Infinity;
    
    placedTiles.forEach((_, key) => {
      const [col, row] = key.split(',').map(Number);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    });
    
    return { minCol, maxCol, minRow, maxRow };
  }, [placedTiles]);

  // ============================================================================
  // ФУНКЦИИ ДЛЯ СПАВНЕРА
  // ============================================================================
  let tileCounter = 1; 
  const createSpawnerTile = useCallback((tile?: Tile): Tile => {
    if (tile) {
      setSpawnerTile(tile);
      return tile;
    }
    
    const definition = getRandomTileDefinition();
    const instanceId = `tile-${Date.now()}-${tileCounter++}`;

    const newTile = new Tile({
      ...definition,  // Берём textureKey, baseEdges из определения
      id: instanceId, // ← Но перезаписываем id на уникальный
    });
    
    if (__DEV__) {
      console.log(`[Tiles] Создана новая плитка в спавнере: ${newTile.id}`);
    }
    setSpawnerTile(newTile);
    return newTile;
  }, []);

  const removeSpawnerTile = useCallback(() => {
    if (__DEV__) {
      console.log('[Tiles] Плитка удалена из спавнера');
    }
    setSpawnerTile(null);
  }, []);

  const takeTileFromSpawner = useCallback((): Tile | null => {
    if (!spawnerTile) {
      if (__DEV__) {
        console.log('[Tiles] Попытка взять плитку из пустого спавнера');
      }
      return null;
    }
    
    const tile = spawnerTile;
    if (__DEV__) {
      console.log(`[Tiles] Плитка ${tile.id} взята из спавнера`);
    }
    
    setSpawnerTile(null);
    return tile;
  }, [spawnerTile]);

  const returnTileToSpawner = useCallback((tile: Tile) => {
    tile.resetRotation();
    
    if (__DEV__) {
      console.log(`[Tiles] Плитка ${tile.id} возвращена в спавнер`);
    }
    setSpawnerTile(tile);
  }, []);

  const hasTileInSpawner = useCallback((): boolean => {
    return spawnerTile !== null;
  }, [spawnerTile]);

  const getSpawnerTile = useCallback((): Tile | null => {
    return spawnerTile;
  }, [spawnerTile]);

  // ============================================================================
  // ЗНАЧЕНИЕ КОНТЕКСТА
  // ============================================================================

  const contextValue = useMemo(() => ({
    placedTiles,
    addTile, removeTile, moveTile,
    isCellOccupied, getTileAt, getAllTiles, getOccupiedBounds,
    spawnerTile,
    createSpawnerTile, removeSpawnerTile,
    takeTileFromSpawner, returnTileToSpawner,
    hasTileInSpawner, getSpawnerTile,
  }), [
    placedTiles,
    addTile, removeTile, moveTile,
    isCellOccupied, getTileAt, getAllTiles, getOccupiedBounds,
    spawnerTile,
    createSpawnerTile, removeSpawnerTile,
    takeTileFromSpawner, returnTileToSpawner,
    hasTileInSpawner, getSpawnerTile,
  ]);

  return (
    <TilesContext.Provider value={contextValue}>
      {children}
    </TilesContext.Provider>
  );
};

// ============================================================================
// ХУК
// ============================================================================

export const useTiles = (): TilesContextType => {
  const context = useContext(TilesContext);
  if (!context) {
    throw new Error('useTiles must be used within a TilesProvider');
  }
  return context;
};

export default TilesContext;
// src/context/TilesContext.js

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const TILE_ID_PREFIX = 'tile';
let tileCounter = 1;

const generateTileId = () => `${TILE_ID_PREFIX}-${Date.now()}-${tileCounter++}`;

const TilesContext = createContext(null);

export const TilesProvider = ({ children }) => {
  const [placedTiles, setPlacedTiles] = useState(new Map());
  const [spawnerTile, setSpawnerTile] = useState(null);

  // ============================================================================
  // ФУНКЦИИ ДЛЯ РАЗМЕЩЁННЫХ ПЛИТОК
  // ============================================================================

  const addTile = useCallback((col, row, tileData) => {
    const key = `${col},${row}`;
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      
      // Удаляем старую запись этой плитки если есть
      const existingEntry = Array.from(newMap.entries()).find(
        ([_, value]) => value.id === tileData.id
      );
      
      if (existingEntry) {
        const [existingKey] = existingEntry;
        newMap.delete(existingKey);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Tiles] Удалена старая запись ${existingKey} для плитки ${tileData.id}`);
        }
      }
      
      newMap.set(key, { ...tileData, col, row });
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Tiles] Добавлена плитка ${tileData.id} в [${col},${row}]`);
      }
      return newMap;
    });
  }, []);

  const removeTile = useCallback((col, row) => {
    const key = `${col},${row}`;
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

  const moveTile = useCallback((fromCol, fromRow, toCol, toRow, tileData) => {
    const fromKey = `${fromCol},${fromRow}`;
    const toKey = `${toCol},${toRow}`;
    
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(fromKey);
      
      // Удаляем дубликаты этой плитки
      const otherEntries = Array.from(newMap.entries()).filter(
        ([_, value]) => value.id === tileData.id
      );
      otherEntries.forEach(([key]) => {
        newMap.delete(key);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Tiles] Удалена дублирующаяся запись ${key}`);
        }
      });
      
      newMap.set(toKey, { ...tileData, col: toCol, row: toRow });
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Tiles] Перемещена плитка ${tileData.id} из [${fromCol},${fromRow}] в [${toCol},${toRow}]`);
      }
      return newMap;
    });
  }, []);

  const isCellOccupied = useCallback((col, row) => {
    const key = `${col},${row}`;
    return placedTiles.has(key);
  }, [placedTiles]);

  const getTileAt = useCallback((col, row) => {
    const key = `${col},${row}`;
    return placedTiles.get(key);
  }, [placedTiles]);

  const getAllTiles = useCallback(() => {
    return Array.from(placedTiles.entries()).map(([key, value]) => {
      const [col, row] = key.split(',').map(Number);
      return { ...value, col, row };
    });
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

  const createSpawnerTile = useCallback((tileData = null) => {
    const newTile = tileData || {
      id: generateTileId(),
      texture: 'test1.png',
    };
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Tiles] Создана новая плитка в спавнере: ${newTile.id}`);
    }
    setSpawnerTile(newTile);
    return newTile;
  }, []);

  const removeSpawnerTile = useCallback(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Tiles] Плитка удалена из спавнера');
    }
    setSpawnerTile(null);
  }, []);

  const takeTileFromSpawner = useCallback(() => {
    if (!spawnerTile) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Tiles] Попытка взять плитку из пустого спавнера');
      }
      return null;
    }
    
    const tile = spawnerTile;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Tiles] Плитка ${tile.id} взята из спавнера`);
    }
    
    setSpawnerTile(null);
    return tile;
  }, [spawnerTile]);

  const returnTileToSpawner = useCallback((tileData) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Tiles] Плитка ${tileData.id} возвращена в спавнер`);
    }
    setSpawnerTile(tileData);
  }, []);

  const hasTileInSpawner = useCallback(() => {
    return spawnerTile !== null;
  }, [spawnerTile]);

  const getSpawnerTile = useCallback(() => {
    return spawnerTile;
  }, [spawnerTile]);

  // ============================================================================
  // ЗНАЧЕНИЕ КОНТЕКСТА (с useMemo для оптимизации)
  // ============================================================================

  const value = useMemo(() => ({
    // Размещённые плитки
    placedTiles,
    addTile,
    removeTile,
    moveTile,
    isCellOccupied,
    getTileAt,
    getAllTiles,
    getOccupiedBounds,
    
    // Спавнер
    spawnerTile,
    createSpawnerTile,
    removeSpawnerTile,
    takeTileFromSpawner,
    returnTileToSpawner,
    hasTileInSpawner,
    getSpawnerTile,
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
    <TilesContext.Provider value={value}>
      {children}
    </TilesContext.Provider>
  );
};

export const useTiles = () => {
  const context = useContext(TilesContext);
  if (!context) {
    throw new Error('useTiles must be used within a TilesProvider');
  }
  return context;
};

export default TilesContext;
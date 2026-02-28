import React, { createContext, useContext, useState, useCallback } from 'react';

const TilesContext = createContext(null);

export const TilesProvider = ({ children }) => {
  const [placedTiles, setPlacedTiles] = useState(new Map());

  const addTile = useCallback((col, row, tileData) => {
    const key = `${col},${row}`;
    setPlacedTiles(prev => {
      const newMap = new Map(prev);
      
      // Важно: если плитка с таким ID уже есть где-то, удаляем её оттуда
      // Это гарантирует, что у плитки только одна запись
      const existingEntry = Array.from(newMap.entries()).find(
        ([_, value]) => value.id === tileData.id
      );
      
      if (existingEntry) {
        const [existingKey] = existingEntry;
        newMap.delete(existingKey);
        console.log(`[Tiles] Удалена старая запись ${existingKey} для плитки ${tileData.id}`);
      }
      
      newMap.set(key, { ...tileData, col, row });
      console.log(`[Tiles] Добавлена плитка ${tileData.id} в [${col},${row}]`);
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
      
      // Убеждаемся, что удаляем именно старую запись
      newMap.delete(fromKey);
      
      // Также удаляем любую другую запись с этим ID (на всякий случай)
      const otherEntries = Array.from(newMap.entries()).filter(
        ([_, value]) => value.id === tileData.id
      );
      otherEntries.forEach(([key]) => {
        newMap.delete(key);
        console.log(`[Tiles] Удалена дублирующаяся запись ${key}`);
      });
      
      // Добавляем на новое место
      newMap.set(toKey, { ...tileData, col: toCol, row: toRow });
      
      console.log(`[Tiles] Перемещена плитка ${tileData.id} из [${fromCol},${fromRow}] в [${toCol},${toRow}]`);
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
    const tiles = Array.from(placedTiles.entries()).map(([key, value]) => {
      const [col, row] = key.split(',').map(Number);
      return { ...value, col, row };
    });
    console.log('[Tiles] getAllTiles:', tiles.map(t => `${t.id}@[${t.col},${t.row}]`));
    return tiles;
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

  const value = {
    placedTiles,
    addTile,
    removeTile,
    moveTile,
    isCellOccupied,
    getTileAt,
    getAllTiles,
    getOccupiedBounds,
  };

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
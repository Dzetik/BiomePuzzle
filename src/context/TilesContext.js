import React, { createContext, useContext, useState, useCallback } from 'react';

// Константы для генерации ID плиток
const TILE_ID_PREFIX = 'tile';
let tileCounter = 1;

// Генератор уникального ID для плитки
const generateTileId = () => `${TILE_ID_PREFIX}-${Date.now()}-${tileCounter++}`;

const TilesContext = createContext(null);

export const TilesProvider = ({ children }) => {
  // Все размещённые на сетке плитки
  const [placedTiles, setPlacedTiles] = useState(new Map());
  
  // Плитка в спавнере (всегда одна)
  const [spawnerTile, setSpawnerTile] = useState(null);

  // ========================================
  // УПРАВЛЕНИЕ ПЛИТКАМИ В СЕТКЕ
  // ========================================

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

  // ========================================
  // УПРАВЛЕНИЕ ПЛИТКОЙ В СПАВНЕРЕ
  // ========================================

  /**
   * Создаёт новую плитку в спавнере
   * @param {Object} tileData - данные плитки (опционально, если нужно создать с определёнными параметрами)
   * @returns {Object} созданная плитка
   */
  const createSpawnerTile = useCallback((tileData = null) => {
    const newTile = tileData || {
      id: generateTileId(),
      texture: 'test1.png', // По умолчанию, можно передавать нужную текстуру
      // Другие свойства плитки можно добавить позже
    };
    
    console.log(`[Tiles] Создана новая плитка в спавнере: ${newTile.id}`);
    setSpawnerTile(newTile);
    return newTile;
  }, []);

  /**
   * Удаляет плитку из спавнера
   */
  const removeSpawnerTile = useCallback(() => {
    console.log('[Tiles] Плитка удалена из спавнера');
    setSpawnerTile(null);
  }, []);

  /**
   * Забирает плитку из спавнера для размещения в сетке
   * @returns {Object|null} плитка или null, если спавнер пуст
   */
  const takeTileFromSpawner = useCallback(() => {
    if (!spawnerTile) {
      console.log('[Tiles] Попытка взять плитку из пустого спавнера');
      return null;
    }
    
    const tile = spawnerTile;
    console.log(`[Tiles] Плитка ${tile.id} взята из спавнера`);
    
    // Не удаляем сразу, чтобы плитка могла быть перетащена
    // Она удалится из спавнера только при успешном размещении
    return tile;
  }, [spawnerTile]);

  /**
   * Возвращает плитку в спавнер
   * @param {Object} tileData - данные возвращаемой плитки
   */
  const returnTileToSpawner = useCallback((tileData) => {
    console.log(`[Tiles] Плитка ${tileData.id} возвращена в спавнер`);
    setSpawnerTile(tileData);
  }, []);

  /**
   * Проверяет, есть ли плитка в спавнере
   */
  const hasTileInSpawner = useCallback(() => {
    return spawnerTile !== null;
  }, [spawnerTile]);

  /**
   * Получает плитку из спавнера
   */
  const getSpawnerTile = useCallback(() => {
    return spawnerTile;
  }, [spawnerTile]);

  // ========================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ========================================

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
    // Плитки в сетке
    placedTiles,
    addTile,
    removeTile,
    moveTile,
    isCellOccupied,
    getTileAt,
    getAllTiles,
    getOccupiedBounds,
    
    // Плитка в спавнере
    spawnerTile,
    createSpawnerTile,
    removeSpawnerTile,
    takeTileFromSpawner,
    returnTileToSpawner,
    hasTileInSpawner,
    getSpawnerTile,
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
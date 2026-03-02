// ========================================
// Хук для управления целевой ячейкой плитки
// ========================================

import { useRef, useCallback, useEffect } from 'react';
import { useTiles } from '../../context/TilesContext';

export const useTileTargetCell = ({
  getTileId,                    // Функция для получения актуального ID
  scale,
  offset,
  currentTileSize,
  currentPositionRef,
  isInSpawner,
  setIsInSpawner,
  targetCellRef,
  onCellOccupied,
  tileData,
}) => {
  
  const { isCellOccupied, addTile, moveTile, removeTile, getTileAt, getAllTiles } = useTiles();

  // Получаем актуальный ID через функцию
  const getCurrentId = useCallback(() => {
    const id = getTileId ? getTileId() : tileData?.id;
    return id || null;
  }, [getTileId, tileData?.id]);

  const getLogId = useCallback(() => {
    const id = getCurrentId();
    return id || 'unknown';
  }, [getCurrentId]);

  // Инициализация при монтировании - теперь использует актуальный ID
  useEffect(() => {
    const currentId = getCurrentId();
    if (!currentId) return;

    const allTiles = getAllTiles();
    const existingTile = allTiles.find(t => t.id === currentId);
    
    if (existingTile) {
      console.log(`[Tile ${currentId}] Загружена из ячейки:`, existingTile.col, existingTile.row);
      targetCellRef.current = { col: existingTile.col, row: existingTile.row };
      setIsInSpawner(false);
    } else {
      console.log(`[Tile ${currentId}] Нет в сохранённых, в спавнере`);
      targetCellRef.current = null;
      setIsInSpawner(true);
    }
  }, [getCurrentId, getAllTiles, setIsInSpawner, targetCellRef]); // Зависимость от getCurrentId

  const isCellFree = useCallback((col, row) => {
    const currentId = getCurrentId();
    const logId = getLogId();
    
    if (!currentId) {
      console.log(`[Tile ${logId}] Ячейка [${col},${row}] - нет ID`);
      return false;
    }
    
    const tileAtCell = getTileAt(col, row);
    const isFree = !tileAtCell || tileAtCell.id === currentId;
    
    console.log(`[Tile ${logId}] Ячейка [${col},${row}] ${isFree ? 'свободна' : `занята (${tileAtCell?.id})`}`);
    return isFree;
  }, [getTileAt, getCurrentId, getLogId]);

  const tryOccupyCell = useCallback((col, row) => {
    const currentId = getCurrentId();
    const logId = getLogId();
    
    if (!currentId) {
      console.log(`[Tile ${logId}] Попытка занять ячейку без ID`);
      return false;
    }
    
    console.log(`[Tile ${currentId}] Попытка занять ячейку [${col},${row}]`);
    
    if (!isCellFree(col, row)) {
      console.log(`[Tile ${currentId}] Ячейка [${col},${row}] занята`);
      return false;
    }
    
    const allTiles = getAllTiles();
    const existingTile = allTiles.find(t => t.id === currentId);
    
    if (existingTile) {
      console.log(`[Tile ${currentId}] Перемещение из [${existingTile.col},${existingTile.row}] в [${col},${row}]`);
      moveTile(existingTile.col, existingTile.row, col, row, { id: currentId, texture: 'test1' });
    } else {
      console.log(`[Tile ${currentId}] Добавление в [${col},${row}]`);
      addTile(col, row, { id: currentId, texture: 'test1' });
    }
    
    targetCellRef.current = { col, row };
    
    if (onCellOccupied) {
      onCellOccupied(col, row);
    }
    
    return true;
  }, [isCellFree, addTile, moveTile, getAllTiles, onCellOccupied, targetCellRef, getCurrentId, getLogId]);

  const releaseCurrentCell = useCallback(() => {
    const currentId = getCurrentId();
    const logId = getLogId();
    
    if (!currentId) return;
    
    if (targetCellRef.current) {
      const { col, row } = targetCellRef.current;
      console.log(`[Tile ${logId}] Удаляем из ячейки [${col},${row}]`);
      removeTile(col, row);
      targetCellRef.current = null;
    }
  }, [removeTile, targetCellRef, getCurrentId, getLogId]);

  const updateTargetCellFromPosition = useCallback(() => {
    const currentId = getCurrentId();
    const logId = getLogId();
    
    if (!currentId) return;
    if (isInSpawner) return;
    
    const pos = currentPositionRef.current;
    const size = currentTileSize.current;
    
    const center = {
      x: pos.x + size.width / 2,
      y: pos.y + size.height / 2
    };
    
    const { findNearestCell } = require('../../utils/gridUtils');
    
    const cell = findNearestCell(
      center.x, 
      center.y, 
      scale,
      offset.x,
      offset.y
    );
    
    if (!targetCellRef.current || 
        targetCellRef.current.col !== cell.col || 
        targetCellRef.current.row !== cell.row) {
      console.log(`[Tile ${logId}] Обновление целевой ячейки: [${cell.col},${cell.row}]`);
      targetCellRef.current = { col: cell.col, row: cell.row };
    }
  }, [scale, offset, isInSpawner, currentPositionRef, currentTileSize, getCurrentId, getLogId, targetCellRef]);

  return {
    isCellFree,
    tryOccupyCell,
    releaseCurrentCell,
    updateTargetCellFromPosition,
  };
};
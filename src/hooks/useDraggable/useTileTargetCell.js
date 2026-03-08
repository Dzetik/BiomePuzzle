// ========================================
// Хук для управления целевой ячейкой плитки
// ✅ ПОЛНАЯ ПРОВЕРКА OFFSET
// ========================================
import { useRef, useCallback, useEffect } from 'react';
import { useTiles } from '../../context/TilesContext';

export const useTileTargetCell = ({
  getTileId,
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

  const getCurrentId = useCallback(() => {
    const id = getTileId ? getTileId() : tileData?.id;
    return id || null;
  }, [getTileId, tileData?.id]);

  const getLogId = useCallback(() => {
    const id = getCurrentId();
    return id || 'unknown';
  }, [getCurrentId]);

  useEffect(() => {
    const currentId = getCurrentId();
    if (!currentId) return;
    const allTiles = getAllTiles();
    const existingTile = allTiles.find(t => t.id === currentId);

    if (existingTile) {
      targetCellRef.current = { col: existingTile.col, row: existingTile.row };
      setIsInSpawner(false);
    } else {
      targetCellRef.current = null;
      setIsInSpawner(true);
    }
  }, [getCurrentId, getAllTiles, setIsInSpawner, targetCellRef]);

  const isCellFree = useCallback((col, row) => {
    const currentId = getCurrentId();
    if (!currentId) return false;

    const tileAtCell = getTileAt(col, row);
    return !tileAtCell || tileAtCell.id === currentId;
  }, [getTileAt, getCurrentId]);

  const tryOccupyCell = useCallback((col, row) => {
    const currentId = getCurrentId();
    if (!currentId) return false;

    if (!isCellFree(col, row)) return false;

    const allTiles = getAllTiles();
    const existingTile = allTiles.find(t => t.id === currentId);

    if (existingTile) {
      moveTile(existingTile.col, existingTile.row, col, row, { id: currentId, texture: 'test1' });
    } else {
      addTile(col, row, { id: currentId, texture: 'test1' });
    }

    targetCellRef.current = { col, row };

    if (onCellOccupied) {
      onCellOccupied(col, row);
    }

    return true;
  }, [isCellFree, addTile, moveTile, getAllTiles, onCellOccupied, targetCellRef, getCurrentId]);

  const releaseCurrentCell = useCallback(() => {
    const currentId = getCurrentId();
    if (!currentId) return;

    if (targetCellRef.current) {
      const { col, row } = targetCellRef.current;
      removeTile(col, row);
      targetCellRef.current = null;
    }
  }, [removeTile, targetCellRef, getCurrentId]);

  // ✅ КРИТИЧНО: ПРОВЕРКА OFFSET ПЕРЕД ИСПОЛЬЗОВАНИЕМ
  const updateTargetCellFromPosition = useCallback(() => {
    const currentId = getCurrentId();
    if (!currentId) return;
    if (isInSpawner) return;

    // ✅ ПРОВЕРКА OFFSET
    if (!offset || typeof offset.x !== 'number' || typeof offset.y !== 'number') {
      console.error(`[Tile] ❌ offset не готов в updateTargetCellFromPosition`);
      return;
    }

    const pos = currentPositionRef.current;
    const size = currentTileSize.current;

    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      console.error(`[Tile] ❌ currentPositionRef не готов`);
      return;
    }

    const center = {
      x: pos.x + size.width / 2,
      y: pos.y + size.height / 2
    };

    const { findNearestCell } = require('../../utils/gridUtils');

    try {
      const cell = findNearestCell(center.x, center.y, scale, offset.x, offset.y);

      if (!targetCellRef.current ||
          targetCellRef.current.col !== cell.col ||
          targetCellRef.current.row !== cell.row) {
        targetCellRef.current = { col: cell.col, row: cell.row };
      }
    } catch (error) {
      console.error(`[Tile] ❌ Ошибка в findNearestCell:`, error);
    }
  }, [scale, offset, isInSpawner, currentPositionRef, currentTileSize, getCurrentId, targetCellRef]);

  return {
    isCellFree,
    tryOccupyCell,
    releaseCurrentCell,
    updateTargetCellFromPosition,
  };
};
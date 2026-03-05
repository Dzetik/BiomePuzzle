import { useCallback, useRef } from 'react';
import { useZoom } from '../useZoom';
import { useGrid } from '../../context/GridContext';
import { findNearestCell, getSnapToCellPosition } from '../../utils/gridUtils';
import { SpawnerService } from '../../services/SpawnerService';

export const useTilePlacement = ({
  getTileId,
  getTileData,
  spawnerPos,
  currentTileSize,
  currentPositionRef,
  isInSpawner,
  targetCellRef,
  isCellFree,
  tryOccupyCell,
  releaseCurrentCell,
  setInSpawner,
  setOutOfSpawner,
  animateToPosition,
  onTilePlaced,
}) => {
  const { scale } = useZoom();
  const { offset } = useGrid();
  const wasPlacedRef = useRef(false);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);

  scaleRef.current = scale;
  offsetRef.current = offset;

  const getLogId = useCallback(() => {
    const id = getTileId ? getTileId() : null;
    return id || 'unknown';
  }, [getTileId]);

  const getActualId = useCallback(() => {
    const id = getTileId ? getTileId() : null;
    return id || null;
  }, [getTileId]);

  const checkGravityZone = useCallback((position) => {
    return SpawnerService.isInGravityZone(
      position,
      currentTileSize.current,
      spawnerPos
    );
  }, [currentTileSize, spawnerPos]);

  const snapToSpawner = useCallback(() => {
    const logId = getLogId();
    console.log(`[Tile ${logId}] ПРИТЯГИВАЕМ К СПАВНЕРУ`);

    if (!isInSpawner && targetCellRef.current) {
      releaseCurrentCell();
    }

    const spawnerPosition = SpawnerService.getSnapToSpawnerPosition(
      currentTileSize.current, 
      spawnerPos
    );

    setInSpawner(true);
    targetCellRef.current = null;
    wasPlacedRef.current = false;

    return spawnerPosition;
  }, [isInSpawner, targetCellRef, releaseCurrentCell, currentTileSize, spawnerPos, setInSpawner, getLogId]);

  const snapToGridAndPlace = useCallback(() => {
    const actualId = getActualId();
    const logId = getLogId();
    
    if (!actualId) {
      console.log(`[Tile ${logId}] Нет ID плитки, не можем разместить`);
      return null;
    }

    console.log(`[Tile ${actualId}] Притягиваем к сетке`);

    const currentPos = currentPositionRef.current;
    const tileSize = currentTileSize.current;

    const centerX = currentPos.x + tileSize.width / 2;
    const centerY = currentPos.y + tileSize.height / 2;

    const currentScale = scaleRef.current;
    const currentOffset = offsetRef.current;

    const targetCell = findNearestCell(
      centerX, 
      centerY, 
      currentScale,
      currentOffset.x,
      currentOffset.y
    );

    console.log(`[Tile ${actualId}] Целевая ячейка: [${targetCell.col},${targetCell.row}]`);

    if (isCellFree(targetCell.col, targetCell.row)) {
      const snappedPosition = getSnapToCellPosition(
        tileSize,
        targetCell.col,
        targetCell.row,
        currentScale,
        currentOffset.x,
        currentOffset.y
      );
      
      const success = tryOccupyCell(targetCell.col, targetCell.row);
      
      if (success) {
        console.log(`[Tile ${actualId}] УСПЕШНО размещена в [${targetCell.col},${targetCell.row}]`);
        
        setOutOfSpawner(true);
        wasPlacedRef.current = true;
        
        const currentTileData = getTileData ? getTileData() : null;
        if (onTilePlaced && currentTileData) {
          console.log(`[Tile ${actualId}] Вызов onTilePlaced с tileData:`, currentTileData.id);
          onTilePlaced(currentTileData, targetCell);
        }
        
        return snappedPosition;
      }
    }

    console.log(`[Tile ${actualId}] Ячейка занята или ошибка, возврат`);
    return null;
  }, [currentPositionRef, currentTileSize, isCellFree, tryOccupyCell, setOutOfSpawner, onTilePlaced, getTileData, getActualId, getLogId]);

  const revertToPrevious = useCallback(() => {
    const logId = getLogId();
    console.log(`[Tile ${logId}] Возврат в предыдущее положение`);
    
    if (!isInSpawner && targetCellRef.current) {
      const tileSize = currentTileSize.current;
      const currentScale = scaleRef.current;
      const currentOffset = offsetRef.current;
      
      return getSnapToCellPosition(
        tileSize,
        targetCellRef.current.col,
        targetCellRef.current.row,
        currentScale,
        currentOffset.x,
        currentOffset.y
      );
    } 

    return SpawnerService.getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
  }, [isInSpawner, targetCellRef, currentTileSize, spawnerPos, getLogId]);

  const handlePlacement = useCallback(() => {
    const currentPos = currentPositionRef.current;
    const inGravityZone = checkGravityZone(currentPos);
    const actualId = getTileId ? getTileId() : null;
    const logId = actualId || 'unknown';

    console.log(`[Tile ${logId}] В зоне притяжения:`, inGravityZone);
    console.log(`[Tile ${logId}] Реальный ID:`, actualId);

    if (inGravityZone) {
      wasPlacedRef.current = false;
      return snapToSpawner();
    }

    const gridPosition = snapToGridAndPlace();

    if (gridPosition) {
      return gridPosition;
    } else {
      wasPlacedRef.current = false;
      return revertToPrevious();
    }
  }, [currentPositionRef, checkGravityZone, snapToSpawner, snapToGridAndPlace, revertToPrevious, getTileId]);

  return {
    handlePlacement,
    checkGravityZone,
  };
};
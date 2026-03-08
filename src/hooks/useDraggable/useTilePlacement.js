// ========================================
// ХУК РАЗМЕЩЕНИЯ ПЛИТКИ
// ✅ ДОБАВЛЕНО ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ
// ========================================
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
  
  // ✅ ЛОГ: перед доступом к spawnerPos.x/y
  const checkGravityZone = useCallback((position) => {
    const logId = getLogId();
    console.log(`[Tile ${logId}] checkGravityZone - проверка spawnerPos:`, {
      hasSpawnerPos: !!spawnerPos,
      spawnerPosX: spawnerPos?.x,
      spawnerPosY: spawnerPos?.y,
      spawnerPosSize: spawnerPos?.size,
    });
    
    if (
      !spawnerPos || 
      typeof spawnerPos.x !== 'number' || 
      typeof spawnerPos.y !== 'number'
    ) {
      console.log(`[Tile ${logId}] checkGravityZone - spawnerPos не готов`);
      return false;
    }
    
    const result = SpawnerService.isInGravityZone(
      position,
      currentTileSize.current,
      spawnerPos
    );
    
    console.log(`[Tile ${logId}] checkGravityZone результат:`, result);
    return result;
  }, [currentTileSize, spawnerPos, getLogId]);
  
  const snapToSpawner = useCallback(() => {
    const logId = getLogId();
    console.log(`[Tile ${logId}] ПРИТЯГИВАЕМ К СПАВНЕРУ`);
    
    if (!isInSpawner && targetCellRef.current) {
      releaseCurrentCell();
    }

    // ✅ ЛОГ: перед доступом к spawnerPos.x/y
    console.log(`[Tile ${logId}] snapToSpawner - проверка spawnerPos:`, {
      hasSpawnerPos: !!spawnerPos,
      spawnerPosX: spawnerPos?.x,
      spawnerPosY: spawnerPos?.y,
    });

    if (
      !spawnerPos || 
      typeof spawnerPos.x !== 'number' || 
      typeof spawnerPos.y !== 'number'
    ) {
      console.error(`[Tile ${logId}] ❌ spawnerPos не готов!`, spawnerPos);
      return currentPositionRef.current;
    }

    const spawnerPosition = SpawnerService.getTilePosition(
      currentTileSize.current, 
      spawnerPos
    );
    
    console.log(`[Tile ${logId}] Позиция спавнера:`, spawnerPosition);

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

    // ✅ ЛОГ: перед доступом к offset.x/y
    console.log(`[Tile ${actualId}] snapToGridAndPlace - проверка offset:`, {
      hasOffset: !!currentOffset,
      offsetX: currentOffset?.x,
      offsetY: currentOffset?.y,
      offsetXType: typeof currentOffset?.x,
      offsetYType: typeof currentOffset?.y,
    });

    if (
      !currentOffset || 
      typeof currentOffset.x !== 'number' || 
      typeof currentOffset.y !== 'number'
    ) {
      console.error(`[Tile ${actualId}] ❌ offset не готов!`, currentOffset);
      return null;
    }

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
      
      // ✅ ЛОГ: перед доступом к offset.x/y
      console.log(`[Tile ${logId}] revertToPrevious - проверка offset:`, {
        hasOffset: !!currentOffset,
        offsetX: currentOffset?.x,
        offsetY: currentOffset?.y,
      });
      
      if (
        !currentOffset || 
        typeof currentOffset.x !== 'number' || 
        typeof currentOffset.y !== 'number'
      ) {
        console.log(`[Tile ${logId}] offset не готов, возврат в спавнер`);
        if (
          spawnerPos && 
          typeof spawnerPos.x === 'number' && 
          typeof spawnerPos.y === 'number'
        ) {
          return SpawnerService.getTilePosition(currentTileSize.current, spawnerPos);
        }
        return currentPositionRef.current;
      }
      
      return getSnapToCellPosition(
        tileSize,
        targetCellRef.current.col,
        targetCellRef.current.row,
        currentScale,
        currentOffset.x,
        currentOffset.y
      );
    } 

    if (
      spawnerPos && 
      typeof spawnerPos.x === 'number' && 
      typeof spawnerPos.y === 'number'
    ) {
      return SpawnerService.getTilePosition(currentTileSize.current, spawnerPos);
    }

    return currentPositionRef.current;
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
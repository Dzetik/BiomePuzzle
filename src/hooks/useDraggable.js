import { useState, useEffect, useCallback, useRef } from 'react';
import { useZoom } from './useZoom';
import { useGrid } from '../context/GridContext';
import { useSpawner } from './useSpawner';
import { useTiles } from '../context/TilesContext';
import { getSpawnerSize } from '../constants/spawner';
import { useTileAnimations } from './useDraggable/useTileAnimations';
import { useTileTargetCell } from './useDraggable/useTileTargetCell';
import { useTileSpawnerLogic } from './useDraggable/useTileSpawnerLogic';
import { useTilePlacement } from './useDraggable/useTilePlacement';
import { useTileDragHandler } from './useDraggable/useTileDragHandler';

const useDraggable = (initialTileData = null, tileId = null, externalInitialPosition = null) => {
  const { scale } = useZoom();
  const { offset } = useGrid();
  const spawnerPos = useSpawner();
  const { returnTileToSpawner, createSpawnerTile } = useTiles();
  const spawnerSize = getSpawnerSize();

  const [isSpawnerReady, setIsSpawnerReady] = useState(false);
  const [isInSpawner, setIsInSpawner] = useState(true);
  const [currentTileData, setCurrentTileData] = useState(initialTileData);
  const isFreshSpawnerTileRef = useRef(false);
  const [startPosition, setStartPosition] = useState(externalInitialPosition || { x: 0, y: 0 });
  const targetCellRef = useRef(null);
  const isTilePositionInitializedRef = useRef(false);
  
  // 🔥 НОВЫЙ: отслеживаем инициализацию размера
  const isTileSizeInitializedRef = useRef(false);

  const getCurrentTileId = useCallback(() => {
    if (currentTileData?.id && currentTileData.id !== 'temp' && currentTileData.id.startsWith('tile-')) {
      return currentTileData.id;
    }
    if (tileId && tileId !== 'temp' && tileId.startsWith('tile-')) {
      return tileId;
    }
    return null;
  }, [currentTileData, tileId]);

  const currentTileIdRef = useRef(null);
  useEffect(() => {
    const id = getCurrentTileId();
    if (id) currentTileIdRef.current = id;
  }, [getCurrentTileId]);
  const getCurrentTileIdRef = useCallback(() => currentTileIdRef.current, []);

  const currentTileDataRef = useRef(currentTileData);
  useEffect(() => {
    currentTileDataRef.current = currentTileData;
  }, [currentTileData]);
  const getCurrentTileDataRef = useCallback(() => currentTileDataRef.current, []);

  const currentTileId = getCurrentTileId();

  // 🔥 КЛЮЧЕВОЕ: initialSize всегда равен размеру спавнера для новой плитки
  const animations = useTileAnimations({
    tileId: currentTileId || 'temp',
    initialPosition: startPosition,
    initialSize: { width: spawnerSize, height: spawnerSize },
    scale,
    offset,
    isInSpawner,
    targetCellRef,
    isSpawnerReady,
  });

  const spawnerLogic = useTileSpawnerLogic({
    getTileId: getCurrentTileIdRef,
    spawnerPos,
    isSpawnerReady,
    currentTileSize: animations.currentTileSize,
    currentPositionRef: animations.currentPositionRef,
    animateSize: animations.animateSize,
    getTileSize: animations.getTileSize,
    scale,
    isInSpawner,
    setIsInSpawner,
    tileData: currentTileData,
  });

  const targetCellLogic = useTileTargetCell({
    getTileId: getCurrentTileIdRef,
    scale,
    offset,
    currentTileSize: animations.currentTileSize,
    currentPositionRef: animations.currentPositionRef,
    isInSpawner,
    setIsInSpawner,
    targetCellRef,
    tileData: currentTileData,
  });

  const handleTilePlaced = useCallback(
    (placedTileData, targetCell) => {
      if (!placedTileData?.id) return;
      try {
        const newTile = createSpawnerTile();
        targetCellRef.current = null;
        setCurrentTileData(newTile);
        returnTileToSpawner(newTile);

        // 🔥 Сбрасываем флаги инициализации для новой плитки
        isTilePositionInitializedRef.current = false;
        isTileSizeInitializedRef.current = false;

        if (
          spawnerPos &&
          typeof spawnerPos.x === 'number' &&
          typeof spawnerPos.y === 'number' &&
          animations.position
        ) {
          animations.animateToPosition(
            { x: spawnerPos.x, y: spawnerPos.y },
            false,
            () => {
              setIsInSpawner(true);
              // 🔥 КЛЮЧЕВОЕ: размер устанавливаем immediately, без анимации
              animations.animateSize(
                { width: spawnerSize, height: spawnerSize },
                true,
                () => { isFreshSpawnerTileRef.current = false; }
              );
            }
          );
        } else {
          setIsInSpawner(true);
          isFreshSpawnerTileRef.current = false;
        }
      } catch (e) {
        console.error('[useDraggable] Error in handleTilePlaced:', e);
      }
    },
    [createSpawnerTile, returnTileToSpawner, spawnerPos, animations, spawnerSize]
  );

  const placementLogic = useTilePlacement({
    getTileId: getCurrentTileIdRef,
    getTileData: getCurrentTileDataRef,
    spawnerPos,
    currentTileSize: animations.currentTileSize,
    currentPositionRef: animations.currentPositionRef,
    isInSpawner,
    targetCellRef,
    isCellFree: targetCellLogic.isCellFree,
    tryOccupyCell: targetCellLogic.tryOccupyCell,
    releaseCurrentCell: targetCellLogic.releaseCurrentCell,
    setInSpawner: spawnerLogic.setInSpawner,
    setOutOfSpawner: spawnerLogic.setOutOfSpawner,
    animateToPosition: animations.animateToPosition,
    onTilePlaced: handleTilePlaced,
  });

  const dragHandler = useTileDragHandler({
    getTileId: getCurrentTileIdRef,
    position: animations.position,
    currentTileSize: animations.currentTileSize,
    currentPositionRef: animations.currentPositionRef,
    correctPositionIfNeeded: animations.correctPositionIfNeeded,
    onPlacement: placementLogic.handlePlacement,
    animateToPosition: animations.animateToPosition,
    acquireTileFromSpawner: spawnerLogic.acquireTileFromSpawner,
  });

  useEffect(() => {
    if (initialTileData?.id && initialTileData.id !== currentTileData?.id) {
      setCurrentTileData(initialTileData);
      isTilePositionInitializedRef.current = false;
      isTileSizeInitializedRef.current = false;
    }
  }, [initialTileData, currentTileData]);

  useEffect(() => {
    if (
      currentTileData?.id &&
      spawnerPos &&
      typeof spawnerPos.x === 'number' &&
      typeof spawnerPos.y === 'number' &&
      spawnerPos.size > 0 &&
      offset &&
      typeof offset.x === 'number' &&
      typeof offset.y === 'number'
    ) {
      setStartPosition({ x: spawnerPos.x, y: spawnerPos.y });
    }
  }, [currentTileData?.id, spawnerPos, offset]);

  useEffect(() => {
    if (
      spawnerPos &&
      typeof spawnerPos.x === 'number' &&
      typeof spawnerPos.y === 'number' &&
      spawnerPos.size > 0
    ) {
      setIsSpawnerReady(true);
    }
  }, [spawnerPos]);

  useEffect(() => {
    if (!animations.position) return;
    
    const extractValue = (val) => {
      if (typeof val === 'number') return val;
      if (val && typeof val.__getValue === 'function') {
        try { return val.__getValue(); } catch { return val._value ?? 0; }
      }
      return 0;
    };

    const listener = animations.position.addListener((value) => {
      try {
        const x = extractValue(value?.x);
        const y = extractValue(value?.y);
        
        if (typeof x !== 'number' || typeof y !== 'number') return;
        if (!isSpawnerReady || !spawnerPos || typeof spawnerPos.x !== 'number') return;
        
        spawnerLogic.handlePositionChange({ x, y });
      } catch (e) {
        console.error('[Effect 4] Listener error:', e);
      }
    });

    return () => {
      animations.position.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (!isSpawnerReady) return;
    if (!isInSpawner && !targetCellRef.current && currentTileData) {
      targetCellLogic.updateTargetCellFromPosition();
    }
  }, [isInSpawner, targetCellRef, targetCellLogic, currentTileData, isSpawnerReady]);

  useEffect(() => {
    if (isFreshSpawnerTileRef.current || !isSpawnerReady || isTilePositionInitializedRef.current) {
      if (isSpawnerReady && !isTilePositionInitializedRef.current) {
        isTilePositionInitializedRef.current = true;
      }
      return;
    }
    
    if (
      isInSpawner &&
      spawnerPos &&
      typeof spawnerPos.x === 'number' &&
      typeof spawnerPos.y === 'number' &&
      animations.position &&
      offset &&
      typeof offset.x === 'number' &&
      typeof offset.y === 'number'
    ) {
      animations.position.setValue({
        x: spawnerPos.x + (spawnerPos.size - spawnerSize) / 2,
        y: spawnerPos.y + (spawnerPos.size - spawnerSize) / 2,
      });
      isTilePositionInitializedRef.current = true;
    }
  }, [isInSpawner, isSpawnerReady, spawnerPos, animations.position, offset, spawnerSize]);

  // 🔥 НОВЫЙ: Effect для инициализации размера (только один раз)
  useEffect(() => {
    if (!animations.width || !animations.height) return;
    if (isFreshSpawnerTileRef.current || !isSpawnerReady || isTileSizeInitializedRef.current) {
      if (isSpawnerReady && !isTileSizeInitializedRef.current) {
        isTileSizeInitializedRef.current = true;
      }
      return;
    }
    
    if (isInSpawner) {
      // 🔥 КЛЮЧЕВОЕ: устанавливаем размер спавнера immediately, без анимации
      animations.animateSize(
        { width: spawnerSize, height: spawnerSize },
        true
      );
      isTileSizeInitializedRef.current = true;
    }
  }, [isInSpawner, isSpawnerReady, animations.width, animations.height, animations.animateSize, spawnerSize]);

  return {
    position: animations.position || { x: 0, y: 0 },
    width: animations.width || spawnerSize,
    height: animations.height || spawnerSize,
    panHandlers: dragHandler.panHandlers || {},
    isInSpawner,
  };
};

export default useDraggable;
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
  
  const { 
    returnTileToSpawner,
    createSpawnerTile,
  } = useTiles();
  
  const [isSpawnerReady, setIsSpawnerReady] = useState(false);
  const [isInSpawner, setIsInSpawner] = useState(true);
  const [currentTileData, setCurrentTileData] = useState(initialTileData);
  
  const isFreshSpawnerTileRef = useRef(false);
  
  useEffect(() => {
    if (initialTileData?.id && initialTileData.id !== currentTileData?.id) {
      console.log('[useDraggable] Обновление currentTileData:', initialTileData.id);
      setCurrentTileData(initialTileData);
    }
  }, [initialTileData, currentTileData]);

  const [startPosition, setStartPosition] = useState(
    externalInitialPosition || { x: 0, y: 0 }
  );
  const [initialPositionSet, setInitialPositionSet] = useState(false);
  
  const targetCellRef = useRef(null);
  const spawnerSize = getSpawnerSize();

  // ========================================
  // ГЕТТЕРЫ ДЛЯ АКТУАЛЬНЫХ ДАННЫХ
  // ========================================

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
    if (id) {
      currentTileIdRef.current = id;
    }
  }, [getCurrentTileId]);

  const getCurrentTileIdRef = useCallback(() => {
    return currentTileIdRef.current;
  }, []);

  const currentTileDataRef = useRef(currentTileData);
  
  useEffect(() => {
    currentTileDataRef.current = currentTileData;
  }, [currentTileData]);

  const getCurrentTileDataRef = useCallback(() => {
    return currentTileDataRef.current;
  }, []);

  // ========================================
  // ИНИЦИАЛИЗАЦИЯ
  // ========================================

  const currentTileId = getCurrentTileId();
  const isValid = !!currentTileId;
  
  useEffect(() => {
    if (spawnerPos && spawnerPos.size > 0) {
      setIsSpawnerReady(true);
    }
  }, [spawnerPos]);

  useEffect(() => {
    if (isSpawnerReady && externalInitialPosition && !initialPositionSet) {
      setStartPosition(externalInitialPosition);
      setInitialPositionSet(true);
    }
  }, [isSpawnerReady, externalInitialPosition, initialPositionSet]);

  // ✅ Инициализируем размером спавнера (100x100)
  const initialTileSize = { width: spawnerSize, height: spawnerSize };

  // ========================================
  // ПОД-ХУКИ
  // ========================================

  const animations = useTileAnimations({
    tileId: currentTileId || 'temp',
    initialPosition: startPosition,
    initialSize: initialTileSize,
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

  // ========================================
  // ОБРАБОТКА РАЗМЕЩЕНИЯ ПЛИТКИ
  // ========================================

  const handleTilePlaced = useCallback((placedTileData, targetCell) => {
    if (!placedTileData?.id) {
      console.log('[Tile] Нет данных плитки при размещении');
      return;
    }
    
    console.log(`[Tile ${placedTileData.id}] Плитка размещена в [${targetCell.col},${targetCell.row}]`);
    
    const newTile = createSpawnerTile();
    console.log(`[Tile] Создана новая плитка в спавнере: ${newTile?.id}`);
    
    // ✅ 1. СНАЧАЛА устанавливаем isInSpawner
    setIsInSpawner(true);
    targetCellRef.current = null;
    
    // ✅ 2. Устанавливаем флаг "свежей" плитки (защита от ложного выхода)
    isFreshSpawnerTileRef.current = true;
    
    // ✅ 3. Обновляем данные плитки
    setCurrentTileData(newTile);
    returnTileToSpawner(newTile);
    
    // ✅ 4. СБРОС РАЗМЕРА СРАЗУ (синхронно, не в setTimeout!)
    const spawnerSize = { width: getSpawnerSize(), height: getSpawnerSize() };
    animations.animateSize(spawnerSize, true);  // true = мгновенно
    console.log('[Tile] Мгновенный сброс размера:', spawnerSize);
    
    // ✅ 5. Позиция в setTimeout (ждёт обновления состояния)
    setTimeout(() => {
      if (spawnerPos && animations.position) {
        const spawnerPosition = {
          x: spawnerPos.x + (spawnerPos.size - getSpawnerSize()) / 2,
          y: spawnerPos.y + (spawnerPos.size - getSpawnerSize()) / 2,
        };
        console.log('[Tile] Сброс позиции новой плитки в спавнер:', spawnerPosition);
        animations.position.setValue(spawnerPosition);
      }
    }, 100);
    
    // ✅ 6. Сбрасываем флаг через 500мс
    setTimeout(() => {
      isFreshSpawnerTileRef.current = false;
      console.log('[Tile] Сброс флага isFreshSpawnerTileRef');
    }, 500);
    
  }, [createSpawnerTile, returnTileToSpawner, targetCellRef, setIsInSpawner, spawnerPos, animations.position, animations.animateSize, getSpawnerSize]);

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

  // ========================================
  // СЛУШАТЕЛИ
  // ========================================

  useEffect(() => {
    if (!animations.position) return;
    
    const listener = animations.position.addListener((value) => {
      spawnerLogic.handlePositionChange(value);
    });
    
    return () => animations.position.removeListener(listener);
  }, [animations.position, spawnerLogic]);

  useEffect(() => {
    if (!isSpawnerReady) return;
    if (!isInSpawner && !targetCellRef.current && currentTileData && isValid) {
      targetCellLogic.updateTargetCellFromPosition();
    }
  }, [isInSpawner, targetCellRef, targetCellLogic, currentTileData, isSpawnerReady, isValid]);

  // ========================================
  // СБРОС ПОЗИЦИИ ПРИ ЗУМЕ/ПАНОРАМИРОВАНИИ
  // ========================================

  useEffect(() => {
    if (isFreshSpawnerTileRef.current) {
      return;
    }
    
    if (isInSpawner && isSpawnerReady && spawnerPos && animations.position) {
      const spawnerPosition = {
        x: spawnerPos.x + (spawnerPos.size - getSpawnerSize()) / 2,
        y: spawnerPos.y + (spawnerPos.size - getSpawnerSize()) / 2,
      };
      
      animations.position.setValue(spawnerPosition);
    }
  }, [isInSpawner, isSpawnerReady, spawnerPos, scale, offset.x, offset.y, animations.position]);

  return {
    position: animations.position || { x: 0, y: 0 },
    width: animations.width || spawnerSize,
    height: animations.height || spawnerSize,
    panHandlers: dragHandler.panHandlers || {},
    isInSpawner,
  };
};

export default useDraggable;
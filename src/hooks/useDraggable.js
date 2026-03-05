// ========================================
// ГЛАВНЫЙ ХУК ПЕРЕТАСКИВАНИЯ ПЛИТКИ
// ✅ ВСЕ ХУКИ ВЫЗЫВАЮТСЯ НА КАЖДОМ РЕНДЕРЕ
// ========================================
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
  // ========================================
  // ✅ 1. ВСЕ ХУКИ КОНТЕКСТА — ВСЕГДА ВЫЗЫВАЮТСЯ
  // ========================================
  const { scale } = useZoom();
  const { offset } = useGrid();
  const spawnerPos = useSpawner();
  const {
    returnTileToSpawner,
    createSpawnerTile,
  } = useTiles();

  // ========================================
  // ✅ 2. ВСЕ СОСТОЯНИЯ — ВСЕГДА ВЫЗЫВАЮТСЯ
  // ========================================
  const [isSpawnerReady, setIsSpawnerReady] = useState(false);
  const [isInSpawner, setIsInSpawner] = useState(true);
  const [currentTileData, setCurrentTileData] = useState(initialTileData);
  const isFreshSpawnerTileRef = useRef(false);

  // ========================================
  // 3. ЭФФЕКТЫ — ВСЕГДА ВЫЗЫВАЮТСЯ
  // ========================================
  useEffect(() => {
    if (initialTileData?.id && initialTileData.id !== currentTileData?.id) {
      setCurrentTileData(initialTileData);
    }
  }, [initialTileData, currentTileData]);

  const [startPosition, setStartPosition] = useState(
    externalInitialPosition || { x: 0, y: 0 }
  );
  
  const [initialPositionSet, setInitialPositionSet] = useState(false);

  useEffect(() => {
    if (currentTileData?.id && spawnerPos?.size > 0) {
      setStartPosition({ x: spawnerPos.x, y: spawnerPos.y });
    }
  }, [currentTileData?.id, spawnerPos]);

  const targetCellRef = useRef(null);
  const spawnerSize = getSpawnerSize();

  // ========================================
  // 4. ГЕТТЕРЫ
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

  const getCurrentTileIdRef = useCallback(() => currentTileIdRef.current, []);

  const currentTileDataRef = useRef(currentTileData);
  useEffect(() => { currentTileDataRef.current = currentTileData; }, [currentTileData]);
  const getCurrentTileDataRef = useCallback(() => currentTileDataRef.current, []);

  // ========================================
  // 5. ИНИЦИАЛИЗАЦИЯ
  // ========================================
  const currentTileId = getCurrentTileId();
  // ✅ НЕ делаем ранний возврат здесь!

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

  const initialTileSize = { width: spawnerSize, height: spawnerSize };

  // ========================================
  // ✅ 6. ПОД-ХУКИ — ВЫЗЫВАЮТСЯ ВСЕГДА!
  // ========================================
  // Даже если currentTileId = null, хуки должны вызываться
  // Они сами обработают null внутри
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
// ОБРАБОТКА РАЗМЕЩЕНИЯ - БЕЗ setTimeout
// ========================================
const handleTilePlaced = useCallback((placedTileData, targetCell) => {
  if (!placedTileData?.id) {
    console.log('[Tile] Нет данных плитки при размещении');
    return;
  }
  
  console.log(`[Tile ${placedTileData.id}] Плитка размещена в [${targetCell.col},${targetCell.row}]`);

  const newTile = createSpawnerTile();
  console.log(`[Tile] Создана новая плитка в спавнере: ${newTile?.id}`);

  // 1. Сбрасываем целевую ячейку
  targetCellRef.current = null;

  // 2. Обновляем данные плитки
  setCurrentTileData(newTile);
  returnTileToSpawner(newTile);

  // ✅ 3. АНИМАЦИЯ С КОЛЛБЭКОМ (вместо setTimeout)
  if (spawnerPos && animations.position) {
    const spawnerPosition = {
      x: spawnerPos.x,
      y: spawnerPos.y,
    };
    
    console.log('[Tile] Анимация возврата в спавнер с onComplete');
    
    // ✅ Анимация позиции с коллбэком
    animations.animateToPosition(spawnerPosition, false, () => {
      console.log('[Tile] Анимация позиции завершена');
      
      // ✅ Теперь устанавливаем isInSpawner
      setIsInSpawner(true);
      console.log('[Tile] setIsInSpawner(true)');
      
      // ✅ И размер для новой плитки
      const spawnerSize = { width: getSpawnerSize(), height: getSpawnerSize() };
      animations.animateSize(spawnerSize, true, () => {
        console.log('[Tile] Анимация размера завершена');
        
        // ✅ Сброс флага
        isFreshSpawnerTileRef.current = false;
        console.log('[Tile] Сброс флага isFreshSpawnerTileRef');
      });
    });
  } else {
    // Fallback если анимация не доступна
    setIsInSpawner(true);
    isFreshSpawnerTileRef.current = false;
  }
}, [createSpawnerTile, returnTileToSpawner, targetCellRef, setIsInSpawner, spawnerPos, animations.position, animations.animateToPosition, animations.animateSize, getSpawnerSize]);

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
  // 8. СЛУШАТЕЛИ — ВСЕГДА
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
    if (!isInSpawner && !targetCellRef.current && currentTileData) {
      targetCellLogic.updateTargetCellFromPosition();
    }
  }, [isInSpawner, targetCellRef, targetCellLogic, currentTileData, isSpawnerReady]);

  useEffect(() => {
    if (isFreshSpawnerTileRef.current) return;
    if (isInSpawner && isSpawnerReady && spawnerPos && animations.position) {
      const spawnerPosition = {
        x: spawnerPos.x + (spawnerPos.size - spawnerSize) / 2,
        y: spawnerPos.y + (spawnerPos.size - spawnerSize) / 2,
      };
      animations.position.setValue(spawnerPosition);
    }
  }, [isInSpawner, isSpawnerReady, spawnerPos, scale, offset.x, offset.y, animations.position, spawnerSize]);

  // ========================================
  // ✅ 9. ВОЗВРАТ — ВСЕГДА ОДИНАКОВЫЙ
  // ========================================
  return {
    position: animations.position || { x: 0, y: 0 },
    width: animations.width || spawnerSize,
    height: animations.height || spawnerSize,
    panHandlers: dragHandler.panHandlers || {},
    isInSpawner,
  };
};

export default useDraggable;
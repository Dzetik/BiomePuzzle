// ========================================
// ГЛАВНЫЙ ХУК ДЛЯ УПРАВЛЕНИЯ ПЕРЕТАСКИВАЕМОЙ ПЛИТКОЙ
// ========================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useZoom } from './useZoom';
import { useGrid } from '../context/GridContext';
import { useSpawner } from './useSpawner';
import { useTiles } from '../context/TilesContext';
import { getSpawnerSize } from '../constants/spawner';

// Импортируем под-хуки
import { useTileAnimations } from './useDraggable/useTileAnimations';
import { useTileTargetCell } from './useDraggable/useTileTargetCell';
import { useTileSpawnerLogic } from './useDraggable/useTileSpawnerLogic';
import { useTilePlacement } from './useDraggable/useTilePlacement';
import { useTileDragHandler } from './useDraggable/useTileDragHandler';

const useDraggable = (initialTileData = null, tileId = null, externalInitialPosition = null) => {
  // Все хуки вызываются безусловно
  const { scale } = useZoom();
  const { offset } = useGrid();
  const spawnerPos = useSpawner();
  
  const { 
    returnTileToSpawner,
    createSpawnerTile,
  } = useTiles();
  
  const [isSpawnerReady, setIsSpawnerReady] = useState(false);
  const [isInSpawner, setIsInSpawner] = useState(true);
  
  // Инициализируем currentTileData данными из пропсов
  const [currentTileData, setCurrentTileData] = useState(initialTileData);
  
  // Обновляем currentTileData когда приходят новые данные из пропсов
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

  // Функция получения ID с приоритетом (для рендера)
  const getCurrentTileId = useCallback(() => {
    if (currentTileData?.id) {
      if (currentTileData.id !== 'temp' && currentTileData.id.startsWith('tile-')) {
        return currentTileData.id;
      }
    }
    
    if (tileId) {
      if (tileId !== 'temp' && tileId.startsWith('tile-')) {
        return tileId;
      }
    }
    
    return null;
  }, [currentTileData, tileId]);

  // Ref для хранения актуального ID (для колбэков)
  const currentTileIdRef = useRef(null);
  
  // Обновляем ref когда меняется ID
  useEffect(() => {
    const id = getCurrentTileId();
    if (id) {
      console.log('[useDraggable] Обновление ref ID:', id);
      currentTileIdRef.current = id;
    }
  }, [getCurrentTileId]);

  // Функция получения ID через ref (всегда актуально для колбэков)
  const getCurrentTileIdRef = useCallback(() => {
    return currentTileIdRef.current;
  }, []);

  const currentTileId = getCurrentTileId();
  const isValid = !!currentTileId;
  
  // Отслеживаем готовность спавнера
  useEffect(() => {
    if (spawnerPos && spawnerPos.size > 0) {
      const logId = currentTileId || 'unknown';
      console.log(`[Tile ${logId}] Спавнер готов:`, spawnerPos);
      setIsSpawnerReady(true);
    }
  }, [spawnerPos, currentTileId]);

  // Обновляем начальную позицию когда спавнер готов (только один раз)
  useEffect(() => {
    if (isSpawnerReady && externalInitialPosition && !initialPositionSet) {
      const logId = currentTileId || 'unknown';
      console.log(`[Tile ${logId}] Устанавливаем начальную позицию:`, externalInitialPosition);
      setStartPosition(externalInitialPosition);
      setInitialPositionSet(true);
    }
  }, [isSpawnerReady, externalInitialPosition, initialPositionSet, currentTileId]);

  const initialTileSize = { width: spawnerSize, height: spawnerSize };

  // Инициализация под-хуков
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

  const handleTilePlaced = useCallback((placedTileData, targetCell) => {
    if (!placedTileData?.id) {
      console.log('[Tile] Нет данных плитки при размещении');
      return;
    }
    
    console.log(`[Tile ${placedTileData.id}] Плитка размещена в [${targetCell.col},${targetCell.row}]`);
    
    const newTile = createSpawnerTile();
    console.log(`[Tile] Создана новая плитка в спавнере: ${newTile?.id}`);
    
    setCurrentTileData(newTile);
    returnTileToSpawner(newTile);
    targetCellRef.current = null;
    setIsInSpawner(true);
    
  }, [createSpawnerTile, returnTileToSpawner, targetCellRef, setIsInSpawner]);

  const placementLogic = useTilePlacement({
    getTileId: getCurrentTileIdRef,
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
    tileData: currentTileData,
  });

  const dragHandler = useTileDragHandler({
    getTileId: getCurrentTileIdRef,
    position: animations.position,
    currentTileSize: animations.currentTileSize,
    currentPositionRef: animations.currentPositionRef,
    correctPositionIfNeeded: animations.correctPositionIfNeeded,
    onPlacement: placementLogic.handlePlacement,
    animateToPosition: animations.animateToPosition,
  });

  // Подключение слушателя позиции
  useEffect(() => {
    if (!animations.position) return;
    
    const listener = animations.position.addListener((value) => {
      spawnerLogic.handlePositionChange(value);
    });
    
    return () => animations.position.removeListener(listener);
  }, [animations.position, spawnerLogic]);

  // Синхронизация целевой ячейки
  useEffect(() => {
    if (!isSpawnerReady) return;
    if (!isInSpawner && !targetCellRef.current && currentTileData && isValid) {
      targetCellLogic.updateTargetCellFromPosition();
    }
  }, [isInSpawner, targetCellRef, targetCellLogic, currentTileData, isSpawnerReady, isValid]);

  return {
    position: animations.position || { x: 0, y: 0 },
    width: animations.width || spawnerSize,
    height: animations.height || spawnerSize,
    panHandlers: dragHandler.panHandlers || {},
    isInSpawner,
  };
};

export default useDraggable;
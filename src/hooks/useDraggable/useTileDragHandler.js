import { useRef, useCallback } from 'react';
import { PanResponder } from 'react-native';
import { getScreenBounds, clampPosition } from '../../utils/constraints';

export const useTileDragHandler = ({
  getTileId,
  position,
  currentTileSize,
  currentPositionRef,
  correctPositionIfNeeded,
  onPlacement,
  animateToPosition,
  acquireTileFromSpawner,
}) => {
  
  const dragData = useRef({
    basePosition: null,
    touchOffset: null,
    tileIdAtStart: null,
  });

  const handleGrant = useCallback((_, gesture) => {
    const currentId = getTileId ? getTileId() : null;
    const logId = currentId || 'unknown';
    
    console.log(`[Tile ${logId}] Начало перетаскивания`);
    console.log(`[Tile ${logId}] ID в момент старта:`, currentId);
    
    // ✅ Вызов функции взятия плитки из спавнера
    if (typeof acquireTileFromSpawner === 'function') {
      acquireTileFromSpawner();
    }
    
    position.stopAnimation();
    
    const currentPos = currentPositionRef.current;
    console.log(`[Tile ${logId}] Текущая позиция:`, currentPos);
    
    dragData.current = {
      basePosition: { ...currentPos },
      touchOffset: {
        x: gesture.x0 - currentPos.x,
        y: gesture.y0 - currentPos.y,
      },
      tileIdAtStart: currentId,
    };
    
    console.log(`[Tile ${logId}] Базовая позиция:`, currentPos);
    console.log(`[Tile ${logId}] Смещение касания:`, dragData.current.touchOffset);
  }, [position, currentPositionRef, getTileId, acquireTileFromSpawner]);

  const handleMove = useCallback((_, gesture) => {
    const { basePosition, touchOffset } = dragData.current;
    
    if (!basePosition || !touchOffset) return;
    
    const newPosition = {
      x: gesture.x0 + gesture.dx - touchOffset.x,
      y: gesture.y0 + gesture.dy - touchOffset.y,
    };
    
    const bounds = getScreenBounds(
      currentTileSize.current.width,
      currentTileSize.current.height
    );
    
    const clampedPosition = clampPosition(newPosition, bounds);
    position.setValue(clampedPosition);
  }, [position, currentTileSize]);

  const handleRelease = useCallback(() => {
    const { tileIdAtStart } = dragData.current;
    const logId = tileIdAtStart || 'unknown';
    
    console.log(`[Tile ${logId}] Завершение перетаскивания`);
    console.log(`[Tile ${logId}] ID при завершении:`, tileIdAtStart);
    
    const targetPosition = onPlacement();
    
    if (targetPosition) {
      console.log(`[Tile ${logId}] Анимация к позиции:`, targetPosition);
      animateToPosition(targetPosition);
    }
    
    dragData.current = { basePosition: null, touchOffset: null, tileIdAtStart: null };
  }, [onPlacement, animateToPosition]);

  const handleTerminate = useCallback(() => {
    const { tileIdAtStart } = dragData.current;
    const logId = tileIdAtStart || 'unknown';
    console.log(`[Tile ${logId}] Жест прерван`);
    dragData.current = { basePosition: null, touchOffset: null, tileIdAtStart: null };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handleGrant,
      onPanResponderMove: handleMove,
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleTerminate,
    })
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
  };
};
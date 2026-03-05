// ========================================
// ОБРАБОТЧИК ЖЕСТОВ ПЛИТКИ
// ========================================
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

  // ========================================
  // СОЗДАНИЕ PAN RESPONDER (ИСПРАВЛЕНО)
  // ========================================
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (_, gesture) => {
        const currentId = getTileId ? getTileId() : null;
        const logId = currentId || 'unknown';
        console.log(`[Tile ${logId}] Начало перетаскивания`);
        console.log(`[Tile ${logId}] ID в момент старта:`, currentId);

        // Вызов функции взятия плитки из спавнера
        if (typeof acquireTileFromSpawner === 'function') {
          acquireTileFromSpawner();
        }

        if (position && typeof position.stopAnimation === 'function') {
          position.stopAnimation();
        }

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
      },

      onPanResponderMove: (_, gesture) => {
        const { basePosition, touchOffset } = dragData.current;
        if (!basePosition || !touchOffset) return;

        if (!position || typeof position.setValue !== 'function') return;

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
      },

      onPanResponderRelease: () => {
        const { tileIdAtStart } = dragData.current;
        const logId = tileIdAtStart || 'unknown';
        console.log(`[Tile ${logId}] Завершение перетаскивания`);

        if (typeof onPlacement === 'function') {
          const targetPosition = onPlacement();

          if (targetPosition && typeof animateToPosition === 'function') {
            console.log(`[Tile ${logId}] Анимация к позиции:`, targetPosition);
            animateToPosition(targetPosition);
          }
        }

        dragData.current = { basePosition: null, touchOffset: null, tileIdAtStart: null };
      },

      onPanResponderTerminate: () => {
        const { tileIdAtStart } = dragData.current;
        const logId = tileIdAtStart || 'unknown';
        console.log(`[Tile ${logId}] Жест прерван`);
        dragData.current = { basePosition: null, touchOffset: null, tileIdAtStart: null };
      },
    })
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
  };
};
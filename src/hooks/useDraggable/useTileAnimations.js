// ========================================
// ХУК АНИМАЦИЙ ПЛИТКИ - С ЗАЩИТОЙ ОТ UNDEFINED
// ========================================
import { useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { getCellSize, getSnapToCellPosition } from '../../utils/gridUtils';

export const useTileAnimations = ({
  tileId,
  initialPosition,
  initialSize,
  scale,
  offset,
  isInSpawner,
  targetCellRef,
  isSpawnerReady,
}) => {
  // ========================================
  // ✅ 1. ЗАЩИТА: Default значения если undefined
  // ========================================
  const safeInitialPosition = initialPosition || { x: 0, y: 0 };
  const safeInitialSize = initialSize || { width: 100, height: 100 };

  console.log('[useTileAnimations] initialPosition:', initialPosition);
  console.log('[useTileAnimations] safeInitialPosition:', safeInitialPosition);

  // ========================================
  // 2. АНИМИРОВАННЫЕ ЗНАЧЕНИЯ
  // ========================================
  const position = useRef(new Animated.ValueXY(safeInitialPosition)).current;
  const widthAnim = useRef(new Animated.Value(safeInitialSize.width)).current;
  const heightAnim = useRef(new Animated.Value(safeInitialSize.height)).current;

  // ========================================
  // 3. REFS ДЛЯ СИНХРОННОГО ДОСТУПА
  // ========================================
  const currentTileSize = useRef(safeInitialSize);
  const currentPositionRef = useRef({ x: safeInitialPosition.x, y: safeInitialPosition.y });
  const animationRef = useRef(null);
  const listenerIdRef = useRef(null);

  // ========================================
  // 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ========================================
  const getTileSize = useCallback((currentScale) => ({
    width: getCellSize(currentScale),
    height: getCellSize(currentScale)
  }), []);

  const animateSize = useCallback((targetSize, immediate = false) => {
    if (!targetSize || !targetSize.width || !targetSize.height) {
      console.warn('[useTileAnimations] animateSize: invalid targetSize', targetSize);
      return;
    }

    if (currentTileSize.current.width === targetSize.width &&
        currentTileSize.current.height === targetSize.height) {
      return;
    }

    console.log(`[Tile ${tileId}] animateSize:`, targetSize, immediate ? 'immediate' : 'animated');

    currentTileSize.current = targetSize;

    if (immediate) {
      widthAnim.setValue(targetSize.width);
      heightAnim.setValue(targetSize.height);
    } else {
      Animated.parallel([
        Animated.spring(widthAnim, { 
          toValue: targetSize.width, 
          useNativeDriver: false,
          friction: 7,
          tension: 40
        }),
        Animated.spring(heightAnim, { 
          toValue: targetSize.height, 
          useNativeDriver: false,
          friction: 7,
          tension: 40
        })
      ]).start();
    }
  }, [widthAnim, heightAnim, tileId]);

  const animateToPosition = useCallback((targetPosition, immediate = false) => {
    if (!targetPosition || typeof targetPosition.x === 'undefined' || typeof targetPosition.y === 'undefined') {
      console.warn('[useTileAnimations] animateToPosition: invalid targetPosition', targetPosition);
      return;
    }

    console.log(`[Tile ${tileId}] animateToPosition:`, targetPosition, immediate ? 'immediate' : 'animated');

    if (animationRef.current) {
      animationRef.current.stop();
    }

    if (immediate) {
      position.setValue(targetPosition);
      currentPositionRef.current = targetPosition;
    } else {
      animationRef.current = Animated.spring(position, {
        toValue: targetPosition,
        useNativeDriver: false,
        friction: 7,
        tension: 40
      });
      animationRef.current.start(() => {
        animationRef.current = null;
      });
    }
  }, [position, tileId]);

  const updatePositionFromTargetCell = useCallback(() => {
    if (isInSpawner || !isSpawnerReady) return;
    if (!targetCellRef.current) {
      console.log(`[Tile ${tileId}] Нет целевой ячейки для обновления позиции`);
      return;
    }

    const newTileSize = getTileSize(scale);
    const newPosition = getSnapToCellPosition(
      newTileSize,
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      offset.x,
      offset.y
    );

    console.log(`[Tile ${tileId}] Обновление позиции по ячейке [${targetCellRef.current.col},${targetCellRef.current.row}]:`, newPosition);

    if (newTileSize.width !== currentTileSize.current.width) {
      animateSize(newTileSize);
    }

    animateToPosition(newPosition);
  }, [scale, offset, isInSpawner, isSpawnerReady, targetCellRef, getTileSize, animateSize, animateToPosition, tileId]);

  const correctPositionIfNeeded = useCallback(() => {
    const currentPos = currentPositionRef.current;
    
    if (isInSpawner || !targetCellRef.current) {
      return currentPos;
    }

    const newTileSize = getTileSize(scale);
    const expectedPosition = getSnapToCellPosition(
      newTileSize,
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      offset.x,
      offset.y
    );

    const threshold = 0.5;
    if (Math.abs(expectedPosition.x - currentPos.x) > threshold || 
        Math.abs(expectedPosition.y - currentPos.y) > threshold) {
      console.log(`[Tile ${tileId}] Коррекция позиции после панорамирования/зума`);
      position.setValue(expectedPosition);
      return expectedPosition;
    }

    return currentPos;
  }, [scale, offset, isInSpawner, targetCellRef, position, tileId, getTileSize]);

  // ========================================
  // 5. ЭФФЕКТЫ
  // ========================================
  useEffect(() => {
    if (listenerIdRef.current) {
      position.removeListener(listenerIdRef.current);
    }
    listenerIdRef.current = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y };
    });

    return () => {
      if (listenerIdRef.current) {
        position.removeListener(listenerIdRef.current);
      }
    };
  }, [position]);

  useEffect(() => {
    updatePositionFromTargetCell();
  }, [scale, offset, updatePositionFromTargetCell]);

  // ========================================
  // 6. ВОЗВРАЩАЕМЫЙ API
  // ========================================
  return {
    position,
    width: widthAnim,
    height: heightAnim,
    currentTileSize,
    currentPositionRef,
    animateSize,
    animateToPosition,
    getTileSize,
    correctPositionIfNeeded,
    updatePositionFromTargetCell,
  };
};

export default useTileAnimations;
// ========================================
// ХУК АНИМАЦИЙ ПЛИТКИ - ФИКС РАЗМЕРА
// ========================================
import { useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Animated } from 'react-native';
import { getCellSize, getSnapToCellPosition } from '../../utils/gridUtils';

const extractAnimatedValue = (val) => {
  if (typeof val === 'number') return val;
  if (val && typeof val.__getValue === 'function') {
    try { return val.__getValue(); } catch { return val._value ?? 0; }
  }
  return 0;
};

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
  const safeInitialPosition = {
    x: typeof initialPosition?.x === 'number' ? initialPosition.x : 0,
    y: typeof initialPosition?.y === 'number' ? initialPosition.y : 0,
  };
  const safeInitialSize = {
    width: typeof initialSize?.width === 'number' ? initialSize.width : 100,
    height: typeof initialSize?.height === 'number' ? initialSize.height : 100,
  };
  const safeOffset = {
    x: typeof offset?.x === 'number' ? offset.x : 0,
    y: typeof offset?.y === 'number' ? offset.y : 0,
  };

  const positionRef = useRef(null);
  const widthAnimRef = useRef(null);
  const heightAnimRef = useRef(null);
  const isInitializedRef = useRef(false);

  // 🔥 КЛЮЧЕВОЕ: инициализируем размеры сразу правильными значениями
  if (!isInitializedRef.current) {
    positionRef.current = new Animated.ValueXY(safeInitialPosition);
    // 🔥 Используем safeInitialSize без анимации для первого рендера
    widthAnimRef.current = new Animated.Value(safeInitialSize.width);
    heightAnimRef.current = new Animated.Value(safeInitialSize.height);
    isInitializedRef.current = true;
  }

  const currentTileSize = useRef(safeInitialSize);
  const currentPositionRef = useRef({ x: safeInitialPosition.x, y: safeInitialPosition.y });
  const animationRef = useRef(null);
  const sizeAnimationRef = useRef(null);
  const listenerIdRef = useRef(null);
  const isMountedRef = useRef(true);
  const prevTileIdRef = useRef(tileId);
  const isFirstRenderRef = useRef(true);
  const isPositionInitializedRef = useRef(false);
  
  // 🔥 НОВЫЙ: отслеживаем последний размер спавнера для предотвращения мигания
  const lastSpawnerSizeRef = useRef({ width: safeInitialSize.width, height: safeInitialSize.height });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      if (sizeAnimationRef.current) {
        sizeAnimationRef.current.stop();
        sizeAnimationRef.current = null;
      }
      if (listenerIdRef.current && positionRef.current) {
        positionRef.current.removeListener(listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, []);

  // Сброс при смене tileId
  useEffect(() => {
    if (prevTileIdRef.current !== tileId && positionRef.current) {
      positionRef.current.stopAnimation();
      positionRef.current.setValue(safeInitialPosition);
      
      // 🔥 КЛЮЧЕВОЕ: размер сбрасываем сразу (immediate), без анимации
      if (widthAnimRef.current && heightAnimRef.current) {
        widthAnimRef.current.stopAnimation();
        heightAnimRef.current.stopAnimation();
        widthAnimRef.current.setValue(safeInitialSize.width);
        heightAnimRef.current.setValue(safeInitialSize.height);
      }
      
      currentPositionRef.current = { ...safeInitialPosition };
      currentTileSize.current = { ...safeInitialSize };
      lastSpawnerSizeRef.current = { ...safeInitialSize };
      isPositionInitializedRef.current = true;
      prevTileIdRef.current = tileId;
    }
  }, [tileId, safeInitialSize]);

  // Синхронная инициализация (до paint)
  useLayoutEffect(() => {
    if (isFirstRenderRef.current && positionRef.current && !isPositionInitializedRef.current) {
      positionRef.current.setValue(safeInitialPosition);
      currentPositionRef.current = { ...safeInitialPosition };
      
      // 🔥 КЛЮЧЕВОЕ: размер устанавливаем синхронно, без анимации
      if (widthAnimRef.current && heightAnimRef.current) {
        widthAnimRef.current.setValue(safeInitialSize.width);
        heightAnimRef.current.setValue(safeInitialSize.height);
      }
      
      currentTileSize.current = { ...safeInitialSize };
      lastSpawnerSizeRef.current = { ...safeInitialSize };
      isPositionInitializedRef.current = true;
      isFirstRenderRef.current = false;
    }
  }, [safeInitialPosition.x, safeInitialPosition.y, safeInitialSize.width, safeInitialSize.height]);

  const getTileSize = useCallback((currentScale) => ({
    width: getCellSize(currentScale),
    height: getCellSize(currentScale)
  }), []);

  const animateSize = useCallback((targetSize, immediate = false) => {
    if (!targetSize || typeof targetSize.width !== 'number' || typeof targetSize.height !== 'number') return;
    if (!isMountedRef.current || !widthAnimRef.current || !heightAnimRef.current) return;
    
    // 🔥 КЛЮЧЕВОЕ: пропускаем анимацию если размер не изменился значительно
    const sizeDiff = Math.abs(currentTileSize.current.width - targetSize.width);
    if (sizeDiff < 0.5) {
      currentTileSize.current = { ...targetSize };
      return;
    }

    currentTileSize.current = { ...targetSize };
    lastSpawnerSizeRef.current = { ...targetSize };

    if (immediate || !isPositionInitializedRef.current) {
      // 🔥 Первый рендер или immediate — без анимации
      widthAnimRef.current.setValue(targetSize.width);
      heightAnimRef.current.setValue(targetSize.height);
    } else {
      // 🔥 Последующие изменения — с анимацией
      if (sizeAnimationRef.current) {
        sizeAnimationRef.current.stop();
        sizeAnimationRef.current = null;
      }
      
      sizeAnimationRef.current = Animated.parallel([
        Animated.spring(widthAnimRef.current, { toValue: targetSize.width, useNativeDriver: false, tension: 35, friction: 8 }),
        Animated.spring(heightAnimRef.current, { toValue: targetSize.height, useNativeDriver: false, tension: 35, friction: 8 })
      ]);
      sizeAnimationRef.current.start(() => { sizeAnimationRef.current = null; });
    }
  }, []);

  const animateToPosition = useCallback((targetPosition, immediate = false) => {
    if (!targetPosition || typeof targetPosition.x !== 'number' || typeof targetPosition.y !== 'number') return;
    if (!isMountedRef.current || !positionRef.current) return;
    
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }

    if (immediate) {
      positionRef.current.setValue(targetPosition);
      currentPositionRef.current = { ...targetPosition };
    } else {
      const startAnimation = () => {
        animationRef.current = Animated.spring(positionRef.current, {
          toValue: targetPosition,
          useNativeDriver: false,
          tension: 35,
          friction: 8,
        });
        animationRef.current.start(() => { animationRef.current = null; });
      };

      if (!isPositionInitializedRef.current) {
        requestAnimationFrame(() => {
          if (isMountedRef.current && positionRef.current) startAnimation();
        });
      } else {
        startAnimation();
      }
    }
  }, []);

  const updatePositionFromTargetCell = useCallback(() => {
    if (!isMountedRef.current || isInSpawner || !isSpawnerReady || !targetCellRef.current) return;

    const newTileSize = getTileSize(scale);
    const newPosition = getSnapToCellPosition(
      newTileSize,
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      safeOffset.x,
      safeOffset.y
    );

    if (newTileSize.width !== currentTileSize.current.width) {
      animateSize(newTileSize);
    }
    animateToPosition(newPosition);
  }, [scale, safeOffset, isInSpawner, isSpawnerReady, targetCellRef, getTileSize, animateSize, animateToPosition]);

  const correctPositionIfNeeded = useCallback(() => {
    if (!isMountedRef.current || isInSpawner || !targetCellRef.current) {
      return currentPositionRef.current;
    }

    const currentPos = currentPositionRef.current;
    const newTileSize = getTileSize(scale);
    const expectedPosition = getSnapToCellPosition(
      newTileSize,
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      safeOffset.x,
      safeOffset.y
    );

    const threshold = 0.5;
    if (Math.abs(expectedPosition.x - currentPos.x) > threshold || 
        Math.abs(expectedPosition.y - currentPos.y) > threshold) {
      positionRef.current?.setValue(expectedPosition);
      currentPositionRef.current = { ...expectedPosition };
      return expectedPosition;
    }
    return currentPos;
  }, [scale, safeOffset, isInSpawner, targetCellRef, getTileSize]);

  useEffect(() => {
    if (!positionRef.current) return;

    listenerIdRef.current = positionRef.current.addListener((value) => {
      if (!isMountedRef.current || !isPositionInitializedRef.current) return;
      
      try {
        const x = extractAnimatedValue(value?.x);
        const y = extractAnimatedValue(value?.y);
        
        if (typeof x === 'number' && typeof y === 'number') {
          currentPositionRef.current = { x, y };
        }
      } catch (e) {
        console.error('[useTileAnimations] Listener error:', e);
      }
    });

    return () => {
      if (listenerIdRef.current && positionRef.current) {
        positionRef.current.removeListener(listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isMountedRef.current && isInSpawner && positionRef.current) {
      positionRef.current.setValue(safeInitialPosition);
      currentPositionRef.current = { ...safeInitialPosition };
    }
  }, [safeInitialPosition.x, safeInitialPosition.y, isInSpawner]);

  return {
    position: positionRef.current,
    width: widthAnimRef.current,
    height: heightAnimRef.current,
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
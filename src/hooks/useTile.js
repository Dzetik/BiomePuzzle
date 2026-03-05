// ========================================
// ХУК УПРАВЛЕНИЯ ПЛИТКОЙ
// Один экземпляр хука = Одна плитка
// ========================================
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';
import { useZoom } from './useZoom';
import { useGrid } from '../context/GridContext';
import { useSpawner } from './useSpawner';
import { useTiles } from '../context/TilesContext';
import { getSpawnerSize } from '../constants/spawner';
import { getCellSize, getSnapToCellPosition, findNearestCell } from '../utils/gridUtils';
// ✅ ОБНОВЛЕНО: импорт из SpawnerService вместо spawnerUtils
import { SpawnerService } from '../services/SpawnerService';

export const useTile = ({
  tileId,
  initialPosition,
  isPlaced = false,
  onPlaced,
}) => {
  // ========================================
  // КОНТЕКСТЫ
  // ========================================
  const { scale } = useZoom();
  const { offset } = useGrid();
  const spawnerPos = useSpawner();
  const {
    addTile,
    moveTile,
    removeTile,
    getTileAt,
    getAllTiles,
    takeTileFromSpawner,
    returnTileToSpawner,
  } = useTiles();

  // ========================================
  // СОСТОЯНИЕ
  // ========================================
  const [isInSpawner, setIsInSpawner] = useState(!isPlaced);
  const [targetCell, setTargetCell] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // ========================================
  // REFS
  // ========================================
  const wasTakenFromSpawnerRef = useRef(false);
  const isDraggingRef = useRef(false);
  const tileDataRef = useRef({ id: tileId, texture: 'test1.png' });
  const dragDataRef = useRef(null);

  // ========================================
  // АНИМИРОВАННЫЕ ЗНАЧЕНИЯ (С MEMO ПО TILEID)
  // ========================================
  const position = useMemo(
    () => new Animated.ValueXY(initialPosition || { x: 0, y: 0 }),
    [tileId]
  );

  const widthAnim = useMemo(
    () => new Animated.Value(getSpawnerSize()),
    [tileId]
  );

  const heightAnim = useMemo(
    () => new Animated.Value(getSpawnerSize()),
    [tileId]
  );

  // ========================================
  // REFS ДЛЯ СИНХРОННОГО ДОСТУПА
  // ========================================
  const currentPositionRef = useRef(initialPosition || { x: 0, y: 0 });
  const currentTileSize = useRef({ width: getSpawnerSize(), height: getSpawnerSize() });

  // ========================================
  // ПОДПИСКА НА ПОЗИЦИЮ
  // ========================================
  useEffect(() => {
    const listener = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y };
    });
    return () => position.removeListener(listener);
  }, [position]);

  // ========================================
  // АНИМАЦИИ
  // ========================================
  const animateSize = useCallback((targetSize, immediate = false) => {
    if (immediate) {
      widthAnim.setValue(targetSize.width);
      heightAnim.setValue(targetSize.height);
    } else {
      Animated.parallel([
        Animated.spring(widthAnim, {
          toValue: targetSize.width,
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }),
        Animated.spring(heightAnim, {
          toValue: targetSize.height,
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }),
      ]).start();
    }
    currentTileSize.current = targetSize;
  }, [widthAnim, heightAnim]);

  const animateToPosition = useCallback((targetPosition, immediate = false) => {
    if (immediate) {
      position.setValue(targetPosition);
      currentPositionRef.current = targetPosition;
    } else {
      Animated.spring(position, {
        toValue: targetPosition,
        useNativeDriver: false,
        friction: 7,
        tension: 40,
      }).start(() => {
        currentPositionRef.current = targetPosition;
      });
    }
  }, [position]);

  // ========================================
  // ЛОГИКА СПАВНЕРА (ОБНОВЛЕНО: SpawnerService)
  // ========================================
  const checkIfInSpawner = useCallback((pos) => {
    if (!spawnerPos) return false;
    return SpawnerService.isInGravityZone(pos, currentTileSize.current, spawnerPos);
  }, [spawnerPos]);

  // ========================================
  // ЛОГИКА ЯЧЕЕК
  // ========================================
  const isCellFree = useCallback((col, row) => {
    const tileAtCell = getTileAt(col, row);
    return !tileAtCell || tileAtCell.id === tileId;
  }, [getTileAt, tileId]);

  const tryOccupyCell = useCallback((col, row) => {
    if (!isCellFree(col, row)) return false;

    const allTiles = getAllTiles();
    const existingTile = allTiles.find(t => t.id === tileId);

    if (existingTile) {
      moveTile(existingTile.col, existingTile.row, col, row, { id: tileId, texture: 'test1.png' });
    } else {
      addTile(col, row, { id: tileId, texture: 'test1.png' });
    }

    setTargetCell({ col, row });
    return true;
  }, [isCellFree, getAllTiles, addTile, moveTile, tileId]);

  const releaseCurrentCell = useCallback(() => {
    if (targetCell) {
      removeTile(targetCell.col, targetCell.row);
      setTargetCell(null);
    }
  }, [targetCell, removeTile]);

  // ========================================
  // ОБРАБОТКА ЖЕСТОВ
  // ========================================
  const handleGrant = useCallback((_, gesture) => {
    console.log(`[Tile ${tileId}] Начало перетаскивания`);

    if (!wasTakenFromSpawnerRef.current && isInSpawner) {
      const tile = takeTileFromSpawner();
      if (tile) {
        wasTakenFromSpawnerRef.current = true;
        tileDataRef.current = tile;
        console.log(`[Tile ${tileId}] Получена из спавнера`);
      }
    }

    position.stopAnimation();
    isDraggingRef.current = true;
    setIsDragging(true);

    const currentPos = currentPositionRef.current;
    const touchOffset = {
      x: gesture.x0 - currentPos.x,
      y: gesture.y0 - currentPos.y,
    };

    // ✅ Сохраняем dragData в ref для использования в handleMove
    dragDataRef.current = { touchOffset, basePosition: { ...currentPos } };
    return dragDataRef.current;
  }, [tileId, isInSpawner, takeTileFromSpawner, position]);

  const handleMove = useCallback((_, gesture) => {
    const dragData = dragDataRef.current;
    if (!dragData?.basePosition || !dragData?.touchOffset) return;

    const { width, height } = Dimensions.get('window');

    const newPosition = {
      x: gesture.x0 + gesture.dx - dragData.touchOffset.x,
      y: gesture.y0 + gesture.dy - dragData.touchOffset.y,
    };

    const bounds = {
      minX: 0,
      maxX: width - currentTileSize.current.width,
      minY: 0,
      maxY: height - currentTileSize.current.height,
    };

    const clampedPosition = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, newPosition.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, newPosition.y)),
    };

    position.setValue(clampedPosition);
  }, [position]);

  const handleRelease = useCallback(() => {
    console.log(`[Tile ${tileId}] Завершение перетаскивания`);
    isDraggingRef.current = false;
    setIsDragging(false);

    const currentPos = currentPositionRef.current;

    // Проверка: в спавнере?
    if (checkIfInSpawner(currentPos)) {
      console.log(`[Tile ${tileId}] Возврат в спавнер`);
      setIsInSpawner(true);
      // ✅ ИСПОЛЬЗУЕМ SpawnerService вместо getSnapToSpawnerPosition
      const spawnerPosition = SpawnerService.getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
      animateToPosition(spawnerPosition);
      if (tileDataRef.current) {
        returnTileToSpawner(tileDataRef.current);
      }
      return;
    }

    // Проверка: сетка
    const centerX = currentPos.x + currentTileSize.current.width / 2;
    const centerY = currentPos.y + currentTileSize.current.height / 2;

    const targetCell = findNearestCell(centerX, centerY, scale, offset.x, offset.y);

    if (isCellFree(targetCell.col, targetCell.row)) {
      const snappedPosition = getSnapToCellPosition(
        currentTileSize.current,
        targetCell.col,
        targetCell.row,
        scale,
        offset.x,
        offset.y
      );

      if (tryOccupyCell(targetCell.col, targetCell.row)) {
        console.log(`[Tile ${tileId}] Размещена в [${targetCell.col},${targetCell.row}]`);
        setIsInSpawner(false);
        animateToPosition(snappedPosition);

        if (onPlaced) {
          onPlaced({ id: tileId, texture: 'test1.png' }, targetCell);
        }
        return;
      }
    }

    // Возврат в предыдущее положение
    console.log(`[Tile ${tileId}] Возврат на место`);
    if (targetCell) {
      const snappedPosition = getSnapToCellPosition(
        currentTileSize.current,
        targetCell.col,
        targetCell.row,
        scale,
        offset.x,
        offset.y
      );
      animateToPosition(snappedPosition);
    } else {
      // ✅ ИСПОЛЬЗУЕМ SpawnerService
      const spawnerPosition = SpawnerService.getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
      animateToPosition(spawnerPosition);
      setIsInSpawner(true);
    }
    
    // ✅ Очищаем dragData после завершения
    dragDataRef.current = null;
  }, [tileId, checkIfInSpawner, spawnerPos, scale, offset, targetCell, isCellFree, tryOccupyCell, animateToPosition, onPlaced, returnTileToSpawner]);

  // ========================================
  // PAN RESPONDER (ИСПРАВЛЕНО)
  // ========================================
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handleGrant,
      onPanResponderMove: handleMove,  // ✅ Прямо передаём handleMove
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleRelease,
    })
  ).current;

  // ========================================
  // СИНХРОНИЗАЦИЯ ПРИ ЗУМЕ/ПАНОРАМИРОВАНИИ
  // ========================================
  useEffect(() => {
    if (isInSpawner || isDragging || !targetCell) return;

    const newPosition = getSnapToCellPosition(
      currentTileSize.current,
      targetCell.col,
      targetCell.row,
      scale,
      offset.x,
      offset.y
    );

    animateToPosition(newPosition, true);
  }, [scale, offset.x, offset.y, isInSpawner, isDragging, targetCell, animateToPosition]);

  // ========================================
  // РАЗМЕР ПРИ СМЕНЕ СОСТОЯНИЯ
  // ========================================
  useEffect(() => {
    const spawnerSize = { width: getSpawnerSize(), height: getSpawnerSize() };
    const gridSize = { width: getCellSize(scale), height: getCellSize(scale) };

    if (isInSpawner) {
      animateSize(spawnerSize, false);
    } else {
      animateSize(gridSize, false);
    }
  }, [isInSpawner, scale, animateSize]);

  // ========================================
  // ВОЗВРАЩАЕМЫЙ API
  // ========================================
  return {
    position,
    width: widthAnim,
    height: heightAnim,
    panHandlers: panResponder.panHandlers,
    isInSpawner,
    isDragging,
    targetCell,
  };
};

export default useTile;
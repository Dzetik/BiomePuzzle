import { useRef, useEffect, useState, useCallback } from 'react';
import { PanResponder, Animated } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid } from '../utils/gridUtils';
import { getSpawnerSize } from '../constants/spawner';
import { isCenterOverSpawner } from '../utils/spawnerUtils';
import { useZoom } from './useZoom';
import { useTiles } from '../context/TilesContext';
import { useGrid } from '../context/GridContext';
import { getCellSize, findNearestCell, getCellCenter } from '../utils/gridUtils';

const useDraggable = (initialPosition = null, tileId = null) => {
  // Все хуки на верхнем уровне
  const { scale } = useZoom();
  const { isCellOccupied, addTile, moveTile, getTileAt, getAllTiles } = useTiles();
  const { offset } = useGrid();
  
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  
  // Обновляем ref при изменении offset и scale
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  
  const [isInSpawner, setIsInSpawner] = useState(true);
  
  // Целевая ячейка плитки
  const targetCellRef = useRef({ col: 0, row: 0 });
  
  // Размеры
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };
  
  const getTileSize = useCallback((s) => ({
    width: getCellSize(s),
    height: getCellSize(s)
  }), []);
  
  const startPosition = initialPosition || { x: 0, y: 0 };
  
  const widthAnim = useRef(new Animated.Value(spawnerTileSize.width)).current;
  const heightAnim = useRef(new Animated.Value(spawnerTileSize.height)).current;
  const position = useRef(new Animated.ValueXY(startPosition)).current;
  
  const currentTileSize = useRef(spawnerTileSize);
  const currentPositionRef = useRef({ x: position.x._value, y: position.y._value });

  /**
   * Эффект: при монтировании проверяем, есть ли уже плитка в какой-то ячейке
   */
  useEffect(() => {
    if (tileId) {
      console.log(`[Tile ${tileId}] Монтирование, поиск существующей позиции`);
      const allTiles = getAllTiles();
      const existingTile = allTiles.find(t => t.id === tileId);
      
      if (existingTile) {
        console.log(`[Tile ${tileId}] Загружена из ячейки:`, existingTile.col, existingTile.row);
        targetCellRef.current = { col: existingTile.col, row: existingTile.row };
        setIsInSpawner(false);
        
        const cellCenter = getCellCenter(
          existingTile.col, 
          existingTile.row, 
          scale, 
          offset.x, 
          offset.y
        );
        
        const newPosition = {
          x: Math.round(cellCenter.x - currentTileSize.current.width / 2),
          y: Math.round(cellCenter.y - currentTileSize.current.height / 2),
        };
        
        console.log(`[Tile ${tileId}] Установка позиции:`, newPosition);
        position.setValue(newPosition);
      } else {
        console.log(`[Tile ${tileId}] Нет в сохранённых, в спавнере`);
        // Для плитки в спавнере устанавливаем целевую ячейку
        const spawnerCell = findNearestCell(
          startPosition.x + spawnerTileSize.width / 2,
          startPosition.y + spawnerTileSize.height / 2,
          scale,
          offset.x,
          offset.y
        );
        targetCellRef.current = spawnerCell;
      }
    }
  }, [tileId, getAllTiles, scale, offset, position, currentTileSize, startPosition, spawnerTileSize]);

  /**
   * Проверяет, свободна ли ячейка
   */
  const isCellFree = useCallback((col, row) => {
    const tileAtCell = getTileAt(col, row);
    return !tileAtCell || tileAtCell.id === tileId;
  }, [getTileAt, tileId]);

  /**
   * Обновляет целевую ячейку по текущей позиции плитки
   */
  const updateTargetCell = useCallback(() => {
    const pos = currentPositionRef.current;
    const size = currentTileSize.current;
    const currentOffset = offsetRef.current;
    
    const center = {
      x: pos.x + size.width / 2,
      y: pos.y + size.height / 2
    };
    
    const cell = findNearestCell(
      center.x, 
      center.y, 
      scaleRef.current,
      currentOffset.x,
      currentOffset.y
    );
    
    targetCellRef.current = { col: cell.col, row: cell.row };
  }, []);

  /**
   * Пытается занять ячейку
   */
  const tryOccupyCell = useCallback((col, row) => {
    console.log(`[Tile ${tileId}] Попытка занять ячейку [${col},${row}]`);
    
    if (isCellFree(col, row)) {
      const allTiles = getAllTiles();
      const existingTile = allTiles.find(t => t.id === tileId);
      
      if (existingTile) {
        console.log(`[Tile ${tileId}] Перемещение из [${existingTile.col},${existingTile.row}] в [${col},${row}]`);
        moveTile(existingTile.col, existingTile.row, col, row, { id: tileId, texture: 'test1' });
      } else {
        console.log(`[Tile ${tileId}] Добавление в [${col},${row}]`);
        addTile(col, row, { id: tileId, texture: 'test1' });
      }
      return true;
    }
    
    console.log(`[Tile ${tileId}] Ячейка [${col},${row}] занята, отмена`);
    return false;
  }, [isCellFree, addTile, moveTile, getAllTiles, tileId]);

  /**
   * Анимирует изменение размера плитки
   */
  const animateSize = useCallback((targetSize) => {
    currentTileSize.current = targetSize;
    Animated.parallel([
      Animated.spring(widthAnim, { 
        toValue: targetSize.width, 
        useNativeDriver: false 
      }),
      Animated.spring(heightAnim, { 
        toValue: targetSize.height, 
        useNativeDriver: false 
      })
    ]).start();
  }, [widthAnim, heightAnim]);

  /**
   * Анимирует перемещение плитки в целевую позицию
   */
  const animateToPosition = useCallback((targetPosition) => {
    Animated.spring(position, {
      toValue: targetPosition,
      useNativeDriver: false,
    }).start();
  }, [position]);

  /**
   * Эффект: при изменении масштаба перемещаем плитку в целевую ячейку
   */
  useEffect(() => {
    if (isInSpawner) return;
    
    const newTileSize = getTileSize(scale);
    const currentOffset = offsetRef.current;
    
    const cellCenter = getCellCenter(
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      currentOffset.x,
      currentOffset.y
    );
    
    const newPosition = {
      x: Math.round(cellCenter.x - newTileSize.width / 2),
      y: Math.round(cellCenter.y - newTileSize.height / 2),
    };
    
    animateSize(newTileSize);
    animateToPosition(newPosition);
    
  }, [scale, isInSpawner, getTileSize, animateSize, animateToPosition]);

  /**
   * Эффект: отслеживание позиции для определения входа/выхода из спавнера
   */
  useEffect(() => {
    const listenerId = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y };
      
      const inSpawner = isCenterOverSpawner(value, currentTileSize.current);
      
      if (inSpawner !== isInSpawner) {
        console.log(`[Tile ${tileId}] Статус спавнера:`, inSpawner ? 'вошёл' : 'вышел');
        setIsInSpawner(inSpawner);
        
        if (inSpawner) {
          animateSize(spawnerTileSize);
        } else {
          animateSize(getTileSize(scaleRef.current));
          // При выходе из спавнера запоминаем первую ячейку
          const pos = currentPositionRef.current;
          const size = currentTileSize.current;
          const center = {
            x: pos.x + size.width / 2,
            y: pos.y + size.height / 2
          };
          
          const cell = findNearestCell(
            center.x, 
            center.y, 
            scaleRef.current,
            offsetRef.current.x,
            offsetRef.current.y
          );
          
          targetCellRef.current = { col: cell.col, row: cell.row };
        }
      }
    });
    
    return () => position.removeListener(listenerId);
  }, [isInSpawner, spawnerTileSize, getTileSize, animateSize, tileId, position]);

  /**
   * PanResponder для обработки перетаскивания пальцем
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (_, gesture) => {
        console.log(`[Tile ${tileId}] Начало перетаскивания`);
        position.stopAnimation();
        
        const currentPos = currentPositionRef.current;
        const currentOffset = offsetRef.current;
        
        // Проверяем, нужно ли скорректировать позицию
        if (targetCellRef.current) {
          const targetCell = targetCellRef.current;
          const cellCenter = getCellCenter(
            targetCell.col,
            targetCell.row,
            scaleRef.current,
            currentOffset.x,
            currentOffset.y
          );
          
          const expectedPosition = {
            x: Math.round(cellCenter.x - currentTileSize.current.width / 2),
            y: Math.round(cellCenter.y - currentTileSize.current.height / 2),
          };
          
          // Если позиции не совпадают, корректируем
          if (Math.abs(expectedPosition.x - currentPos.x) > 1 || 
              Math.abs(expectedPosition.y - currentPos.y) > 1) {
            console.log(`[Tile ${tileId}] Корректировка позиции`);
            position.setValue(expectedPosition);
            currentPositionRef.current = expectedPosition;
          }
        }
        
        const adjustedPos = currentPositionRef.current;
        
        dragData.current = {
          basePosition: { ...adjustedPos },
          touchOffset: {
            x: gesture.x0 - adjustedPos.x,
            y: gesture.y0 - adjustedPos.y,
          },
        };
      },
      
      onPanResponderMove: (_, gesture) => {
        const { basePosition, touchOffset } = dragData.current;
        
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
        console.log(`[Tile ${tileId}] Завершение перетаскивания`);
        const currentPos = currentPositionRef.current;
        if (!currentPos) return;
        
        const currentOffset = offsetRef.current;
        
        const snappedPosition = snapToGrid(
          currentPos, 
          currentTileSize.current, 
          scaleRef.current,
          currentOffset.x,
          currentOffset.y
        );
        
        const center = {
          x: snappedPosition.x + currentTileSize.current.width / 2,
          y: snappedPosition.y + currentTileSize.current.height / 2
        };
        
        const targetCell = findNearestCell(
          center.x, 
          center.y, 
          scaleRef.current,
          currentOffset.x,
          currentOffset.y
        );
        
        console.log(`[Tile ${tileId}] Цель: [${targetCell.col},${targetCell.row}]`);
        
        if (tryOccupyCell(targetCell.col, targetCell.row)) {
          animateToPosition(snappedPosition);
        } else {
          if (!isInSpawner) {
            const prevCellCenter = getCellCenter(
              targetCellRef.current.col,
              targetCellRef.current.row,
              scaleRef.current,
              currentOffset.x,
              currentOffset.y
            );
            const prevPosition = {
              x: prevCellCenter.x - currentTileSize.current.width / 2,
              y: prevCellCenter.y - currentTileSize.current.height / 2,
            };
            animateToPosition(prevPosition);
          } else {
            animateToPosition(initialPosition);
          }
        }
        
        dragData.current = { basePosition: null, touchOffset: null };
      },
      
      onPanResponderTerminate: () => {
        console.log(`[Tile ${tileId}] Жест прерван`);
        dragData.current = { basePosition: null, touchOffset: null };
      },
    })
  ).current;

  const dragData = useRef({ basePosition: null, touchOffset: null });

  return {
    position,
    width: widthAnim,
    height: heightAnim,
    panHandlers: panResponder.panHandlers,
    isInSpawner,
  };
};

export default useDraggable;
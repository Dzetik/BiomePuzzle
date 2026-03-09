// src/hooks/useDraggable/useDraggable.fsm.ts

import { useRef, useMemo, useEffect, useReducer, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useTileMachine } from '../useTileMachine';
import { UseDraggableReturn } from './index';
import { getSpawnerSize } from '../../constants/spawner';
import { DEFAULT_TILE_SIZE } from '../../constants/tile';
import { BASE_GRID_OFFSET } from '../../constants/grid';

import { useZoom } from '../useZoom';
import { useSpawner } from '../useSpawner';
import { useGrid } from '../../context/GridContext';
import { useTiles } from '../../context/TilesContext';
import { GridService } from '../../services/GridService';

export const useDraggableFSM = (
  initialTileData: any = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null,
  onPlaced?: (cell: { col: number; row: number }) => void,
  onReturned?: () => void
): UseDraggableReturn => {
  
  // 🔥 useReducer вместо useState для forceUpdate (без аргументов!)
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  
  // -------------------------------------------------------------------------
  // 1. Получаем данные из контекстов
  // -------------------------------------------------------------------------
  const { scale } = useZoom();
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const { spawnerTile, addTile } = useTiles();
  
  // -------------------------------------------------------------------------
  // 2. Стабильные рефы
  // -------------------------------------------------------------------------
  const scaleRef = useRef(1);
  const spawnerPosRef = useRef<any>(null);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isReturningRef = useRef(false);
  
  scaleRef.current = scale || 1;
  if (spawnerPos) spawnerPosRef.current = spawnerPos;
  
  // -------------------------------------------------------------------------
  // 3. Настройка GridService
  // -------------------------------------------------------------------------
  useEffect(() => {
    const offsetX = offset?.x ?? 0;
    const offsetY = offset?.y ?? 0;
    const currentScale = scale ?? 1;
    
    GridService.configure({
      cellSize: DEFAULT_TILE_SIZE.width,
      gridOffset: { x: offsetX, y: offsetY },
      scale: currentScale,
      gridBounds: {
        startCol: -1,
        endCol: 6,
        startRow: -1,
        endRow: 12,
      },
    });
  }, [offset?.x, offset?.y, scale]);
  
  // -------------------------------------------------------------------------
  // 4. Initial position
  // -------------------------------------------------------------------------
  const stableInitialPosition = useMemo(() => {
    if (externalInitialPosition) return externalInitialPosition;
    
    const spawnerSize = getSpawnerSize();
    const currentSpawner = spawnerPosRef.current;
    
    if (!currentSpawner || typeof currentSpawner.x !== 'number') {
      return { x: 0, y: 0 };
    }
    
    return {
      x: currentSpawner.x + (currentSpawner.size - spawnerSize) / 2,
      y: currentSpawner.y + (currentSpawner.size - spawnerSize) / 2,
    };
  }, [externalInitialPosition]);
  
  useEffect(() => {
    positionRef.current = { ...stableInitialPosition };
  }, [stableInitialPosition]);
  
  // -------------------------------------------------------------------------
  // 5. Стабильный tileId
  // -------------------------------------------------------------------------
  const stableTileId = useRef<string | null>(null);
  if (!stableTileId.current) {
    stableTileId.current = tileId || `tile-${Date.now()}`;
  }
  
  // -------------------------------------------------------------------------
  // 6. Размер плитки
  // -------------------------------------------------------------------------
  const spawnerSize = getSpawnerSize();
  const tileSize = spawnerSize * (scaleRef.current || 1);
  
  // -------------------------------------------------------------------------
  // 7. Инициализация машины состояний
  // -------------------------------------------------------------------------
  const { state, send, animated, context } = useTileMachine({
    tileId: stableTileId.current!,
    tileType: initialTileData?.type || 'default',
    initialPosition: stableInitialPosition,
    spawnerPosition: {
      x: spawnerPosRef.current?.x || 0,
      y: spawnerPosRef.current?.y || 0,
      width: tileSize,
      height: tileSize,
    },
    onPlaced: (cell) => {
      console.log('[FSM] ✅ Tile placed at:', cell);
      
      if (stableTileId.current) {
        addTile(cell.col, cell.row, {
          id: stableTileId.current,
          texture: 'test1',
        });
        console.log('[Tiles] ✅ addTile вызван:', stableTileId.current);
      }
      
      onPlaced?.(cell);
    },
    onReturned: () => {
      console.log('[FSM] ✅ Tile returned to spawner');
      onReturned?.();
    },
  });
  
  // -------------------------------------------------------------------------
  // 8. Синхронизация positionRef
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!animated?.position) return;
    
    const listener = animated.position.addListener((value: { x: number; y: number }) => {
      positionRef.current = { x: value.x, y: value.y };
      forceUpdate();  // 🔥 Без аргумента!
    });
    
    return () => {
      animated.position.removeListener(listener);
    };
  }, [animated?.position]);
  
  // -------------------------------------------------------------------------
  // 9a. Отслеживание НОВОЙ плитки (БЕЗ state в зависимостях!)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isReturningRef.current) {
      console.log('[FSM] ⏳ Waiting for return animation...');
      return;
    }
    
    if (spawnerTile?.id && spawnerTile.id !== stableTileId.current) {
      stableTileId.current = spawnerTile.id;
      positionRef.current = { ...stableInitialPosition };
      send({ type: 'RESET_TO_SPAWNER' });
      forceUpdate();  // 🔥 Без аргумента!
      console.log('[FSM] 🔄 New spawner tile:', spawnerTile.id);
    }
  }, [spawnerTile?.id, stableInitialPosition, send]);
  
  // -------------------------------------------------------------------------
  // 9b. Логирование активности (только лог)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state === 'SPAWNER_IDLE' && spawnerTile?.id === stableTileId.current) {
      console.log('[FSM] ✅ Tile is active in spawner:', spawnerTile.id);
    }
  }, [state, spawnerTile?.id, stableTileId.current]);
  
  // -------------------------------------------------------------------------
  // 9c. Отслеживание возврата
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state === 'RETURNING_TO_SPAWN') {
      isReturningRef.current = true;
      console.log('[FSM] ⏳ Return animation started');
    } else if (state === 'SPAWNER_IDLE') {
      isReturningRef.current = false;
      console.log('[FSM] ✅ Return animation completed');
    }
  }, [state]);
  
  // -------------------------------------------------------------------------
  // 10. Gesture Handler
  // -------------------------------------------------------------------------
  const panGesture = Gesture.Pan()
    .enabled(state === 'SPAWNER_IDLE' || state === 'DRAGGING')
    .activateAfterLongPress(0)
    .onStart((e) => {
      console.log('[FSM] 🖐️ Gesture onStart, state:', state);
      dragStartRef.current = { ...positionRef.current };
      
      if (state === 'SPAWNER_IDLE') {
        send({ type: 'TAKEN_FROM_SPAWN' });
      }
    })
    .onUpdate((e) => {
      if (state !== 'DRAGGING') return;
      
      if (dragStartRef.current) {
        const newX = dragStartRef.current.x + e.translationX;
        const newY = dragStartRef.current.y + e.translationY;
        
        positionRef.current = { x: newX, y: newY };
        
        send({ type: 'DRAG_MOVE', payload: { x: newX, y: newY } });
        forceUpdate();  // 🔥 Без аргумента!
      }
    })
    .onEnd((e) => {
      console.log('[FSM] 🖐️ Gesture onEnd, state:', state);
      
      if (state === 'DRAGGING') {
        const endPosition = { x: positionRef.current.x, y: positionRef.current.y };
        
        send({ type: 'DRAG_END', payload: endPosition });
        
        const cell = GridService.findCellAtPosition(
          endPosition.x,
          endPosition.y,
          tileSize
        );
        
        if (cell) {
          const isFree = GridService.isCellFree(cell.col, cell.row);
          
          if (isFree) {
            console.log('[FSM] 🎯 Cell found:', { col: cell.col, row: cell.row, isFree });
            
            send({ 
              type: 'CELL_FOUND', 
              payload: { 
                col: cell.col, 
                row: cell.row, 
                isFree,
                scale: scaleRef.current,
                baseTileSize: DEFAULT_TILE_SIZE.width,
              } 
            });
          } else {
            console.log('[FSM] ❌ Cell occupied, returning to spawner');
            send({ type: 'NO_CELL' });
          }
        } else {
          console.log('[FSM] ❌ No cell found, returning to spawner');
          send({ type: 'NO_CELL' });
        }
      }
      
      dragStartRef.current = null;
    });
  
  // -------------------------------------------------------------------------
  // 11. Возвращаемое значение
  // -------------------------------------------------------------------------
  const getAnimatedValue = (val: any, fallback: number): number => {
    if (typeof val === 'number') return val;
    if (val?.__getValue) {
      try { return val.__getValue(); } catch { return fallback; }
    }
    if (val?._value !== undefined) return val._value;
    return fallback;
  };
  
  return {
    position: { ...positionRef.current },
    width: getAnimatedValue(animated?.size?.width, tileSize),
    height: getAnimatedValue(animated?.size?.height, tileSize),
    panHandlers: panGesture,
    isInSpawner: state === 'SPAWNER_IDLE' || state === 'RETURNING_TO_SPAWN',
    state,
    send,
    debug: context ? {
      isInSpawner: context.isInSpawner,
      currentCell: context.currentCell,
      position: context.position,
      fsmState: state,
    } : null,
  };
};

export default useDraggableFSM;
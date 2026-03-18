// ============================================================================
// ХУК ИНТЕГРАЦИИ FSM С REACT (ИСПРАВЛЕННЫЙ)
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { TileStateMachine } from '../state/tileMachine';
import {
  TileState,
  TileEvent,
  TileContext,
  MachineAction,
  UseTileMachineOptions,
} from '../state';
import { FEATURE_FLAGS, DEFAULT_TILE_CONFIG } from '../state';
import { GridService } from '../services/GridService';
import { DEFAULT_TILE_SIZE } from '../constants/tile';

export interface UseTileMachineReturn {
  state: TileState;
  send: (event: TileEvent) => void;
  context: TileContext | null;
  animated: {
    position: Animated.ValueXY;
    size: { width: Animated.Value; height: Animated.Value };
  };
  debug?: {
    history: Array<{ fromState: TileState; event: string; toState: TileState; timestamp: number }>;
    lastAction: MachineAction | null;
  };
}

export const useTileMachine = ({
  tileId,
  tileType,
  initialPosition,
  spawnerPosition,
  tile,
  onStateChange,
  onPlaced,
  onReturned,
  onRotate, // 👈 НОВЫЙ ПРОП
  isInSpawner,
}: UseTileMachineOptions): UseTileMachineReturn => {
  
  const animatedValuesRef = useRef<{
    position: Animated.ValueXY;
    size: { width: Animated.Value; height: Animated.Value };
  } | null>(null);
  
  if (!animatedValuesRef.current) {
    animatedValuesRef.current = {
      position: new Animated.ValueXY(initialPosition),
      size: {
        width: new Animated.Value(spawnerPosition.width),
        height: new Animated.Value(spawnerPosition.height),
      },
    };
  }
  
  const sendRef = useRef<(event: TileEvent) => void>(() => {});
  const machineRef = useRef<TileStateMachine | null>(null);
  
  if (!machineRef.current) {
    const initialContext: TileContext = {
      tileId: tile?.id || tileId,
      tileType,
      tile: tile ?? null,
      position: { ...initialPosition },
      size: { width: spawnerPosition.width, height: spawnerPosition.height },
      spawnerPosition: { ...spawnerPosition },
      isInSpawner: isInSpawner ?? true,
      initialState: isInSpawner === false ? 'INVENTORY_IDLE' : undefined,
      isAnimating: false,
      animatedPosition: animatedValuesRef.current.position,
      animatedSize: animatedValuesRef.current.size,
      meta: {},
      createdAt: Date.now(),
    };
    
    machineRef.current = new TileStateMachine(initialContext);
  }

  useEffect(() => {
    if (machineRef.current && tileId) {
      const ctx = machineRef.current.getContext();
      if (ctx.tileId !== tileId) {
        ctx.tileId = tileId;
      }
      if (ctx.tile !== tile) {
        ctx.tile = tile;
      }
    }
  }, [tileId, tile]); 
  
  const [currentState, setCurrentState] = useState<TileState>(
    machineRef.current.getState()
  );
  
  const [debugInfo, setDebugInfo] = useState<{ history: any[]; lastAction: MachineAction | null }>({ 
    history: [], 
    lastAction: null 
  });
  
  const animationsPendingRef = useRef(0);
  
  // ============================================================================
  // 🔑 executeAction: ОБРАБОТКА ДЕЙСТВИЙ (включая ROTATE_TILE)
  // ============================================================================
  const executeAction = useCallback((action: MachineAction) => {
    const anim = animatedValuesRef.current;
    if (!anim) return;
    
    switch (action.type) {
      case 'UPDATE_POSITION_IMMEDIATE': {
        anim.position.setValue(action.payload);
        break;
      }
      
      case 'ANIMATE_TO_POSITION': {
        const { x, y, duration, onComplete, col, row, baseTileSize } = action.payload;
        let targetX = x;
        let targetY = y;
        
        if (col !== undefined && row !== undefined) {
          const snapPos = GridService.getSnapPosition(
            col, row, baseTileSize ?? DEFAULT_TILE_SIZE.width
          );
          if (snapPos) { targetX = snapPos.x; targetY = snapPos.y; }
        }
        
        anim.position.stopAnimation();
        animationsPendingRef.current++;
        let animationCompleted = false;
        
        const completeAnimation = () => {
          if (animationCompleted) return;
          animationCompleted = true;
          animationsPendingRef.current--;
          if (animationsPendingRef.current === 0) {
            sendRef.current({ type: 'ANIMATION_COMPLETE' });
          }
          onComplete?.();
        };
        
        Animated.timing(anim.position, {
          toValue: { x: targetX, y: targetY },
          duration: duration || DEFAULT_TILE_CONFIG.animationDuration,
          useNativeDriver: false,
        }).start(completeAnimation);
        
        setTimeout(() => { if (!animationCompleted) completeAnimation(); }, 2000);
        break;
      }
      
      case 'ANIMATE_SIZE': {
        const { width, height, duration, onComplete } = action.payload;
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        animationsPendingRef.current++;
        let animationCompleted = false;
        
        const completeAnimation = () => {
          if (animationCompleted) return;
          animationCompleted = true;
          animationsPendingRef.current--;
          if (animationsPendingRef.current === 0) {
            sendRef.current({ type: 'ANIMATION_COMPLETE' });
          }
          onComplete?.();
        };
        
        Animated.parallel([
          Animated.timing(anim.size.width, {
            toValue: width, duration: duration || DEFAULT_TILE_CONFIG.animationDuration, useNativeDriver: false,
          }),
          Animated.timing(anim.size.height, {
            toValue: height, duration: duration || DEFAULT_TILE_CONFIG.animationDuration, useNativeDriver: false,
          }),
        ]).start(completeAnimation);
        
        setTimeout(() => { if (!animationCompleted) completeAnimation(); }, 2000);
        break;
      }

      // ============================================================================
      // 🔑 НОВОЕ: Обработка ROTATE_TILE через колбэк onRotate
      // ============================================================================
      case 'ROTATE_TILE': {
        if (onRotate) {
          const ctx = machineRef.current?.getContext();
          if (ctx?.tileId) {
            if (__DEV__) {
              console.log(`[TileMachine] 🔄 ROTATE_TILE → onRotate(${ctx.tileId})`);
            }
            onRotate(ctx.tileId); // 👈 Делегируем поворот внешнему колбэку
          }
        } else {
          if (__DEV__) {
            console.warn('[TileMachine] ⚠️ onRotate callback not provided for ROTATE_TILE');
          }
        }
        break;
      }
      
      case 'STOP_ANIMATIONS': {
        anim.position.stopAnimation();
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        animationsPendingRef.current = 0;
        break;
      }
      
      case 'CALLBACK': {
        action.payload();
        break;
      }
    }
    
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo(prev => ({ ...prev, lastAction: action }));
    }
  }, [onRotate]); // 👈 onRotate в зависимостях
  
  // ============================================================================
  // 🔑 send: ОТПРАВКА СОБЫТИЙ (с onRotate в зависимостях)
  // ============================================================================
  const send = useCallback((event: TileEvent) => {
    if (!machineRef.current) return;
    
    const machineStateBefore = machineRef.current.getState();
    const result = machineRef.current.send(event);
    if (!result) return;
    
    const stateChanged = result.nextState !== machineStateBefore;
    
    if (stateChanged) {
      setCurrentState(result.nextState);
      
      if (result.nextState === 'PLACED' && onPlaced) {
        const ctx = machineRef.current?.getContext();
        if (ctx?.targetCell) {
          GridService.occupyCell(ctx.targetCell.col, ctx.targetCell.row, ctx.tileId);
          onPlaced(ctx.targetCell);
        }
      }
      
      if (result.nextState === 'SPAWNER_IDLE' && onReturned) {
        onReturned();
      }
      
      if (onStateChange) {
        const ctx = machineRef.current?.getContext();
        if (ctx) onStateChange(result.nextState, ctx);
      }
    }
    
    result.actions.forEach(action => executeAction(action));
    
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo({
        history: machineRef.current?.getHistory() || [],
        lastAction: result.actions[0] || null,
      });
    }
  }, [executeAction, onPlaced, onReturned, onStateChange, onRotate]); // 👈 Добавили onRotate

  useEffect(() => { sendRef.current = send; }, [send]);

  useEffect(() => {
    if (onStateChange && machineRef.current) {
      const ctx = machineRef.current.getContext();
      if (ctx) onStateChange(currentState, ctx);
    }
  }, [currentState, onStateChange]);
  
  useEffect(() => {
    const anim = animatedValuesRef.current?.position;
    if (!anim) return;
    const listenerId = anim.addListener((value) => {
      const ctx = machineRef.current?.getContext();
      if (ctx) ctx.position = { x: value.x || 0, y: value.y || 0 };
    });
    return () => { anim.removeListener(listenerId); };
  }, []);
  
  useEffect(() => {
    return () => {
      const anim = animatedValuesRef.current;
      if (anim) {
        anim.position.stopAnimation();
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
      }
      machineRef.current = null;
    };
  }, []);
  
  return {
    state: currentState,
    send,
    context: machineRef.current?.getContext() || null,
    animated: {
      position: animatedValuesRef.current!.position,
      size: animatedValuesRef.current!.size,
    },
    ...(FEATURE_FLAGS.SHOW_TILE_DEBUG && { debug: debugInfo }),
  };
};

export default useTileMachine;
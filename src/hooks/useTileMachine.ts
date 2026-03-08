// src/hooks/useTileMachine.ts

// ============================================================================
// ИМПОРТЫ
// ============================================================================
import { 
  useState, 
  useEffect, 
  useCallback, 
  useRef, 
} from 'react';
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

// ============================================================================
// ТИПЫ ВОЗВРАЩАЕМОГО ЗНАЧЕНИЯ ХУКА
// ============================================================================
export interface UseTileMachineReturn {
  state: TileState;
  send: (event: TileEvent) => void;
  context: TileContext | null;
  animated: {
    position: Animated.ValueXY;
    size: {
      width: Animated.Value;
      height: Animated.Value;
    };
  };
  debug?: {
    history: Array<{
      fromState: TileState;
      event: string;
      toState: TileState;
      timestamp: number;
    }>;
    lastAction: MachineAction | null;
  };
}

// ============================================================================
// ОСНОВНОЙ ХУК
// ============================================================================
export const useTileMachine = ({
  tileId,
  tileType,
  initialPosition,
  spawnerPosition,
  onStateChange,
  onPlaced,
  onReturned,
}: UseTileMachineOptions): UseTileMachineReturn => {
  
  // -------------------------------------------------------------------------
  // 1. ИНИЦИАЛИЗАЦИЯ ANIMATED VALUES (только один раз)
  // -------------------------------------------------------------------------
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
  
  // -------------------------------------------------------------------------
  // 2. ИНИЦИАЛИЗАЦИЯ МАШИНЫ СОСТОЯНИЙ (только один раз)
  // -------------------------------------------------------------------------
  const machineRef = useRef<TileStateMachine | null>(null);
  
  if (!machineRef.current) {
    const initialContext: TileContext = {
      tileId,
      tileType,
      position: { ...initialPosition },
      size: { width: spawnerPosition.width, height: spawnerPosition.height },
      spawnerPosition: { ...spawnerPosition },
      isInSpawner: true,
      animatedPosition: animatedValuesRef.current.position,
      animatedSize: animatedValuesRef.current.size,
      isAnimating: false,
      meta: {},
      createdAt: Date.now(),
    };
    
    machineRef.current = new TileStateMachine(initialContext);
  }
  
  // -------------------------------------------------------------------------
  // 3. REACT STATE ДЛЯ ПЕРЕ-РЕНДЕРОВ (только при смене состояния)
  // -------------------------------------------------------------------------
  const [currentState, setCurrentState] = useState<TileState>(
    machineRef.current.getState()
  );
  
  const [debugInfo, setDebugInfo] = useState<{
    history: any[];
    lastAction: MachineAction | null;
  }>({ history: [], lastAction: null });
  
  // 🔥 Счётчик незавершённых анимаций
  const animationsPendingRef = useRef(0);
  
  // -------------------------------------------------------------------------
  // 4. ФУНКЦИЯ ВЫПОЛНЕНИЯ ДЕЙСТВИЙ (анимации и сайд-эффекты)
  // -------------------------------------------------------------------------
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
        
        // 🔥 Если переданы col/row, вычисляем позицию через GridService
        let targetX = x;
        let targetY = y;
        
        if (col !== undefined && row !== undefined) {
          // 🔥 Передаём базовый размер (или дефолт)
          const snapPos = GridService.getSnapPosition(
            col, 
            row, 
            baseTileSize ?? DEFAULT_TILE_SIZE.width
          );
          if (snapPos) {
            targetX = snapPos.x;
            targetY = snapPos.y;
          }
        }
        
        anim.position.stopAnimation();
        
        animationsPendingRef.current++;
        
        Animated.timing(anim.position, {
          toValue: { x: targetX, y: targetY },
          duration: duration || DEFAULT_TILE_CONFIG.animationDuration,
          useNativeDriver: false,
        }).start(() => {
          animationsPendingRef.current--;
          
          // 🔥 Отправляем ANIMATION_COMPLETE только когда все анимации завершены
          if (animationsPendingRef.current === 0) {
            machineRef.current?.send({ type: 'ANIMATION_COMPLETE' });
          }
          
          onComplete?.();
        });
        break;
      }
      
      case 'ANIMATE_SIZE': {
        const { width, height, duration, onComplete } = action.payload;
        
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        
        animationsPendingRef.current++;
        
        Animated.parallel([
          Animated.timing(anim.size.width, {
            toValue: width,
            duration: duration || DEFAULT_TILE_CONFIG.animationDuration,
            useNativeDriver: false,
          }),
          Animated.timing(anim.size.height, {
            toValue: height,
            duration: duration || DEFAULT_TILE_CONFIG.animationDuration,
            useNativeDriver: false,
          }),
        ]).start(() => {
          animationsPendingRef.current--;
          
          // 🔥 Отправляем ANIMATION_COMPLETE только когда все анимации завершены
          if (animationsPendingRef.current === 0) {
            machineRef.current?.send({ type: 'ANIMATION_COMPLETE' });
          }
          
          onComplete?.();
        });
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
  }, []);
  
  // -------------------------------------------------------------------------
  // 5. ФУНКЦИЯ ОТПРАВКИ СОБЫТИЙ
  // -------------------------------------------------------------------------
  const send = useCallback((event: TileEvent) => {
    if (!machineRef.current) return;
    
    const prevState = machineRef.current.getState();
    const result = machineRef.current.send(event);
    
    if (!result) return;
    
    if (result.nextState !== prevState) {
      setCurrentState(result.nextState);
      
      // 🔥 Обработка размещения плитки (занятие ячейки)
      if (result.nextState === 'PLACED' && onPlaced) {
        const ctx = machineRef.current?.getContext();
        if (ctx?.targetCell) {
          // Занимаем ячейку через GridService
          GridService.occupyCell(ctx.targetCell.col, ctx.targetCell.row, ctx.tileId);
          onPlaced(ctx.targetCell);
        }
      }
      
      if (result.nextState === 'SPAWNER_IDLE' && onReturned) {
        onReturned();
      }
      
      if (onStateChange) {
        const ctx = machineRef.current?.getContext();
        if (ctx) {
          onStateChange(result.nextState, ctx);
        }
      }
    }
    
    // Выполняем действия (анимации)
    result.actions.forEach(executeAction);
    
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo({
        history: machineRef.current?.getHistory() || [],
        lastAction: result.actions[0] || null,
      });
    }
  }, [executeAction, onPlaced, onReturned, onStateChange]);
  
  // -------------------------------------------------------------------------
  // 6. ПОДПИСКА НА ИЗМЕНЕНИЯ ПОЗИЦИИ
  // -------------------------------------------------------------------------
  useEffect(() => {
    const anim = animatedValuesRef.current?.position;
    if (!anim) return;
    
    const listenerId = anim.addListener((value) => {
      const ctx = machineRef.current?.getContext();
      if (ctx) {
        ctx.position = { x: value.x || 0, y: value.y || 0 };
      }
    });
    
    return () => {
      anim.removeListener(listenerId);
    };
  }, []);
  
  // -------------------------------------------------------------------------
  // 7. ОЧИСТКА ПРИ РАЗМОНТИРОВАНИИ
  // -------------------------------------------------------------------------
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
  
  // -------------------------------------------------------------------------
  // 8. ФОРМИРОВАНИЕ ВОЗВРАЩАЕМОГО ЗНАЧЕНИЯ
  // -------------------------------------------------------------------------
  return {
    state: currentState,
    send,
    context: machineRef.current?.getContext() || null,
    animated: {
      position: animatedValuesRef.current!.position,
      size: animatedValuesRef.current!.size,
    },
    ...(FEATURE_FLAGS.SHOW_TILE_DEBUG && {
      debug: debugInfo,
    }),
  };
};

export default useTileMachine;
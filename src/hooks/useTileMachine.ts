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
// 🔥 ГЛОБАЛЬНЫЙ REFS ДЛЯ ОТСЛЕЖИВАНИЯ ЗАВЕРШЁННЫХ АНИМАЦИЙ
// ============================================================================
// Предотвращает двойной вызов completeAnimation (из колбэка + timeout)
const completedAnimationsRef = new Map<string, boolean>();

// Очистка старых записей каждые 5 секунд
setInterval(() => {
  if (completedAnimationsRef.size > 50) {
    const keys = Array.from(completedAnimationsRef.keys());
    keys.slice(0, 25).forEach(key => completedAnimationsRef.delete(key));
  }
}, 5000);

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
  
  // Ref для хранения актуальной send функции
  const sendRef = useRef<(event: TileEvent) => void>(() => {});

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
        
        const actionId = `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        let targetX = x;
        let targetY = y;
        
        if (col !== undefined && row !== undefined) {
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
        
        console.log('[useTileMachine] 🎬 ANIMATE_TO_POSITION start:', { 
          actionId,
          animationsPending: animationsPendingRef.current,
          target: { x: targetX, y: targetY }
        });
        
        let animationCompleted = false;
        
        const completeAnimation = () => {
          if (animationCompleted) return;
          animationCompleted = true;
          
          animationsPendingRef.current--;
          
          console.log('[useTileMachine] 🎬 ANIMATE_TO_POSITION complete:', { 
            actionId,
            animationsPending: animationsPendingRef.current 
          });
          
          if (animationsPendingRef.current === 0) {
            console.log('[useTileMachine] 📬 Sending ANIMATION_COMPLETE via sendRef');
            // 🔥 КЛЮЧЕВОЕ: Используем sendRef.current вместо machineRef.current.send()
            sendRef.current({ type: 'ANIMATION_COMPLETE' });
          }
          
          onComplete?.();
        };
        
        Animated.timing(anim.position, {
          toValue: { x: targetX, y: targetY },
          duration: duration || DEFAULT_TILE_CONFIG.animationDuration,
          useNativeDriver: false,
        }).start(completeAnimation);
        
        // 🔥 Фолбэк таймаут
        setTimeout(() => {
          if (!animationCompleted) {
            console.log('[useTileMachine] ⚠️ ANIMATE_TO_POSITION timeout fallback');
            completeAnimation();
          }
        }, 2000);
        
        break;
      }
      
      case 'ANIMATE_SIZE': {
        const { width, height, duration, onComplete } = action.payload;
        
        const actionId = `size-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        
        animationsPendingRef.current++;
        
        console.log('[useTileMachine] 🎬 ANIMATE_SIZE start:', { 
          actionId,
          animationsPending: animationsPendingRef.current,
          target: { width, height }
        });
        
        let animationCompleted = false;
        
        const completeAnimation = () => {
          if (animationCompleted) return;
          animationCompleted = true;
          
          animationsPendingRef.current--;
          
          console.log('[useTileMachine] 🎬 ANIMATE_SIZE complete:', { 
            actionId,
            animationsPending: animationsPendingRef.current 
          });
          
          if (animationsPendingRef.current === 0) {
            console.log('[useTileMachine] 📬 Sending ANIMATION_COMPLETE via sendRef');
            // 🔥 КЛЮЧЕВОЕ: Используем sendRef.current вместо machineRef.current.send()
            sendRef.current({ type: 'ANIMATION_COMPLETE' });
          }
          
          onComplete?.();
        };
        
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
        ]).start(completeAnimation);
        
        // 🔥 Фолбэк таймаут
        setTimeout(() => {
          if (!animationCompleted) {
            console.log('[useTileMachine] ⚠️ ANIMATE_SIZE timeout fallback');
            completeAnimation();
          }
        }, 2000);
        
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
      
      // 🔥 НОВОЕ: Обработка отложенного завершения (если используете)
      case 'DELAYED_ANIMATION_COMPLETE': {
        const delay = action.payload?.delay || 350;
        console.log('[useTileMachine] ⏱️ Scheduling DELAYED_ANIMATION_COMPLETE in', delay, 'ms');
        setTimeout(() => {
          console.log('[useTileMachine] 📬 Sending DELAYED_ANIMATION_COMPLETE via sendRef');
          sendRef.current({ type: 'DELAYED_ANIMATION_COMPLETE' });
        }, delay);
        break;
      }
    }
    
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo(prev => ({ ...prev, lastAction: action }));
    }
  }, []);
  
  // ============================================================================
  // 5. ФУНКЦИЯ ОТПРАВКИ СОБЫТИЙ (С ОТЛАДКОЙ)
  // ============================================================================
  const send = useCallback((event: TileEvent) => {
    if (!machineRef.current) return;
    
    // 🔥 Отладка входа
    console.log('[useTileMachine] 📥 send() called:', {
      eventType: event.type,
      tileId: machineRef.current.getContext()?.tileId,
    });
    
    const machineStateBefore = machineRef.current.getState();
    const result = machineRef.current.send(event);
    const machineStateAfter = result?.nextState;
    
    console.log('[useTileMachine] 🔍 machineState BEFORE:', machineStateBefore);
    console.log('[useTileMachine] 🔍 machineState AFTER:', machineStateAfter);
    
    if (!result) {
      console.log('[useTileMachine] ⚠️ No transition for event:', event.type);
      return;
    }
    
    const stateChanged = result.nextState !== machineStateBefore;
    
    console.log('[useTileMachine] 🔄 stateChanged check:', {
      prevState: machineStateBefore,
      nextState: result.nextState,
      willCallSetState: stateChanged,
    });
    
    if (stateChanged) {
      console.log('[useTileMachine] ✅ State CHANGED — calling setCurrentState');
      setCurrentState(result.nextState);
      
      // 🔥 Обработка размещения
      if (result.nextState === 'PLACED' && onPlaced) {
        const ctx = machineRef.current?.getContext();
        if (ctx?.targetCell) {
          GridService.occupyCell(ctx.targetCell.col, ctx.targetCell.row, ctx.tileId);
          onPlaced(ctx.targetCell);
        }
      }
      
      // 🔥 Обработка возврата в спавнер
      if (result.nextState === 'SPAWNER_IDLE' && onReturned) {
        onReturned();
      }
      
      // 🔥 Общий колбэк
      if (onStateChange) {
        const ctx = machineRef.current?.getContext();
        if (ctx) {
          onStateChange(result.nextState, ctx);
        }
      }
    } else {
      console.log('[useTileMachine] ⚠️ State UNCHANGED — skipping setCurrentState');
    }
    
    // 🔥 Выполняем действия
    result.actions.forEach(action => executeAction(action));
    
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo({
        history: machineRef.current?.getHistory() || [],
        lastAction: result.actions[0] || null,
      });
    }
    
    console.log('[useTileMachine] 📤 send() completed');
    
  }, [executeAction, onPlaced, onReturned, onStateChange]);  // ← executeAction в зависимостях!

  // 🔥 Обновляем sendRef после создания send
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // 🔥 КРИТИЧНО: Синхронизация состояния с родителем
  useEffect(() => {
    console.log('[useTileMachine] 📢 currentState changed:', currentState);
    
    // 🔥 Форсируем уведомление родителя через onStateChange
    if (onStateChange && machineRef.current) {
      const ctx = machineRef.current.getContext();  
      if (ctx) {
        onStateChange(currentState, ctx);
      }
    }
  }, [currentState, onStateChange]);
  
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
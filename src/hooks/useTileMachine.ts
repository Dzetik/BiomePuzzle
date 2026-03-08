// src/hooks/useTileMachine.ts

// ============================================================================
// ИМПОРТЫ
// ============================================================================
import { 
  useState, 
  useEffect, 
  useCallback, 
  useRef, 
  useMemo 
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

// ============================================================================
// ТИПЫ ВОЗВРАЩАЕМОГО ЗНАЧЕНИЯ ХУКА
// ============================================================================
export interface UseTileMachineReturn {
  /** Текущее логическое состояние плитки */
  state: TileState;
  
  /** Функция отправки событий в машину */
  send: (event: TileEvent) => void;
  
  /** Контекст плитки (для чтения, не для мутации) */
  context: TileContext | null;
  
  /** Animated values для привязки к стилям */
  animated: {
    position: Animated.ValueXY;
    size: {
      width: Animated.Value;
      height: Animated.Value;
    };
  };
  
  /** Отладочная информация (только в dev режиме) */
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
  
  // -------------------------------------------------------------------------
  // 4. ФУНКЦИЯ ВЫПОЛНЕНИЯ ДЕЙСТВИЙ (анимации и сайд-эффекты)
  // -------------------------------------------------------------------------
  const executeAction = useCallback((action: MachineAction) => {
    const anim = animatedValuesRef.current;
    if (!anim) return;
    
    switch (action.type) {
      case 'UPDATE_POSITION_IMMEDIATE': {
        // Мгновенное обновление позиции (без анимации, для драга)
        anim.position.setValue(action.payload);
        break;
      }
      
      case 'ANIMATE_TO_POSITION': {
        const { x, y, duration, onComplete } = action.payload;
        
        anim.position.stopAnimation();
        
        // ✅ ИСПОЛЬЗУЕМ timing ВМЕСТО spring ДЛЯ КОНТРОЛЯ ДЛИТЕЛЬНОСТИ
        Animated.timing(anim.position, {
            toValue: { x, y },
            duration: duration || DEFAULT_TILE_CONFIG.animationDuration, // ✅ duration работает здесь
            useNativeDriver: false,
        }).start(() => {
            machineRef.current?.send({ type: 'ANIMATION_COMPLETE' });
            onComplete?.();
        });
        break;
      }

        case 'ANIMATE_SIZE': {
        const { width, height, duration, onComplete } = action.payload;
        
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        
        // ✅ timing для размера тоже
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
            onComplete?.();
        });
        break;
      }
      
      case 'STOP_ANIMATIONS': {
        // Экстренная остановка всех анимаций
        anim.position.stopAnimation();
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        break;
      }
      
      case 'CALLBACK': {
        // Произвольный колбэк (освобождение ячейки и т.п.)
        action.payload();
        break;
      }
    }
    
    // Сохраняем последнее действие для отладки
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo(prev => ({ ...prev, lastAction: action }));
    }
  }, []);
  
  // -------------------------------------------------------------------------
  // 5. ФУНКЦИЯ ОТПРАВКИ СОБЫТИЙ (главный публичный API)
  // -------------------------------------------------------------------------
  const send = useCallback((event: TileEvent) => {
    if (!machineRef.current) return;
    
    const prevState = machineRef.current.getState();
    const result = machineRef.current.send(event);
    
    if (!result) return; // Событие проигнорировано
    
    // Обновляем React state только если состояние изменилось
    if (result.nextState !== prevState) {
      setCurrentState(result.nextState);
      
      // Вызываем внешние колбэки
      if (result.nextState === 'PLACED' && onPlaced) {
        const ctx = machineRef.current?.getContext();
        if (ctx?.targetCell) {
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
    
    // Обновляем отладочную информацию
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo({
        history: machineRef.current?.getHistory() || [],
        lastAction: result.actions[0] || null,
      });
    }
  }, [executeAction, onPlaced, onReturned, onStateChange]);
  
  // -------------------------------------------------------------------------
  // 6. ПОДПИСКА НА ИЗМЕНЕНИЯ ПОЗИЦИИ (для drag move без ре-рендеров)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const anim = animatedValuesRef.current?.position;
    if (!anim) return;
    
    // Подписываемся на изменения позиции для обновления контекста
    const listenerId = anim.addListener((value) => {
      const ctx = machineRef.current?.getContext();
      if (ctx) {
        // Обновляем позицию в контексте (не вызывает ре-рендер)
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
      // Останавливаем все анимации при размонтировании
      const anim = animatedValuesRef.current;
      if (anim) {
        anim.position.stopAnimation();
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
      }
      // Сбрасываем рефы
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
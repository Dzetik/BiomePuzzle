// ============================================================================
// ХУК ИНТЕГРАЦИИ FSM С REACT
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

/**
 * Возвращаемое значение хука `useTileMachine`.
 *
 * Предоставляет текущее состояние FSM, функцию отправки событий,
 * контекст машины, Animated-значения для позиции/размера и
 * опциональные отладочные данные.
 */
export interface UseTileMachineReturn {
  /** Текущее логическое состояние плитки. */
  state: TileState;
  /** Отправляет событие в машину состояний. */
  send: (event: TileEvent) => void;
  /** Полный контекст машины (позиция, ячейка, флаги) или null если машина не инициализирована. */
  context: TileContext | null;
  /** Animated-значения для CSS-подобного управления позицией и размером без ре-рендеров. */
  animated: {
    position: Animated.ValueXY;
    size: { width: Animated.Value; height: Animated.Value };
  };
  /** Отладочная информация — доступна только при FEATURE_FLAGS.SHOW_TILE_DEBUG. */
  debug?: {
    history: Array<{ fromState: TileState; event: string; toState: TileState; timestamp: number }>;
    lastAction: MachineAction | null;
  };
}

/**
 * Хук интеграции `TileStateMachine` с React.
 *
 * Создаёт и управляет экземпляром FSM плитки, связывает переходы состояний
 * с React-рендерами и выполняет `MachineAction` через Animated API.
 *
 * Ключевые архитектурные решения:
 * - `machineRef` и `animatedValuesRef` инициализируются один раз (паттерн lazy ref),
 *   что исключает пересоздание машины при ре-рендерах.
 * - `sendRef` — стабильная ссылка на актуальную функцию `send` для безопасного
 *   вызова из анимационных колбэков (обходит stale closure).
 * - React-состояние (`currentState`) обновляется только при фактической смене
 *   состояния FSM, что минимизирует количество ре-рендеров.
 * - Анимации снабжены таймаутом 2000 мс как страховка на случай потери
 *   `onComplete` колбэка от Animated API.
 *
 * @param options - параметры инициализации (см. UseTileMachineOptions)
 * @returns UseTileMachineReturn
 */
export const useTileMachine = ({
  tileId,
  tileType,
  initialPosition,
  spawnerPosition,
  tile,
  onStateChange,
  onPlaced,
  onReturned,
  onRotate,
  isInSpawner,
}: UseTileMachineOptions): UseTileMachineReturn => {

  // Lazy ref: Animated-значения создаются один раз и никогда не пересоздаются
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

  /** Стабильная ссылка на send — используется внутри анимационных колбэков. */
  const sendRef = useRef<(event: TileEvent) => void>(() => {});
  /** Экземпляр FSM — создаётся один раз, живёт всё время жизни компонента. */
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
      // Плитки из инвентаря стартуют в INVENTORY_IDLE, а не SPAWNER_IDLE
      initialState: isInSpawner === false ? 'INVENTORY_IDLE' : undefined,
      isAnimating: false,
      animatedPosition: animatedValuesRef.current.position,
      animatedSize: animatedValuesRef.current.size,
      meta: {},
      createdAt: Date.now(),
    };

    machineRef.current = new TileStateMachine(initialContext);
  }

  // Синхронизируем tileId и tile в контексте при их изменении извне
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

  // React-состояние: обновляется только при реальной смене состояния FSM
  const [currentState, setCurrentState] = useState<TileState>(
    machineRef.current.getState()
  );

  const [debugInfo, setDebugInfo] = useState<{ history: any[]; lastAction: MachineAction | null }>({
    history: [],
    lastAction: null,
  });

  /** Счётчик незавершённых анимаций — ANIMATION_COMPLETE отправляется когда он достигает 0. */
  const animationsPendingRef = useRef(0);

  // ============================================================================
  // executeAction: ИСПОЛНИТЕЛЬ ДЕЙСТВИЙ FSM
  // ============================================================================

  /**
   * Выполняет одно действие из `TransitionResult.actions`.
   *
   * Каждый тип действия соответствует конкретной операции Animated API
   * или сайд-эффекту. Анимации защищены таймаутом 2000 мс на случай,
   * если Animated не вызовет onComplete (известный edge case на Android).
   *
   * @param action - действие из MachineAction
   */
  const executeAction = useCallback((action: MachineAction) => {
    const anim = animatedValuesRef.current;
    if (!anim) return;

    switch (action.type) {
      case 'UPDATE_POSITION_IMMEDIATE': {
        // Без анимации — для максимальной отзывчивости во время драга
        anim.position.setValue(action.payload);
        break;
      }

      case 'ANIMATE_TO_POSITION': {
        const { x, y, duration, onComplete, col, row, baseTileSize } = action.payload;
        let targetX = x;
        let targetY = y;

        // Если переданы col/row — вычисляем экранные координаты через GridService
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
          // Отправляем ANIMATION_COMPLETE только когда все параллельные анимации завершены
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

        // Страховой таймаут: если Animated не вызвал колбэк — завершаем принудительно
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

        // Ширина и высота анимируются параллельно
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

      case 'ROTATE_TILE': {
        // Поворот делегируется внешнему колбэку — FSM не знает о React-состоянии плитки
        if (onRotate) {
          const ctx = machineRef.current?.getContext();
          if (ctx?.tileId) {
            if (__DEV__) {
              console.log(`[TileMachine] ROTATE_TILE -> onRotate(${ctx.tileId})`);
            }
            onRotate(ctx.tileId);
          }
        } else {
          if (__DEV__) {
            console.warn('[TileMachine] onRotate callback not provided for ROTATE_TILE');
          }
        }
        break;
      }

      case 'STOP_ANIMATIONS': {
        // Принудительная остановка всех анимаций и сброс счётчика
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
  }, [onRotate]);

  // ============================================================================
  // send: ПУБЛИЧНАЯ ФУНКЦИЯ ОТПРАВКИ СОБЫТИЙ
  // ============================================================================

  /**
   * Отправляет событие в FSM, обновляет React-состояние при необходимости
   * и выполняет все действия из `TransitionResult`.
   *
   * React-рендер вызывается только если состояние FSM изменилось.
   * После перехода в PLACED регистрирует ячейку в GridService.
   *
   * @param event - событие для FSM
   */
  const send = useCallback((event: TileEvent) => {
    if (!machineRef.current) return;

    const machineStateBefore = machineRef.current.getState();
    const result = machineRef.current.send(event);
    if (!result) return;

    const stateChanged = result.nextState !== machineStateBefore;

    if (stateChanged) {
      // Триггерим ре-рендер только при реальной смене состояния
      setCurrentState(result.nextState);

      if (result.nextState === 'PLACED' && onPlaced) {
        const ctx = machineRef.current?.getContext();
        if (ctx?.targetCell) {
          // Синхронно регистрируем ячейку в GridService до вызова onPlaced
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

    // Выполняем все действия перехода (анимации, колбэки)
    result.actions.forEach(action => executeAction(action));

    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo({
        history: machineRef.current?.getHistory() || [],
        lastAction: result.actions[0] || null,
      });
    }
  }, [executeAction, onPlaced, onReturned, onStateChange, onRotate]);

  // Синхронизируем sendRef с актуальной функцией send (для анимационных колбэков)
  useEffect(() => { sendRef.current = send; }, [send]);

  // Вызываем onStateChange при любом изменении currentState
  useEffect(() => {
    if (onStateChange && machineRef.current) {
      const ctx = machineRef.current.getContext();
      if (ctx) onStateChange(currentState, ctx);
    }
  }, [currentState, onStateChange]);

  // Слушаем Animated.position и синхронизируем значение в контекст FSM
  useEffect(() => {
    const anim = animatedValuesRef.current?.position;
    if (!anim) return;
    const listenerId = anim.addListener((value) => {
      const ctx = machineRef.current?.getContext();
      if (ctx) ctx.position = { x: value.x || 0, y: value.y || 0 };
    });
    return () => { anim.removeListener(listenerId); };
  }, []);

  // Очистка при размонтировании: останавливаем анимации и уничтожаем машину
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

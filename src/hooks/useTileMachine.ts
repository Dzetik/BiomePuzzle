// ============================================================================
// ХУК ИНТЕГРАЦИИ FSM С REACT
// ============================================================================
// Этот хук соединяет машину состояний (TileStateMachine) с экосистемой React.
// Он управляет:
// - Animated значениями для плавных анимаций позиции и размера
// - Синхронизацией состояния FSM с React state для ре-рендеров
// - Обработкой колбэков (onPlaced, onReturned, onStateChange)
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

// ============================================================================
// ТИП ВОЗВРАЩАЕМОГО ЗНАЧЕНИЯ
// ============================================================================
// Интерфейс определяет что хук возвращает для использования в компонентах.
// ============================================================================
export interface UseTileMachineReturn {
  state: TileState;  // Текущее состояние FSM (для условного рендера)
  send: (event: TileEvent) => void;  // Функция отправки событий в FSM
  context: TileContext | null;  // Текущий контекст (для отладки/инспекции)
  animated: {  // Animated значения для привязки к UI
    position: Animated.ValueXY;  // Позиция плитки на экране
    size: {  // Размер плитки (ширина и высота)
      width: Animated.Value;
      height: Animated.Value;
    };
  };
  debug?: {  // Отладочная информация (только если SHOW_TILE_DEBUG = true)
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
// Принимает конфигурацию плитки и возвращает объект для управления ею.
// Используется внутри useDraggable.fsm.ts для каждой активной плитки.
// ============================================================================
export const useTileMachine = ({
  tileId,              // Уникальный идентификатор плитки
  tileType,            // Тип плитки (для будущих расширений)
  initialPosition,     // Начальная позиция на экране {x, y}
  spawnerPosition,     // Позиция и размер спавнера {x, y, width, height}
  tile,
  onStateChange,       // Колбэк при смене состояния (для синхронизации с родительским компонентом)
  onPlaced,            // Колбэк при успешном размещении плитки в ячейке
  onReturned,          // Колбэк при возврате плитки в спавнер
}: UseTileMachineOptions): UseTileMachineReturn => {
  
  // --------------------------------------------------------------------------
  // 1. ИНИЦИАЛИЗАЦИЯ ANIMATED VALUES (только один раз при маунте)
  // --------------------------------------------------------------------------
  // Ref хранит Animated значения чтобы они не пересоздавались при ре-рендерах.
  // Это критично для производительности: пересоздание Animated.Value прервёт анимации.
  // --------------------------------------------------------------------------
  const animatedValuesRef = useRef<{
    position: Animated.ValueXY;
    size: { width: Animated.Value; height: Animated.Value };
  } | null>(null);
  
  // Инициализируем только если ещё не созданы (паттерн "ленивая инициализация")
  if (!animatedValuesRef.current) {
    animatedValuesRef.current = {
      position: new Animated.ValueXY(initialPosition),  // Начальная позиция
      size: {
        width: new Animated.Value(spawnerPosition.width),   // Начальная ширина
        height: new Animated.Value(spawnerPosition.height), // Начальная высота
      },
    };
  }
  
  // --------------------------------------------------------------------------
  // 2. REFS ДЛЯ ДОСТУПА К ФУНКЦИЯМ ИЗ АСИНХРОННЫХ КОЛБЭКОВ
  // --------------------------------------------------------------------------
  // Храним актуальную send() в ref и используем её в колбэках.
  // --------------------------------------------------------------------------
  const sendRef = useRef<(event: TileEvent) => void>(() => {});

  // --------------------------------------------------------------------------
  // 3. ИНИЦИАЛИЗАЦИЯ МАШИНЫ СОСТОЯНИЙ (только один раз при маунте)
  // --------------------------------------------------------------------------
  // Создаём экземпляр TileStateMachine с начальным контекстом.
  // --------------------------------------------------------------------------
  const machineRef = useRef<TileStateMachine | null>(null);
  
  if (!machineRef.current) {
    const initialContext: TileContext = {
      tileId: tile?.id || tileId,
      tileType,
      tile: tile ?? null, 
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

  useEffect(() => {
    if (machineRef.current && tileId) {
      const ctx = machineRef.current.getContext();
      // Обновляем tileId только если он действительно изменился
      if (ctx.tileId !== tileId) {
        ctx.tileId = tileId;
        if (__DEV__) {
          console.log(`[TileMachine] tileId обновлён: ${ctx.tileId}`);
        }
      }
    }
  }, [tileId]);
  
  // --------------------------------------------------------------------------
  // 4. REACT STATE ДЛЯ ТРИГГЕРА РЕ-РЕНДЕРОВ
  // --------------------------------------------------------------------------
  // FSM хранит состояние внутри себя, но React компоненты не знают об изменениях.
  // currentState синхронизируется с внутренним состоянием машины и вызывает
  // ре-рендер когда состояние меняется — это нужно для условного рендера в UI.
  // --------------------------------------------------------------------------
  const [currentState, setCurrentState] = useState<TileState>(
    machineRef.current.getState()  // Начальное состояние из машины
  );
  
  // Отладочная информация (только если включён флаг)
  const [debugInfo, setDebugInfo] = useState<{
    history: any[];
    lastAction: MachineAction | null;
  }>({ history: [], lastAction: null });
  
  // --------------------------------------------------------------------------
  // 5. СЧЁТЧИК АКТИВНЫХ АНИМАЦИЙ
  // --------------------------------------------------------------------------
  // Когда плитка анимирует и позицию, и размер одновременно, нужно отправить
  // событие ANIMATION_COMPLETE только когда ОБЕ анимации завершатся.
  // Этот счётчик инкрементируется при старте каждой анимации и декрементируется
  // при завершении. Когда достигает 0 — отправляем событие.
  // --------------------------------------------------------------------------
  const animationsPendingRef = useRef(0);
  
  // --------------------------------------------------------------------------
  // 6. ФУНКЦИЯ ВЫПОЛНЕНИЯ ДЕЙСТВИЙ (анимации и сайд-эффекты)
  // --------------------------------------------------------------------------
  // Принимает MachineAction из TransitionResult и выполняет соответствующее
  // действие: мгновенное обновление позиции, анимацию, остановку или колбэк.
  // Использует useCallback с пустым массивом зависимостей для стабильности.
  // --------------------------------------------------------------------------
  const executeAction = useCallback((action: MachineAction) => {
    const anim = animatedValuesRef.current;
    if (!anim) return;  // Если Animated значения ещё не инициализированы — выходим
    
    switch (action.type) {
      // --------------------------------------------------------------------
      // ДЕЙСТВИЕ: МГНОВЕННОЕ ОБНОВЛЕНИЕ ПОЗИЦИИ
      // --------------------------------------------------------------------
      // Используется во время перетаскивания для максимальной отзывчивости.
      // Не требует анимации — позиция обновляется сразу в том же тике.
      // --------------------------------------------------------------------
      case 'UPDATE_POSITION_IMMEDIATE': {
        anim.position.setValue(action.payload);
        break;
      }
      
      // --------------------------------------------------------------------
      // ДЕЙСТВИЕ: АНИМАЦИЯ ПОЗИЦИИ
      // --------------------------------------------------------------------
      // Используется при размещении в ячейке или возврате в спавнер.
      // Анимирует позицию к целевым координатам с плавностью ~300ms.
      // --------------------------------------------------------------------
      case 'ANIMATE_TO_POSITION': {
        const { x, y, duration, onComplete, col, row, baseTileSize } = action.payload;
        
        // Вычисляем целевую позицию: если указаны col/row — через GridService
        let targetX = x;
        let targetY = y;
        
        if (col !== undefined && row !== undefined) {
          // GridService вычисляет точный центр ячейки с учётом scale и offset
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
        
        // Останавливаем предыдущую анимацию позиции (если была)
        anim.position.stopAnimation();
        
        // Увеличиваем счётчик активных анимаций
        animationsPendingRef.current++;
        
        // Флаг для предотвращения двойного вызова завершения
        let animationCompleted = false;
        
        // Функция завершения анимации
        const completeAnimation = () => {
          // Защита от двойного вызова (колбэк + timeout)
          if (animationCompleted) return;
          animationCompleted = true;
          
          // Уменьшаем счётчик активных анимаций
          animationsPendingRef.current--;
          
          // Если все анимации завершены — отправляем событие
          // Используем sendRef.current вместо machineRef.current.send()
          // Причина: sendRef всегда ссылается на актуальную send() функцию
          // которая также вызывает setCurrentState для обновления React state.
          // Прямой вызов machineRef.current.send() обновит только FSM,
          // но не вызовет ре-рендер компонента → плитка "зависнет" визуально.
          if (animationsPendingRef.current === 0) {
            sendRef.current({ type: 'ANIMATION_COMPLETE' });
          }
          
          // Вызываем пользовательский колбэк если есть
          onComplete?.();
        };
        
        // Запускаем анимацию позиции
        Animated.timing(anim.position, {
          toValue: { x: targetX, y: targetY },  // Целевая позиция
          duration: duration || DEFAULT_TILE_CONFIG.animationDuration,  // ~300ms
          useNativeDriver: false,  // false т.к. Animated.ValueXY не поддерживается
        }).start(completeAnimation);  // Вызываем completeAnimation после завершения
        
        // Если колбэк анимации не сработал (баг React Native),
        // завершаем анимацию вручную через таймаут.
        // 2000ms — достаточно для любой анимации (обычно 300ms)
        setTimeout(() => {
          if (!animationCompleted) {
            completeAnimation();
          }
        }, 2000);
        
        break;
      }
      
      // --------------------------------------------------------------------
      // ДЕЙСТВИЕ: АНИМАЦИЯ РАЗМЕРА
      // --------------------------------------------------------------------
      // Используется при изменении размера плитки (спавнер ↔ ячейка).
      // Анимирует ширину и высоту параллельно для синхронности.
      // --------------------------------------------------------------------
      case 'ANIMATE_SIZE': {
        const { width, height, duration, onComplete } = action.payload;
        
        // Останавливаем предыдущие анимации размера
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        
        // Увеличиваем счётчик активных анимаций
        animationsPendingRef.current++;
        
        // Флаг для предотвращения двойного вызова
        let animationCompleted = false;
        
        // Функция завершения анимации
        const completeAnimation = () => {
          if (animationCompleted) return;
          animationCompleted = true;
          
          animationsPendingRef.current--;
          
          // Отправляем событие завершения через sendRef
          if (animationsPendingRef.current === 0) {
            sendRef.current({ type: 'ANIMATION_COMPLETE' });
          }
          
          onComplete?.();
        };
        
        // Запускаем параллельные анимации ширины и высоты
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
        
        // 🔥 СТРАХОВКА: Таймаут на случай если колбэк не сработает
        setTimeout(() => {
          if (!animationCompleted) {
            completeAnimation();
          }
        }, 2000);
        
        break;
      }
      
      // --------------------------------------------------------------------
      // ДЕЙСТВИЕ: ОСТАНОВКА ВСЕХ АНИМАЦИЙ
      // --------------------------------------------------------------------
      // Используется при удалении плитки или принудительной остановке.
      // Сбрасывает счётчик анимаций в 0.
      // --------------------------------------------------------------------
      case 'STOP_ANIMATIONS': {
        anim.position.stopAnimation();
        anim.size.width.stopAnimation();
        anim.size.height.stopAnimation();
        animationsPendingRef.current = 0;
        break;
      }
      
      // --------------------------------------------------------------------
      // ДЕЙСТВИЕ: ПРОИЗВОЛЬНЫЙ КОЛБЭК
      // --------------------------------------------------------------------
      // Используется для расширений (например, освобождение ячейки в сетке).
      // --------------------------------------------------------------------
      case 'CALLBACK': {
        action.payload();
        break;
      }
    }
    
    // Обновляем отладочную информацию если включён флаг
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo(prev => ({ ...prev, lastAction: action }));
    }
  }, []);  // Пустой массив зависимостей — executeAction не пересоздаётся
  
  // --------------------------------------------------------------------------
  // 7. ФУНКЦИЯ ОТПРАВКИ СОБЫТИЙ (ГЛАВНАЯ ТОЧКА ВХОДА)
  // --------------------------------------------------------------------------
  // Единственный способ изменить состояние FSM извне.
  // Вызывается из жестов (onStart, onUpdate, onEnd) и анимационных колбэков.
  // --------------------------------------------------------------------------
  const send = useCallback((event: TileEvent) => {
    // Проверяем что машина состояний инициализирована
    if (!machineRef.current) return;
    
    // Получаем состояние ДО обработки события (для сравнения)
    const machineStateBefore = machineRef.current.getState();
    
    // Отправляем событие в машину состояний
    const result = machineRef.current.send(event);
    
    // Если переход не найден — выходим (событие проигнорировано)
    if (!result) return;
    
    // Проверяем изменилось ли состояние
    const stateChanged = result.nextState !== machineStateBefore;
    
    // Если состояние изменилось — обновляем React state и вызываем колбэки
    if (stateChanged) {
      // Обновляем React state — это вызывает ре-рендер компонента
      setCurrentState(result.nextState);
      
      // ------------------------------------------------------------------
      // КОЛБЭК: РАЗМЕЩЕНИЕ ПЛИТКИ
      // ------------------------------------------------------------------
      // Вызывается когда плитка успешно размещена в ячейке.
      // Добавляет плитку в TilesContext для сохранения в сетке.
      // ------------------------------------------------------------------
      if (result.nextState === 'PLACED' && onPlaced) {
        const ctx = machineRef.current?.getContext();
        if (ctx?.targetCell) {
          // Занимаем ячейку через GridService (для проверки занятости)
          GridService.occupyCell(ctx.targetCell.col, ctx.targetCell.row, ctx.tileId);
          // Вызываем внешний колбэк (в App.js создаётся новая плитка в спавнере)
          onPlaced(ctx.targetCell);
        }
      }
      
      // ------------------------------------------------------------------
      // КОЛБЭК: ВОЗВРАТ В СПАВНЕР
      // ------------------------------------------------------------------
      // Вызывается когда плитка вернулась в спавнер после неудачного размещения.
      // ------------------------------------------------------------------
      if (result.nextState === 'SPAWNER_IDLE' && onReturned) {
        onReturned();
      }
      
      // ------------------------------------------------------------------
      // КОЛБЭК: СМЕНА СОСТОЯНИЯ (ОБЩИЙ)
      // ------------------------------------------------------------------
      // Вызывается при любом изменении состояния (для синхронизации с родителем).
      // ------------------------------------------------------------------
      if (onStateChange) {
        const ctx = machineRef.current?.getContext();
        if (ctx) {
          onStateChange(result.nextState, ctx);
        }
      }
    }
    
    // Выполняем все действия из перехода (анимации)
    result.actions.forEach(action => executeAction(action));
    
    // Обновляем отладочную информацию если включён флаг
    if (FEATURE_FLAGS.SHOW_TILE_DEBUG) {
      setDebugInfo({
        history: machineRef.current?.getHistory() || [],
        lastAction: result.actions[0] || null,
      });
    }
    
  }, [executeAction, onPlaced, onReturned, onStateChange]);  // Зависимости для стабильности

  // --------------------------------------------------------------------------
  // 8. СИНХРОНИЗАЦИЯ sendRef
  // --------------------------------------------------------------------------
  // Обновляет sendRef.current при каждом изменении send функции.
  // Это гарантирует что анимационные колбэки всегда вызывают актуальную send().
  // --------------------------------------------------------------------------
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // --------------------------------------------------------------------------
  // 9. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ С РОДИТЕЛЕМ
  // --------------------------------------------------------------------------
  // Дополнительный useEffect для гарантии что onStateChange вызывается
  // даже если send() не был вызван напрямую (например, при маунте).
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (onStateChange && machineRef.current) {
      const ctx = machineRef.current.getContext();
      if (ctx) {
        onStateChange(currentState, ctx);
      }
    }
  }, [currentState, onStateChange]);
  
  // --------------------------------------------------------------------------
  // 10. ПОДПИСКА НА ИЗМЕНЕНИЯ ПОЗИЦИИ
  // --------------------------------------------------------------------------
  // Синхронизирует Animated.ValueXY с контекстом машины состояний.
  // Нужно чтобы контекст всегда содержал актуальную позицию плитки.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const anim = animatedValuesRef.current?.position;
    if (!anim) return;
    
    // Добавляем слушатель изменений позиции
    const listenerId = anim.addListener((value) => {
      const ctx = machineRef.current?.getContext();
      if (ctx) {
        // Обновляем позицию в контексте (для отладки и логики)
        ctx.position = { x: value.x || 0, y: value.y || 0 };
      }
    });
    
    // Очищаем слушатель при размонтировании
    return () => {
      anim.removeListener(listenerId);
    };
  }, []);
  
  // --------------------------------------------------------------------------
  // 11. ОЧИСТКА ПРИ РАЗМОНТИРОВАНИИ
  // --------------------------------------------------------------------------
  // Останавливает все анимации и освобождает ссылки при размонтировании.
  // Предотвращает утечки памяти и ошибки "can't perform update on unmounted component".
  // --------------------------------------------------------------------------
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
  
  // --------------------------------------------------------------------------
  // 12. ФОРМИРОВАНИЕ ВОЗВРАЩАЕМОГО ЗНАЧЕНИЯ
  // --------------------------------------------------------------------------
  // Объект который используется в useDraggable.fsm.ts для управления плиткой.
  // --------------------------------------------------------------------------
  return {
    state: currentState,  // Текущее состояние FSM (для условного рендера)
    send,                 // Функция отправки событий (для жестов)
    context: machineRef.current?.getContext() || null,  // Контекст для отладки
    animated: {
      position: animatedValuesRef.current!.position,  // Animated позиция
      size: animatedValuesRef.current!.size,          // Animated размер
    },
    // Отладочная информация — только если включён флаг (не в продакшене)
    ...(FEATURE_FLAGS.SHOW_TILE_DEBUG && {
      debug: debugInfo,
    }),
  };
};

export default useTileMachine;
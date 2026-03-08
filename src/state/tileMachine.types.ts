// src/state/tileMachine.types.ts

// ============================================================================
// СОСТОЯНИЯ ПЛИТКИ (TILE STATES)
// ============================================================================
/**
 * SPAWNER_IDLE      - Плитка в спавнере, ожидает взятия
 * SPAWNER_RETURNING - Промежуточное: плитка возвращается в спавнер
 * DRAGGING          - Пользователь перетаскивает плитку
 * SNAPPING          - Плитка примагничивается к ячейке (поиск/анимация)
 * PLACED            - Плитка размещена на сетке
 * RETURNING_TO_SPAWN- Анимация возврата в спавнер
 * REMOVED           - Плитка удалена/уничтожена (терминальное)
 */
export type TileState =
  | 'SPAWNER_IDLE'
  | 'SPAWNER_RETURNING'
  | 'DRAGGING'
  | 'SNAPPING'
  | 'PLACED'
  | 'RETURNING_TO_SPAWN'
  | 'REMOVED';

// ============================================================================
// СОБЫТИЯ (EVENTS) — дискриминированный юнион для типобезопасности
// ============================================================================
export type TileEvent =
  // Взятие плитки из спавнера
  | { type: 'TAKEN_FROM_SPAWN' }
  
  // Начало перетаскивания
  | { type: 'DRAG_START' }
  
  // Перемещение при перетаскивании
  | { type: 'DRAG_MOVE'; payload: { x: number; y: number } }
  
  // Конец перетаскивания
  | { type: 'DRAG_END'; payload: { x: number; y: number } }
  
  // Ячейка найдена под плиткой
  | { type: 'CELL_FOUND'; payload: { col: number; row: number; isFree: boolean; scale?: number; baseTileSize?: number; } }
  
  // Ячейка не найдена (плитка за пределами сетки)
  | { type: 'NO_CELL' }
  
  // Команда: вернуть плитку в спавнер
  | { type: 'RETURN_TO_SPAWN' }
  
  // Команда: разместить на конкретной ячейке
  | { type: 'PLACE_ON_GRID'; payload: { col: number; row: number } }
  
  // Удалить плитку
  | { type: 'REMOVE' }
  
  // Анимация завершена (внутреннее событие)
  | { type: 'ANIMATION_COMPLETE' };

// ============================================================================
// КОНТЕКСТ ПЛИТКИ (TILE CONTEXT) — единый источник истины
// ============================================================================
export interface TileContext {
  // === Идентификаторы ===
  tileId: string;
  tileType: string;
  
  // === Позиция и размер (логические значения) ===
  position: { x: number; y: number };
  size: { width: number; height: number };
  targetPosition?: { x: number; y: number }; // для анимаций
  
  // === Сетка ===
  currentCell?: { col: number; row: number }; // где плитка сейчас
  targetCell?: { col: number; row: number };  // куда хотим разместить
  
  // === Спавнер ===
  spawnerPosition: { x: number; y: number; width: number; height: number };
  isInSpawner: boolean;
  
  // === Анимации (Animated API refs — не вызывают ре-рендеры) ===
  /** Animated.ValueXY для позиции */
  animatedPosition: any; 
  /** { width: Animated.Value, height: Animated.Value } */
  animatedSize: any;
  /** Флаг: идёт ли сейчас анимация */
  isAnimating: boolean;
  
  // === Мета-данные ===
  meta: Record<string, any>;
  createdAt: number;
}

// ============================================================================
// ДЕЙСТВИЯ (ACTIONS) — что выполнять при переходе
// ============================================================================
/**
 * Действия выполняются ПОСЛЕ смены состояния.
 * Они управляют анимациями и сайд-эффектами, не вызывая ре-рендеры.
 */
export type MachineAction =
  // Мгновенно установить позицию (без анимации)
  | { 
      type: 'UPDATE_POSITION_IMMEDIATE'; 
      payload: { x: number; y: number } 
    }
  // Анимировать позицию
  | { 
      type: 'ANIMATE_TO_POSITION'; 
      payload: { 
        x: number; 
        y: number; 
        duration?: number;
        onComplete?: () => void;
        col?: number;  
        row?: number;
        baseTileSize?: number;
      } 
    }
  // Анимировать размер
  | { 
      type: 'ANIMATE_SIZE'; 
      payload: { 
        width: number; 
        height: number; 
        duration?: number;
        onComplete?: () => void;
      } 
    }
  // Остановить все анимации (для edge cases)
  | { type: 'STOP_ANIMATIONS' }
  // Выполнить произвольный колбэк (освобождение ячейки и т.п.)
  | { type: 'CALLBACK'; payload: () => void };

// ============================================================================
// РЕЗУЛЬТАТ ПЕРЕХОДА (TRANSITION RESULT)
// ============================================================================
export interface TransitionResult {
  /** Новое состояние после перехода */
  nextState: TileState;
  
  /** Частичное обновление контекста (merge) */
  contextUpdates: Partial<TileContext>;
  
  /** Действия для выполнения после перехода */
  actions: MachineAction[];
  
  /** Сообщение для лога (dev mode) */
  logMessage?: string;
}

// ============================================================================
// КОНФИГУРАЦИЯ (CONFIG)
// ============================================================================
export interface TileMachineConfig {
  /** Таймаут анимаций по умолчанию (мс) */
  animationDuration: number;
  
  /** Порог для "примагничивания" к ячейке (в пикселях) */
  snapThreshold: number;
  
  /** Дебаунс для DRAG_MOVE событий (мс, 0 = отключено) */
  dragMoveDebounce: number;
  
  /** Включить логирование переходов */
  debugMode: boolean;
  
  /** Лимит истории переходов для отладки */
  logHistoryLimit: number;
  
  /** Тension/friction для spring-анимаций */
  animationTension: number;
  animationFriction: number;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================================
/** Результат отправки события в машину */
export interface SendResult {
  /** Удалось ли обработать событие */
  success: boolean;
  /** Было ли состояние изменено */
  stateChanged: boolean;
  /** Предыдущее состояние (для отладки) */
  prevState?: TileState;
  /** Новое состояние */
  nextState: TileState;
  /** Выполненные действия */
  executedActions: MachineAction[];
}

/** Опции для хука useTileMachine */
export interface UseTileMachineOptions {
  tileId: string;
  tileType: string;
  initialPosition: { x: number; y: number };
  spawnerPosition: { x: number; y: number; width: number; height: number };
  /** Колбэк при смене логического состояния */
  onStateChange?: (state: TileState, context: TileContext) => void;
  /** Колбэк при размещении на сетке */
  onPlaced?: (cell: { col: number; row: number }) => void;
  /** Колбэк при возврате в спавнер */
  onReturned?: () => void;
}
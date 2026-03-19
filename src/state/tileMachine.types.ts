// src/state/tileMachine.types.ts

import { Tile } from "../models";

// ============================================================================
// СОСТОЯНИЯ ПЛИТКИ (TILE STATES)
// ============================================================================

/**
 * Все возможные состояния конечного автомата плитки.
 *
 * - `SPAWNER_IDLE`          — плитка в спавнере, ожидает взятия
 * - `INVENTORY_IDLE`        — плитка в инвентаре, ожидает взятия
 * - `SPAWNER_RETURNING`     — промежуточное: плитка возвращается в спавнер
 * - `DRAGGING`              — пользователь перетаскивает плитку
 * - `SNAPPING`              — поиск ячейки после окончания перетаскивания
 * - `PLACED`                — плитка размещена на сетке
 * - `RETURNING_TO_SPAWN`    — анимация возврата в спавнер
 * - `RETURNING_TO_INVENTORY`— анимация возврата в инвентарь
 * - `REMOVED`               — плитка удалена/уничтожена (терминальное состояние)
 */
export type TileState =
  | 'SPAWNER_IDLE'
  | 'INVENTORY_IDLE'
  | 'SPAWNER_RETURNING'
  | 'DRAGGING'
  | 'SNAPPING'
  | 'PLACED'
  | 'RETURNING_TO_SPAWN'
  | 'RETURNING_TO_INVENTORY'
  | 'REMOVED';

// ============================================================================
// СОБЫТИЯ (EVENTS) — дискриминированный юнион для типобезопасности
// ============================================================================

/**
 * Все события, которые можно отправить в машину состояний через `send()`.
 *
 * Использует паттерн дискриминированного юниона: поле `type` однозначно
 * определяет форму объекта, что позволяет TypeScript сужать тип в switch/case.
 */
export type TileEvent =
  /** Плитка взята из спавнера — переход SPAWNER_IDLE → DRAGGING. */
  | { type: 'TAKEN_FROM_SPAWN' }

  /** Плитка взята из инвентаря — переход INVENTORY_IDLE → DRAGGING. */
  | { type: 'TAKEN_FROM_INVENTORY' }

  /** Начало перетаскивания. */
  | { type: 'DRAG_START' }

  /** Перемещение плитки (~60 раз/сек во время драга). */
  | { type: 'DRAG_MOVE'; payload: { x: number; y: number } }

  /** Конец перетаскивания — переход к поиску ячейки (SNAPPING). */
  | { type: 'DRAG_END'; payload: { x: number; y: number } }

  /** Ячейка найдена под плиткой; `isFree` — свободна ли она. */
  | { type: 'CELL_FOUND'; payload: { col: number; row: number; isFree: boolean; scale?: number; baseTileSize?: number; } }

  /** Ячейка не найдена — плитка за пределами сетки. */
  | { type: 'NO_CELL' }

  /** Команда вернуть плитку в спавнер. */
  | { type: 'RETURN_TO_SPAWN' }

  /** Команда разместить плитку на конкретной ячейке. */
  | { type: 'PLACE_ON_GRID'; payload: { col: number; row: number } }

  /** Удалить плитку из игры (терминальное событие). */
  | { type: 'REMOVE' }

  /** Принудительный сброс в состояние SPAWNER_IDLE (для новой плитки). */
  | { type: 'RESET_TO_SPAWNER' }

  /** Подтверждение завершения возврата в спавнер. */
  | { type: 'RETURNED_TO_SPAWNER' }

  /** Команда вернуть плитку в инвентарь. */
  | { type: 'RETURN_TO_INVENTORY' }

  /** Подтверждение завершения возврата в инвентарь. */
  | { type: 'RETURNED_TO_INVENTORY' }

  /** Завершение отложенной анимации. */
  | { type: 'DELAYED_ANIMATION_COMPLETE' }

  /** Анимация завершена (внутреннее событие). */
  | { type: 'ANIMATION_COMPLETE' }

  /** Поворот плитки на 90°. */
  | { type: 'ROTATE' }

  /** Синхронизация ссылки на объект Tile в контексте машины. */
  | { type: 'SYNC_TILE'; payload: { tile: Tile } };


// ============================================================================
// КОНТЕКСТ ПЛИТКИ (TILE CONTEXT) — единый источник истины
// ============================================================================

/**
 * Полный контекст конечного автомата плитки.
 *
 * Хранит все данные, необходимые для управления жизненным циклом плитки:
 * идентификаторы, позицию, размер, привязку к ячейке, параметры спавнера
 * и ссылки на Animated-значения для анимаций без лишних ре-рендеров.
 *
 * Обновляется через поле `contextUpdates` в `TransitionResult` при каждом
 * переходе состояния.
 */
export interface TileContext {
  // Идентификаторы
  tileId: string;
  tileType: string;

  /** Объект плитки — источник текстуры, рёбер и activeSide. */
  tile: Tile | null;

  // Позиция и размер (логические значения в экранных пикселях)
  position: { x: number; y: number };
  size: { width: number; height: number };
  /** Целевая позиция для анимаций перемещения. */
  targetPosition?: { x: number; y: number };

  /** Начальное состояние при инициализации (опционально). */
  initialState?: TileState;

  // Сетка
  /** Текущая ячейка, в которой находится плитка. */
  currentCell?: { col: number; row: number };
  /** Целевая ячейка при snap-анимации. */
  targetCell?: { col: number; row: number };

  // Спавнер
  spawnerPosition: { x: number; y: number; width: number; height: number };
  isInSpawner: boolean;

  // Анимации (Animated API refs — не вызывают ре-рендеры при изменении)
  /** Animated.ValueXY для управления позицией плитки. */
  animatedPosition: any;
  /** { width: Animated.Value, height: Animated.Value } для управления размером. */
  animatedSize: any;
  /** Флаг: выполняется ли сейчас анимация. */
  isAnimating: boolean;

  // Мета-данные
  meta: Record<string, any>;
  createdAt: number;
}

// ============================================================================
// ДЕЙСТВИЯ (ACTIONS) — что выполнять при переходе
// ============================================================================

/**
 * Действия, выполняемые ПОСЛЕ смены состояния.
 *
 * Управляют анимациями и сайд-эффектами, не вызывая ре-рендеры React.
 * Обрабатываются хуком `useTileMachine` сразу после получения `TransitionResult`.
 */
export type MachineAction =
  /** Мгновенно установить позицию без анимации (для отзывчивости во время драга). */
  | {
      type: 'UPDATE_POSITION_IMMEDIATE';
      payload: { x: number; y: number }
    }
  /** Анимировать перемещение плитки к указанной позиции или ячейке. */
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
  /** Анимировать изменение размера плитки. */
  | {
      type: 'ANIMATE_SIZE';
      payload: {
        width: number;
        height: number;
        duration?: number;
        onComplete?: () => void;
      }
    }
  /** Остановить все текущие анимации (для edge cases и принудительного удаления). */
  | { type: 'STOP_ANIMATIONS' }
  /** Выполнить произвольный колбэк (освобождение ячейки и т.п.). */
  | { type: 'CALLBACK'; payload: () => void }
  /** Отправить ANIMATION_COMPLETE с задержкой. */
  | {
      type: 'DELAYED_ANIMATION_COMPLETE';
      payload: { delay: number }
    }
  /** Выполнить поворот плитки на 90°. */
  | { type: 'ROTATE_TILE' };

// ============================================================================
// РЕЗУЛЬТАТ ПЕРЕХОДА (TRANSITION RESULT)
// ============================================================================

/**
 * Результат, возвращаемый из `send()` при успешном переходе.
 *
 * Содержит новое состояние, частичное обновление контекста и список действий
 * для выполнения. `prevState` добавляется в `send()` для определения
 * факта смены состояния без дополнительного сравнения.
 */
export interface TransitionResult {
  /** Новое состояние после перехода. */
  nextState: TileState;

  /** Предыдущее состояние (заполняется в `send()`, не в обработчиках). */
  prevState?: TileState;

  /** Частичное обновление контекста — мержится со старым через spread. */
  contextUpdates: Partial<TileContext>;

  /** Список действий для выполнения после перехода. */
  actions: MachineAction[];

  /** Сообщение для лога в dev-режиме. */
  logMessage?: string;
}

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

/**
 * Настройки машины состояний плитки.
 *
 * Позволяет тонко настроить тайминги анимаций, пороги snap и режим отладки.
 * Используется через `DEFAULT_TILE_CONFIG` или `createTileConfig()`.
 */
export interface TileMachineConfig {
  /** Длительность анимаций по умолчанию в миллисекундах. */
  animationDuration: number;

  /** Порог "примагничивания" к ячейке в пикселях. */
  snapThreshold: number;

  /** Дебаунс для DRAG_MOVE событий в мс (0 = отключено). */
  dragMoveDebounce: number;

  /** Включить логирование переходов состояний в консоль. */
  debugMode: boolean;

  /** Максимальное количество записей в истории переходов. */
  logHistoryLimit: number;

  /** Tension для spring-анимаций Animated API. */
  animationTension: number;
  /** Friction для spring-анимаций Animated API. */
  animationFriction: number;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================================

/**
 * Результат вызова `send()` — расширенный ответ с метаданными перехода.
 *
 * Используется хуком `useTileMachine` для определения необходимости
 * ре-рендера и выполнения действий.
 */
export interface SendResult {
  /** Удалось ли обработать событие (false если переход не найден). */
  success: boolean;
  /** Изменилось ли состояние в результате события. */
  stateChanged: boolean;
  /** Предыдущее состояние (для отладки). */
  prevState?: TileState;
  /** Новое текущее состояние. */
  nextState: TileState;
  /** Список выполненных действий. */
  executedActions: MachineAction[];
}

/**
 * Параметры инициализации хука `useTileMachine`.
 *
 * Передаются при создании хука и определяют начальное состояние машины,
 * колбэки на смену состояния и другие реакции на события.
 */
export interface UseTileMachineOptions {
  tileId: string;
  tileType: string;
  initialPosition: { x: number; y: number };
  spawnerPosition: { x: number; y: number; width: number; height: number };
  tile?: Tile;
  /** Колбэк при любой смене логического состояния. */
  onStateChange?: (state: TileState, context: TileContext) => void;
  /** Колбэк при успешном размещении плитки на сетке. */
  onPlaced?: (cell: { col: number; row: number }) => void;
  /** Колбэк при возврате плитки в спавнер. */
  onReturned?: () => void;
  onRotate?: (tileId: string) => void;
  isInSpawner?: boolean;
}

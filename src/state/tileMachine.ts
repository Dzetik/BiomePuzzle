// ============================================================================
// МАШИНА СОСТОЯНИЙ ПЛИТКИ (FSM)
// ============================================================================
// Реализует конечный автомат для управления жизненным циклом плитки.
// Все переходы между состояниями строго типизированы и детерминированы.
// Класс не зависит от React — может использоваться в любом контексте.
// ============================================================================

import {
  TileState,
  TileEvent,
  TileContext,
  TransitionResult,
  MachineAction,
} from './tileMachine.types';
import { DEFAULT_TILE_CONFIG, FEATURE_FLAGS } from './tileMachine.config';
import { DEFAULT_TILE_SIZE } from '../constants/tile';

// ============================================================================
// КЛАСС МАШИНЫ СОСТОЯНИЙ
// ============================================================================

/**
 * Конечный автомат (FSM) управления жизненным циклом игровой плитки.
 *
 * Инкапсулирует все переходы между состояниями плитки — от появления
 * в спавнере до размещения на сетке или удаления. Каждый переход строго
 * детерминирован: одно состояние + одно событие = один результат.
 *
 * Не зависит от React и не вызывает setState напрямую. Внешний код
 * (хук `useTileMachine`) получает `TransitionResult` и сам решает,
 * когда и как обновить React-состояние.
 *
 * Архитектурные решения:
 * - `context` обновляется через merge (spread), неуказанные поля сохраняются.
 * - `history` ограничена 50 записями для предотвращения утечек памяти.
 * - `REMOVED` — терминальное состояние, любые события игнорируются.
 * - `SPAWNER_RETURNING` делегирует обработку в `handleReturningToSpawn`.
 */
export class TileStateMachine {
  /** Полный контекст плитки: позиция, ячейка, размер, анимации. */
  private context: TileContext;

  /** Текущее состояние автомата — изменяется только через `send()`. */
  private currentState: TileState;

  /**
   * Кольцевой буфер истории переходов для отладки.
   * Хранит не более `logHistoryLimit` записей.
   */
  private history: Array<{
    fromState: TileState;
    event: TileEvent['type'];
    toState: TileState;
    timestamp: number;
  }> = [];

  // ============================================================================
  // КОНСТРУКТОР
  // ============================================================================

  /**
   * Инициализирует машину состояний с заданным контекстом.
   *
   * Начальное состояние определяется в порядке приоритета:
   * 1. `initialContext.initialState` (явно задан)
   * 2. `SPAWNER_IDLE` если плитка в спавнере (`isInSpawner === true`)
   * 3. `DRAGGING` во всех остальных случаях
   *
   * @param initialContext - начальный контекст плитки
   */
  constructor(initialContext: TileContext) {
    this.context = initialContext;
    this.currentState = initialContext.initialState ?? (
      initialContext.isInSpawner ? 'SPAWNER_IDLE' : 'DRAGGING'
    );

    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      console.log(`[FSM:${initialContext.tileId}] Initialized in ${this.currentState}`);
    }
  }

  // ============================================================================
  // ГЛАВНЫЙ МЕТОД: ОТПРАВКА СОБЫТИЯ
  // ============================================================================

  /**
   * Отправляет событие в машину состояний и выполняет переход.
   *
   * Единственный публичный способ изменить состояние. Гарантирует
   * предсказуемость: все изменения состояния проходят через этот метод.
   *
   * Алгоритм:
   * 1. Сохраняет `prevState` до обработки.
   * 2. Ищет обработчик для комбинации (currentState, event).
   * 3. Если обработчик не найден — событие игнорируется, возвращается null.
   * 4. Обновляет состояние и контекст через merge.
   * 5. Записывает переход в историю.
   * 6. Возвращает `TransitionResult` с `prevState` для хука.
   *
   * @param event - событие для обработки
   * @returns TransitionResult при успешном переходе, null если переход не найден
   */
  public send(event: TileEvent): TransitionResult | null {
    const prevState = this.currentState;

    const transition = this.getTransition(prevState, event);

    if (!transition) {
      if (FEATURE_FLAGS.LOG_TRANSITIONS) {
        console.warn(
          `[FSM:${this.context.tileId}] Ignored event "${event.type}" in state "${prevState}"`
        );
      }
      return null;
    }

    this.currentState = transition.nextState;

    // Merge: только указанные поля обновляются, остальные сохраняются
    this.context = { ...this.context, ...transition.contextUpdates };

    this.addToHistory(prevState, event.type, transition.nextState);

    // Шум от DRAG_MOVE исключаем из лога для читаемости
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      if (prevState !== 'DRAGGING' && event.type !== 'DRAG_MOVE' && transition.nextState !== 'DRAGGING') {
        console.log(
          `[FSM:${this.context.tileId}] ${prevState} --[${event.type}]--> ${transition.nextState}`,
          transition.logMessage ? `| ${transition.logMessage}` : ''
        );
      }
    }

    // prevState добавляется здесь, а не в обработчиках, чтобы не дублировать логику
    return {
      ...transition,
      prevState,
    };
  }

  // ============================================================================
  // ГЕТТЕРЫ (Публичный API)
  // ============================================================================

  /**
   * Возвращает текущее состояние автомата.
   */
  public getState(): TileState {
    return this.currentState;
  }

  /**
   * Возвращает текущий контекст плитки.
   */
  public getContext(): TileContext {
    return this.context;
  }

  /**
   * Возвращает копию истории переходов.
   * Копирование защищает внутренний массив от внешней мутации.
   */
  public getHistory() {
    return [...this.history];
  }

  // ============================================================================
  // ТАБЛИЦА ПЕРЕХОДОВ (TRANSITION MATRIX)
  // ============================================================================

  /**
   * Маршрутизирует событие к обработчику текущего состояния.
   *
   * Каждое состояние имеет отдельный метод `handleXxx`, что упрощает
   * тестирование и локализацию логики переходов.
   *
   * @param state - текущее состояние
   * @param event - входящее событие
   * @returns TransitionResult или null если переход не определён
   */
  private getTransition(state: TileState, event: TileEvent): TransitionResult | null {
    switch (state) {
      case 'SPAWNER_IDLE':        return this.handleSpawnerIdle(event);
      case 'INVENTORY_IDLE':      return this.handleInventoryIdle(event);
      case 'DRAGGING':            return this.handleDragging(event);
      case 'SNAPPING':            return this.handleSnapping(event);
      case 'PLACED':              return this.handlePlaced(event);
      case 'RETURNING_TO_SPAWN':  return this.handleReturningToSpawn(event);
      case 'RETURNING_TO_INVENTORY': return this.handleReturningToInventory(event);
      case 'REMOVED':             return null; // Терминальное состояние
      case 'SPAWNER_RETURNING':   return this.handleSpawnerReturning(event);
      default:                    return null;
    }
  }

  // ============================================================================
  // ОБРАБОТЧИКИ СОСТОЯНИЙ
  // ============================================================================

  // -------------------------------------------------------------------------
  // SPAWNER_IDLE: Плитка в спавнере, готова к перетаскиванию
  // -------------------------------------------------------------------------

  /**
   * Обрабатывает события в состоянии SPAWNER_IDLE.
   *
   * Допустимые события: TAKEN_FROM_SPAWN, ROTATE, SYNC_TILE, REMOVE.
   */
  private handleSpawnerIdle(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'TAKEN_FROM_SPAWN':
        return {
          nextState: 'DRAGGING',
          contextUpdates: {
            isInSpawner: false,
            currentCell: undefined,
            isAnimating: false,
          },
          actions: [
            // Мгновенное обновление позиции для немедленной отзывчивости
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.position },
            },
          ],
          logMessage: 'Tile taken from spawner',
        };

      case 'ROTATE':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {},
          actions: [{ type: 'ROTATE_TILE' }],
          logMessage: `Tile rotated to ${this.context.tile?.rotation || 0}°`,
        };

      case 'SYNC_TILE':
        // Обновляем ссылку на объект Tile без смены состояния
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            tile: event.payload.tile,
            tileId: event.payload.tile.id,
          },
          actions: [],
          logMessage: `Tile synced: ${event.payload.tile.id}`,
        };

      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: {},
          actions: [],
          logMessage: 'Tile removed from spawner',
        };

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // INVENTORY_IDLE: Плитка в инвентаре, готова к перетаскиванию
  // -------------------------------------------------------------------------

  /**
   * Обрабатывает события в состоянии INVENTORY_IDLE.
   *
   * Допустимые события: TAKEN_FROM_INVENTORY, ROTATE, SYNC_TILE, REMOVE.
   */
  private handleInventoryIdle(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'TAKEN_FROM_INVENTORY':
        return {
          nextState: 'DRAGGING',
          contextUpdates: {
            isInSpawner: false,
            currentCell: undefined,
            isAnimating: false,
          },
          actions: [
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.position },
            },
          ],
          logMessage: 'Tile taken from inventory',
        };

      case 'ROTATE':
        return {
          nextState: 'INVENTORY_IDLE',
          contextUpdates: {},
          actions: [{ type: 'ROTATE_TILE' }],
          logMessage: `Tile rotated to ${this.context.tile?.rotation || 0}°`,
        };

      case 'SYNC_TILE':
        return {
          nextState: 'INVENTORY_IDLE',
          contextUpdates: {
            tile: event.payload.tile,
            tileId: event.payload.tile.id,
          },
          actions: [],
          logMessage: `Tile synced: ${event.payload.tile.id}`,
        };

      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: {},
          actions: [],
          logMessage: 'Tile removed from inventory',
        };

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // DRAGGING: Плитка перетаскивается пользователем
  // -------------------------------------------------------------------------

  /**
   * Обрабатывает события в состоянии DRAGGING.
   *
   * DRAG_MOVE вызывается ~60 раз/сек — обработчик намеренно минимален.
   * DRAG_END переводит в SNAPPING для поиска целевой ячейки.
   */
  private handleDragging(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'DRAG_MOVE':
        // Остаёмся в DRAGGING, только обновляем позицию мгновенно
        return {
          nextState: 'DRAGGING',
          contextUpdates: {
            position: event.payload,
          },
          actions: [
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: event.payload,
            },
          ],
        };

      case 'DRAG_END':
        // Переходим в SNAPPING — ищем ячейку под плиткой
        return {
          nextState: 'SNAPPING',
          contextUpdates: {
            isAnimating: true,
          },
          actions: [],
          logMessage: 'Drag ended, searching for cell',
        };

      case 'RETURN_TO_SPAWN':
        return this.createReturnToSpawnerTransition('Manual return from drag');

      case 'RESET_TO_SPAWNER':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
            currentCell: undefined,
            targetCell: undefined,
          },
          actions: [
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.spawnerPosition },
            },
            {
              type: 'ANIMATE_SIZE',
              payload: {
                width: this.context.spawnerPosition.width,
                height: this.context.spawnerPosition.height,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
          ],
          logMessage: 'Reset to spawner from dragging (new tile)',
        };

      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: { currentCell: undefined },
          actions: [{ type: 'STOP_ANIMATIONS' }],
          logMessage: 'Tile removed while dragging',
        };

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // SNAPPING: Поиск ячейки после окончания перетаскивания
  // -------------------------------------------------------------------------

  /**
   * Обрабатывает события в состоянии SNAPPING.
   *
   * При CELL_FOUND с `isFree === true` — анимирует snap к ячейке и переходит
   * в PLACED. При занятой ячейке или NO_CELL — возвращает в спавнер.
   */
  private handleSnapping(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'CELL_FOUND':
        if (event.payload.isFree) {
          const scale = event.payload.scale ?? 1;
          const baseSize = event.payload.baseTileSize ?? DEFAULT_TILE_SIZE.width;

          return {
            nextState: 'PLACED',
            contextUpdates: {
              currentCell: { col: event.payload.col, row: event.payload.row },
              targetCell: { col: event.payload.col, row: event.payload.row },
              isAnimating: true,
              isInSpawner: false,
            },
            actions: [
              {
                type: 'ANIMATE_TO_POSITION',
                payload: {
                  col: event.payload.col,
                  row: event.payload.row,
                  x: 0,
                  y: 0,
                  duration: DEFAULT_TILE_CONFIG.animationDuration,
                  baseTileSize: baseSize,
                },
              },
              {
                type: 'ANIMATE_SIZE',
                payload: {
                  // Размер плитки с учётом текущего zoom-масштаба
                  width: baseSize * scale,
                  height: baseSize * scale,
                  duration: DEFAULT_TILE_CONFIG.animationDuration,
                },
              },
            ],
            logMessage: `Snapped to cell (${event.payload.col}, ${event.payload.row})`,
          };
        } else {
          // Ячейка занята — возврат в спавнер
          return this.createReturnToSpawnerTransition('Cell occupied');
        }

      case 'NO_CELL':
        return this.createReturnToSpawnerTransition('No cell found');

      case 'ANIMATION_COMPLETE':
        // Страховка на случай потери CELL_FOUND/NO_CELL
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
          },
          actions: [],
          logMessage: 'Snap animation completed, returned to spawner',
        };

      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: { currentCell: undefined },
          actions: [{ type: 'STOP_ANIMATIONS' }],
          logMessage: 'Tile removed during snap',
        };

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // PLACED: Плитка успешно размещена в ячейке
  // -------------------------------------------------------------------------

  /**
   * Обрабатывает события в состоянии PLACED.
   *
   * Поддерживает возврат в спавнер/инвентарь, удаление и сброс для новой плитки.
   */
  private handlePlaced(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'RETURN_TO_SPAWN':
        return {
          nextState: 'RETURNING_TO_SPAWN',
          contextUpdates: {
            currentCell: undefined,
            isAnimating: true,
            targetPosition: this.context.spawnerPosition,
          },
          actions: [
            {
              type: 'ANIMATE_TO_POSITION',
              payload: {
                x: this.context.spawnerPosition.x,
                y: this.context.spawnerPosition.y,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
            // Освобождаем ячейку одновременно с началом анимации
            {
              type: 'CALLBACK',
              payload: () => this.releaseCell(),
            },
          ],
          logMessage: 'Returning placed tile to spawner',
        };

      case 'RETURNED_TO_SPAWNER':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
            currentCell: undefined,
            targetCell: undefined,
          },
          actions: [
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.spawnerPosition },
            },
            {
              type: 'ANIMATE_SIZE',
              payload: {
                width: this.context.spawnerPosition.width,
                height: this.context.spawnerPosition.height,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
          ],
          logMessage: 'Returned to spawner (failed placement), ready for drag',
        };

      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: { currentCell: undefined },
          actions: [
            { type: 'CALLBACK', payload: () => this.releaseCell() },
          ],
          logMessage: 'Tile removed from grid',
        };

      case 'ANIMATION_COMPLETE':
        // Анимация snap завершена — снимаем флаг без смены состояния
        return {
          nextState: 'PLACED',
          contextUpdates: { isAnimating: false },
          actions: [],
          logMessage: 'Placement animation completed',
        };

      case 'RESET_TO_SPAWNER':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
            currentCell: undefined,
            targetCell: undefined,
          },
          actions: [
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.spawnerPosition },
            },
            {
              type: 'ANIMATE_SIZE',
              payload: {
                width: this.context.spawnerPosition.width,
                height: this.context.spawnerPosition.height,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
          ],
          logMessage: 'Reset to spawner for new tile (size + position)',
        };

      case 'RETURN_TO_INVENTORY':
        return {
          nextState: 'RETURNING_TO_INVENTORY',
          contextUpdates: {
            currentCell: undefined,
            isAnimating: true,
            // targetPosition будет перезаписана в useDraggable до начала анимации
            targetPosition: this.context.spawnerPosition,
          },
          actions: [
            {
              type: 'ANIMATE_TO_POSITION',
              payload: {
                x: this.context.spawnerPosition.x,
                y: this.context.spawnerPosition.y,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
          ],
          logMessage: 'Returning tile to inventory',
        };

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // RETURNING_TO_SPAWN: Плитка возвращается в спавнер
  // -------------------------------------------------------------------------

  /**
   * Обрабатывает события в состоянии RETURNING_TO_SPAWN.
   *
   * Ожидает ANIMATION_COMPLETE для перехода в SPAWNER_IDLE.
   * NO_CELL перезапускает анимацию возврата (повторный вызов при потере события).
   */
  private handleReturningToSpawn(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'ANIMATION_COMPLETE':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
            currentCell: undefined,
            targetCell: undefined,
          },
          actions: [],
          logMessage: 'Returned to spawner, now idle',
        };

      case 'NO_CELL':
        // Повторно запускаем анимацию — страховка при потере предыдущего события
        return {
          nextState: 'RETURNING_TO_SPAWN',
          contextUpdates: {
            currentCell: undefined,
            isAnimating: true,
            targetPosition: this.context.spawnerPosition,
          },
          actions: [
            {
              type: 'ANIMATE_TO_POSITION',
              payload: {
                x: this.context.spawnerPosition.x,
                y: this.context.spawnerPosition.y,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
            {
              type: 'ANIMATE_SIZE',
              payload: {
                width: this.context.spawnerPosition.width,
                height: this.context.spawnerPosition.height,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
          ],
          logMessage: 'Returning to spawner: No cell found',
        };

      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: { isAnimating: false },
          actions: [{ type: 'STOP_ANIMATIONS' }],
          logMessage: 'Tile removed while returning',
        };

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // RETURNING_TO_INVENTORY: Плитка возвращается в инвентарь
  // -------------------------------------------------------------------------

  /**
   * Обрабатывает события в состоянии RETURNING_TO_INVENTORY.
   *
   * Ожидает ANIMATION_COMPLETE для перехода в INVENTORY_IDLE.
   */
  private handleReturningToInventory(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'ANIMATION_COMPLETE':
        return {
          nextState: 'INVENTORY_IDLE',
          contextUpdates: {
            isInSpawner: false,
            isAnimating: false,
            currentCell: undefined,
            targetCell: undefined,
          },
          actions: [],
          logMessage: 'Returned to inventory, now idle',
        };

      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: { isAnimating: false },
          actions: [{ type: 'STOP_ANIMATIONS' }],
          logMessage: 'Tile removed while returning to inventory',
        };

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // SPAWNER_RETURNING: Промежуточное состояние возврата
  // -------------------------------------------------------------------------

  /**
   * Делегирует обработку в `handleReturningToSpawn` во избежание дублирования.
   */
  private handleSpawnerReturning(event: TileEvent): TransitionResult | null {
    return this.handleReturningToSpawn(event);
  }

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================================

  /**
   * Создаёт стандартный TransitionResult для возврата плитки в спавнер.
   *
   * Используется несколькими обработчиками (DRAGGING, SNAPPING) для
   * единообразного поведения без дублирования объектов переходов.
   *
   * @param reason - причина возврата (только для лога)
   * @returns TransitionResult с переходом в RETURNING_TO_SPAWN
   */
  private createReturnToSpawnerTransition(reason: string): TransitionResult {
    return {
      nextState: 'RETURNING_TO_SPAWN',
      contextUpdates: {
        currentCell: undefined,
        isAnimating: true,
        targetPosition: this.context.spawnerPosition,
      },
      actions: [
        {
          type: 'ANIMATE_TO_POSITION',
          payload: {
            x: this.context.spawnerPosition.x,
            y: this.context.spawnerPosition.y,
            duration: DEFAULT_TILE_CONFIG.animationDuration,
          },
        },
      ],
      logMessage: `Returning to spawner: ${reason}`,
    };
  }

  /**
   * Логирует освобождение ячейки сетки в dev-режиме.
   *
   * Точка расширения: здесь можно добавить вызов GridService.releaseCell(),
   * если потребуется синхронизация прямо из FSM.
   */
  private releaseCell() {
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      console.log(`[FSM:${this.context.tileId}] Cell released`);
    }
  }

  /**
   * Добавляет запись о переходе в историю с автоматическим вытеснением старых.
   *
   * При превышении `logHistoryLimit` удаляет самую старую запись (FIFO).
   *
   * @param from  - состояние до перехода
   * @param event - тип события, вызвавшего переход
   * @param to    - состояние после перехода
   */
  private addToHistory(from: TileState, event: string, to: TileState) {
    this.history.push({
      fromState: from,
      event: event as TileEvent['type'],
      toState: to,
      timestamp: Date.now(),
    });

    // Вытесняем самую старую запись при достижении лимита
    const limit = DEFAULT_TILE_CONFIG.logHistoryLimit ?? 50;
    if (this.history.length > limit) {
      this.history.shift();
    }
  }
}

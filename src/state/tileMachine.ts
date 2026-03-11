// ============================================================================
// МАШИНА СОСТОЯНИЙ ПЛИТКИ (FSM)
// ============================================================================
// Этот класс реализует конечный автомат для управления жизненным циклом плитки.
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
export class TileStateMachine {
  // Контекст хранит все данные плитки: позицию, размер, привязку к ячейке
  private context: TileContext;
  
  // Текущее состояние автомата — изменяется только через send()
  private currentState: TileState;
  
  // История переходов — для отладки и потенциального восстановления состояния
  // Хранит не более 50 записей чтобы не занимать память
  private history: Array<{
    fromState: TileState;
    event: TileEvent['type'];
    toState: TileState;
    timestamp: number;
  }> = [];

  // ============================================================================
  // КОНСТРУКТОР
  // ============================================================================
  // Инициализирует машину с начальным контекстом.
  // Начальное состояние определяется по флагу isInSpawner.
  // ============================================================================
  constructor(initialContext: TileContext) {
    this.context = initialContext;
    // 🔥 Определяем начальное состояние: если плитка в спавнере — ждёт драга
    this.currentState = initialContext.initialState ?? (
      initialContext.isInSpawner ? 'SPAWNER_IDLE' : 'DRAGGING'
    );
    
    // Логирование только в режиме разработки
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      console.log(`[FSM:${initialContext.tileId}] Initialized in ${this.currentState}`);
    }
  }

  // ============================================================================
  // ГЛАВНЫЙ МЕТОД: ОТПРАВКА СОБЫТИЯ
  // ============================================================================
  // Единственный публичный способ изменить состояние машины.
  // Все события проходят через этот метод — это гарантирует предсказуемость.
  // ============================================================================
  public send(event: TileEvent): TransitionResult | null {
    // 🔥 Сохраняем состояние ДО обработки — нужно для сравнения и отладки
    const prevState = this.currentState;
    
    // Получаем переход на основе текущего состояния и события
    const transition = this.getTransition(prevState, event);
    
    // Если переход не найден — событие игнорируется (невалидная комбинация state/event)
    if (!transition) {
      if (FEATURE_FLAGS.LOG_TRANSITIONS) {
        console.warn(
          `[FSM:${this.context.tileId}] Ignored event "${event.type}" in state "${prevState}"`
        );
      }
      return null;
    }
    
    // Обновляем текущее состояние на новое из перехода
    this.currentState = transition.nextState;
    
    // Обновляем контекст: старые данные + новые из contextUpdates
    // Spread-оператор гарантирует что не указанные поля сохранятся
    this.context = { ...this.context, ...transition.contextUpdates };
    
    // Записываем переход в историю (для отладки)
    this.addToHistory(prevState, event.type, transition.nextState);
    
    // Логирование перехода (только в режиме разработки)
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      if (prevState != "DRAGGING" && event.type != "DRAG_MOVE" && transition.nextState != "DRAGGING") {
        console.log(
          `[FSM:${this.context.tileId}] ${prevState} --[${event.type}]--> ${transition.nextState}`,
          transition.logMessage ? `| ${transition.logMessage}` : ''
        );
      }
    }
    
    // Возвращаем prevState вместе с результатом
    // Это нужно хуку useTileMachine чтобы определить изменилось ли состояние
    // и нужно ли вызывать setCurrentState для ре-рендера React-компонента
    return {
      ...transition,
      prevState,
    };
  }

  // ============================================================================
  // ГЕТТЕРЫ (Публичный API)
  // ============================================================================
  // Эти методы используются внешним кодом для получения информации о машине.
  // ============================================================================

  public getState(): TileState {
    return this.currentState;
  }

  public getContext(): TileContext {
    return this.context;
  }

  // Возвращает копию истории чтобы внешний код не мог её изменить
  public getHistory() {
    return [...this.history];
  }

  // ============================================================================
  // ТАБЛИЦА ПЕРЕХОДОВ (TRANSITION MATRIX)
  // ============================================================================
  // Маршрутизирует событие к соответствующему обработчику состояния.
  // Каждый state имеет свой метод handleXxx — это упрощает тестирование.
  // ============================================================================
  private getTransition(state: TileState, event: TileEvent): TransitionResult | null {
    switch (state) {
      case 'SPAWNER_IDLE':
        return this.handleSpawnerIdle(event);

      case 'INVENTORY_IDLE':
        return this.handleInventoryIdle(event);
      
      case 'DRAGGING':
        return this.handleDragging(event);
      
      case 'SNAPPING':
        return this.handleSnapping(event);
      
      case 'PLACED':
        return this.handlePlaced(event);
      
      case 'RETURNING_TO_SPAWN':
        return this.handleReturningToSpawn(event);

      case 'RETURNING_TO_INVENTORY':
        return this.handleReturningToInventory(event);
      
      // Терминальное состояние — плитка удалена, переходы невозможны
      case 'REMOVED':
        return null;
      
      // Промежуточное состояние — делегируем основному обработчику
      case 'SPAWNER_RETURNING':
        return this.handleSpawnerReturning(event);
      
      default:
        // Неизвестное состояние — игнорируем событие для безопасности
        return null;
    }
  }

  // ============================================================================
  // ОБРАБОТЧИКИ СОСТОЯНИЙ
  // ============================================================================
  // Каждый метод обрабатывает события только для своего состояния.
  // Возвращает TransitionResult или null если событие неприменимо.
  // ============================================================================

  // -------------------------------------------------------------------------
  // SPAWNER_IDLE: Плитка в спавнере, готова к перетаскиванию
  // -------------------------------------------------------------------------
  private handleSpawnerIdle(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      // Пользователь начал перетаскивание
      case 'TAKEN_FROM_SPAWN':
        return {
          nextState: 'DRAGGING',
          contextUpdates: {
            isInSpawner: false,      // Плитка больше не в спавнере
            currentCell: undefined,  // Очищаем привязку к ячейке
            isAnimating: false,      // Анимация не требуется
          },
          actions: [
            // Мгновенно обновляем позицию для отзывчивости во время драга
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
          actions: [
            {
              type: 'ROTATE_TILE',
            },
          ],
          logMessage: `Tile rotated to ${this.context.tile?.rotation || 0}°`,
        };

      case 'SYNC_TILE':
        return {
          nextState: 'SPAWNER_IDLE',  // Остаёмся в том же состоянии
          contextUpdates: {
            tile: event.payload.tile,  // Обновляем ссылку на плитку в контексте
            tileId: event.payload.tile.id,
          },
          actions: [],
          logMessage: `Tile synced: ${event.payload.tile.id}`,
        };
      
      // Принудительное удаление плитки
      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: {},
          actions: [],
          logMessage: 'Tile removed from spawner',
        };
      
      // Другие события игнорируются в этом состоянии
      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // INVENTORY_IDLE: Плитка в инвентаре, готова к перетаскиванию
  // -------------------------------------------------------------------------
  private handleInventoryIdle(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      // Пользователь начал перетаскивание из инвентаря
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
      
      // Поворот плитки тапом (как в спавнере)
      case 'ROTATE':
        return {
          nextState: 'INVENTORY_IDLE',
          contextUpdates: {},
          actions: [
            {
              type: 'ROTATE_TILE',
            },
          ],
          logMessage: `Tile rotated to ${this.context.tile?.rotation || 0}°`,
        };

      case 'SYNC_TILE':
        return {
          nextState: 'INVENTORY_IDLE',  // Остаёмся в том же состоянии
          contextUpdates: {
            tile: event.payload.tile,  // Обновляем ссылку на плитку в контексте
            tileId: event.payload.tile.id,
          },
          actions: [],
          logMessage: `Tile synced: ${event.payload.tile.id}`,
        };
      
      // Принудительное удаление
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
  private handleDragging(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      // Пользователь перемещает плитку (~60 раз в секунду)
      case 'DRAG_MOVE':
        return {
          nextState: 'DRAGGING',  // Остаёмся в том же состоянии
          contextUpdates: {
            position: event.payload,  // Обновляем позицию на новые координаты
          },
          actions: [
            // Мгновенное обновление позиции без анимации для максимальной отзывчивости
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: event.payload,
            },
          ],
          //logMessage: `Dragging to (${event.payload.x}, ${event.payload.y})`,
        };
      
      // Пользователь отпустил плитку — начинаем поиск ячейки
      case 'DRAG_END':
        return {
          nextState: 'SNAPPING',  // Переходим в состояние поиска
          contextUpdates: {
            isAnimating: true,  // Включаем флаг анимации
          },
          actions: [],  // Действия будут в handleSnapping
          logMessage: 'Drag ended, searching for cell',
        };
      
      // Принудительный возврат в спавнер (например, по таймауту)
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
            // Мгновенно перемещаем в позицию спавнера
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.spawnerPosition },
            },
            // Анимируем размер к размеру спавнера
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

      // Удаление плитки во время драга
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
  private handleSnapping(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      // Найдена ячейка под плиткой
      case 'CELL_FOUND':
        // Проверяем свободна ли ячейка
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
              // Анимируем позицию к центру найденной ячейки
              {
                type: 'ANIMATE_TO_POSITION',
                payload: {
                  col: event.payload.col,
                  row: event.payload.row,
                  x: 0,  // x/y не нужны если указаны col/row
                  y: 0,
                  duration: DEFAULT_TILE_CONFIG.animationDuration,
                  baseTileSize: baseSize,  // Для расчёта позиции через GridService
                },
              },
              // Анимируем размер к размеру ячейки с учётом текущего scale
              {
                type: 'ANIMATE_SIZE',
                payload: {
                  width: baseSize * scale,  // 🔥 Базовый размер * масштаб
                  height: baseSize * scale,
                  duration: DEFAULT_TILE_CONFIG.animationDuration,
                },
              },
            ],
            logMessage: `Snapped to cell (${event.payload.col}, ${event.payload.row})`,
          };
        } else {
          // Ячейка занята — возвращаем в спавнер
          return this.createReturnToSpawnerTransition('Cell occupied');
        }
      
      // Ячейка не найдена — возвращаем в спавнер
      case 'NO_CELL':
        return this.createReturnToSpawnerTransition('No cell found');
      
      // Fallback: если анимация завершилась без явного CELL_FOUND
      // Это страховка на случай если событие потерялось
      case 'ANIMATION_COMPLETE':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
          },
          actions: [],
          logMessage: 'Snap animation completed, returned to spawner',
        };
      
      // Удаление плитки во время поиска ячейки
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
  private handlePlaced(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      // Возврат размещённой плитки в спавнер (например, по действию пользователя)
      case 'RETURN_TO_SPAWN':
        return {
          nextState: 'RETURNING_TO_SPAWN',
          contextUpdates: {
            currentCell: undefined,  // Очищаем привязку к ячейке
            isAnimating: true,
            targetPosition: this.context.spawnerPosition,  // Целевая позиция
          },
          actions: [
            // Анимируем позицию обратно в спавнер
            {
              type: 'ANIMATE_TO_POSITION',
              payload: {
                x: this.context.spawnerPosition.x,
                y: this.context.spawnerPosition.y,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
            // Освобождаем ячейку в сетке после начала анимации
            {
              type: 'CALLBACK',
              payload: () => this.releaseCell(),
            },
          ],
          logMessage: 'Returning placed tile to spawner',
        };

      // Явный сброс после возврата (для повторной активации плитки)
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
            // Мгновенно перемещаем в позицию спавнера
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.spawnerPosition },
            },
            // Анимируем размер к размеру спавнера
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
      
      // Удаление плитки из сетки
      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: { currentCell: undefined },
          actions: [
            // Освобождаем ячейку перед удалением
            { type: 'CALLBACK', payload: () => this.releaseCell() },
          ],
          logMessage: 'Tile removed from grid',
        };
      
      // Анимация размещения завершена — просто снимаем флаг
      case 'ANIMATION_COMPLETE':
        return {
          nextState: 'PLACED',  // Остаёмся в том же состоянии
          contextUpdates: { isAnimating: false },  // Только снимаем флаг
          actions: [],
          logMessage: 'Placement animation completed',
        };

      // Сброс в спавнер для новой плитки (после размещения предыдущей)
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
            // Мгновенно перемещаем в позицию спавнера
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.spawnerPosition },
            },
            // Анимируем размер к размеру спавнера
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

      // Возврат в инвентарь (после неудачного размещения)  
      case 'RETURN_TO_INVENTORY':
        return {
          nextState: 'RETURNING_TO_INVENTORY',
          contextUpdates: {
            currentCell: undefined,
            isAnimating: true,
            targetPosition: this.context.spawnerPosition,  // Будет перезаписано в useDraggable
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
  private handleReturningToSpawn(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      // Анимация возврата завершена — плитка готова к новому драгу
      case 'ANIMATION_COMPLETE':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
            currentCell: undefined,
            targetCell: undefined,
          },
          actions: [],  // Нет действий — анимация уже завершена
          logMessage: 'Returned to spawner, now idle',
        };
      
      // Возврат из-за занятой ячейки или отсутствия ячейки
      case 'NO_CELL':
        return {
          nextState: 'RETURNING_TO_SPAWN',  // Остаёмся в состоянии возврата
          contextUpdates: {
            currentCell: undefined,
            isAnimating: true,
            targetPosition: this.context.spawnerPosition,
          },
          actions: [
            // Анимируем позицию обратно в спавнер
            {
              type: 'ANIMATE_TO_POSITION',
              payload: {
                x: this.context.spawnerPosition.x,
                y: this.context.spawnerPosition.y,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
            // Анимируем размер к размеру спавнера
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
      
      // Удаление плитки во время возврата
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
  private handleReturningToInventory(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      // Анимация возврата завершена
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
      
      // Удаление во время возврата
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
  // Делегирует обработку основному методу чтобы избежать дублирования кода.
  // -------------------------------------------------------------------------
  private handleSpawnerReturning(event: TileEvent): TransitionResult | null {
    return this.handleReturningToSpawn(event);
  }

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================================

  // Создаёт стандартный переход для возврата в спавнер
  // Выносится в отдельный метод чтобы избежать дублирования кода в handleDragging/handleSnapping
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

  // Освобождает ячейку в сетке при удалении или возврате плитки
  // Вынесено в отдельный метод для централизации логики освобождения
  private releaseCell() {
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      console.log(`[FSM:${this.context.tileId}] Cell released`);
    }
    // Здесь можно добавить вызов GridService.releaseCell() если нужно
  }

  // Добавляет запись о переходе в историю с ограничением размера
  private addToHistory(from: TileState, event: string, to: TileState) {
    this.history.push({
      fromState: from,
      event: event as TileEvent['type'],
      toState: to,
      timestamp: Date.now(),
    });
    
    // Ограничиваем историю чтобы не занимала много памяти
    const limit = DEFAULT_TILE_CONFIG.logHistoryLimit ?? 50;
    if (this.history.length > limit) {
      this.history.shift();  // Удаляем самую старую запись
    }
  }
}
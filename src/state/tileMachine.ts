// src/state/tileMachine.ts

// ============================================================================
// ИМПОРТЫ
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
  private context: TileContext;
  private currentState: TileState;
  private history: Array<{
    fromState: TileState;
    event: TileEvent['type'];
    toState: TileState;
    timestamp: number;
  }> = [];

  // ============================================================================
  // КОНСТРУКТОР
  // ============================================================================
  constructor(initialContext: TileContext) {
    this.context = initialContext;
    this.currentState = initialContext.isInSpawner ? 'SPAWNER_IDLE' : 'DRAGGING';
    
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      console.log(`[FSM:${initialContext.tileId}] Initialized in ${this.currentState}`);
    }
  }

  // ============================================================================
  // ГЛАВНЫЙ МЕТОД: ОТПРАВКА СОБЫТИЯ
  // ============================================================================
  public send(event: TileEvent): TransitionResult | null {
    const prevState = this.currentState;
    
    // Получаем переход
    const transition = this.getTransition(prevState, event);
    
    if (!transition) {
      if (FEATURE_FLAGS.LOG_TRANSITIONS) {
        console.warn(
          `[FSM:${this.context.tileId}] Ignored event "${event.type}" in state "${prevState}"`
        );
      }
      return null;
    }
    
    // Обновляем состояние
    this.currentState = transition.nextState;
    
    // Применяем обновления контекста
    this.context = { ...this.context, ...transition.contextUpdates };
    
    // Записываем в историю
    this.addToHistory(prevState, event.type, transition.nextState);
    
    // Логирование
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      console.log(
        `[FSM:${this.context.tileId}] ${prevState} --[${event.type}]--> ${transition.nextState}`,
        transition.logMessage ? `| ${transition.logMessage}` : ''
      );
    }
    
    return transition;
  }

  // ============================================================================
  // ПОЛУЧЕНИЕ ТЕКУЩЕГО СОСТОЯНИЯ
  // ============================================================================
  public getState(): TileState {
    return this.currentState;
  }

  // ============================================================================
  // ПОЛУЧЕНИЕ КОНТЕКСТА
  // ============================================================================
  public getContext(): TileContext {
    return this.context;
  }

  // ============================================================================
  // ПОЛУЧЕНИЕ ИСТОРИИ (для отладки)
  // ============================================================================
  public getHistory() {
    return [...this.history];
  }

  // ============================================================================
  // ТАБЛИЦА ПЕРЕХОДОВ (TRANSITION MATRIX)
  // ============================================================================
  private getTransition(state: TileState, event: TileEvent): TransitionResult | null {
    switch (state) {
      // -------------------------------------------------------------------------
      // SPAWNER_IDLE
      // -------------------------------------------------------------------------
      case 'SPAWNER_IDLE':
        return this.handleSpawnerIdle(event);
      
      // -------------------------------------------------------------------------
      // DRAGGING
      // -------------------------------------------------------------------------
      case 'DRAGGING':
        return this.handleDragging(event);
      
      // -------------------------------------------------------------------------
      // SNAPPING
      // -------------------------------------------------------------------------
      case 'SNAPPING':
        return this.handleSnapping(event);
      
      // -------------------------------------------------------------------------
      // PLACED
      // -------------------------------------------------------------------------
      case 'PLACED':
        return this.handlePlaced(event);
      
      // -------------------------------------------------------------------------
      // RETURNING_TO_SPAWN
      // -------------------------------------------------------------------------
      case 'RETURNING_TO_SPAWN':
        return this.handleReturningToSpawn(event);
      
      // -------------------------------------------------------------------------
      // REMOVED (терминальное состояние)
      // -------------------------------------------------------------------------
      case 'REMOVED':
        return null;
      
      // -------------------------------------------------------------------------
      // SPAWNER_RETURNING (промежуточное)
      // -------------------------------------------------------------------------
      case 'SPAWNER_RETURNING':
        return this.handleSpawnerReturning(event);
      
      default:
        return null;
    }
  }

  // ============================================================================
  // ОБРАБОТЧИКИ СОСТОЯНИЙ
  // ============================================================================

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
            {
              type: 'UPDATE_POSITION_IMMEDIATE',
              payload: { ...this.context.position },
            },
          ],
          logMessage: 'Tile taken from spawner',
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

  private handleDragging(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'DRAG_MOVE':
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
          logMessage: `Dragging to (${event.payload.x}, ${event.payload.y})`,
        };
      
      case 'DRAG_END':
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
                  width: baseSize * scale,  // 🔥 Базовый размер * scale
                  height: baseSize * scale,
                  duration: DEFAULT_TILE_CONFIG.animationDuration,
                },
              },
            ],
            logMessage: `Snapped to cell (${event.payload.col}, ${event.payload.row})`,
          };
        } else {
          return this.createReturnToSpawnerTransition('Cell occupied');
        }
      
      case 'NO_CELL':
        return this.createReturnToSpawnerTransition('No cell found');
      
      case 'ANIMATION_COMPLETE':
        // Fallback: если анимация завершилась без явного CELL_FOUND
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
            {
              type: 'CALLBACK',
              payload: () => this.releaseCell(),
            },
          ],
          logMessage: 'Returning placed tile to spawner',
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
      
      // 🔥 Игнорируем ANIMATION_COMPLETE в PLACED (анимация уже завершена)
      case 'ANIMATION_COMPLETE':
        return {
          nextState: 'PLACED',
          contextUpdates: { isAnimating: false },
          actions: [],
          logMessage: 'Placement animation completed',
        };
      
      default:
        return null;
    }
  }

  private handleReturningToSpawn(event: TileEvent): TransitionResult | null {
    switch (event.type) {
      case 'ANIMATION_COMPLETE':
        return {
          nextState: 'SPAWNER_IDLE',
          contextUpdates: {
            isInSpawner: true,
            isAnimating: false,
            position: {
              x: this.context.spawnerPosition.x,
              y: this.context.spawnerPosition.y,
            },
          },
          actions: [
            {
              type: 'ANIMATE_SIZE',
              payload: {
                width: this.context.spawnerPosition.width,
                height: this.context.spawnerPosition.height,
                duration: DEFAULT_TILE_CONFIG.animationDuration,
              },
            },
          ],
          logMessage: 'Returned to spawner, now idle',
        };
      
      case 'REMOVE':
        return {
          nextState: 'REMOVED',
          contextUpdates: { isAnimating: false },
          actions: [{ type: 'STOP_ANIMATIONS' }],
          logMessage: 'Tile removed while returning to spawner',
        };
      
      default:
        return null;
    }
  }

  private handleSpawnerReturning(event: TileEvent): TransitionResult | null {
    // Промежуточное состояние, обычно переходит в SPAWNER_IDLE
    return this.handleReturningToSpawn(event);
  }

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================================

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

  private releaseCell() {
    if (FEATURE_FLAGS.LOG_TRANSITIONS) {
      console.log(`[FSM:${this.context.tileId}] Cell released`);
    }
    // Здесь можно вызвать колбэк для освобождения ячейки в сетке
  }

  private addToHistory(from: TileState, event: string, to: TileState) {
    this.history.push({
      fromState: from,
      event: event as TileEvent['type'],
      toState: to,
      timestamp: Date.now(),
    });
    
    // Ограничиваем историю
    const limit = DEFAULT_TILE_CONFIG.logHistoryLimit;
    if (this.history.length > limit) {
      this.history.shift();
    }
  }
}
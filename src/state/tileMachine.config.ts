// src/state/tileMachine.config.ts

// ============================================================================
// ИМПОРТЫ ТИПОВ (из той же папки)
// ============================================================================
import { TileMachineConfig, TileEvent } from './tileMachine.types';

// ============================================================================
// КОНФИГУРАЦИЯ ПО УМОЛЧАНИЮ
// ============================================================================
export const DEFAULT_TILE_CONFIG: TileMachineConfig = {
  animationDuration: 300,      // ms
  snapThreshold: 50,           // pixels
  dragMoveDebounce: 0,         // 0 = отключено
  debugMode: process.env.NODE_ENV !== 'production',
  logHistoryLimit: 50,
  animationTension: 35,
  animationFriction: 8,
};

// ============================================================================
// ХЕЛПЕР ДЛЯ СЛИЯНИЯ КОНФИГОВ
// ============================================================================
export const createTileConfig = (
  overrides: Partial<TileMachineConfig> = {}
): TileMachineConfig => ({
  ...DEFAULT_TILE_CONFIG,
  ...overrides,
});

// ============================================================================
// FEATURE FLAGS
// ============================================================================
export const FEATURE_FLAGS = {
  USE_TILE_FSM: process.env.USE_TILE_FSM === 'true' || process.env.NODE_ENV !== 'production',
  SHOW_TILE_DEBUG: process.env.NODE_ENV !== 'production',
  LOG_TRANSITIONS: process.env.NODE_ENV !== 'production',
};

// ============================================================================
// TYPE GUARDS
// ============================================================================
export const isDragEvent = (
  event: TileEvent
): event is Extract<TileEvent, { type: 'DRAG_MOVE' | 'DRAG_END' }> => {
  return event.type === 'DRAG_MOVE' || event.type === 'DRAG_END';
};

export const isCellEvent = (
  event: TileEvent
): event is Extract<TileEvent, { type: 'CELL_FOUND' }> => {
  return event.type === 'CELL_FOUND';
};

export const hasPayload = <T extends TileEvent['type']>(
  event: TileEvent,
  type: T
): event is Extract<TileEvent, { type: T } & { payload: any }> => {
  return event.type === type && 'payload' in event;
};
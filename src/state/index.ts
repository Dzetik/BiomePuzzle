// src/state/index.ts

// Типы
export type {
  TileState,
  TileEvent,
  TileContext,
  MachineAction,
  TransitionResult,
  TileMachineConfig,
  SendResult,
  UseTileMachineOptions,
} from './tileMachine.types';

// Константы и конфиг
export {
  DEFAULT_TILE_CONFIG,
  createTileConfig,
  FEATURE_FLAGS,
  isDragEvent,
  isCellEvent,
  hasPayload,
} from './tileMachine.config';

export { TileStateMachine } from './tileMachine';

//export { useTileMachine } from '../hooks/useTileMachine';
//export type { UseTileMachineReturn } from '../hooks/useTileMachine';
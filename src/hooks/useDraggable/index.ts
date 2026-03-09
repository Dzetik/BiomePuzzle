// src/hooks/useDraggable/index.ts

// ============================================================================
// АДАПТЕР ДЛЯ ПОСТЕПЕННОЙ МИГРАЦИИ
// ============================================================================

import { FEATURE_FLAGS } from '../../state';
import { useDraggableLegacy } from './useDraggable.legacy';
import { useDraggableFSM } from './useDraggable.fsm';

// ============================================================================
// ТИПЫ
// ============================================================================
export interface UseDraggableReturn {
  position: any;
  width: any;
  height: any;
  panHandlers: any;
  isInSpawner: boolean;
  state?: string;
  send?: (event: any) => void;
  debug?: any;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================================
export const useDraggable = (
  initialTileData: any = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null,
  onPlaced?: (cell: { col: number; row: number }) => void
): UseDraggableReturn => {
  
  const useFSM = FEATURE_FLAGS.USE_TILE_FSM;
  
  if (useFSM) {
    return useDraggableFSM(
      initialTileData, 
      tileId, 
      externalInitialPosition, 
      onPlaced  
    );
  }
  
  return useDraggableLegacy(initialTileData, tileId, externalInitialPosition);
};

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================
export { useDraggableLegacy, useDraggableFSM };
export default useDraggable;
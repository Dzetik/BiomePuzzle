// ============================================================================
// АДАПТЕР ДЛЯ useDraggableFSM
// ============================================================================
// Этот файл предоставляет упрощённый интерфейс для использования хука.
// Все параметры передаются напрямую в useDraggableFSM.
// ============================================================================

import { TileEvent, TileState } from '../../state';
import { useDraggableFSM } from './useDraggable.fsm';
import { Tile } from '../../models/Tile';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface UseDraggableReturn {
  position: { x: number; y: number };
  width: number;
  height: number;
  gesture: any;  // Gesture из react-native-gesture-handler
  rotation: number;
  isInSpawner: boolean;
  isInInventory: boolean;
  state: TileState;
  send: (event: TileEvent) => void;
  debug?: {
    isInSpawner: boolean;
    currentCell?: { col: number; row: number };
    position: { x: number; y: number };
    fsmState: TileState;
  } | null;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ (адаптер)
// ============================================================================
// Принимает все параметры и передаёт их в useDraggableFSM.
// ============================================================================

export const useDraggable = (
  initialTileData: Tile | null = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null,
  onPlaced?: (
    cell: { col: number; row: number },
    tile?: Tile  
  ) => void,
  onReturned?: () => void,
  source: 'SPAWNER' | 'INVENTORY' = 'SPAWNER',  
  onDroppedInInventory?: () => void,
): UseDraggableReturn => {
  return useDraggableFSM(
    initialTileData,
    tileId,
    externalInitialPosition,
    onPlaced,
    onReturned,
    source,
    onDroppedInInventory  
  );
};

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================

export { useDraggableFSM };
export { createDraggableGestures } from './useDraggable.gestures';
export default useDraggable;
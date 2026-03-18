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
  gesture: any;
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
// ГЛАВНАЯ ФУНКЦИЯ (адаптер) — ИСПРАВЛЕННАЯ СИГНАТУРА
// ============================================================================

export const useDraggable = (
  initialTileData: Tile | null = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null,
  onPlaced?: (cell: { col: number; row: number }, tile?: Tile) => void,
  onReturned?: () => void,
  source: 'SPAWNER' | 'INVENTORY' = 'SPAWNER',  // 👈 6-й параметр, как в useDraggableFSM
  onDroppedInInventory?: () => boolean,          // 👈 7-й параметр
  onRotate?: (tileId: string) => void,           // 👈 8-й параметр — НОВЫЙ!
): UseDraggableReturn => {
  
  if (__DEV__ && onRotate) {
    console.log(`[useDraggable index] ✅ onRotate received for source=${source}`);
  }

  // Передаём ВСЕ 8 параметров в useDraggableFSM в правильном порядке
  return useDraggableFSM(
    initialTileData,
    tileId,
    externalInitialPosition,
    onPlaced,
    onReturned,
    source,                    // 👈 6
    onDroppedInInventory,      // 👈 7
    onRotate                   // 👈 8 — КЛЮЧЕВОЙ ФИКС!
  );
};

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================

export { useDraggableFSM };
export { createDraggableGestures } from './useDraggable.gestures';
export default useDraggable;
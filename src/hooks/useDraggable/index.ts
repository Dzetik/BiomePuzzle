// src/hooks/useDraggable/index.ts

// ============================================================================
// АДАПТЕР ДЛЯ ПОСТЕПЕННОЙ МИГРАЦИИ
// ============================================================================

import { TileEvent, TileState } from '../../state';
import { useDraggableFSM } from './useDraggable.fsm';

// ============================================================================
// ТИПЫ
// ============================================================================
export interface UseDraggableReturn {
  position: { x: number; y: number };
  width: number;
  height: number;
  
  // ← НОВОЕ: составной жест (заменяет panHandlers)
  gesture: any;  // Тип Gesture из react-native-gesture-handler
  
  // ← НОВОЕ: текущий угол поворота плитки
  rotation: number;
  
  isInSpawner: boolean;
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
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================================
export const useDraggable = (
  initialTileData: any = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null,
  onPlaced?: (cell: { col: number; row: number }) => void
): UseDraggableReturn => {
  // 🔥 Всегда используем FSM — legacy удалён
  return useDraggableFSM(initialTileData, tileId, externalInitialPosition, onPlaced);
};

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================
// Главный хук
export { useDraggableFSM } from './useDraggable.fsm';

// ← НОВОЕ: экспорт функции жестов для переиспользования
export { createDraggableGestures } from './useDraggable.gestures';

// Default export для обратной совместимости
export { useDraggableFSM as default } from './useDraggable.fsm';
// src/hooks/useDraggable/index.ts

// ============================================================================
// АДАПТЕР ДЛЯ ПОСТЕПЕННОЙ МИГРАЦИИ
// ============================================================================

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
  // 🔥 Всегда используем FSM — legacy удалён
  return useDraggableFSM(initialTileData, tileId, externalInitialPosition, onPlaced);
};

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================
export { useDraggableFSM };
export default useDraggable;
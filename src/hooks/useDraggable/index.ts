// ============================================================================
// АДАПТЕР ДЛЯ useDraggableFSM
// ============================================================================
// Предоставляет упрощённый публичный интерфейс для использования хука.
// Все параметры передаются напрямую в useDraggableFSM.
// ============================================================================

import { TileEvent, TileState } from '../../state';
import { useDraggableFSM } from './useDraggable.fsm';
import { Tile } from '../../models/Tile';

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Возвращаемое значение хука `useDraggable`.
 *
 * Содержит текущую позицию плитки, её размеры, составной жест для GestureDetector,
 * угол поворота, флаги местонахождения и прямой доступ к FSM.
 */
export interface UseDraggableReturn {
  /** Текущая экранная позиция плитки (верхний левый угол). */
  position: { x: number; y: number };
  /** Текущая ширина плитки в пикселях (изменяется при snap-анимации). */
  width: number;
  /** Текущая высота плитки в пикселях. */
  height: number;
  /** Составной жест (Pan + Tap) для привязки к GestureDetector. */
  gesture: any;
  /** Текущий угол поворота плитки в градусах (0, 90, 180, 270). */
  rotation: number;
  /** true пока плитка находится в спавнере или возвращается в него. */
  isInSpawner: boolean;
  /** true пока плитка находится в инвентаре или возвращается в него. */
  isInInventory: boolean;
  /** Текущее состояние FSM. */
  state: TileState;
  /** Прямая отправка события в FSM (для принудительных переходов). */
  send: (event: TileEvent) => void;
  /** Отладочные данные FSM или null в prod-сборке. */
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

/**
 * Хук перетаскивания плитки — тонкий адаптер над `useDraggableFSM`.
 *
 * Единая точка входа для компонентов: скрывает внутренние детали FSM и
 * прокидывает все параметры в `useDraggableFSM` в корректном порядке.
 *
 * @param initialTileData          - объект плитки для инициализации (для инвентарных плиток)
 * @param tileId                   - идентификатор плитки (если не задан в initialTileData)
 * @param externalInitialPosition  - начальная экранная позиция (передаётся из InventoryCell)
 * @param onPlaced                 - колбэк при успешном размещении на сетке
 * @param onReturned               - колбэк при возврате плитки в исходную зону
 * @param source                   - источник плитки: 'SPAWNER' или 'INVENTORY'
 * @param onDroppedInInventory     - колбэк для плитки спавнера, упавшей в зону инвентаря
 * @param onRotate                 - колбэк поворота плитки по тапу
 * @returns UseDraggableReturn
 */
export const useDraggable = (
  initialTileData: Tile | null = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null,
  onPlaced?: (cell: { col: number; row: number }, tile?: Tile) => void,
  onReturned?: () => void,
  source: 'SPAWNER' | 'INVENTORY' = 'SPAWNER',
  onDroppedInInventory?: () => boolean,
  onRotate?: (tileId: string) => void,
): UseDraggableReturn => {

  if (__DEV__ && onRotate) {
    console.log(`[useDraggable] onRotate received for source=${source}`);
  }

  // Передаём все параметры в useDraggableFSM строго по порядку
  return useDraggableFSM(
    initialTileData,
    tileId,
    externalInitialPosition,
    onPlaced,
    onReturned,
    source,
    onDroppedInInventory,
    onRotate
  );
};

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================

export { useDraggableFSM };
export { createDraggableGestures } from './useDraggable.gestures';
export default useDraggable;

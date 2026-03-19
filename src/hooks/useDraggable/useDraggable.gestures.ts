// ============================================================================
// ЖЕСТЫ ДЛЯ ПЕРЕТАСКИВАНИЯ ПЛИТКИ
// ============================================================================
// Содержит общую логику Pan и Tap жестов для всех источников плиток.
// Используется в useDraggable.fsm.ts для интеграции с машиной состояний.
// ============================================================================

import { Gesture } from 'react-native-gesture-handler';
import { TileState, TileEvent } from '../../state/tileMachine.types';
import { INVENTORY_CELL_SIZE } from '../../constants/inventory';

// ============================================================================
// ПАРАМЕТРЫ ЖЕСТОВ
// ============================================================================

/**
 * Параметры для создания жестов перетаскивания.
 *
 * Передаются из `useDraggableFSM` — включают ссылки на FSM,
 * ref-переменные для позиции и вспомогательные колбэки.
 */
export interface GestureParams {
  /** Текущее состояние FSM — определяет, активен ли жест. */
  state: TileState;
  /** Функция отправки событий в FSM. */
  send: (event: TileEvent) => void;
  /** Ref текущей позиции плитки (верхний левый угол). */
  positionRef: React.RefObject<{ x: number; y: number }>;
  /** Ref позиции плитки в начале жеста — база для вычисления translation. */
  dragStartRef: React.RefObject<{ x: number; y: number } | null>;
  /** Принудительный ре-рендер для обновления UI во время drag. */
  forceUpdate: () => void;
  /** Размер плитки в пикселях с учётом текущего масштаба. */
  tileSize: number;
  /** Ref текущего масштаба сетки. */
  scaleRef: React.RefObject<number>;
  /** Animated.ValueXY для обновления позиции без ре-рендера. */
  animated?: {
    position: any;
  };
  /** Колбэк окончания drag с финальной позицией плитки. */
  onDragEnd?: (position: { x: number; y: number }) => void;
}

// ============================================================================
// СОЗДАНИЕ ЖЕСТОВ
// ============================================================================

/**
 * Создаёт Pan, Tap и составной жест для плитки.
 *
 * Два режима перемещения плитки:
 * - **Спавнер**: позиция вычисляется как `dragStart + translation` —
 *   плитка "тянется" относительно точки захвата.
 * - **Инвентарь**: позиция вычисляется как `absoluteXY - tileSize/2` —
 *   плитка немедленно центрируется под пальцем для удобства.
 *
 * `global.inventoryDragState` обновляется для синхронизации с App.tsx,
 * который отображает "тень" плитки поверх всего интерфейса во время drag.
 *
 * @param params - параметры жестов (см. GestureParams)
 * @returns объект с panGesture, tapGesture и composedGesture
 */
export const createDraggableGestures = ({
  state,
  send,
  positionRef,
  dragStartRef,
  forceUpdate,
  tileSize,
  animated,
  onDragEnd,
}: GestureParams) => {

  // ============================================================================
  // ЖЕСТ ПЕРЕТАСКИВАНИЯ (PAN)
  // ============================================================================

  const panGesture = Gesture.Pan()
    // Жест активен только в состояниях покоя и перетаскивания
    .enabled(state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE' || state === 'DRAGGING')
    .activateAfterLongPress(0) // Мгновенная активация без ожидания
    .minDistance(10)           // Минимальное смещение для различения drag от tap

    // НАЧАЛО ПЕРЕТАСКИВАНИЯ
    .onStart((e) => {
      if (state === 'INVENTORY_IDLE') {
        // Инвентарь: плитку центрируем под пальцем сразу при начале жеста
        const newPosition = {
          x: e.absoluteX - tileSize / 2,
          y: e.absoluteY - tileSize / 2,
        };

        positionRef.current = newPosition;

        if (animated?.position) {
          animated.position.setValue(newPosition);
        }

        // Инициализируем global.inventoryDragState для App.tsx (отрисовка тени)
        if (!global.inventoryDragState) {
          global.inventoryDragState = {
            position: { x: 0, y: 0 },
            size: { width: INVENTORY_CELL_SIZE, height: INVENTORY_CELL_SIZE },
            rotation: 0,
            isDragging: false,
            tileId: null,
          };
        }
        global.inventoryDragState.position = newPosition;
        global.inventoryDragState.isDragging = true;
        global.inventoryDragState.tileId = '';
        global.inventoryDragState.rotation = 0;

        dragStartRef.current = { ...newPosition };

        if (__DEV__) {
          console.log(`[Gesture] Inventory drag START at finger:`, {
            finger: { x: e.absoluteX, y: e.absoluteY },
            tile: newPosition,
          });
        }

        send({ type: 'TAKEN_FROM_INVENTORY' });
      } else {
        // Спавнер: фиксируем начальную позицию для дальнейшего вычисления дельты
        dragStartRef.current = { ...positionRef.current };

        if (state === 'SPAWNER_IDLE') {
          send({ type: 'TAKEN_FROM_SPAWN' });
        }
      }
    })

    // ПЕРЕМЕЩЕНИЕ ПЛИТКИ
    .onUpdate((e) => {
      if (state !== 'DRAGGING' || !dragStartRef.current) return;

      if (global.inventoryDragState?.isDragging) {
        // Инвентарь: абсолютные координаты минус половина плитки — центр под пальцем
        const newPosition = {
          x: e.absoluteX - tileSize / 2,
          y: e.absoluteY - tileSize / 2,
        };

        positionRef.current = newPosition;

        if (animated?.position) {
          animated.position.setValue(newPosition);
        }

        global.inventoryDragState.position = newPosition;
      } else {
        // Спавнер: начальная позиция + накопленное смещение от gesture handler
        const newX = dragStartRef.current.x + e.translationX;
        const newY = dragStartRef.current.y + e.translationY;

        positionRef.current = { x: newX, y: newY };

        if (animated?.position) {
          animated.position.setValue({ x: newX, y: newY });
        }
      }

      // Синхронизируем global.inventoryDragState для App.tsx
      if (global.inventoryDragState?.isDragging) {
        global.inventoryDragState.position = positionRef.current;
      }

      send({ type: 'DRAG_MOVE', payload: { ...positionRef.current } });
      forceUpdate();
    })

    // КОНЕЦ ПЕРЕТАСКИВАНИЯ
    .onEnd(() => {
      if (state === 'DRAGGING') {
        const endPosition = { x: positionRef.current.x, y: positionRef.current.y };
        // Передаём финальную позицию в useDraggableFSM для поиска целевой ячейки
        onDragEnd?.(endPosition);
      }
      dragStartRef.current = null;
    });

  // ============================================================================
  // ЖЕСТ ТАПА (для поворота плитки)
  // ============================================================================

  const tapGesture = Gesture.Tap()
    // Доступен только в состояниях покоя, не во время drag
    .enabled(state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE')
    .maxDuration(250)  // Тап не длиннее 250 мс
    .maxDistance(10)   // Смещение не более 10 px — иначе это начало drag
    .onStart(() => {
      if (__DEV__) {
        console.log(`[Gesture] Tap detected! state=${state}`);
      }
      // FSM обработает ROTATE через executeAction -> ROTATE_TILE -> onRotate
      send({ type: 'ROTATE' });
    });

  // ============================================================================
  // СОСТАВНОЙ ЖЕСТ
  // ============================================================================

  // Simultaneous позволяет одновременно распознавать Pan и Tap.
  // Gesture handler сам разберёт, какой из них активировался первым.
  const composedGesture = Gesture.Simultaneous(panGesture, tapGesture);

  return {
    panGesture,
    tapGesture,
    composedGesture,
  };
};

export default createDraggableGestures;

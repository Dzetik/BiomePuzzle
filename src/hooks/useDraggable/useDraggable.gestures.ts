// ============================================================================
// ЖЕСТЫ ДЛЯ ПЕРЕТАСКИВАНИЯ ПЛИТКИ
// ============================================================================
// Этот модуль содержит общую логику жестов (Pan, Tap) для всех источников плиток.
// Используется в useDraggable.fsm.ts для интеграции с машиной состояний.
// Модуль не зависит от GridService, контекстов или бизнес-логики — только жесты.
// ============================================================================

import { Gesture } from 'react-native-gesture-handler';
import { TileState, TileEvent } from '../../state/tileMachine.types';

// ============================================================================
// ПАРАМЕТРЫ ЖЕСТОВ
// ============================================================================

export interface GestureParams {
  state: TileState;                    // Текущее состояние FSM
  send: (event: TileEvent) => void;   // Функция отправки событий в FSM
  positionRef: React.MutableRefObject<{ x: number; y: number }>;  // Ссылка на позицию
  dragStartRef: React.MutableRefObject<{ x: number; y: number } | null>;  // Начало драга
  forceUpdate: () => void;            // Триггер ре-рендера
  tileSize: number;                   // Размер плитки для расчётов
  scaleRef: React.MutableRefObject<number>;  // Текущий масштаб
  
  // Колбэк для обработки конца драга (поиск ячейки, логика размещения)
  // Выносится сюда чтобы жесты оставались чистыми и тестируемыми
  onDragEnd?: (position: { x: number; y: number }) => void;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ: СОЗДАНИЕ ЖЕСТОВ
// ============================================================================
// Возвращает составной жест (Pan + Tap) для использования в GestureDetector.
// Pan имеет приоритет: если пользователь начал тащить — сработает он.
// Если просто тапнул (коротко, без перемещения) — сработает tapGesture.
// ============================================================================

export const createDraggableGestures = ({
  state,
  send,
  positionRef,
  dragStartRef,
  forceUpdate,
  tileSize,
  scaleRef,
  onDragEnd,
}: GestureParams) => {
  
  // --------------------------------------------------------------------------
  // ЖЕСТ ПЕРЕТАСКИВАНИЯ (PAN)
  // --------------------------------------------------------------------------
  // Обрабатывает ввод пользователя: начало, перемещение, конец драга.
  // Преобразует жесты в события FSM через send().
  // --------------------------------------------------------------------------
  const panGesture = Gesture.Pan()
    .enabled(state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE' || state === 'DRAGGING')
    .activateAfterLongPress(0)
    .minDistance(10)
    
    // НАЧАЛО ПЕРЕТАСКИВАНИЯ
    .onStart((e) => {
      // Сохраняем начальную позицию для вычисления дельты
      dragStartRef.current = { ...positionRef.current };
      
      // ============================================================================
      // 🔑 НОВОЕ: Мгновенное обновление global при начале драга (для инвентаря)
      // ============================================================================
      if (state === 'INVENTORY_IDLE') {
        if (!global.inventoryDragState) {
          global.inventoryDragState = {
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            rotation: 0,
            isDragging: false,
            tileId: null,
          };
        }
        
        // 🔑 Устанавливаем позицию СРАЗУ (точка касания = центр плитки)
        global.inventoryDragState.position = {
          x: e.absoluteX - tileSize / 2,  // Центрируем плитку на пальце
          y: e.absoluteY - tileSize / 2,
        };
        global.inventoryDragState.size = { width: tileSize, height: tileSize };
        global.inventoryDragState.isDragging = true;
        // tileId будет установлен в InventoryCell.tsx через useEffect
        
        if (__DEV__) {
          console.log(`[Gesture] 🚀 Instant global update at START:`, {
            position: global.inventoryDragState.position,
            touch: { x: e.absoluteX, y: e.absoluteY },
            tileSize,
          });
        }
      }
      
      // Отправляем событие начала драга в зависимости от источника
      if (state === 'SPAWNER_IDLE') {
        send({ type: 'TAKEN_FROM_SPAWN' });
      } else if (state === 'INVENTORY_IDLE') {
        send({ type: 'TAKEN_FROM_INVENTORY' });
      }
    })
    
    // ПЕРЕМЕЩЕНИЕ ПЛИТКИ
    .onUpdate((e) => {
      // Игнорируем если не в состоянии DRAGGING или нет начальной позиции
      if (state !== 'DRAGGING' || !dragStartRef.current) return;
      
      // Вычисляем новую позицию на основе дельты жеста
      const newX = dragStartRef.current.x + e.translationX;
      const newY = dragStartRef.current.y + e.translationY;
      
      // Обновляем ref для использования в onEnd
      positionRef.current = { x: newX, y: newY };
      
      // ============================================================================
      // 🔑 Обновляем global при каждом движении (для инвентаря)
      // ============================================================================
      if (global.inventoryDragState?.isDragging) {
        global.inventoryDragState.position = { x: newX, y: newY };
      }
      
      // Отправляем событие перемещения в FSM
      send({ type: 'DRAG_MOVE', payload: { x: newX, y: newY } });
      
      // Триггерим ре-рендер для обновления UI
      forceUpdate();
    })
    
    // КОНЕЦ ПЕРЕТАСКИВАНИЯ
    .onEnd((e) => {
      // Обрабатываем только если в состоянии DRAGGING
      if (state === 'DRAGGING') {
        const endPosition = { x: positionRef.current.x, y: positionRef.current.y };
        
        // Вызываем колбэк если есть (логика поиска ячейки, размещения)
        onDragEnd?.(endPosition);
      }
      
      // Сбрасываем начальную позицию драга
      dragStartRef.current = null;
    });

  // --------------------------------------------------------------------------
  // ЖЕСТ ТАПА (ДЛЯ ПОВОРОТА)
  // --------------------------------------------------------------------------
  // Срабатывает только в спавнере или инвентаре.
  // Отправляет событие ROTATE в FSM для поворота плитки на 90°.
  // --------------------------------------------------------------------------
  const tapGesture = Gesture.Tap()
    // Разрешаем тап только когда плитка в источнике (не в драге)
    .enabled(state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE')
    // Не дольше 250ms чтобы не конфликтовать с началом драга
    .maxDuration(250)
    // Не дальше 10px чтобы короткий свайп не считался тапом
    .maxDistance(10)
    .onStart(() => {
      if (__DEV__) {
        console.log(`[Gesture] 🎯 Tap detected! state=${state}`);
      }
      // Отправляем событие поворота в FSM
      send({ type: 'ROTATE' });
      // Триггерим ре-рендер для обновления визуала (угол поворота)
      //forceUpdate();
    });

  // --------------------------------------------------------------------------
  // СОСТАВНОЙ ЖЕСТ (Simultaneous)
  // --------------------------------------------------------------------------
  // Объединяет Pan и Tap жесты.
  // Gesture Handler автоматически разрешает конфликты:
  // - Если перемещение > maxDistance — сработает Pan
  // - Если короткое нажатие — сработает Tap
  // --------------------------------------------------------------------------
  const composedGesture = Gesture.Simultaneous(panGesture, tapGesture);

  return {
    panGesture,
    tapGesture,
    composedGesture,
  };
};

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================

export default createDraggableGestures;
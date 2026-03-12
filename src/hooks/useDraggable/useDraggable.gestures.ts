// ============================================================================
// ЖЕСТЫ ДЛЯ ПЕРЕТАСКИВАНИЯ ПЛИТКИ (ИСПРАВЛЕННЫЙ)
// ============================================================================
// Этот модуль содержит общую логику жестов (Pan, Tap) для всех источников плиток.
// Используется в useDraggable.fsm.ts для интеграции с машиной состояний.
// ============================================================================

import { Gesture } from 'react-native-gesture-handler';
import { TileState, TileEvent } from '../../state/tileMachine.types';
import { INVENTORY_CELL_SIZE } from '../../constants/inventory';

// ============================================================================
// ПАРАМЕТРЫ ЖЕСТОВ
// ============================================================================

export interface GestureParams {
  state: TileState;
  send: (event: TileEvent) => void;
  positionRef: React.MutableRefObject<{ x: number; y: number }>;
  dragStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  forceUpdate: () => void;
  tileSize: number;
  scaleRef: React.MutableRefObject<number>;
  animated?: {
    position: any; // Animated.ValueXY
  };
  onDragEnd?: (position: { x: number; y: number }) => void;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ: СОЗДАНИЕ ЖЕСТОВ
// ============================================================================

export const createDraggableGestures = ({
  state,
  send,
  positionRef,
  dragStartRef,
  forceUpdate,
  tileSize,
  scaleRef,
  animated,
  onDragEnd,
}: GestureParams) => {
  
  // ============================================================================
  // ЖЕСТ ПЕРЕТАСКИВАНИЯ (PAN) — ФИНАЛЬНАЯ ВЕРСИЯ
  // ============================================================================
  const panGesture = Gesture.Pan()
    .enabled(state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE' || state === 'DRAGGING')
    .activateAfterLongPress(0)
    .minDistance(10)
    
    // НАЧАЛО ПЕРЕТАСКИВАНИЯ
    .onStart((e) => {
      // ============================================================================
      // 🔑 Для инвентаря — сразу ставим позицию ПОД ПАЛЕЦ
      // ============================================================================
      if (state === 'INVENTORY_IDLE') {
        const newPosition = {
          x: e.absoluteX - tileSize / 2,
          y: e.absoluteY - tileSize / 2,
        };
        
        positionRef.current = newPosition;
        
        if (animated?.position) {
          animated.position.setValue(newPosition);
        }
        
        // ============================================================================
        // 🔑 Обновляем global для App.tsx
        // ============================================================================
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
        
        // 🔑 Для инвентаря — dragStartRef = текущая позиция (не будет использоваться)
        dragStartRef.current = { ...newPosition };
        
        if (__DEV__) {
          console.log(`[Gesture] 🎯 Inventory drag START at finger:`, {
            finger: { x: e.absoluteX, y: e.absoluteY },
            tile: newPosition,
          });
        }
        
        send({ type: 'TAKEN_FROM_INVENTORY' });
      } else {
        // Для спавнера — оставляем как было
        dragStartRef.current = { ...positionRef.current };
        
        if (state === 'SPAWNER_IDLE') {
          send({ type: 'TAKEN_FROM_SPAWN' });
        }
      }
    })
    
    // ПЕРЕМЕЩЕНИЕ ПЛИТКИ
    .onUpdate((e) => {
      if (state !== 'DRAGGING' || !dragStartRef.current) return;
      
      // ============================================================================
      // 🔑 Для инвентаря — используем absolute координаты, не translation
      // ============================================================================
      if (global.inventoryDragState?.isDragging) {
        // Для инвентаря: позиция = текущая позиция пальца - половина плитки
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
        // Для спавнера — оставляем как было (translation)
        const newX = dragStartRef.current.x + e.translationX;
        const newY = dragStartRef.current.y + e.translationY;
        
        positionRef.current = { x: newX, y: newY };
        
        if (animated?.position) {
          animated.position.setValue({ x: newX, y: newY });
        }
      }
      
      // ============================================================================
      // 🔑 Обновляем global для App.tsx
      // ============================================================================
      if (global.inventoryDragState?.isDragging) {
        global.inventoryDragState.position = positionRef.current;
      }
      
      send({ type: 'DRAG_MOVE', payload: { ...positionRef.current } });
      forceUpdate();
    })
    
    // КОНЕЦ ПЕРЕТАСКИВАНИЯ
    .onEnd((e) => {
      if (state === 'DRAGGING') {
        const endPosition = { x: positionRef.current.x, y: positionRef.current.y };
        onDragEnd?.(endPosition);
      }
      dragStartRef.current = null;
    });

  // --------------------------------------------------------------------------
  // ЖЕСТ ТАПА (ДЛЯ ПОВОРОТА)
  // --------------------------------------------------------------------------
  const tapGesture = Gesture.Tap()
    .enabled(state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE')
    .maxDuration(250)
    .maxDistance(10)
    .onStart(() => {
      if (__DEV__) {
        console.log(`[Gesture] 🎯 Tap detected! state=${state}`);
      }
      send({ type: 'ROTATE' });
    });

  // --------------------------------------------------------------------------
  // СОСТАВНОЙ ЖЕСТ
  // --------------------------------------------------------------------------
  const composedGesture = Gesture.Simultaneous(panGesture, tapGesture);

  return {
    panGesture,
    tapGesture,
    composedGesture,
  };
};

export default createDraggableGestures;
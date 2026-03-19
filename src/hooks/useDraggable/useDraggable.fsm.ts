// ============================================================================
// FSM РЕАЛИЗАЦИЯ ХУКА ПЕРЕТАСКИВАНИЯ
// ============================================================================

import { useRef, useMemo, useEffect, useReducer, useCallback } from 'react';
import { useTileMachine } from '../useTileMachine';
import { UseDraggableReturn } from './index';
import { getSpawnerSize } from '../../constants/spawner';
import { DEFAULT_TILE_SIZE } from '../../constants/tile';
import { BASE_GRID } from '../../constants/grid';
import { useZoom } from '../useZoom';
import { useSpawner } from '../useSpawner';
import { useGrid } from '../../context/GridContext';
import { useTiles } from '../../context/TilesContext';
import { GridService } from '../../services/GridService';
import { Tile } from '../../models/Tile';
import { createDraggableGestures } from './useDraggable.gestures';
import {
  INVENTORY_DROP_ZONE_TOTAL_HEIGHT,
  INVENTORY_DROP_ZONE_PADDING_BOTTOM,
} from '../../constants/inventory';
import { isCellWithinGrid } from '../../utils/gridUtils';
import { Dimensions } from 'react-native';

/**
 * Основная реализация хука перетаскивания плитки на базе FSM.
 *
 * Объединяет TileStateMachine, жесты (Pan/Tap), GridService и TilesContext
 * в единый управляемый поток событий для одной плитки.
 *
 * Два режима работы (параметр `source`):
 * - **SPAWNER**: плитка берётся из спавнера. При drop в зону инвентаря вызывается
 *   `onDroppedInInventory`; иначе ищется ячейка сетки.
 * - **INVENTORY**: плитка берётся из инвентаря. Центрируется под пальцем
 *   сразу при начале drag. После drop возвращается в инвентарь или размещается на сетке.
 *
 * Ключевые технические решения:
 * - `stableTileId` — lazy ref: ID не меняется между рендерами, FSM не пересоздаётся.
 * - `currentTileRef` — фиксирует объект плитки в момент начала drag для передачи в addTile.
 * - `isReturningRef` — защита от повторного сброса в SPAWNER_IDLE во время анимации возврата.
 * - GridService конфигурируется при каждом изменении scale/offset для корректного hit-test.
 *
 * @param initialTileData         - объект Tile (для инвентарных плиток)
 * @param tileId                  - ID плитки (если не задан в initialTileData)
 * @param externalInitialPosition - начальная позиция (передаётся из InventoryCell)
 * @param onPlaced                - колбэк при успешном размещении на сетке
 * @param onReturned              - колбэк при возврате в исходную зону
 * @param source                  - источник плитки: 'SPAWNER' | 'INVENTORY'
 * @param onDroppedInInventory    - колбэк drop спавнерной плитки в зону инвентаря
 * @param onRotate                - колбэк поворота плитки по тапу
 * @returns UseDraggableReturn
 */
export const useDraggableFSM = (
  initialTileData: Tile | null = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null,
  onPlaced?: (cell: { col: number; row: number }, tile?: Tile) => void,
  onReturned?: () => void,
  source: 'SPAWNER' | 'INVENTORY' = 'SPAWNER',
  onDroppedInInventory?: () => boolean,
  onRotate?: (tileId: string) => void,
): UseDraggableReturn => {

  // forceUpdate используется для принудительного ре-рендера во время drag
  // (Animated не триггерит ре-рендер сам по себе)
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const { scale } = useZoom();
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const { spawnerTile, addTile, getSpawnerTile } = useTiles();

  // Refs для стабильного доступа к изменяемым значениям без пересоздания колбэков
  const scaleRef = useRef(1);
  const spawnerPosRef = useRef<any>(null);
  const positionRef = useRef<{ x: number; y: number }>(
    externalInitialPosition || { x: 0, y: 0 }
  );
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  /** Флаг: плитка сейчас анимируется обратно — блокирует повторный RESET_TO_SPAWNER. */
  const isReturningRef = useRef(false);
  /** Объект плитки, захваченный в момент начала drag. */
  const currentTileRef = useRef<Tile | null>(null);
  /** ID плитки спавнера на предыдущем рендере — для отслеживания смены плитки. */
  const prevSourceTileIdRef = useRef<string | null>(null);
  /** ID последней плитки, для которой была отправлена SYNC_TILE. */
  const lastSyncedTileIdRef = useRef<string | null>(null);

  scaleRef.current = scale || 1;
  if (spawnerPos) spawnerPosRef.current = spawnerPos;

  // Отладочный лог при изменении ключевых параметров
  useEffect(() => {
    if (__DEV__) {
      console.log(`[useDraggableFSM] Debug props:`, {
        source,
        tileId: tileId || initialTileData?.id,
        hasOnRotate: typeof onRotate === 'function',
      });
    }
  }, [source, tileId, initialTileData?.id, onRotate]);

  // Синхронизируем GridService с текущим состоянием сетки при каждом изменении
  useEffect(() => {
    GridService.configure({
      cellSize: DEFAULT_TILE_SIZE.width,
      gridOffset: { x: offset?.x ?? 0, y: offset?.y ?? 0 },
      scale: scale ?? 1,
      gridBounds: { startCol: 0, endCol: BASE_GRID.COLS - 1, startRow: 0, endRow: BASE_GRID.ROWS - 1 },
    });
  }, [offset?.x, offset?.y, scale]);

  /**
   * Стабильная начальная позиция для FSM.
   * Если передана извне (инвентарь) — используем её.
   * Иначе вычисляем центр спавнера.
   */
  const stableInitialPosition = useMemo(() => {
    if (externalInitialPosition) return externalInitialPosition;
    const spawnerSize = getSpawnerSize();
    const currentSpawner = spawnerPosRef.current;
    if (!currentSpawner || typeof currentSpawner.x !== 'number') return { x: 0, y: 0 };
    return {
      x: currentSpawner.x + (currentSpawner.size - spawnerSize) / 2,
      y: currentSpawner.y + (currentSpawner.size - spawnerSize) / 2,
    };
  }, [externalInitialPosition]);

  // Lazy ref для ID плитки — создаётся один раз, не вызывает пересоздания FSM
  const stableTileId = useRef<string | null>(null);
  if (!stableTileId.current) stableTileId.current = tileId || `tile-${Date.now()}`;

  const spawnerSize = getSpawnerSize();
  const tileSize = spawnerSize * (scaleRef.current || 1);

  // ============================================================================
  // ИНИЦИАЛИЗАЦИЯ FSM
  // ============================================================================

  const { state, send, animated, context } = useTileMachine({
    // Для спавнера используем ID текущей плитки спавнера, для инвентаря — stableTileId
    tileId: source === 'SPAWNER' ? (spawnerTile?.id || stableTileId.current!) : (stableTileId.current!),
    tileType: initialTileData?.textureKey || spawnerTile?.textureKey || 'default',
    initialPosition: stableInitialPosition,
    spawnerPosition: {
      x: spawnerPosRef.current?.x || 0,
      y: spawnerPosRef.current?.y || 0,
      width: tileSize,
      height: tileSize,
    },
    isInSpawner: source === 'SPAWNER',
    tile: source === 'SPAWNER'
      ? (currentTileRef.current || spawnerTile)
      : (currentTileRef.current || initialTileData),
    onPlaced: (cell) => {
      const tileToPlace = currentTileRef.current;
      if (tileToPlace) {
        // Регистрируем плитку в TilesContext — синхронно до вызова onPlaced
        addTile(cell.col, cell.row, tileToPlace);
        currentTileRef.current = null;
      }
      onPlaced?.(cell, tileToPlace);
    },
    onReturned: () => {
      currentTileRef.current = null;
      onReturned?.();
    },
    onRotate,
  });

  // Синхронизируем tile в FSM при изменении объекта плитки инвентаря
  useEffect(() => {
    if (source === 'INVENTORY' && initialTileData) {
      if (initialTileData.id !== lastSyncedTileIdRef.current) {
        send({ type: 'SYNC_TILE', payload: { tile: initialTileData } });
        lastSyncedTileIdRef.current = initialTileData.id;
      }
    }
  }, [source, initialTileData?.id, send]);

  /**
   * Обрабатывает окончание drag: определяет, куда направить плитку.
   *
   * Логика для SPAWNER: если плитка упала в зону инвентаря — передаём в инвентарь.
   * Иначе ищем ячейку сетки. Плитки за границами сетки отправляются в NO_CELL.
   */
  const handleDragEnd = useCallback((endPosition: { x: number; y: number }) => {
    if (source === 'SPAWNER' && onDroppedInInventory) {
      const { height: screenHeight } = Dimensions.get('window');
      // Верхняя граница зоны инвентаря — куда нужно опустить плитку
      const dropZoneTopY = screenHeight - INVENTORY_DROP_ZONE_TOTAL_HEIGHT - INVENTORY_DROP_ZONE_PADDING_BOTTOM;

      if (endPosition.y >= dropZoneTopY) {
        const success = onDroppedInInventory?.();
        if (success) {
          // Плитка успешно добавлена в инвентарь — сбрасываем спавнер
          send({ type: 'RESET_TO_SPAWNER' });
        } else {
          // Инвентарь полон — возвращаем плитку в спавнер
          send({ type: 'DRAG_END', payload: endPosition });
          send({ type: 'NO_CELL' });
        }
        return;
      }
    }

    send({ type: 'DRAG_END', payload: endPosition });
    const cell = GridService.findCellAtPosition(endPosition.x, endPosition.y, tileSize);

    if (cell) {
      if (!isCellWithinGrid(cell.col, cell.row)) {
        // Ячейка за логическими границами сетки
        send({ type: 'NO_CELL' });
        return;
      }
      const isFree = GridService.isCellFree(cell.col, cell.row);
      if (isFree) {
        send({
          type: 'CELL_FOUND',
          payload: {
            col: cell.col,
            row: cell.row,
            isFree,
            scale: scaleRef.current,
            baseTileSize: DEFAULT_TILE_SIZE.width,
          },
        });
      } else {
        send({ type: 'NO_CELL' });
      }
    } else {
      send({ type: 'NO_CELL' });
    }
  }, [send, tileSize, source, onDroppedInInventory, scaleRef]);

  // Создаём жесты с текущими параметрами
  const { composedGesture } = createDraggableGestures({
    state, send, positionRef, dragStartRef, forceUpdate, tileSize, scaleRef, animated, onDragEnd: handleDragEnd,
  });

  // Синхронизируем positionRef с Animated.position для актуальных координат в handleDragEnd
  useEffect(() => {
    if (!animated?.position) return;
    const listener = animated.position.addListener((value: { x: number; y: number }) => {
      positionRef.current = { x: value.x, y: value.y };
    });
    return () => { animated.position.removeListener(listener); };
  }, [animated?.position]);

  // Обнаружение смены плитки спавнера — сбрасываем FSM для новой плитки
  useEffect(() => {
    const sourceTileId = source === 'SPAWNER' ? spawnerTile?.id : undefined;
    if (sourceTileId && sourceTileId !== prevSourceTileIdRef.current) {
      stableTileId.current = sourceTileId;
      prevSourceTileIdRef.current = sourceTileId;
      positionRef.current = { ...stableInitialPosition };
      send({ type: 'RESET_TO_SPAWNER' });
    }
  }, [spawnerTile?.id, stableInitialPosition, source]);

  // Дополнительная проверка смены spawnerTile.id (страховка от пропуска)
  useEffect(() => {
    if (isReturningRef.current) return;
    if (spawnerTile?.id && spawnerTile.id !== stableTileId.current) {
      stableTileId.current = spawnerTile.id;
      positionRef.current = { ...stableInitialPosition };
      if (state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE') {
        send({ type: 'RESET_TO_SPAWNER' });
      }
    }
  }, [spawnerTile?.id, stableInitialPosition]);

  // Отслеживаем флаг возврата для защиты от двойного RESET_TO_SPAWNER
  useEffect(() => {
    if (state === 'RETURNING_TO_SPAWN' || state === 'RETURNING_TO_INVENTORY') {
      isReturningRef.current = true;
    } else if (state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE') {
      isReturningRef.current = false;
    }
  }, [state]);

  // Захватываем ссылку на текущую плитку в момент начала drag
  useEffect(() => {
    if (state === 'DRAGGING' && !currentTileRef.current) {
      const tile = source === 'SPAWNER' ? getSpawnerTile() : null;
      if (tile) currentTileRef.current = tile;
      else if (initialTileData) currentTileRef.current = initialTileData;
    }
  }, [state, getSpawnerTile, source, initialTileData]);

  /**
   * Безопасно читает числовое значение из Animated.Value.
   * Пробует __getValue(), затем _value, при ошибке возвращает fallback.
   */
  const getAnimatedValue = (val: any, fallback: number): number => {
    if (typeof val === 'number') return val;
    if (val?.__getValue) { try { return val.__getValue(); } catch { return fallback; } }
    if (val?._value !== undefined) return val._value;
    return fallback;
  };

  return {
    position: { ...positionRef.current },
    width: getAnimatedValue(animated?.size?.width, tileSize),
    height: getAnimatedValue(animated?.size?.height, tileSize),
    gesture: composedGesture,
    // Поворот: для спавнера берём из spawnerTile, для инвентаря — из initialTileData или контекста FSM
    rotation: source === 'SPAWNER'
      ? (spawnerTile?.rotation ?? 0)
      : (initialTileData?.rotation ?? context?.tile?.rotation ?? 0),
    isInSpawner: state === 'SPAWNER_IDLE' || state === 'RETURNING_TO_SPAWN',
    isInInventory: state === 'INVENTORY_IDLE' || state === 'RETURNING_TO_INVENTORY',
    state,
    send,
    debug: context
      ? { isInSpawner: context.isInSpawner, currentCell: context.currentCell, position: context.position, fsmState: state }
      : null,
  };
};

export default useDraggableFSM;

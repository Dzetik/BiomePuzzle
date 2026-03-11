// ============================================================================
// FSM РЕАЛИЗАЦИЯ ХУКА ПЕРЕТАСКИВАНИЯ ПЛИТКИ
// ============================================================================
// Этот хук интегрирует машину состояний (TileStateMachine) с жестами
// React Native Gesture Handler. Он преобразует ввод пользователя в события
// FSM и обеспечивает плавную анимацию плитки во время перетаскивания.
// ============================================================================

import { useRef, useMemo, useEffect, useReducer, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useTileMachine } from '../useTileMachine';
import { UseDraggableReturn } from './index';
import { getSpawnerSize } from '../../constants/spawner';
import { DEFAULT_TILE_SIZE } from '../../constants/tile';
import { BASE_GRID_OFFSET } from '../../constants/grid';
import { useZoom } from '../useZoom';
import { useSpawner } from '../useSpawner';
import { useGrid } from '../../context/GridContext';
import { useTiles } from '../../context/TilesContext';
import { GridService } from '../../services/GridService';
import { Tile } from '../../models/Tile';
import { createDraggableGestures } from './useDraggable.gestures';
import { Dimensions } from 'react-native';
import {
  INVENTORY_DROP_ZONE_TOTAL_HEIGHT,
  INVENTORY_DROP_ZONE_PADDING_BOTTOM,
} from '../../constants/inventory';

// ============================================================================
// ГЛАВНЫЙ ХУК
// ============================================================================
// Принимает данные плитки и колбэки, возвращает объект для рендера и жестов.
// Используется в App.js для каждой активной плитки.
// ============================================================================
export const useDraggableFSM = (
  initialTileData: Tile | null = null,    // Данные плитки (экземпляр Tile)
  tileId: string | null = null,           // Уникальный идентификатор плитки
  externalInitialPosition: { x: number; y: number } | null = null,  // Начальная позиция
  onPlaced?: (cell: { col: number; row: number }) => void,  // Колбэк размещения
  onReturned?: () => void,  // Колбэк возврата в источник
  source: 'SPAWNER' | 'INVENTORY' = 'SPAWNER',  // Источник плитки
  onDroppedInInventory?: () => boolean,
): UseDraggableReturn => {
  
  // --------------------------------------------------------------------------
  // 1. FORCE UPDATE МЕХАНИЗМ
  // --------------------------------------------------------------------------
  // useReducer используется вместо useState для стабильного forceUpdate.
  // Вызов forceUpdate() без аргументов триггерит ре-рендер компонента.
  // Это нужно для обновления UI при изменении позиции во время драга.
  // --------------------------------------------------------------------------
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  
  // --------------------------------------------------------------------------
  // 2. ПОЛУЧЕНИЕ ДАННЫХ ИЗ КОНТЕКСТОВ
  // --------------------------------------------------------------------------
  // Хуки контекстов предоставляют глобальное состояние приложения:
  // - scale: текущий масштаб сетки (при зуме)
  // - spawnerPos: позиция спавнера на экране
  // - offset: смещение сетки (при панорамировании)
  // - spawnerTile/addTile: данные плитки из TilesContext
  // --------------------------------------------------------------------------
  const { scale } = useZoom();
  const spawnerPos = useSpawner();
  const { offset } = useGrid();
  const { spawnerTile, addTile, getSpawnerTile } = useTiles();
  
  // --------------------------------------------------------------------------
  // 3. СТАБИЛЬНЫЕ REFS (не триггерят ре-рендеры)
  // --------------------------------------------------------------------------
  // Refs используются для хранения данных которые часто меняются,
  // но не должны вызывать ре-рендер при каждом изменении.
  // --------------------------------------------------------------------------
  
  // Текущий масштаб — обновляется при зуме, но не триггерит ре-рендер
  const scaleRef = useRef(1);
  
  // Позиция спавнера — стабильная ссылка для вычислений
  const spawnerPosRef = useRef<any>(null);
  
  // Текущая позиция плитки — обновляется ~60 раз в секунду во время драга
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Начальная позиция драга — для вычисления дельты перемещения
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Флаг возврата в источник — предотвращает сброс плитки во время анимации возврата
  const isReturningRef = useRef(false);
  
  // Ref для хранения ссылки на активный экземпляр Tile
  // Нужно чтобы передать правильный объект в addTile при размещении
  const currentTileRef = useRef<Tile | null>(null);
  
  // Ref для отслеживания предыдущего ID плитки в спавнере/инвентаре
  const prevSourceTileIdRef = useRef<string | null>(null);

  const lastSyncedTileIdRef = useRef<string | null>(null);
  
  // Обновляем scaleRef при изменении scale (без ре-рендера)
  scaleRef.current = scale || 1;
  
  // Обновляем spawnerPosRef при изменении spawnerPos
  if (spawnerPos) spawnerPosRef.current = spawnerPos;
  
  // --------------------------------------------------------------------------
  // 4. НАСТРОЙКА GRID SERVICE
  // --------------------------------------------------------------------------
  // GridService используется для вычисления позиции ячеек с учётом зума и смещения.
  // Настройка обновляется при изменении offset или scale.
  // --------------------------------------------------------------------------
  useEffect(() => {
    GridService.configure({
      cellSize: DEFAULT_TILE_SIZE.width,
      gridOffset: { x: offset?.x ?? 0, y: offset?.y ?? 0 },
      scale: scale ?? 1,
      gridBounds: { startCol: -1, endCol: 6, startRow: -1, endRow: 12 },
    });
  }, [offset?.x, offset?.y, scale]);

  // --------------------------------------------------------------------------
  // 5. ВЫЧИСЛЕНИЕ НАЧАЛЬНОЙ ПОЗИЦИИ (мемоизировано)
  // --------------------------------------------------------------------------
  // Позиция вычисляется один раз и сохраняется в stableInitialPosition.
  // Если передана externalInitialPosition — используем её.
  // Иначе вычисляем позицию центрирования плитки в источнике.
  // --------------------------------------------------------------------------
  const stableInitialPosition = useMemo(() => {
    if (externalInitialPosition) return externalInitialPosition;
    
    const spawnerSize = getSpawnerSize();
    const currentSpawner = spawnerPosRef.current;
    
    if (!currentSpawner || typeof currentSpawner.x !== 'number') {
      return { x: 0, y: 0 };
    }
    
    return {
      x: currentSpawner.x + (currentSpawner.size - spawnerSize) / 2,
      y: currentSpawner.y + (currentSpawner.size - spawnerSize) / 2,
    };
  }, [externalInitialPosition]);

  // Синхронизируем positionRef с вычисленной позицией
  useEffect(() => {
    positionRef.current = { ...stableInitialPosition };
  }, [stableInitialPosition]);
  
  // --------------------------------------------------------------------------
  // 6. СТАБИЛЬНЫЙ TILE ID
  // --------------------------------------------------------------------------
  // stableTileId не меняется при ре-рендерах — это нужно для корректной
  // идентификации плитки в машине состояний и контексте.
  // --------------------------------------------------------------------------
  const stableTileId = useRef<string | null>(null);
  if (!stableTileId.current) {
    stableTileId.current = tileId || `tile-${Date.now()}`;
  }
  
  // --------------------------------------------------------------------------
  // 7. ВЫЧИСЛЕНИЕ РАЗМЕРА ПЛИТКИ
  // --------------------------------------------------------------------------
  // Размер плитки зависит от размера источника и текущего масштаба.
  // Вычисляется на каждый рендер потому что scale может измениться.
  // --------------------------------------------------------------------------
  const spawnerSize = getSpawnerSize();
  const tileSize = spawnerSize * (scaleRef.current || 1);
  
  // --------------------------------------------------------------------------
  // 8. ИНИЦИАЛИЗАЦИЯ МАШИНЫ СОСТОЯНИЙ
  // --------------------------------------------------------------------------
  // Создаёт useTileMachine хук с конфигурацией плитки.
  // Возвращает state, send, animated и context для управления плиткой.
  // --------------------------------------------------------------------------
  const { state, send, animated, context } = useTileMachine({
    // ← ИЗМЕНЕНО: Условный tileId в зависимости от source
    tileId: source === 'SPAWNER' 
      ? (spawnerTile?.id || stableTileId.current!) 
      : (stableTileId.current!),
    
    tileType: initialTileData?.textureKey || spawnerTile?.textureKey || 'default',
    initialPosition: stableInitialPosition,
    spawnerPosition: {
      x: spawnerPosRef.current?.x || 0,
      y: spawnerPosRef.current?.y || 0,
      width: tileSize,
      height: tileSize,
    },

    isInSpawner: source === 'SPAWNER',
    
    // ← ИЗМЕНЕНО: Условная плитка в зависимости от source
    tile: source === 'SPAWNER' 
      ? (currentTileRef.current || spawnerTile) 
      : (currentTileRef.current || initialTileData),
    
    onPlaced: (cell) => {
      if (currentTileRef.current) {
        addTile(cell.col, cell.row, currentTileRef.current);
        currentTileRef.current = null;
      }
      onPlaced?.(cell);
    },
    onReturned: () => {
      currentTileRef.current = null;
      onReturned?.();
    },
  });

  useEffect(() => {
    if (source === 'INVENTORY' && initialTileData) {
      // Отправляем SYNC_TILE только если ID плитки изменился
      // Это предотвращает бесконечный цикл из-за изменения ссылки send
      if (initialTileData.id !== lastSyncedTileIdRef.current) {
        send({ type: 'SYNC_TILE', payload: { tile: initialTileData } });
        lastSyncedTileIdRef.current = initialTileData.id;
        
        if (__DEV__) {
          console.log(`[Draggable] 🔧 SYNC_TILE sent: ${initialTileData.id}`);
        }
      }
    }
  }, [source, initialTileData?.id, send]);

  // ============================================================================
  // ОБРАБОТКА КОНЦА DRAG (проверка инвентаря ПЕРЕД поиском ячейки)
  // ============================================================================
  const handleDragEnd = useCallback((endPosition: { x: number; y: number }) => {
    
    // ============================================================================
    // ПРОВЕРКА ЗОНЫ СБРОСА В ИНВЕНТАРЬ (ПЕРЕД отправкой DRAG_END!)
    // ============================================================================
    // Только для плиток из спавнера. Если плитка отпущена в зоне инвентаря —
    // НЕ отправляем DRAG_END, сразу вызываем колбэк и сбрасываем FSM.
    // ============================================================================
    if (source === 'SPAWNER' && onDroppedInInventory) {
      const { height: screenHeight } = Dimensions.get('window');
      const dropZoneTopY = screenHeight - INVENTORY_DROP_ZONE_TOTAL_HEIGHT - INVENTORY_DROP_ZONE_PADDING_BOTTOM;
      
      if (endPosition.y >= dropZoneTopY) {
        if (__DEV__) {
          console.log('[Draggable] 📦 Плитка dropped в зону инвентаря', {
            endPositionY: endPosition.y,
            dropZoneTopY,
            screenHeight,
          });
        }
        
        const success = onDroppedInInventory?.();
  
        if (success) {
          // Успех: плитка в инвентаре, сбрасываем FSM для новой плитки
          send({ type: 'RESET_TO_SPAWNER' });
        } else {
          send({ type: 'DRAG_END', payload: endPosition });
          send({ type: 'NO_CELL' });
        }
        
        return;
      }
    }
    
    // ============================================================================
    // СТАНДАРТНАЯ ЛОГИКА: Отправляем DRAG_END и ищем ячейку грида
    // ============================================================================
    send({ type: 'DRAG_END', payload: endPosition });
    
    const cell = GridService.findCellAtPosition(endPosition.x, endPosition.y, tileSize);
    
    if (cell) {
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
          } 
        });
      } else {
        send({ type: 'NO_CELL' });
      }
    } else {
      send({ type: 'NO_CELL' });
    }
  }, [send, tileSize, source, onDroppedInInventory, scaleRef]);

  // --------------------------------------------------------------------------
  // 10. СОЗДАНИЕ ЖЕСТОВ (через модуль gestures)
  // --------------------------------------------------------------------------
  // Выносим логику жестов в отдельный модуль для переиспользования.
  // Передаём handleDragEnd как колбэк для обработки конца перетаскивания.
  // --------------------------------------------------------------------------
  const { panGesture, tapGesture, composedGesture } = createDraggableGestures({
    state,
    send,
    positionRef,
    dragStartRef,
    forceUpdate,
    tileSize,
    scaleRef,
    onDragEnd: handleDragEnd,
  });

  // --------------------------------------------------------------------------
  // 11. СИНХРОНИЗАЦИЯ POSITION REF С ANIMATED
  // --------------------------------------------------------------------------
  // Подписывается на изменения Animated.ValueXY позиции.
  // Обновляет positionRef для использования в жестах.
  // Триггерит ре-рендер через forceUpdate() для обновления UI.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!animated?.position) return;
    
    const listener = animated.position.addListener((value: { x: number; y: number }) => {
      positionRef.current = { x: value.x, y: value.y };
    });
    
    return () => {
      animated.position.removeListener(listener);
    };
  }, [animated?.position]);

  // --------------------------------------------------------------------------
  // 12. СИНХРОНИЗАЦИЯ tileId И tile В КОНТЕКСТЕ МАШИНЫ
  // --------------------------------------------------------------------------
  // Машина создаётся один раз, но плитка может появиться позже.
  // Этот эффект обновляет ссылку на экземпляр Tile и tileId в контексте.
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Логика синхронизации уже есть в useTileMachine через эффект
    // Здесь можно добавить дополнительные проверки если нужно
  }, [spawnerTile?.id]);

  // --------------------------------------------------------------------------
  // 13. СБРОС FSM ПРИ СМЕНЕ ПЛИТКИ В ИСТОЧНИКЕ
  // --------------------------------------------------------------------------
  // Сравнивает текущий ID источника с предыдущим, чтобы обнаружить смену плитки.
  // Сбрасывает FSM и синхронизирует stableTileId атомарно.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const sourceTileId = source === 'SPAWNER' ? spawnerTile?.id : undefined;
    
    if (sourceTileId && sourceTileId !== prevSourceTileIdRef.current) {
      stableTileId.current = sourceTileId;
      prevSourceTileIdRef.current = sourceTileId;
      
      // Сбрасываем позицию
      positionRef.current = { ...stableInitialPosition };
      
      send({ type: 'RESET_TO_SPAWNER' });
      forceUpdate();
      
      if (__DEV__) {
        console.log('[Draggable] 🔄 FSM сброшен для новой плитки:', sourceTileId);
      }
    }
  }, [spawnerTile?.id, stableInitialPosition, send, source]);

  // --------------------------------------------------------------------------
  // 14. ОТСЛЕЖИВАНИЕ НОВОЙ ПЛИТКИ В ИСТОЧНИКЕ
  // --------------------------------------------------------------------------
  // Когда размещённая плитка создаёт новую в источнике, этот эффект
  // обнаруживает изменение spawnerTile.id и сбрасывает FSM.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isReturningRef.current) return;
    
    if (spawnerTile?.id && spawnerTile.id !== stableTileId.current) {
      stableTileId.current = spawnerTile.id;
      positionRef.current = { ...stableInitialPosition };
      if (state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE') {
        send({ type: 'RESET_TO_SPAWNER' });
      }
      forceUpdate();
    }
  }, [spawnerTile?.id, stableInitialPosition, send]);
  
  // --------------------------------------------------------------------------
  // 15. ОТСЛЕЖИВАНИЕ ВОЗВРАТА В ИСТОЧНИК
  // --------------------------------------------------------------------------
  // Обновляет isReturningRef при изменении состояния FSM.
  // Это предотвращает преждевременный сброс плитки во время анимации возврата.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (state === 'RETURNING_TO_SPAWN' || state === 'RETURNING_TO_INVENTORY') {
      isReturningRef.current = true;
    } else if (state === 'SPAWNER_IDLE' || state === 'INVENTORY_IDLE') {
      isReturningRef.current = false;
    }
  }, [state]);

  // --------------------------------------------------------------------------
  // 16. ОТСЛЕЖИВАНИЕ ВЗЯТИЯ ПЛИТКИ ИЗ ИСТОЧНИКА
  // --------------------------------------------------------------------------
  // Когда FSM переходит в состояние DRAGGING, мы берём плитку из контекста
  // и сохраняем ссылку на неё в currentTileRef для дальнейшего использования.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (state === 'DRAGGING' && !currentTileRef.current) {
      const tile = source === 'SPAWNER' ? getSpawnerTile() : null;
      // Для инвентаря плитка передаётся напрямую через initialTileData
      if (tile) {
        currentTileRef.current = tile;
      } else if (initialTileData) {
        currentTileRef.current = initialTileData;
      }
    }
  }, [state, getSpawnerTile, source, initialTileData]);

  // --------------------------------------------------------------------------
  // 17. ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ПОЛУЧЕНИЕ ЗНАЧЕНИЯ ANIMATED
  // --------------------------------------------------------------------------
  // Безопасно извлекает числовое значение из Animated.Value.
  // Обрабатывает разные форматы (number, __getValue, _value).
  // --------------------------------------------------------------------------
  const getAnimatedValue = (val: any, fallback: number): number => {
    if (typeof val === 'number') return val;
    if (val?.__getValue) {
      try { return val.__getValue(); } catch { return fallback; }
    }
    if (val?._value !== undefined) return val._value;
    return fallback;
  };

  // --------------------------------------------------------------------------
  // 18. ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
  // --------------------------------------------------------------------------
  // Объект который используется в компонентах для рендера плитки и жестов.
  // --------------------------------------------------------------------------
  return {
    position: { ...positionRef.current },
    width: getAnimatedValue(animated?.size?.width, tileSize),
    height: getAnimatedValue(animated?.size?.height, tileSize),
    gesture: composedGesture,
    rotation: source === 'SPAWNER' 
      ? (spawnerTile?.rotation ?? 0)  // Для спавнера: берём напрямую из контекста
      : (initialTileData?.rotation ?? context?.tile?.rotation ?? 0),
    isInSpawner: state === 'SPAWNER_IDLE' || state === 'RETURNING_TO_SPAWN',
    isInInventory: state === 'INVENTORY_IDLE' || state === 'RETURNING_TO_INVENTORY',
    state,
    send,
    debug: context ? {
      isInSpawner: context.isInSpawner,
      currentCell: context.currentCell,
      position: context.position,
      fsmState: state,
    } : null,
  };
};

export default useDraggableFSM;
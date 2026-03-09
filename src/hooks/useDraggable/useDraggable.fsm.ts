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

// ============================================================================
// ГЛАВНЫЙ ХУК
// ============================================================================
// Принимает данные плитки и колбэки, возвращает объект для рендера и жестов.
// Используется в App.js для каждой активной плитки.
// ============================================================================
export const useDraggableFSM = (
  initialTileData: any = null,    // Данные плитки (текстура, тип)
  tileId: string | null = null,   // Уникальный идентификатор плитки
  externalInitialPosition: { x: number; y: number } | null = null,  // Начальная позиция (опционально)
  onPlaced?: (cell: { col: number; row: number }) => void,  // Колбэк успешного размещения
  onReturned?: () => void  // Колбэк возврата в спавнер
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
  const { spawnerTile, addTile } = useTiles();
  
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
  
  // Флаг возврата в спавнер — предотвращает сброс плитки во время анимации возврата
  const isReturningRef = useRef(false);
  
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
      cellSize: DEFAULT_TILE_SIZE.width,  // Базовый размер ячейки (80px)
      gridOffset: { x: offset?.x ?? 0, y: offset?.y ?? 0 },  // Смещение сетки
      scale: scale ?? 1,  // Текущий масштаб
      gridBounds: { startCol: -1, endCol: 6, startRow: -1, endRow: 12 },  // Границы сетки
    });
  }, [offset?.x, offset?.y, scale]);  // Перенастраиваем при изменении этих параметров

  // --------------------------------------------------------------------------
  // 5. ВЫЧИСЛЕНИЕ НАЧАЛЬНОЙ ПОЗИЦИИ (мемоизировано)
  // --------------------------------------------------------------------------
  // Позиция вычисляется один раз и сохраняется в stableInitialPosition.
  // Если передана externalInitialPosition — используем её.
  // Иначе вычисляем позицию центрирования плитки в спавнере.
  // --------------------------------------------------------------------------
  const stableInitialPosition = useMemo(() => {
    // Если передана внешняя позиция — используем её
    if (externalInitialPosition) return externalInitialPosition;
    
    // Получаем размер спавнера (100px по умолчанию)
    const spawnerSize = getSpawnerSize();
    
    // Получаем текущую позицию спавнера из ref
    const currentSpawner = spawnerPosRef.current;
    
    // Если спавнер ещё не инициализирован — возвращаем (0, 0)
    if (!currentSpawner || typeof currentSpawner.x !== 'number') {
      return { x: 0, y: 0 };
    }
    
    // Вычисляем позицию центрирования плитки в спавнере
    // Формула: центр спавнера - половина размера плитки
    return {
      x: currentSpawner.x + (currentSpawner.size - spawnerSize) / 2,
      y: currentSpawner.y + (currentSpawner.size - spawnerSize) / 2,
    };
  }, [externalInitialPosition]);  // Пересчитываем только при изменении externalInitialPosition

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
  // Размер плитки зависит от размера спавнера и текущего масштаба.
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
    tileId: stableTileId.current!,  // Уникальный ID плитки
    tileType: initialTileData?.type || 'default',  // Тип плитки
    initialPosition: stableInitialPosition,  // Начальная позиция
    spawnerPosition: {  // Позиция и размер спавнера
      x: spawnerPosRef.current?.x || 0,
      y: spawnerPosRef.current?.y || 0,
      width: tileSize,
      height: tileSize,
    },
    // Колбэк размещения плитки
    onPlaced: (cell) => {
      // Добавляем плитку в TilesContext для сохранения в сетке
      if (stableTileId.current) {
        addTile(cell.col, cell.row, { id: stableTileId.current, texture: 'test1' });
      }
      // Вызываем внешний колбэк (в App.js создаётся новая плитка в спавнере)
      onPlaced?.(cell);
    },
    // Колбэк возврата в спавнер
    onReturned: () => onReturned?.(),
  });

  // --------------------------------------------------------------------------
  // 9. СИНХРОНИЗАЦИЯ POSITION REF С ANIMATED
  // --------------------------------------------------------------------------
  // Подписывается на изменения Animated.ValueXY позиции.
  // Обновляет positionRef для использования в жестах.
  // Триггерит ре-рендер через forceUpdate() для обновления UI.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!animated?.position) return;
    
    // Добавляем слушатель изменений позиции
    const listener = animated.position.addListener((value: { x: number; y: number }) => {
      positionRef.current = { x: value.x, y: value.y };
      forceUpdate();  // Триггерим ре-рендер для обновления UI
    });
    
    // Очищаем слушатель при размонтировании
    return () => {
      animated.position.removeListener(listener);
    };
  }, [animated?.position]);

  // --------------------------------------------------------------------------
  // 10. ОТСЛЕЖИВАНИЕ НОВОЙ ПЛИТКИ В СПАВНЕРЕ
  // --------------------------------------------------------------------------
  // Когда размещённая плитка создаёт новую в спавнере, этот эффект
  // обнаруживает изменение spawnerTile.id и сбрасывает FSM.
  // isReturningRef предотвращает сброс во время анимации возврата.
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Если плитка возвращается в спавнер — не сбрасываем пока анимация не завершится
    if (isReturningRef.current) return;
    
    // Если spawnerTile изменился и это новая плитка
    if (spawnerTile?.id && spawnerTile.id !== stableTileId.current) {
      // Обновляем stableTileId на новый ID
      stableTileId.current = spawnerTile.id;
      
      // Сбрасываем позицию на начальную
      positionRef.current = { ...stableInitialPosition };
      
      // Отправляем событие сброса в FSM
      send({ type: 'RESET_TO_SPAWNER' });
      
      // Триггерим ре-рендер
      forceUpdate();
    }
  }, [spawnerTile?.id, stableInitialPosition, send]);  // 🔥 state НЕ в зависимостях!

  // --------------------------------------------------------------------------
  // 11. ЛОГИРОВАНИЕ АКТИВНОСТИ ПЛИТКИ (только для отладки)
  // --------------------------------------------------------------------------
  // Логирует когда плитка становится активной в спавнере.
  // Можно удалить в продакшене или обернуть в FEATURE_FLAGS.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (state === 'SPAWNER_IDLE' && spawnerTile?.id === stableTileId.current) {
      // Плитка в спавнере и готова к перетаскиванию
    }
  }, [state, spawnerTile?.id, stableTileId.current]);
  
  // --------------------------------------------------------------------------
  // 12. ОТСЛЕЖИВАНИЕ ВОЗВРАТА В СПАВНЕР
  // --------------------------------------------------------------------------
  // Обновляет isReturningRef при изменении состояния FSM.
  // Это предотвращает преждевременный сброс плитки во время анимации возврата.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (state === 'RETURNING_TO_SPAWN') {
      isReturningRef.current = true;  // Начался возврат
    } else if (state === 'SPAWNER_IDLE') {
      isReturningRef.current = false;  // Возврат завершён
    }
  }, [state]);

  // --------------------------------------------------------------------------
  // 13. ЖЕСТ ПЕРЕТАСКИВАНИЯ (PAN GESTURE)
  // --------------------------------------------------------------------------
  // Обрабатывает ввод пользователя: начало, перемещение, конец драга.
  // Преобразует жесты в события FSM через send().
  // --------------------------------------------------------------------------
  const panGesture = Gesture.Pan()
    // Разрешаем жест только в состояниях SPAWNER_IDLE и DRAGGING
    .enabled(state === 'SPAWNER_IDLE' || state === 'DRAGGING')
    // Активируем сразу без задержки для отзывчивости
    .activateAfterLongPress(0)
    
    // ------------------------------------------------------------------------
    // НАЧАЛО ПЕРЕТАСКИВАНИЯ
    // ------------------------------------------------------------------------
    .onStart((e) => {
      // Сохраняем начальную позицию для вычисления дельты
      dragStartRef.current = { ...positionRef.current };
      
      // Если плитка в спавнере — отправляем событие начала драга
      if (state === 'SPAWNER_IDLE') {
        send({ type: 'TAKEN_FROM_SPAWN' });
      }
    })
    
    // ------------------------------------------------------------------------
    // ПЕРЕМЕЩЕНИЕ ПЛИТКИ
    // ------------------------------------------------------------------------
    .onUpdate((e) => {
      // Игнорируем если не в состоянии DRAGGING или нет начальной позиции
      if (state !== 'DRAGGING' || !dragStartRef.current) return;
      
      // Вычисляем новую позицию на основе дельты жеста
      const newX = dragStartRef.current.x + e.translationX;
      const newY = dragStartRef.current.y + e.translationY;
      
      // Обновляем ref для использования в onEnd
      positionRef.current = { x: newX, y: newY };
      
      // Отправляем событие перемещения в FSM
      send({ type: 'DRAG_MOVE', payload: { x: newX, y: newY } });
      
      // Триггерим ре-рендер для обновления UI
      forceUpdate();
    })
    
    // ------------------------------------------------------------------------
    // КОНЕЦ ПЕРЕТАСКИВАНИЯ
    // ------------------------------------------------------------------------
    .onEnd((e) => {
      // Обрабатываем только если в состоянии DRAGGING
      if (state === 'DRAGGING') {
        // Получаем финальную позицию
        const endPosition = { x: positionRef.current.x, y: positionRef.current.y };
        
        // Отправляем событие конца драга в FSM
        send({ type: 'DRAG_END', payload: endPosition });
        
        // Ищем ячейку под плиткой через GridService
        const cell = GridService.findCellAtPosition(endPosition.x, endPosition.y, tileSize);
        
        if (cell) {
          // Проверяем свободна ли ячейка
          const isFree = GridService.isCellFree(cell.col, cell.row);
          
          if (isFree) {
            // Ячейка свободна — отправляем событие успешного размещения
            send({ 
              type: 'CELL_FOUND', 
              payload: { 
                col: cell.col, 
                row: cell.row, 
                isFree, 
                scale: scaleRef.current,  // Текущий масштаб для расчёта размера
                baseTileSize: DEFAULT_TILE_SIZE.width  // Базовый размер плитки
              } 
            });
          } else {
            // Ячейка занята — отправляем событие возврата в спавнер
            send({ type: 'NO_CELL' });
          }
        } else {
          // Ячейка не найдена — отправляем событие возврата в спавнер
          send({ type: 'NO_CELL' });
        }
      }
      
      // Сбрасываем начальную позицию драга
      dragStartRef.current = null;
    });

  // --------------------------------------------------------------------------
  // 14. ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ПОЛУЧЕНИЕ ЗНАЧЕНИЯ ANIMATED
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
  // 15. ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
  // --------------------------------------------------------------------------
  // Объект который используется в App.js для рендера плитки и жестов.
  // --------------------------------------------------------------------------
  return {
    position: { ...positionRef.current },  // Текущая позиция для рендера
    width: getAnimatedValue(animated?.size?.width, tileSize),  // Текущая ширина
    height: getAnimatedValue(animated?.size?.height, tileSize),  // Текущая высота
    panHandlers: panGesture,  // Обработчик жестов для GestureDetector
    isInSpawner: state === 'SPAWNER_IDLE' || state === 'RETURNING_TO_SPAWN',  // Флаг для UI
    state,  // Текущее состояние FSM (для условного рендера)
    send,  // Функция отправки событий (для отладки)
    debug: context ? {  // Отладочная информация
      isInSpawner: context.isInSpawner,
      currentCell: context.currentCell,
      position: context.position,
      fsmState: state,
    } : null,
  };
};

export default useDraggableFSM;
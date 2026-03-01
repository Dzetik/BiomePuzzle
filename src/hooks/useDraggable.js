// ========================================
// ГЛАВНЫЙ ХУК ДЛЯ УПРАВЛЕНИЯ ПЕРЕТАСКИВАЕМОЙ ПЛИТКОЙ
// 
// Собирает все под-хуки вместе:
// - useTileAnimations: анимации позиции и размера
// - useTileTargetCell: работа с целевой ячейкой
// - useTileSpawnerLogic: логика спавнера
// - useTilePlacement: логика размещения при отпускании
// - useTileDragHandler: обработка жестов
// 
// Возвращает API для компонента TileView
// ========================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useZoom } from './useZoom';
import { useGrid } from '../context/GridContext';
import { useSpawner } from './useSpawner';
import { getSpawnerSize } from '../constants/spawner';
import { getSnapToSpawnerPosition } from '../utils/spawnerUtils';

// Импортируем под-хуки из папки useDraggable
import { useTileAnimations } from './useDraggable/useTileAnimations';
import { useTileTargetCell } from './useDraggable/useTileTargetCell';
import { useTileSpawnerLogic } from './useDraggable/useTileSpawnerLogic';
import { useTilePlacement } from './useDraggable/useTilePlacement';
import { useTileDragHandler } from './useDraggable/useTileDragHandler';

const useDraggable = (initialPosition = null, tileId = null) => {
  // ========================================
  // 1. ПОЛУЧЕНИЕ ДАННЫХ ИЗ КОНТЕКСТОВ
  // ========================================
  
  /**
   * scale - текущий масштаб (зум) из useZoom
   * offset - текущее смещение сетки при панорамировании из GridContext
   * spawnerPos - позиция спавнера на экране из useSpawner
   */
  const { scale } = useZoom();
  const { offset } = useGrid();
  const spawnerPos = useSpawner();
  
  // ========================================
  // 2. ЛОКАЛЬНЫЕ СОСТОЯНИЯ
  // ========================================
  
  /**
   * isSpawnerReady - флаг, что спавнер уже имеет корректные координаты
   * (используется, чтобы не рассчитывать позицию до получения данных)
   */
  const [isSpawnerReady, setIsSpawnerReady] = useState(false);
  
  /**
   * isInSpawner - флаг нахождения плитки в спавнере
   * Поднимаем на этот уровень, чтобы передавать во все дочерние хуки
   */
  const [isInSpawner, setIsInSpawner] = useState(true);
  
  // ========================================
  // 3. REF ДЛЯ ЦЕЛЕВОЙ ЯЧЕЙКИ
  // ========================================
  
  /**
   * targetCellRef - ссылка на объект с координатами целевой ячейки {col, row}
   * или null, если плитка в спавнере
   * 
   * ВАЖНО: Создаётся здесь и передаётся во все дочерние хуки,
   * чтобы все работали с одним и тем же ref
   */
  const targetCellRef = useRef(null);

  // ========================================
  // 4. ОТСЛЕЖИВАНИЕ ГОТОВНОСТИ СПАВНЕРА
  // ========================================
  
  /**
   * Эффект срабатывает, когда spawnerPos получает корректные координаты
   * (spawnerPos.size > 0 означает, что спавнер отрисован и известны его размеры)
   */
  useEffect(() => {
    if (spawnerPos.size > 0) {
      console.log(`[Tile ${tileId}] Спавнер готов:`, spawnerPos);
      setIsSpawnerReady(true);
    }
  }, [spawnerPos, tileId]);

  // ========================================
  // 5. ВЫЧИСЛЕНИЕ НАЧАЛЬНЫХ ЗНАЧЕНИЙ
  // ========================================
  
  /**
   * spawnerSize - размер спавнера из конфига
   * initialTileSize - начальный размер плитки (равен размеру спавнера)
   */
  const spawnerSize = getSpawnerSize();
  const initialTileSize = { width: spawnerSize, height: spawnerSize };
  
  /**
   * startPosition - начальная позиция плитки
   * Если передан initialPosition - используем его
   * Иначе центрируем в спавнере (как только он готов)
   * Иначе временно ставим в (0,0)
   */
  const startPosition = useCallback(() => {
    if (initialPosition) return initialPosition;
    if (isSpawnerReady) {
      return getSnapToSpawnerPosition(initialTileSize, spawnerPos);
    }
    return { x: 0, y: 0 };
  }, [initialPosition, isSpawnerReady, spawnerPos, initialTileSize])();

  // ========================================
  // 6. ИНИЦИАЛИЗАЦИЯ ПОД-ХУКОВ
  // ========================================
  
  /**
   * ПОРЯДОК ВАЖЕН!
   * 1. Анимации - базовый слой, создаёт анимированные значения
   * 2. Спавнер логика - зависит от анимаций
   * 3. Целевая ячейка - зависит от анимаций и спавнера
   * 4. Размещение - зависит от всего вышеперечисленного
   * 5. Обработчик жестов - замыкает всё вместе
   */
  
  // --- 6.1 Анимации (самый базовый слой) ---
  const {
    position,                    // Animated.ValueXY для позиции
    width,                       // Animated.Value для ширины
    height,                      // Animated.Value для высоты
    currentTileSize,             // Ref с актуальным размером
    currentPositionRef,          // Ref с актуальной позицией
    animateSize,                 // Функция анимации размера
    animateToPosition,           // Функция анимации перемещения
    getTileSize,                 // Функция получения размера под масштаб
    correctPositionIfNeeded,     // Коррекция позиции перед перетаскиванием
    updatePositionFromTargetCell, // Обновление по целевой ячейке
  } = useTileAnimations({
    tileId,
    initialPosition: startPosition,
    initialSize: initialTileSize,
    scale,
    offset,
    isInSpawner,
    targetCellRef,
    isSpawnerReady,
  });

  // --- 6.2 Логика спавнера ---
  const {
    spawnerTileSize,             // Размер плитки в спавнере
    handlePositionChange,        // Обработчик изменения позиции
    setInSpawner,                // Принудительный вход в спавнер
    setOutOfSpawner,             // Принудительный выход из спавнера
    checkIfInSpawner,            // Проверка нахождения в спавнере
  } = useTileSpawnerLogic({
    tileId,
    spawnerPos,
    isSpawnerReady,
    currentTileSize,
    currentPositionRef,
    animateSize,
    getTileSize,
    scale,
    isInSpawner,
    setIsInSpawner,
  });

  // --- 6.3 Логика целевой ячейки ---
  const {
    isCellFree,                  // Проверка свободы ячейки
    tryOccupyCell,               // Попытка занять ячейку
    releaseCurrentCell,          // Освобождение текущей ячейки
    updateTargetCellFromPosition, // Обновление целевой ячейки по позиции
  } = useTileTargetCell({
    tileId,
    scale,
    offset,
    currentTileSize,
    currentPositionRef,
    isInSpawner,
    setIsInSpawner,
    targetCellRef,
    onCellOccupied: (col, row) => { 
      console.log(`[Tile ${tileId}] Ячейка [${col},${row}] занята`);
    },
  });

  // --- 6.4 Логика размещения (при отпускании) ---
  const {
    handlePlacement,             // Основная функция размещения
  } = useTilePlacement({
    tileId,
    spawnerPos,
    currentTileSize,
    currentPositionRef,
    isInSpawner,
    targetCellRef,
    isCellFree,
    tryOccupyCell,
    releaseCurrentCell,
    setInSpawner,
    setOutOfSpawner,
    animateToPosition,
    scale,
    offset,
  });

  // --- 6.5 Обработчик жестов ---
  const {
    panHandlers,                 // Обработчики для Animated.View
  } = useTileDragHandler({
    tileId,
    position,
    currentTileSize,
    currentPositionRef,
    correctPositionIfNeeded,
    onPlacement: handlePlacement,
    animateToPosition,
  });

  // ========================================
  // 7. ПОДКЛЮЧЕНИЕ СЛУШАТЕЛЯ ПОЗИЦИИ
  // ========================================
  
  /**
   * Подписываемся на изменения позиции плитки
   * Каждое изменение передаётся в handlePositionChange,
   * который проверяет вход/выход из спавнера
   */
  useEffect(() => {
    const listener = position.addListener((value) => {
      handlePositionChange(value);
    });
    
    return () => position.removeListener(listener);
  }, [position, handlePositionChange]);

  // ========================================
  // 8. СИНХРОНИЗАЦИЯ ЦЕЛЕВОЙ ЯЧЕЙКИ
  // ========================================
  
  /**
   * Если плитка вышла из спавнера, но у неё ещё нет целевой ячейки
   * (например, при первом выходе), обновляем ячейку по текущей позиции
   */
  useEffect(() => {
    if (!isInSpawner && !targetCellRef.current) {
      updateTargetCellFromPosition();
    }
  }, [isInSpawner, targetCellRef, updateTargetCellFromPosition]);

  // ========================================
  // 9. ВОЗВРАЩАЕМЫЙ API
  // ========================================
  
  /**
   * Всё, что нужно компоненту TileView для отрисовки и взаимодействия
   */
  return {
    position,        // Animated.ValueXY - позиция плитки
    width,           // Animated.Value - ширина плитки
    height,          // Animated.Value - высота плитки
    panHandlers,     // Обработчики жестов для Animated.View
    isInSpawner,     // Флаг для отладки (можно показать на экране)
  };
};

export default useDraggable;
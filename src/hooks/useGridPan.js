// src/hooks/useGridPan.js

import { Gesture } from 'react-native-gesture-handler';
import { useRef } from 'react';
import { Dimensions } from 'react-native';
import { useGrid } from '../context/GridContext';
import { useZoom } from './useZoom';
import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
import { clampOffsetToGridBounds } from '../utils/constraints';

/**
 * Хук жеста панорамирования (пана) игровой сетки.
 *
 * Возвращает объект Pan-жеста для react-native-gesture-handler,
 * который нужно привязать к корневому View сетки.
 *
 * Алгоритм обработки жеста:
 * 1. При начале жеста фиксируются текущее смещение и начальная позиция пальца.
 * 2. При каждом движении вычисляется дельта относительно предыдущего кадра.
 * 3. Новое смещение ограничивается функцией `clampOffsetToGridBounds`, чтобы
 *    сетка не уходила за пределы экрана дальше допустимого.
 * 4. Смещение записывается напрямую через `setOffsetDirect` (без анимации)
 *    для максимальной отзывчивости.
 *
 * Ограничения:
 * - Только один палец (minPointers/maxPointers = 1); два пальца — зум.
 * - Нижняя граница учитывает высоту инвентарной панели (90 * scale).
 *
 * @returns {Gesture} — настроенный Pan-жест
 */
export const useGridPan = () => {
  const { offset, setOffsetDirect } = useGrid();
  const { scale } = useZoom();

  /** Перемещение пальца на предыдущем кадре — нужно для вычисления дельты. */
  const lastTranslationRef = useRef({ x: 0, y: 0 });
  /** Смещение сетки в начале текущего жеста — база для накопления дельт. */
  const lastValidOffsetRef = useRef(offset);

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1) // Два и более пальцев — обрабатывается отдельным pinch-жестом
    .onStart(() => {
      // Сбрасываем накопленное перемещение и фиксируем текущее смещение сетки
      lastTranslationRef.current = { x: 0, y: 0 };
      lastValidOffsetRef.current = offset;
    })
    .onUpdate((event) => {
      // Дельта относительно предыдущего кадра (не относительно старта жеста)
      const deltaX = event.translationX - lastTranslationRef.current.x;
      const deltaY = event.translationY - lastTranslationRef.current.y;

      // Инвертируем знак: движение пальца вправо → сетка сдвигается влево (offset растёт)
      const dx = -deltaX;
      const dy = -deltaY;

      const newOffset = {
        x: lastValidOffsetRef.current.x + dx,
        y: lastValidOffsetRef.current.y + dy,
      };

      // Параметры сетки для расчёта допустимых границ
      const screen = Dimensions.get('window');
      const gridConfig = {
        cols: BASE_GRID.COLS,
        rows: BASE_GRID.ROWS,
        cellSize: BASE_GRID.CELL_SIZE,
        baseOffset: BASE_GRID_OFFSET,
      };

      // Ограничиваем смещение: нижний буфер = высота инвентарной панели (90 * scale)
      const clamped = clampOffsetToGridBounds(
        newOffset.x, newOffset.y,
        scale, gridConfig, screen,
        0,          // верхний буфер (px)
        90 * scale  // нижний буфер (px) — учитываем панель инвентаря
      );

      setOffsetDirect(clamped);
      lastValidOffsetRef.current = clamped;

      // Обновляем опорную точку для следующего кадра
      lastTranslationRef.current = {
        x: event.translationX,
        y: event.translationY,
      };
    })
    .onEnd(() => {
      console.log('[GridPan] End');
    });

  return panGesture;
};

// ========================================
// Хук для управления целевой ячейкой плитки
// Отвечает за:
// - Хранение целевой ячейки в ref (null для плитки в спавнере)
// - Загрузку существующей плитки из TilesContext при монтировании
// - Проверку занятости ячейки (isCellFree)
// - Попытку занять ячейку (tryOccupyCell)
// - Освобождение ячейки (releaseCurrentCell)
// - Обновление целевой ячейки по текущей позиции
// ========================================

import { useRef, useCallback, useEffect } from 'react';
import { useTiles } from '../../context/TilesContext';

export const useTileTargetCell = ({
  tileId,                    // ID плитки для логирования
  scale,                      // Текущий масштаб (для пересчёта координат)
  offset,                     // Текущее смещение сетки (для пересчёта координат)
  currentTileSize,            // Ref с текущим размером плитки {width, height}
  currentPositionRef,         // Ref с текущей позицией плитки {x, y}
  isInSpawner,                // Флаг нахождения в спавнере
  setIsInSpawner,             // Функция установки флага спавнера (для синхронизации при загрузке)
  targetCellRef,              // Ref для хранения координат целевой ячейки {col, row} или null
  onCellOccupied,             // Колбэк при успешном занятии ячейки (для отладки)
}) => {
  
  // Получаем методы из контекста плиток
  // isCellOccupied - проверка занятости ячейки (используется внутри)
  // addTile - добавление новой плитки в ячейку
  // moveTile - перемещение существующей плитки из одной ячейки в другую
  // removeTile - удаление плитки из ячейки
  // getTileAt - получение плитки по координатам ячейки
  // getAllTiles - получение всех размещённых плиток
  const { isCellOccupied, addTile, moveTile, removeTile, getTileAt, getAllTiles } = useTiles();

  // ========================================
  // Инициализация при монтировании
  // ========================================

  /**
   * Загружает существующую плитку из контекста при монтировании
   * 
   * Логика:
   * 1. Получаем все размещённые плитки из TilesContext
   * 2. Ищем плитку с нашим tileId
   * 3. Если найдена - устанавливаем targetCellRef и выходим из спавнера
   * 4. Если не найдена - сбрасываем targetCellRef и остаёмся в спавнере
   * 
   * Это позволяет восстановить состояние после перезагрузки приложения
   */
  useEffect(() => {
    if (!tileId) return;

    const allTiles = getAllTiles();
    const existingTile = allTiles.find(t => t.id === tileId);
    
    if (existingTile) {
      console.log(`[Tile ${tileId}] Загружена из ячейки:`, existingTile.col, existingTile.row);
      // Устанавливаем целевую ячейку в соответствии с сохранённой
      targetCellRef.current = { col: existingTile.col, row: existingTile.row };
      // Плитка не в спавнере, а в сетке
      setIsInSpawner(false);
    } else {
      console.log(`[Tile ${tileId}] Нет в сохранённых, в спавнере`);
      // Сбрасываем целевую ячейку (null означает "в спавнере")
      targetCellRef.current = null;
      // Плитка в спавнере
      setIsInSpawner(true);
    }
  }, [tileId, getAllTiles, setIsInSpawner, targetCellRef]);

  // ========================================
  // Методы для работы с ячейками
  // ========================================

  /**
   * Проверяет, свободна ли ячейка (не занята другой плиткой)
   * @param {number} col - колонка
   * @param {number} row - строка
   * @returns {boolean} true если ячейка свободна или занята этой же плиткой
   * 
   * Важно: ячейка считается свободной, если:
   * - В ней вообще нет плитки
   * - В ней лежит наша же плитка (мы можем переместить её)
   */
  const isCellFree = useCallback((col, row) => {
    const tileAtCell = getTileAt(col, row);
    return !tileAtCell || tileAtCell.id === tileId;
  }, [getTileAt, tileId]);

  /**
   * Пытается занять ячейку (добавить или переместить плитку)
   * @param {number} col - колонка
   * @param {number} row - строка
   * @returns {boolean} true если успешно заняли
   * 
   * Процесс:
   * 1. Проверяем, свободна ли ячейка
   * 2. Если нет - возвращаем false
   * 3. Если да - определяем, есть ли уже плитка где-то
   * 4. Если есть - перемещаем (moveTile)
   * 5. Если нет - добавляем новую (addTile)
   * 6. Обновляем targetCellRef
   * 7. Вызываем колбэк
   */
  const tryOccupyCell = useCallback((col, row) => {
    console.log(`[Tile ${tileId}] Попытка занять ячейку [${col},${row}]`);
    
    // Шаг 1: проверка занятости
    if (!isCellFree(col, row)) {
      console.log(`[Tile ${tileId}] Ячейка [${col},${row}] занята, отмена`);
      return false;
    }
    
    // Шаг 2: получаем все плитки
    const allTiles = getAllTiles();
    const existingTile = allTiles.find(t => t.id === tileId);
    
    // Шаг 3: перемещение или добавление
    if (existingTile) {
      // Плитка уже есть в другой ячейке - перемещаем
      console.log(`[Tile ${tileId}] Перемещение из [${existingTile.col},${existingTile.row}] в [${col},${row}]`);
      moveTile(existingTile.col, existingTile.row, col, row, { id: tileId, texture: 'test1' });
    } else {
      // Новая плитка - добавляем
      console.log(`[Tile ${tileId}] Добавление в [${col},${row}]`);
      addTile(col, row, { id: tileId, texture: 'test1' });
    }
    
    // Шаг 4: обновляем целевую ячейку
    targetCellRef.current = { col, row };
    
    // Шаг 5: вызываем колбэк для отладки
    if (onCellOccupied) {
      onCellOccupied(col, row);
    }
    
    return true;
  }, [isCellFree, addTile, moveTile, getAllTiles, tileId, onCellOccupied, targetCellRef]);

  /**
   * Освобождает текущую ячейку (удаляет плитку из контекста)
   * Вызывается при возврате в спавнер
   * 
   * Важно: только если плитка реально была в какой-то ячейке
   */
  const releaseCurrentCell = useCallback(() => {
    if (targetCellRef.current) {
      const { col, row } = targetCellRef.current;
      console.log(`[Tile ${tileId}] Удаляем из ячейки [${col},${row}]`);
      removeTile(col, row);
      targetCellRef.current = null;
    }
  }, [removeTile, tileId, targetCellRef]);

  /**
   * Обновляет целевую ячейку по текущей позиции плитки
   * Используется для синхронизации после выхода из спавнера
   * 
   * Логика:
   * 1. Если плитка в спавнере - ничего не делаем (у неё нет ячейки)
   * 2. Вычисляем центр плитки по текущей позиции
   * 3. Находим ближайшую ячейку к этому центру
   * 4. Если ячейка изменилась - обновляем targetCellRef
   */
  const updateTargetCellFromPosition = useCallback(() => {
    // Плитка в спавнере не имеет целевой ячейки
    if (isInSpawner) return;
    
    const pos = currentPositionRef.current;
    const size = currentTileSize.current;
    
    // Вычисляем центр плитки
    const center = {
      x: pos.x + size.width / 2,
      y: pos.y + size.height / 2
    };
    
    // Динамический импорт для избежания циклических зависимостей
    const { findNearestCell } = require('../../utils/gridUtils');
    
    // Находим ближайшую ячейку с учётом текущих scale и offset
    const cell = findNearestCell(
      center.x, 
      center.y, 
      scale,
      offset.x,
      offset.y
    );
    
    // Обновляем только если ячейка действительно изменилась
    // (предотвращаем лишние логи и возможные циклические обновления)
    if (!targetCellRef.current || 
        targetCellRef.current.col !== cell.col || 
        targetCellRef.current.row !== cell.row) {
      console.log(`[Tile ${tileId}] Обновление целевой ячейки: [${cell.col},${cell.row}]`);
      targetCellRef.current = { col: cell.col, row: cell.row };
    }
  }, [scale, offset, isInSpawner, currentPositionRef, currentTileSize, tileId, targetCellRef]);

  // ========================================
  // Возвращаемый API
  // ========================================
  
  return {
    isCellFree,                    // Проверка занятости ячейки
    tryOccupyCell,                  // Попытка занять ячейку
    releaseCurrentCell,             // Освобождение текущей ячейки
    updateTargetCellFromPosition,   // Обновление по позиции
  };
};
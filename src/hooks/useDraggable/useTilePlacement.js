// ========================================
// ХУК РАЗМЕЩЕНИЯ ПЛИТКИ
// Отвечает за логику размещения плитки при отпускании:
// - Проверка зоны притяжения спавнера
// - Притягивание к спавнеру или к сетке
// - Занятие/освобождение ячеек
// - Возврат в предыдущее положение при неудаче
// ========================================

import { useCallback, useRef } from 'react';
import { useZoom } from '../useZoom';
import { useGrid } from '../../context/GridContext';
import { findNearestCell, getSnapToCellPosition } from '../../utils/gridUtils';
import { getSnapToSpawnerPosition, isInGravityZone } from '../../utils/spawnerUtils';

export const useTilePlacement = ({
  tileId,                    // ID плитки (для отладки)
  spawnerPos,                 // Позиция спавнера {x, y, size}
  currentTileSize,            // Ref с актуальным размером плитки
  currentPositionRef,         // Ref с актуальной позицией плитки
  isInSpawner,                // Флаг: сейчас в спавнере?
  targetCellRef,              // Ref с целевой ячейкой {col, row}
  isCellFree,                 // Функция проверки свободы ячейки
  tryOccupyCell,              // Функция попытки занять ячейку
  releaseCurrentCell,         // Функция освобождения ячейки
  setInSpawner,               // Принудительный вход в спавнер
  setOutOfSpawner,            // Принудительный выход из спавнера
  animateToPosition,          // Функция анимации перемещения
}) => {
  
  // Получаем актуальные значения из контекстов
  const { scale } = useZoom();
  const { offset } = useGrid();
  
  /**
   * Используем ref для хранения актуальных значений scale и offset.
   * Это гарантирует, что даже при замыкании в useCallback мы получим
   * свежие значения в момент вызова функции.
   */
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  
  // Обновляем ref при каждом рендере
  scaleRef.current = scale;
  offsetRef.current = offset;

  /**
   * Проверяет, находится ли центр плитки в зоне притяжения спавнера
   * @param {Object} position - позиция плитки {x, y}
   * @returns {boolean} true если в зоне притяжения
   */
  const checkGravityZone = useCallback((position) => {
    return isInGravityZone(
      position,
      currentTileSize.current,
      spawnerPos
    );
  }, [currentTileSize, spawnerPos]);

  /**
   * Притягивает плитку к спавнеру
   * @returns {Object} позиция для анимации {x, y}
   */
  const snapToSpawner = useCallback(() => {
    console.log(`[Tile ${tileId}] ПРИТЯГИВАЕМ К СПАВНЕРУ`);
    
    // Если плитка была в сетке - освобождаем ячейку
    if (!isInSpawner && targetCellRef.current) {
      releaseCurrentCell();
    }
    
    // Вычисляем позицию для центрирования в спавнере
    const spawnerPosition = getSnapToSpawnerPosition(
      currentTileSize.current, 
      spawnerPos
    );
    
    // Устанавливаем состояние "в спавнере" и сбрасываем целевую ячейку
    setInSpawner(true);
    targetCellRef.current = null;
    
    return spawnerPosition;
  }, [tileId, isInSpawner, targetCellRef, releaseCurrentCell, currentTileSize, spawnerPos, setInSpawner]);

  /**
   * Притягивает плитку к сетке и пытается занять ячейку
   * @returns {Object|null} позиция для анимации или null если не удалось
   */
  const snapToGridAndPlace = useCallback(() => {
    console.log(`[Tile ${tileId}] Притягиваем к сетке`);
    
    const currentPos = currentPositionRef.current;
    const tileSize = currentTileSize.current;
    
    // Вычисляем центр плитки для поиска ближайшей ячейки
    const centerX = currentPos.x + tileSize.width / 2;
    const centerY = currentPos.y + tileSize.height / 2;
    
    // Берем актуальные значения из ref (а не из замыкания)
    const currentScale = scaleRef.current;
    const currentOffset = offsetRef.current;
    
    // Находим ближайшую ячейку к центру плитки
    const targetCell = findNearestCell(
      centerX, 
      centerY, 
      currentScale,
      currentOffset.x,
      currentOffset.y
    );
    
    console.log(`[Tile ${tileId}] Целевая ячейка: [${targetCell.col},${targetCell.row}]`);
    
    // Проверяем, свободна ли целевая ячейка
    if (isCellFree(targetCell.col, targetCell.row)) {
      // Вычисляем точную позицию для этой ячейки
      const snappedPosition = getSnapToCellPosition(
        tileSize,
        targetCell.col,
        targetCell.row,
        currentScale,
        currentOffset.x,
        currentOffset.y
      );
      
      // Пытаемся занять ячейку в контексте
      const success = tryOccupyCell(targetCell.col, targetCell.row);
      
      if (success) {
        console.log(`[Tile ${tileId}] Позиция для ячейки [${targetCell.col},${targetCell.row}]:`, snappedPosition);
        
        // Выходим из спавнера (размер обновится автоматически)
        setOutOfSpawner(true);
        
        return snappedPosition;
      }
    }
    
    console.log(`[Tile ${tileId}] Ячейка занята или ошибка, возврат`);
    return null;
  }, [
    tileId, currentPositionRef, currentTileSize, 
    isCellFree, tryOccupyCell, setOutOfSpawner,
    // scale и offset не используются напрямую, но нужны для пересоздания колбэка
    // при их изменении (значения берутся из ref)
  ]);

  /**
   * Возвращает плитку в предыдущее положение
   * @returns {Object} позиция для анимации {x, y}
   */
  const revertToPrevious = useCallback(() => {
    console.log(`[Tile ${tileId}] Возврат в предыдущее положение`);
    
    // Если плитка была в сетке и есть целевая ячейка - возвращаемся в неё
    if (!isInSpawner && targetCellRef.current) {
      const tileSize = currentTileSize.current;
      const currentScale = scaleRef.current;
      const currentOffset = offsetRef.current;
      
      return getSnapToCellPosition(
        tileSize,
        targetCellRef.current.col,
        targetCellRef.current.row,
        currentScale,
        currentOffset.x,
        currentOffset.y
      );
    } 
    
    // Иначе возвращаемся в спавнер
    return getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
  }, [tileId, isInSpawner, targetCellRef, currentTileSize, spawnerPos]);

  /**
   * Основная функция размещения при отпускании
   * Вызывается из useTileDragHandler
   * @returns {Object} позиция для анимации {x, y}
   */
  const handlePlacement = useCallback(() => {
    const currentPos = currentPositionRef.current;
    
    // Сначала проверяем зону притяжения спавнера
    const inGravityZone = checkGravityZone(currentPos);
    
    console.log(`[Tile ${tileId}] В зоне притяжения:`, inGravityZone);
    
    // ПРИОРИТЕТ 1: Спавнер
    if (inGravityZone) {
      return snapToSpawner();
    }
    
    // ПРИОРИТЕТ 2: Сетка
    const gridPosition = snapToGridAndPlace();
    
    if (gridPosition) {
      return gridPosition;
    } else {
      // Если не удалось разместить в сетке - возвращаемся
      return revertToPrevious();
    }
  }, [tileId, currentPositionRef, checkGravityZone, snapToSpawner, snapToGridAndPlace, revertToPrevious]);

  return {
    handlePlacement,  // Основная функция размещения
    checkGravityZone, // Функция проверки зоны притяжения (для переиспользования)
  };
};
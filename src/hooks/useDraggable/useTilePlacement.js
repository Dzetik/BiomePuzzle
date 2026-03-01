// ========================================
// Хук для логики размещения плитки при отпускании
// Отвечает за принятие решения: спавнер или сетка
// Вызывается из useTileDragHandler при завершении жеста
// ========================================

import { snapToGrid, findNearestCell } from '../../utils/gridUtils';
import { getSnapToSpawnerPosition, isInGravityZone } from '../../utils/spawnerUtils';

export const useTilePlacement = ({
  tileId,                    // ID плитки для логирования
  spawnerPos,                 // Позиция спавнера {x, y, size}
  currentTileSize,            // Ref с текущим размером плитки
  currentPositionRef,         // Ref с текущей позицией плитки
  isInSpawner,                // Флаг: сейчас в спавнере?
  targetCellRef,              // Ref с целевой ячейкой {col, row} или null
  isCellFree,                 // Функция проверки свободы ячейки (из useTileTargetCell)
  tryOccupyCell,              // Функция попытки занять ячейку (из useTileTargetCell)
  releaseCurrentCell,         // Функция освобождения текущей ячейки (из useTileTargetCell)
  setInSpawner,               // Функция принудительного входа в спавнер
  setOutOfSpawner,            // Функция принудительного выхода из спавнера
  animateToPosition,          // Функция анимации перемещения (из useTileAnimations)
  scale,                      // Текущий масштаб
  offset,                     // Текущее смещение сетки
}) => {
  
  /**
   * Проверяет, находится ли центр плитки в зоне притяжения спавнера
   * Использует утилиту isInGravityZone из spawnerUtils
   * @param {Object} position - текущая позиция плитки {x, y}
   * @returns {boolean} true если в зоне притяжения
   */
  const checkGravityZone = (position) => {
    return isInGravityZone(
      position,
      currentTileSize.current,
      spawnerPos
    );
  };

  /**
   * Притягивает плитку к спавнеру
   * Вызывается, если плитка отпущена в зоне притяжения
   * @returns {Object} позиция для анимации {x, y}
   */
  const snapToSpawner = () => {
    console.log(`[Tile ${tileId}] ПРИТЯГИВАЕМ К СПАВНЕРУ`);
    
    // Если плитка была в сетке (не в спавнере) и у неё была ячейка
    if (!isInSpawner && targetCellRef.current) {
      // Удаляем её из контекста плиток (освобождаем ячейку)
      releaseCurrentCell();
    }
    
    // Получаем позицию для центрирования плитки в спавнере
    const spawnerPosition = getSnapToSpawnerPosition(
      currentTileSize.current, 
      spawnerPos
    );
    
    // Устанавливаем флаг "в спавнере" (через колбэк из useTileSpawnerLogic)
    setInSpawner(true);
    
    return spawnerPosition;
  };

  /**
   * Притягивает плитку к сетке и пытается занять ячейку
   * Вызывается, если плитка отпущена вне зоны притяжения
   * @returns {Object|null} позиция для анимации или null если нужно вернуться
   */
  const snapToGridAndPlace = () => {
    console.log(`[Tile ${tileId}] Притягиваем к сетке`);
    
    const currentPos = currentPositionRef.current;
    
    /**
     * 1. Притягиваем позицию плитки к сетке
     * snapToGrid возвращает позицию верхнего левого угла плитки,
     * выровненную по сетке (с учётом scale и offset)
     */
    const snappedPosition = snapToGrid(
      currentPos, 
      currentTileSize.current, 
      scale,
      offset.x,
      offset.y
    );
    
    /**
     * 2. Вычисляем центр плитки после притягивания
     * Нужно для определения, в какую именно ячейку мы попали
     */
    const snappedCenter = {
      x: snappedPosition.x + currentTileSize.current.width / 2,
      y: snappedPosition.y + currentTileSize.current.height / 2
    };
    
    /**
     * 3. Находим ближайшую ячейку к центру плитки
     */
    const targetCell = findNearestCell(
      snappedCenter.x, 
      snappedCenter.y, 
      scale,
      offset.x,
      offset.y
    );
    
    console.log(`[Tile ${tileId}] Целевая ячейка: [${targetCell.col},${targetCell.row}]`);
    
    /**
     * 4. Проверяем, свободна ли ячейка
     * isCellFree учитывает, что ячейка может быть занята этой же плиткой
     */
    if (isCellFree(targetCell.col, targetCell.row)) {
      // 5. Пытаемся занять ячейку (добавить или переместить плитку в контексте)
      const success = tryOccupyCell(targetCell.col, targetCell.row);
      
      if (success) {
        // 6. Если успешно - выходим из спавнера и возвращаем позицию для анимации
        setOutOfSpawner(true);
        return snappedPosition;
      }
    }
    
    /**
     * 7. Если ячейка занята или не удалось занять - возвращаем null
     * Это сигнал для handlePlacement, что нужно вернуться в предыдущее положение
     */
    console.log(`[Tile ${tileId}] Ячейка занята или ошибка, возврат`);
    return null;
  };

  /**
   * Возвращает плитку в предыдущее положение
   * Вызывается, когда не удалось разместить плитку в сетке
   * @returns {Object} позиция для возврата {x, y}
   */
  const revertToPrevious = () => {
    console.log(`[Tile ${tileId}] Возврат в предыдущее положение`);
    
    /**
     * Если плитка была в сетке и у неё есть целевая ячейка
     * Возвращаемся в эту ячейку
     */
    if (!isInSpawner && targetCellRef.current) {
      // Динамический импорт для избежания циклических зависимостей
      const { getCellCenter } = require('../../utils/gridUtils');
      
      // Получаем центр целевой ячейки с учётом текущих scale и offset
      const cellCenter = getCellCenter(
        targetCellRef.current.col,
        targetCellRef.current.row,
        scale,
        offset.x,
        offset.y
      );
      
      // Вычисляем позицию верхнего левого угла плитки
      const prevPosition = {
        x: cellCenter.x - currentTileSize.current.width / 2,
        y: cellCenter.y - currentTileSize.current.height / 2,
      };
      
      return prevPosition;
    } 
    
    /**
     * Иначе (плитка была в спавнере или нет целевой ячейки)
     * Возвращаемся в спавнер
     */
    return getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
  };

  /**
   * Основная функция размещения при отпускании
   * Вызывается из useTileDragHandler.handleRelease
   * 
   * Логика принятия решения:
   * 1. Если плитка в зоне притяжения спавнера → притягиваем к спавнеру
   * 2. Иначе пытаемся притянуть к сетке и занять ячейку
   * 3. Если не получилось занять ячейку → возвращаемся в предыдущее положение
   * 
   * @returns {Object} позиция для анимации {x, y}
   */
  const handlePlacement = () => {
    const currentPos = currentPositionRef.current;
    
    // Проверяем зону притяжения
    const inGravityZone = checkGravityZone(currentPos);
    
    console.log(`[Tile ${tileId}] В зоне притяжения:`, inGravityZone);
    
    // ПРИОРИТЕТ 1: Спавнер (если в зоне притяжения)
    if (inGravityZone) {
      console.log(`[Tile ${tileId}] В зоне притяжения спавнера!`);
      const spawnerPosition = snapToSpawner();
      return spawnerPosition;
    }
    
    // ПРИОРИТЕТ 2: Сетка (если вне зоны притяжения)
    const gridPosition = snapToGridAndPlace();
    
    if (gridPosition) {
      // Успешно разместили в сетке
      return gridPosition;
    } else {
      // Не удалось разместить - возвращаемся
      const revertPosition = revertToPrevious();
      return revertPosition;
    }
  };

  /**
   * Возвращаем API для родительского хука useDraggable
   */
  return {
    handlePlacement,  // Основная функция размещения
    checkGravityZone, // Функция проверки зоны притяжения (может пригодиться)
  };
};
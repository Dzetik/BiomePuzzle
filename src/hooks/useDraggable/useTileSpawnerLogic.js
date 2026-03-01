// ========================================
// ХУК ЛОГИКИ СПАВНЕРА
// Отвечает за:
// - Отслеживание входа/выхода из спавнера при движении
// - Управление размером плитки (в спавнере / вне спавнера)
// - Реакцию на изменение масштаба для плиток вне спавнера
// - Принудительную установку состояния спавнера
// ========================================

import { useCallback, useEffect, useRef } from 'react';
import { isCenterOverSpawner } from '../../utils/spawnerUtils';
import { getSpawnerSize } from '../../constants/spawner';

export const useTileSpawnerLogic = ({
  tileId,                    // ID плитки для отладки
  spawnerPos,                 // Позиция спавнера {x, y, size}
  isSpawnerReady,             // Флаг готовности спавнера
  currentTileSize,            // Ref с текущим размером плитки
  currentPositionRef,         // Ref с текущей позицией плитки
  animateSize,                // Функция анимации размера
  getTileSize,                // Функция получения размера под масштаб
  scale,                      // Текущий масштаб
  isInSpawner,                // Текущее состояние (из useDraggable)
  setIsInSpawner,             // Функция изменения состояния
  onSpawnerStateChange,       // Колбэк при изменении состояния (опционально)
}) => {
  
  // ========================================
  // 1. REFS И КОНСТАНТЫ
  // ========================================
  
  /**
   * Хранит предыдущее состояние спавнера для сравнения
   * Предотвращает лишние вызовы эффектов
   */
  const prevIsInSpawnerRef = useRef(isInSpawner);
  
  /**
   * Размер плитки в спавнере (фиксированный, из конфига)
   */
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };

  // ========================================
  // 2. ФУНКЦИИ ПРОВЕРКИ
  // ========================================

  /**
   * Проверяет, находится ли центр плитки над спавнером
   * @param {Object} position - позиция плитки {x, y}
   * @returns {boolean} true если центр плитки внутри спавнера
   */
  const checkIfInSpawner = useCallback((position) => {
    if (!isSpawnerReady) return false;
    
    return isCenterOverSpawner(
      position,
      currentTileSize.current,
      spawnerPos
    );
  }, [isSpawnerReady, spawnerPos, currentTileSize]);

  // ========================================
  // 3. ОБРАБОТЧИК ИЗМЕНЕНИЯ ПОЗИЦИИ
  // ========================================

  /**
   * Вызывается при каждом изменении позиции плитки
   * Отслеживает вход/выход из спавнера
   * @param {Object} newPosition - новая позиция плитки {x, y}
   */
  const handlePositionChange = useCallback((newPosition) => {
    if (!isSpawnerReady) return;
    
    const inSpawner = checkIfInSpawner(newPosition);
    
    // Если состояние изменилось - обновляем
    if (inSpawner !== isInSpawner) {
      console.log(`[Tile ${tileId}] ${inSpawner ? 'Вход' : 'Выход'} из спавнера`);
      setIsInSpawner(inSpawner);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(inSpawner);
      }
    }
  }, [isSpawnerReady, checkIfInSpawner, isInSpawner, setIsInSpawner, tileId, onSpawnerStateChange]);

  // ========================================
  // 4. УПРАВЛЕНИЕ РАЗМЕРОМ
  // ========================================

  /**
   * Обновляет размер плитки в зависимости от состояния
   * @param {boolean} inSpawner - целевое состояние
   * @param {boolean} immediate - true = мгновенно, false = с анимацией
   */
  const updateSizeForSpawner = useCallback((inSpawner, immediate = false) => {
    if (inSpawner) {
      // В спавнере - фиксированный размер
      animateSize(spawnerTileSize, immediate);
    } else {
      // Вне спавнера - размер под текущий масштаб
      const targetSize = getTileSize(scale);
      animateSize(targetSize, immediate);
    }
  }, [animateSize, getTileSize, scale, spawnerTileSize]);

  // ========================================
  // 5. ЭФФЕКТЫ
  // ========================================

  /**
   * Синхронизация размера при изменении состояния спавнера
   */
  useEffect(() => {
    if (prevIsInSpawnerRef.current !== isInSpawner) {
      console.log(`[Tile ${tileId}] isInSpawner изменился:`, isInSpawner);
      
      // Плавно меняем размер при смене состояния
      updateSizeForSpawner(isInSpawner, false);
      
      prevIsInSpawnerRef.current = isInSpawner;
    }
  }, [isInSpawner, updateSizeForSpawner, tileId]);

  /**
   * Обновление размера при изменении масштаба
   * Важно: только для плиток вне спавнера
   */
  useEffect(() => {
    if (!isInSpawner && isSpawnerReady) {
      updateSizeForSpawner(false, false);
    }
  }, [scale, isInSpawner, isSpawnerReady, updateSizeForSpawner]);

  // ========================================
  // 6. ПРИНУДИТЕЛЬНОЕ УПРАВЛЕНИЕ СОСТОЯНИЕМ
  // ========================================

  /**
   * Принудительный вход в спавнер
   * Вызывается из useTilePlacement при возврате
   */
  const setInSpawner = useCallback(() => {
    if (!isInSpawner) {
      console.log(`[Tile ${tileId}] Принудительный вход в спавнер`);
      setIsInSpawner(true);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(true);
      }
      // Размер обновится в useEffect при изменении isInSpawner
    }
  }, [isInSpawner, setIsInSpawner, tileId, onSpawnerStateChange]);

  /**
   * Принудительный выход из спавнера
   * Вызывается из useTilePlacement при размещении в сетке
   */
  const setOutOfSpawner = useCallback(() => {
    if (isInSpawner) {
      console.log(`[Tile ${tileId}] Принудительный выход из спавнера`);
      setIsInSpawner(false);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(false);
      }
      // Размер обновится в useEffect при изменении isInSpawner
    }
  }, [isInSpawner, setIsInSpawner, tileId, onSpawnerStateChange]);

  // ========================================
  // 7. ВОЗВРАЩАЕМЫЙ API
  // ========================================
  
  return {
    spawnerTileSize,       // Размер плитки в спавнере
    handlePositionChange,  // Для подключения к слушателю позиции
    setInSpawner,          // Принудительный вход
    setOutOfSpawner,       // Принудительный выход
    checkIfInSpawner,      // Проверка нахождения в спавнере
  };
};
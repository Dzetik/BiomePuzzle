// ========================================
// ХУК ЛОГИКИ СПАВНЕРА (v2 - Бесконечный спавнер)
// Отвечает за:
// - Отслеживание входа/выхода из спавнера при движении
// - Управление размером плитки (в спавнере / вне спавнера)
// - Реакцию на изменение масштаба для плиток вне спавнера
// - Принудительную установку состояния спавнера
// - Взаимодействие с TilesContext для генерации новых плиток
// ========================================

import { useCallback, useEffect, useRef } from 'react';
import { isCenterOverSpawner } from '../../utils/spawnerUtils';
import { getSpawnerSize } from '../../constants/spawner';
import { useTiles } from '../../context/TilesContext';

export const useTileSpawnerLogic = ({
  getTileId,                  // Функция для получения актуального ID плитки
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
  tileData,                   // Данные текущей плитки (для возврата в спавнер)
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
   * Флаг, что плитка была взята из спавнера и ещё не размещена
   * Используется для предотвращения множественного создания плиток
   */
  const wasTakenFromSpawnerRef = useRef(false);
  
  /**
   * Размер плитки в спавнере (фиксированный, из конфига)
   */
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };
  
  // Получаем функции из TilesContext
  const { 
    takeTileFromSpawner, 
    returnTileToSpawner,
    hasTileInSpawner,
    getSpawnerTile 
  } = useTiles();

  // Вспомогательная функция для получения ID для логов
  const getLogId = useCallback(() => {
    const id = getTileId();
    return id || 'unknown';
  }, [getTileId]);

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
    const logId = getLogId();
    
    // Если состояние изменилось - обновляем
    if (inSpawner !== isInSpawner) {
      console.log(`[Tile ${logId}] ${inSpawner ? 'Вход' : 'Выход'} из спавнера`);
      setIsInSpawner(inSpawner);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(inSpawner);
      }
      
      // Важно: при входе в спавнер помечаем, что плитка взята из него
      if (inSpawner) {
        wasTakenFromSpawnerRef.current = true;
      }
    }
  }, [isSpawnerReady, checkIfInSpawner, isInSpawner, setIsInSpawner, onSpawnerStateChange, getLogId]);

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
      const logId = getLogId();
      console.log(`[Tile ${logId}] isInSpawner изменился:`, isInSpawner);
      
      // Плавно меняем размер при смене состояния
      updateSizeForSpawner(isInSpawner, false);
      
      prevIsInSpawnerRef.current = isInSpawner;
    }
  }, [isInSpawner, updateSizeForSpawner, getLogId]);

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
      const logId = getLogId();
      console.log(`[Tile ${logId}] Принудительный вход в спавнер`);
      setIsInSpawner(true);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(true);
      }
      
      // Возвращаем плитку в спавнер в контексте
      if (tileData) {
        returnTileToSpawner(tileData);
      }
      
      wasTakenFromSpawnerRef.current = true;
      // Размер обновится в useEffect при изменении isInSpawner
    }
  }, [isInSpawner, setIsInSpawner, onSpawnerStateChange, tileData, returnTileToSpawner, getLogId]);

  /**
   * Принудительный выход из спавнера
   * Вызывается из useTilePlacement при размещении в сетке
   */
  const setOutOfSpawner = useCallback(() => {
    if (isInSpawner) {
      const logId = getLogId();
      console.log(`[Tile ${logId}] Принудительный выход из спавнера`);
      setIsInSpawner(false);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(false);
      }
      
      // Помечаем, что плитка была взята из спавнера
      wasTakenFromSpawnerRef.current = true;
      // Размер обновится в useEffect при изменении isInSpawner
    }
  }, [isInSpawner, setIsInSpawner, onSpawnerStateChange, getLogId]);

  /**
   * Проверяет, нужно ли создать новую плитку в спавнере
   * Вызывается после успешного размещения плитки в сетке
   */
  const ensureSpawnerHasTile = useCallback(() => {
    // Если спавнер пуст - создаём новую плитку
    if (!hasTileInSpawner()) {
      const logId = getLogId();
      console.log(`[Tile ${logId}] Спавнер пуст, создаём новую плитку`);
      // Сигнал для App.js, что нужно создать новую плитку
      return true;
    }
    return false;
  }, [hasTileInSpawner, getLogId]);

  /**
   * Получает текущую плитку из спавнера для перетаскивания
   */
  const acquireTileFromSpawner = useCallback(() => {
    if (!wasTakenFromSpawnerRef.current && hasTileInSpawner()) {
      const tile = takeTileFromSpawner();
      if (tile) {
        const logId = getLogId();
        console.log(`[Tile ${logId}] Получена плитка ${tile.id} из спавнера`);
        wasTakenFromSpawnerRef.current = true;
        return tile;
      }
    }
    return null;
  }, [takeTileFromSpawner, hasTileInSpawner, getLogId]);

  // ========================================
  // 7. ВОЗВРАЩАЕМЫЙ API
  // ========================================
  
  return {
    spawnerTileSize,           // Размер плитки в спавнере
    handlePositionChange,      // Для подключения к слушателю позиции
    setInSpawner,              // Принудительный вход
    setOutOfSpawner,           // Принудительный выход
    checkIfInSpawner,          // Проверка нахождения в спавнере
    ensureSpawnerHasTile,      // Проверка необходимости новой плитки
    acquireTileFromSpawner,    // Получение плитки из спавнера
    wasTakenFromSpawner: wasTakenFromSpawnerRef.current, // Флаг взятия плитки
  };
};
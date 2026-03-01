// ========================================
// Хук для логики спавнера плитки
// Отвечает за:
// - Отслеживание входа/выхода из спавнера при движении
// - Управление размером плитки (в спавнере / вне спавнера)
// - Реакцию на изменение масштаба для плиток вне спавнера
// - Принудительную установку состояния спавнера
// ========================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { isCenterOverSpawner } from '../../utils/spawnerUtils';
import { getSpawnerSize } from '../../constants/spawner';

export const useTileSpawnerLogic = ({
  tileId,                    // ID плитки для логирования
  spawnerPos,                 // Позиция спавнера {x, y, size}
  isSpawnerReady,             // Флаг готовности спавнера (позиция известна)
  currentTileSize,            // Ref с текущим размером плитки
  currentPositionRef,         // Ref с текущей позицией плитки
  animateSize,                // Функция анимации размера (из useTileAnimations)
  getTileSize,                // Функция получения размера под масштаб
  scale,                      // Текущий масштаб
  isInSpawner,                // Текущее состояние (приходит сверху из useDraggable)
  setIsInSpawner,             // Функция изменения состояния (из useDraggable)
  onSpawnerStateChange,       // Колбэк при изменении состояния (для отладки)
}) => {
  
  /**
   * Ref для хранения предыдущего состояния спавнера
   * Нужен, чтобы не вызывать лишние эффекты при каждом рендере
   */
  const prevIsInSpawnerRef = useRef(isInSpawner);
  
  /**
   * Размер спавнера (константа из конфига)
   * spawnerTileSize - размер, который должна иметь плитка, находясь в спавнере
   */
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };

  /**
   * Проверяет, находится ли центр плитки над спавнером
   * Используется в handlePositionChange для определения входа/выхода
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

  /**
   * Обработчик изменения позиции плитки
   * Вызывается из useTileAnimations при каждом изменении позиции (через слушатель)
   * 
   * Логика:
   * 1. Проверяем, изменилось ли состояние (вошла/вышла)
   * 2. Если изменилось - обновляем через setIsInSpawner
   * 
   * @param {Object} newPosition - новая позиция плитки {x, y}
   */
  const handlePositionChange = useCallback((newPosition) => {
    if (!isSpawnerReady) return;
    
    // Определяем, внутри спавнера ли сейчас плитка
    const inSpawner = checkIfInSpawner(newPosition);
    
    // Если состояние изменилось
    if (inSpawner !== isInSpawner) {
      console.log(`[Tile ${tileId}] ${inSpawner ? 'Вход' : 'Выход'} из спавнера`);
      // Обновляем состояние в родительском хуке
      setIsInSpawner(inSpawner); 
      
      // Вызываем колбэк для отладки
      if (onSpawnerStateChange) {
        onSpawnerStateChange(inSpawner);
      }
    }
  }, [isSpawnerReady, checkIfInSpawner, isInSpawner, setIsInSpawner, tileId, onSpawnerStateChange]);

  /**
   * Обновляет размер плитки в зависимости от состояния спавнера
   * @param {boolean} inSpawner - целевое состояние
   * @param {boolean} immediate - true = мгновенно, false = с анимацией
   */
  const updateSizeForSpawner = useCallback((inSpawner, immediate = false) => {
    if (inSpawner) {
      // В спавнере - размер равен размеру спавнера
      animateSize(spawnerTileSize, immediate);
    } else {
      // Вне спавнера - обычный размер под текущий масштаб
      animateSize(getTileSize(scale), immediate);
    }
  }, [animateSize, getTileSize, scale, spawnerTileSize]);

  /**
   * Эффект: синхронизация размера с состоянием спавнера
   * Срабатывает при изменении isInSpawner
   */
  useEffect(() => {
    // Проверяем, действительно ли изменилось состояние
    if (prevIsInSpawnerRef.current !== isInSpawner) {
      console.log(`[Tile ${tileId}] isInSpawner изменился:`, isInSpawner);
      updateSizeForSpawner(isInSpawner);
      prevIsInSpawnerRef.current = isInSpawner;
    }
  }, [isInSpawner, updateSizeForSpawner, tileId]);

  /**
   * Эффект: обновление размера при изменении масштаба
   * Важно: обновляем размер ТОЛЬКО если плитка НЕ в спавнере
   * Плитка в спавнере всегда имеет фиксированный размер (spawnerTileSize)
   */
  useEffect(() => {
    if (!isInSpawner && isSpawnerReady) {
      updateSizeForSpawner(false);
    }
  }, [scale, isInSpawner, isSpawnerReady, updateSizeForSpawner]);

  /**
   * Принудительно устанавливает состояние "в спавнере"
   * Используется в useTilePlacement при возврате в спавнер
   * @param {boolean} immediate - true = мгновенно изменить размер
   */
  const setInSpawner = useCallback((immediate = false) => {
    if (!isInSpawner) {
      console.log(`[Tile ${tileId}] Принудительный вход в спавнер`);
      setIsInSpawner(true);
      updateSizeForSpawner(true, immediate);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(true);
      }
    }
  }, [isInSpawner, setIsInSpawner, updateSizeForSpawner, tileId, onSpawnerStateChange]);

  /**
   * Принудительно устанавливает состояние "вне спавнера"
   * Используется в useTilePlacement при размещении в сетке
   * @param {boolean} immediate - true = мгновенно изменить размер
   */
  const setOutOfSpawner = useCallback((immediate = false) => {
    if (isInSpawner) {
      console.log(`[Tile ${tileId}] Принудительный выход из спавнера`);
      setIsInSpawner(false);
      updateSizeForSpawner(false, immediate);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(false);
      }
    }
  }, [isInSpawner, setIsInSpawner, updateSizeForSpawner, tileId, onSpawnerStateChange]);

  /**
   * Возвращаем API для родительского хука useDraggable
   */
  return {
    isInSpawner,           // Текущее состояние (дублируется, но для удобства)
    spawnerTileSize,       // Размер плитки в спавнере
    handlePositionChange,  // Для подключения к слушателю позиции
    setInSpawner,          // Принудительный вход
    setOutOfSpawner,       // Принудительный выход
    checkIfInSpawner,      // Функция проверки (может пригодиться)
  };
};
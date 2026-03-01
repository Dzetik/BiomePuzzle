// ========================================
// УТИЛИТЫ ДЛЯ РАБОТЫ СО СПАВНЕРОМ
// Содержат все функции для:
// - Проверки нахождения плитки в спавнере
// - Проверки нахождения в зоне притяжения
// - Расчёта позиции для центрирования в спавнере
// ========================================

import { 
  getGravityZoneSize, 
  getGravityZonePadding, 
  isGravityZoneEnabled 
} from '../constants/spawner';

/**
 * Проверяет, находится ли центр плитки над спавнером
 * Используется для определения момента входа/выхода из спавнера
 * 
 * @param {Object} tilePosition - позиция плитки {x, y}
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {Object} spawnerPos - позиция спавнера {x, y, size}
 * @returns {boolean} true если центр плитки внутри спавнера
 * 
 * Логика: центр плитки должен быть внутри прямоугольника спавнера
 */
export const isCenterOverSpawner = (tilePosition, tileSize, spawnerPos) => {
  // Вычисляем центр плитки (верхний левый угол + половина размера)
  const tileCenter = {
    x: tilePosition.x + tileSize.width / 2,
    y: tilePosition.y + tileSize.height / 2,
  };
  
  // Проверяем, находится ли центр внутри прямоугольника спавнера
  return (
    tileCenter.x >= spawnerPos.x &&                    // Не левее левого края
    tileCenter.x <= spawnerPos.x + spawnerPos.size &&  // Не правее правого края
    tileCenter.y >= spawnerPos.y &&                    // Не выше верхнего края
    tileCenter.y <= spawnerPos.y + spawnerPos.size      // Не ниже нижнего края
  );
};

/**
 * Проверяет, находится ли центр плитки в зоне притяжения спавнера
 * Используется для решения: притягивать к спавнеру или к сетке
 * 
 * @param {Object} tilePosition - позиция плитки {x, y}
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {Object} spawnerPos - позиция спавнера {x, y, size}
 * @returns {boolean} true если плитка в зоне притяжения
 * 
 * Зона притяжения - это квадрат вокруг спавнера, размер которого
 * задаётся в конфиге (через sizeMultiplier или absoluteSize)
 */
export const isInGravityZone = (tilePosition, tileSize, spawnerPos) => {
  // Если зона притяжения отключена в конфиге, всегда возвращаем false
  if (!isGravityZoneEnabled()) {
    return false;
  }
  
  // Вычисляем центр плитки
  const tileCenter = {
    x: tilePosition.x + tileSize.width / 2,
    y: tilePosition.y + tileSize.height / 2,
  };
  
  // Получаем размер зоны притяжения и отступ от краёв спавнера
  // zoneSize - общий размер зоны (ширина и высота)
  // padding - расстояние от края спавнера до края зоны
  const zoneSize = getGravityZoneSize();
  const padding = getGravityZonePadding();
  
  // Вычисляем границы зоны притяжения
  // Зона центрирована относительно спавнера, поэтому:
  // - левый край = левый край спавнера минус padding
  // - верхний край = верхний край спавнера минус padding
  const zoneX = spawnerPos.x - padding;
  const zoneY = spawnerPos.y - padding;
  
  // Проверяем, находится ли центр плитки внутри зоны
  return (
    tileCenter.x >= zoneX &&                    // Не левее левого края зоны
    tileCenter.x <= zoneX + zoneSize &&         // Не правее правого края зоны
    tileCenter.y >= zoneY &&                    // Не выше верхнего края зоны
    tileCenter.y <= zoneY + zoneSize             // Не ниже нижнего края зоны
  );
};

/**
 * Получает позицию для центрирования плитки в спавнере
 * Используется при:
 * - Начальном размещении плитки
 * - Возврате плитки в спавнер
 * 
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {Object} spawnerPos - позиция спавнера {x, y, size}
 * @returns {Object} позиция верхнего левого угла плитки {x, y}
 * 
 * Формула: 
 * x = левый край спавнера + (ширина спавнера - ширина плитки) / 2
 * y = верхний край спавнера + (высота спавнера - высота плитки) / 2
 * 
 * Это гарантирует, что плитка будет точно по центру спавнера
 */
export const getSnapToSpawnerPosition = (tileSize, spawnerPos) => {
  return {
    x: spawnerPos.x + (spawnerPos.size - tileSize.width) / 2,
    y: spawnerPos.y + (spawnerPos.size - tileSize.height) / 2,
  };
};

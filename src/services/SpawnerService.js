// ========================================
// ЕДИНЫЙ СЕРВИС СПАВНЕРА
// Объединяет spawnerUtils.js + SpawnerService.js
// ========================================
import { Dimensions } from 'react-native';
import {
  SPAWNER_CONFIG,
  getSpawnerSize,
  getSpawnerPositionConfig,
  getGravityZoneSize,
  getGravityZonePadding,
  isGravityZoneEnabled
} from '../constants/spawner';

export const SpawnerService = {
  // ========================================
  // ПОЗИЦИЯ СПАВНЕРА НА ЭКРАНЕ
  // ========================================
  
  /**
   * Вычисляет позицию спавнера на экране
   * @returns {Object} { x, y, size }
   */
  calculatePosition: () => {
    const { width: screenWidth } = Dimensions.get('window');
    const spawnerSize = getSpawnerSize();
    const positionConfig = getSpawnerPositionConfig();

    const x = screenWidth - spawnerSize - positionConfig.offset.right;
    const y = positionConfig.offset.top;

    return { x, y, size: spawnerSize };
  },

  /**
   * Получает размер спавнера
   * @returns {number}
   */
  getSize: () => {
    return getSpawnerSize();
  },

  // ========================================
  // ПРОВЕРКИ ПОЗИЦИИ ПЛИТКИ
  // ========================================
  
  /**
   * Проверяет, находится ли центр плитки над спавнером
   * @param {Object} tilePosition - позиция плитки {x, y}
   * @param {Object} tileSize - размер плитки {width, height}
   * @param {Object} spawnerPos - позиция спавнера {x, y, size}
   * @returns {boolean} true если центр плитки внутри спавнера
   */
  isCenterOverSpawner: (tilePosition, tileSize, spawnerPos) => {
    if (!spawnerPos || !tilePosition || !tileSize) return false;
    
    const tileCenter = {
      x: tilePosition.x + tileSize.width / 2,
      y: tilePosition.y + tileSize.height / 2,
    };

    return (
      tileCenter.x >= spawnerPos.x &&
      tileCenter.x <= spawnerPos.x + spawnerPos.size &&
      tileCenter.y >= spawnerPos.y &&
      tileCenter.y <= spawnerPos.y + spawnerPos.size
    );
  },

  /**
   * Проверяет, находится ли плитка в зоне притяжения спавнера
   * @param {Object} tilePosition - позиция плитки {x, y}
   * @param {Object} tileSize - размер плитки {width, height}
   * @param {Object} spawnerPos - позиция спавнера {x, y, size}
   * @returns {boolean} true если плитка в зоне притяжения
   */
  isInGravityZone: (tilePosition, tileSize, spawnerPos) => {
    if (!spawnerPos || !tilePosition || !tileSize) return false;
    
    if (!isGravityZoneEnabled()) {
      return false;
    }

    const tileCenter = {
      x: tilePosition.x + tileSize.width / 2,
      y: tilePosition.y + tileSize.height / 2,
    };

    const zoneSize = getGravityZoneSize();
    const padding = getGravityZonePadding();

    const zoneX = spawnerPos.x - padding;
    const zoneY = spawnerPos.y - padding;

    return (
      tileCenter.x >= zoneX &&
      tileCenter.x <= zoneX + zoneSize &&
      tileCenter.y >= zoneY &&
      tileCenter.y <= zoneY + zoneSize
    );
  },

  /**
   * Проверяет находится ли точка в зоне спавнера
   * @param {Object} position - { x, y }
   * @param {Object} spawnerPos - { x, y, size }
   * @returns {boolean}
   */
  isPointInSpawner: (position, spawnerPos) => {
    if (!spawnerPos || !position) return false;
    
    return (
      position.x >= spawnerPos.x &&
      position.x <= spawnerPos.x + spawnerPos.size &&
      position.y >= spawnerPos.y &&
      position.y <= spawnerPos.y + spawnerPos.size
    );
  },

  // ========================================
  // ПОЗИЦИОНИРОВАНИЕ ПЛИТКИ
  // ========================================
  
  /**
   * Вычисляет позицию для центрирования плитки в спавнере
   * @param {Object} tileSize - размер плитки {width, height}
   * @param {Object} spawnerPos - позиция спавнера {x, y, size}
   * @returns {Object} позиция {x, y}
   */
  getSnapToSpawnerPosition: (tileSize, spawnerPos) => {
    if (!spawnerPos || !tileSize) {
      return { x: 0, y: 0 };
    }
    
    return {
      x: spawnerPos.x + (spawnerPos.size - tileSize.width) / 2,
      y: spawnerPos.y + (spawnerPos.size - tileSize.height) / 2,
    };
  },

  /**
   * Вычисляет позицию для плитки в спавнере (алиас)
   * @param {Object} tileSize - размер плитки {width, height}
   * @param {Object} spawnerPos - позиция спавнера {x, y, size}
   * @returns {Object} { x, y }
   */
  getTilePosition: (tileSize, spawnerPos) => {
    return SpawnerService.getSnapToSpawnerPosition(tileSize, spawnerPos);
  },

  // ========================================
  // КОНФИГУРАЦИЯ
  // ========================================
  
  /**
   * Получает настройки зоны притяжения
   */
  getGravityZoneConfig: () => ({
    enabled: isGravityZoneEnabled(),
    size: getGravityZoneSize(),
    padding: getGravityZonePadding(),
  }),

  /**
   * Получает визуальные настройки зоны
   */
  getGravityZoneVisual: () => SPAWNER_CONFIG.gravityZone.visual,
};

export default SpawnerService;
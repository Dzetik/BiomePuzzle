import { TILE_SIZES } from './tile';
import { GRID_OFFSET } from './grid';

// ========================================
// Конфигурация спавнера - единый источник истины
// ========================================

export const SPAWNER_CONFIG = {
  // Позиция спавнера по умолчанию
  defaultPosition: {
    type: 'right',
    offset: {
      top: GRID_OFFSET.y,
      right: 20,
    }
  },
  // Размер спавнера
  size: TILE_SIZES.large.width,
  
  // Настройки зоны притяжения
  gravityZone: {
    // Включена ли зона притяжения
    enabled: true,
    
    // Размер зоны относительно спавнера (множитель)
    // Например: 2 = зона в 2 раза больше спавнера по каждой стороне
    sizeMultiplier: 1.1,
    
    // Можно задать абсолютный размер в пикселях (если нужно)
    // Если null, используется sizeMultiplier
    absoluteSize: null,
    
    // Визуальные настройки
    visual: {
      // Показывать ли зону притяжения
      showZone: true,
      
      // Цвет зоны (RGBA)
      color: 'rgba(76, 175, 80, 0.03)',
      
      // Цвет границы
      borderColor: 'rgba(76, 175, 80, 0.15)',
      
      // Толщина границы
      borderWidth: 2,
      
      // Стиль границы: 'solid', 'dashed', 'dotted'
      borderStyle: 'dashed',
    },
    
    // Поведение притяжения
    behavior: {
      // Притягивать только если плитка полностью остановлена
      attractOnRelease: true,
      
      // Притягивать во время движения (если true, может дергаться)
      attractDuringDrag: false,
      
      // Мгновенное притяжение или с анимацией
      smoothAttraction: true,
      
      // Длительность анимации притяжения (мс)
      animationDuration: 300,
    },
  },
};

// ========================================
// Геттеры для зоны притяжения
// ========================================

// Получить размер зоны притяжения в пикселях
export const getGravityZoneSize = () => {
  const { absoluteSize, sizeMultiplier } = SPAWNER_CONFIG.gravityZone;
  
  // Если задан абсолютный размер, используем его
  if (absoluteSize !== null) {
    return absoluteSize;
  }
  
  // Иначе вычисляем через множитель
  return SPAWNER_CONFIG.size * sizeMultiplier;
};

// Получить отступ зоны притяжения от края спавнера
export const getGravityZonePadding = () => {
  const zoneSize = getGravityZoneSize();
  return (zoneSize - SPAWNER_CONFIG.size) / 2;
};

// Проверить, включена ли зона притяжения
export const isGravityZoneEnabled = () => SPAWNER_CONFIG.gravityZone.enabled;

// Получить визуальные настройки зоны
export const getGravityZoneVisual = () => SPAWNER_CONFIG.gravityZone.visual;

// Получить настройки поведения
export const getGravityZoneBehavior = () => SPAWNER_CONFIG.gravityZone.behavior;

// ========================================
// Существующие геттеры 
// ========================================

export const getSpawnerSize = () => SPAWNER_CONFIG.size;
export const getSpawnerPositionConfig = () => SPAWNER_CONFIG.defaultPosition;
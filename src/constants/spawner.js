import { TILE_SIZES } from './tile';
import { GRID_OFFSET } from './grid';

// ========================================
// Конфигурация спавнера - единый источник истины
// ========================================

export const SPAWNER_CONFIG = {
  // Позиция спавнера по умолчанию
  defaultPosition: {
    type: 'right', // 'right' - справа от сетки
    offset: {
      top: GRID_OFFSET.y,      // Отступ сверху (на одном уровне с сеткой)
      right: 20,               // Отступ справа от края экрана
    }
  },
  // Размер спавнера (квадратный, берем из размеров большой плитки)
  size: TILE_SIZES.large.width,
};

// Геттеры для получения текущих значений конфигурации
export const getSpawnerSize = () => SPAWNER_CONFIG.size;
export const getSpawnerPositionConfig = () => SPAWNER_CONFIG.defaultPosition;
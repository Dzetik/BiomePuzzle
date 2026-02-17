import { TILE_SIZES } from './tile';
import { GRID_OFFSET } from './grid';

// Конфигурация спавнера
export const SPAWNER_CONFIG = {
  defaultPosition: {
    type: 'right',
    offset: {
      top: GRID_OFFSET.y,
      right: 20,
    }
  },
  size: TILE_SIZES.large.width,
};

export const getSpawnerSize = () => SPAWNER_CONFIG.size;
export const getSpawnerPositionConfig = () => SPAWNER_CONFIG.defaultPosition;
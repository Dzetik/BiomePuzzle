import { GRID, GRID_OFFSET } from '../constants/grid';
import { getCachedSpawnerPosition } from '../components/SpawnerCellView';

export const isCenterOverSpawner = (position, tileSize) => {
  const spawnerPos = getCachedSpawnerPosition();
  if (!spawnerPos || !tileSize || !position) return false;
  
  const centerX = position.x + tileSize.width / 2;
  const centerY = position.y + tileSize.height / 2;
  
  return (
    centerX >= spawnerPos.x &&
    centerX <= spawnerPos.x + spawnerPos.size &&
    centerY >= spawnerPos.y &&
    centerY <= spawnerPos.y + spawnerPos.size
  );
};

export const getSnapToSpawnerPosition = (tileSize) => {
  const spawnerPos = getCachedSpawnerPosition();
  if (!spawnerPos || !tileSize) return { x: 0, y: 0 };
  
  const spawnerCenterX = spawnerPos.x + spawnerPos.size / 2;
  const spawnerCenterY = spawnerPos.y + spawnerPos.size / 2;
  
  return {
    x: Math.round(spawnerCenterX - tileSize.width / 2),
    y: Math.round(spawnerCenterY - tileSize.height / 2)
  };
};

const snapToGridPosition = (position) => {
  const localX = position.x - GRID_OFFSET.x;
  const localY = position.y - GRID_OFFSET.y;
  
  const col = Math.round(localX / GRID.CELL_SIZE);
  const row = Math.round(localY / GRID.CELL_SIZE);
  
  const clampedCol = Math.max(0, Math.min(col, GRID.COLS - 1));
  const clampedRow = Math.max(0, Math.min(row, GRID.ROWS - 1));
  
  return {
    x: GRID_OFFSET.x + clampedCol * GRID.CELL_SIZE,
    y: GRID_OFFSET.y + clampedRow * GRID.CELL_SIZE,
  };
};

export const snapToGrid = (position, tileSize = null) => {
  if (!position || !tileSize) return { ...position };
  
  if (isCenterOverSpawner(position, tileSize)) {
    return getSnapToSpawnerPosition(tileSize);
  }
  
  return snapToGridPosition(position);
};
import { BASE_GRID, BASE_GRID_OFFSET, VIRTUAL_GRID, MAX_EMPTY_CELLS } from '../constants/grid';
import { Dimensions } from 'react-native';

export const getVisibleBounds = (offsetX, offsetY, scale) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  const baseOffset = BASE_GRID_OFFSET.x * scale;
  
  const startCol = Math.floor((-baseOffset + offsetX) / cellSize - 1);
  const endCol = Math.ceil((screenWidth - baseOffset + offsetX) / cellSize + 1);
  const startRow = Math.floor((-baseOffset + offsetY) / cellSize - 1);
  const endRow = Math.ceil((screenHeight - baseOffset + offsetY) / cellSize + 1);
  
  return {
    startCol: Math.max(VIRTUAL_GRID.MIN_COL, startCol),
    endCol: Math.min(VIRTUAL_GRID.MAX_COL, endCol),
    startRow: Math.max(VIRTUAL_GRID.MIN_ROW, startRow),
    endRow: Math.min(VIRTUAL_GRID.MAX_ROW, endRow),
  };
};

export const isOffsetValid = (offsetX, offsetY, scale, bounds) => {
  if (!bounds) return true;
  
  const { minCol, maxCol, minRow, maxRow } = bounds;
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  
  const minOffsetX = -(minCol * cellSize) - (MAX_EMPTY_CELLS * cellSize);
  const maxOffsetX = -(maxCol * cellSize) + (MAX_EMPTY_CELLS * cellSize);
  const minOffsetY = -(minRow * cellSize) - (MAX_EMPTY_CELLS * cellSize);
  const maxOffsetY = -(maxRow * cellSize) + (MAX_EMPTY_CELLS * cellSize);
  
  return (
    offsetX >= minOffsetX && 
    offsetX <= maxOffsetX && 
    offsetY >= minOffsetY && 
    offsetY <= maxOffsetY
  );
};

export const clampOffset = (offsetX, offsetY, scale, bounds) => {
  if (!bounds) return { x: offsetX, y: offsetY };
  
  const { minCol, maxCol, minRow, maxRow } = bounds;
  const cellSize = BASE_GRID.CELL_SIZE * scale;
  
  const minOffsetX = -(minCol * cellSize) - (MAX_EMPTY_CELLS * cellSize);
  const maxOffsetX = -(maxCol * cellSize) + (MAX_EMPTY_CELLS * cellSize);
  const minOffsetY = -(minRow * cellSize) - (MAX_EMPTY_CELLS * cellSize);
  const maxOffsetY = -(maxRow * cellSize) + (MAX_EMPTY_CELLS * cellSize);
  
  return {
    x: Math.max(minOffsetX, Math.min(maxOffsetX, offsetX)),
    y: Math.max(minOffsetY, Math.min(maxOffsetY, offsetY)),
  };
};
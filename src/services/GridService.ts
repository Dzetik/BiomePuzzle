// src/services/GridService.ts

import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
import { DEFAULT_TILE_SIZE } from '../constants/tile';

export interface GridCell {
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface GridServiceConfig {
  cellSize: number;
  gridOffset: { x: number; y: number };
  scale: number;
  gridBounds: {
    startCol: number;
    endCol: number;
    startRow: number;
    endRow: number;
  };
}

class GridServiceClass {
  private config: GridServiceConfig | null = null;
  private occupiedCells: Map<string, string> = new Map();

  configure(config: GridServiceConfig) {
    this.config = config;
  }

  /**
   * Найти ячейку по координатам (формула из gridUtils.js)
   */
  findCellAtPosition(
    x: number,
    y: number,
    tileSize: number = DEFAULT_TILE_SIZE.width
  ): GridCell | null {
    if (!this.config) {
      console.log('[GridService] ❌ Not configured!');
      return null;
    }

    const { gridOffset, scale, gridBounds } = this.config;
    
    // 🔥 Формула из gridUtils.js: масштабируем base offset и cell size
    const scaledCellSize = BASE_GRID.CELL_SIZE * scale;
    const baseOffsetX = BASE_GRID_OFFSET.x * scale;
    const baseOffsetY = BASE_GRID_OFFSET.y * scale;

    // 🔥 Центр плитки (tileSize уже масштабируется в useDraggable)
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    // 🔥 Формула из findNearestCell: (center + offset - baseOffset) / cellSize
    const gridX = (centerX + gridOffset.x - baseOffsetX) / scaledCellSize;
    const gridY = (centerY + gridOffset.y - baseOffsetY) / scaledCellSize;

    const col = Math.floor(gridX);
    const row = Math.floor(gridY);

    // Проверяем границы
    if (
      col < gridBounds.startCol ||
      col > gridBounds.endCol ||
      row < gridBounds.startRow ||
      row > gridBounds.endRow
    ) {
      return null;
    }

    // Вычисляем позицию для анимации
    const snapPos = this.getSnapPosition(col, row, tileSize);
    if (!snapPos) return null;

    return { col, row, x: snapPos.x, y: snapPos.y };
  }

  isCellFree(col: number, row: number): boolean {
    const key = `${col},${row}`;
    return !this.occupiedCells.has(key);
  }

  occupyCell(col: number, row: number, tileId: string): boolean {
    const key = `${col},${row}`;
    if (this.occupiedCells.has(key)) {
      return false;
    }
    this.occupiedCells.set(key, tileId);
    return true;
  }

  releaseCell(col: number, row: number): void {
    const key = `${col},${row}`;
    this.occupiedCells.delete(key);
  }

  releaseCellByTileId(tileId: string): void {
    for (const [key, id] of this.occupiedCells.entries()) {
      if (id === tileId) {
        this.occupiedCells.delete(key);
        break;
      }
    }
  }

  /**
   * Получить позицию для привязки к ячейке
   * 🔥 ИСПРАВЛЕНО: tileSize уже включает scale
   */
  getSnapPosition(
    col: number,
    row: number,
    tileSize: number = DEFAULT_TILE_SIZE.width  // ← Базовый размер (90)
    ): { x: number; y: number } | null {
    if (!this.config) return null;

    const { gridOffset, scale } = this.config;
    
    const scaledCellSize = BASE_GRID.CELL_SIZE * scale;
    const baseOffsetX = BASE_GRID_OFFSET.x * scale;
    const baseOffsetY = BASE_GRID_OFFSET.y * scale;

    // Центр ячейки
    const centerX = baseOffsetX + col * scaledCellSize + scaledCellSize / 2 - gridOffset.x;
    const centerY = baseOffsetY + row * scaledCellSize + scaledCellSize / 2 - gridOffset.y;

    // 🔥 Масштабируем базовый размер плитки
    const scaledTileSize = tileSize * scale;  // 90 * 0.84 = 75.6
    const x = centerX - scaledTileSize / 2;
    const y = centerY - scaledTileSize / 2;

    console.log('[GridService] 🎯 Snap position:', {
        col, row, scale,
        tileSize,           // Базовый: 90
        scaledTileSize,     // Масштабированный: 75.6
        computedX: x,
        computedY: y,
    });

    return { x, y };
    }
}

export const GridService = new GridServiceClass();
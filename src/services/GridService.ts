// src/services/GridService.ts

import { BASE_GRID, BASE_GRID_OFFSET } from '../constants/grid';
import { DEFAULT_TILE_SIZE } from '../constants/tile';

/**
 * Координаты одной ячейки сетки — логические (col, row)
 * и экранные (x, y) в пикселях относительно корня экрана.
 */
export interface GridCell {
  col: number;
  row: number;
  x: number;
  y: number;
}

/**
 * Конфигурация сетки, передаваемая в GridService.configure().
 *
 * Задаёт размер ячейки, смещение сетки относительно экрана,
 * масштаб (zoom) и допустимые границы колонок/строк.
 */
export interface GridServiceConfig {
  /** Базовый размер ячейки в пикселях (до применения масштаба). */
  cellSize: number;
  /** Текущее смещение сетки в пикселях (пан). */
  gridOffset: { x: number; y: number };
  /** Коэффициент масштабирования (pinch-to-zoom). */
  scale: number;
  /** Допустимый диапазон колонок и строк. Выход за границы — невалидная ячейка. */
  gridBounds: {
    startCol: number;
    endCol: number;
    startRow: number;
    endRow: number;
  };
}

/**
 * Синглтон-сервис управления игровой сеткой.
 *
 * Отвечает за три задачи:
 * 1. Перевод экранных координат в логические координаты ячейки (hit-test).
 * 2. Вычисление позиции привязки (snap) для размещения плитки в ячейке.
 * 3. Отслеживание занятости ячеек (occupied cells registry).
 *
 * Перед использованием необходимо вызвать `configure()` с актуальными
 * параметрами сетки. Экземпляр создаётся один раз и экспортируется
 * как `GridService`.
 */
class GridServiceClass {
  /** Текущая конфигурация сетки. Null до первого вызова configure(). */
  private config: GridServiceConfig | null = null;

  /**
   * Реестр занятых ячеек.
   * Ключ: `"col,row"`, значение: ID плитки, занимающей ячейку.
   */
  private occupiedCells: Map<string, string> = new Map();

  /**
   * Устанавливает конфигурацию сетки.
   *
   * Должен вызываться при каждом изменении масштаба, смещения или размеров
   * сетки, чтобы расчёты оставались актуальными.
   *
   * @param config - новая конфигурация сетки
   */
  configure(config: GridServiceConfig) {
    this.config = config;
  }

  /**
   * Определяет ячейку сетки, над которой находится плитка с заданной
   * экранной позицией верхнего левого угла.
   *
   * Алгоритм:
   * 1. Вычисляет центр плитки по переданным координатам и размеру.
   * 2. Переводит центр из экранного пространства в пространство сетки
   *    с учётом масштаба и текущего смещения (пана).
   * 3. Возвращает null, если ячейка выходит за допустимые границы.
   *
   * @param x        - экранная X-координата верхнего левого угла плитки
   * @param y        - экранная Y-координата верхнего левого угла плитки
   * @param tileSize - размер плитки в пикселях (по умолчанию DEFAULT_TILE_SIZE.width)
   * @returns объект GridCell с логическими и экранными координатами, либо null
   */
  findCellAtPosition(
    x: number,
    y: number,
    tileSize: number = DEFAULT_TILE_SIZE.width
  ): GridCell | null {
    if (!this.config) {
      return null;
    }

    const { gridOffset, scale, gridBounds } = this.config;

    // Размер одной ячейки в экранных пикселях с учётом текущего масштаба
    const scaledCellSize = BASE_GRID.CELL_SIZE * scale;
    // Базовое смещение начала сетки от края экрана (масштабируется вместе с сеткой)
    const baseOffsetX = BASE_GRID_OFFSET.x * scale;
    const baseOffsetY = BASE_GRID_OFFSET.y * scale;

    // Центр плитки в экранных координатах
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    // Перевод экранных координат центра в дробные координаты сетки.
    // gridOffset — текущий пан (смещение сетки), вычитается для компенсации.
    const gridX = (centerX + gridOffset.x - baseOffsetX) / scaledCellSize;
    const gridY = (centerY + gridOffset.y - baseOffsetY) / scaledCellSize;

    // Целочисленные индексы ячейки
    const col = Math.floor(gridX);
    const row = Math.floor(gridY);

    // Проверка, что ячейка находится в допустимой зоне сетки
    if (
      col < gridBounds.startCol ||
      col > gridBounds.endCol ||
      row < gridBounds.startRow ||
      row > gridBounds.endRow
    ) {
      return null;
    }

    const snapPos = this.getSnapPosition(col, row, tileSize);
    if (!snapPos) return null;

    return { col, row, x: snapPos.x, y: snapPos.y };
  }

  /**
   * Проверяет, свободна ли ячейка сетки.
   *
   * @param col - индекс колонки
   * @param row - индекс строки
   * @returns true, если ячейка не занята ни одной плиткой
   */
  isCellFree(col: number, row: number): boolean {
    const key = `${col},${row}`;
    return !this.occupiedCells.has(key);
  }

  /**
   * Помечает ячейку как занятую указанной плиткой.
   *
   * Если ячейка уже занята, операция не выполняется и возвращается false.
   *
   * @param col    - индекс колонки
   * @param row    - индекс строки
   * @param tileId - идентификатор плитки, занимающей ячейку
   * @returns true, если ячейка успешно занята; false, если она уже была занята
   */
  occupyCell(col: number, row: number, tileId: string): boolean {
    const key = `${col},${row}`;
    if (this.occupiedCells.has(key)) {
      return false;
    }
    this.occupiedCells.set(key, tileId);
    return true;
  }

  /**
   * Освобождает ячейку сетки по её координатам.
   *
   * Если ячейка не была занята, вызов безопасен и не приводит к ошибке.
   *
   * @param col - индекс колонки
   * @param row - индекс строки
   */
  releaseCell(col: number, row: number): void {
    const key = `${col},${row}`;
    this.occupiedCells.delete(key);
  }

  /**
   * Освобождает ячейку, занятую плиткой с указанным ID.
   *
   * Выполняет линейный поиск по реестру. Останавливается на первом совпадении,
   * так как каждая плитка занимает не более одной ячейки.
   *
   * @param tileId - идентификатор плитки, чью ячейку необходимо освободить
   */
  releaseCellByTileId(tileId: string): void {
    for (const [key, id] of this.occupiedCells.entries()) {
      if (id === tileId) {
        this.occupiedCells.delete(key);
        break;
      }
    }
  }

  /**
   * Полностью пересинхронизирует реестр занятых ячеек с переданной картой
   * размещённых плиток.
   *
   * Используется при загрузке сохранения или после серии крафтов, чтобы
   * привести внутренний реестр GridService в соответствие с состоянием
   * TilesContext.
   *
   * @param placedTiles - карта, где ключ — ID плитки, значение — её позиция
   */
  syncOccupiedCells(placedTiles: Map<string, { tile: any; col: number; row: number }>) {
    // Полный сброс — устраняет расхождения между реестром и реальным состоянием
    this.occupiedCells.clear();
    for (const [tileId, info] of placedTiles) {
      const key = `${info.col},${info.row}`;
      this.occupiedCells.set(key, tileId);
    }
  }

  /**
   * Вычисляет экранную позицию верхнего левого угла плитки,
   * выровненной по центру ячейки (col, row).
   *
   * Используется для привязки (snap) перетаскиваемой плитки к сетке.
   * Учитывает текущий масштаб и пан (смещение) сетки.
   *
   * @param col      - индекс колонки целевой ячейки
   * @param row      - индекс строки целевой ячейки
   * @param tileSize - размер плитки в пикселях (по умолчанию DEFAULT_TILE_SIZE.width)
   * @returns экранные координаты {x, y} верхнего левого угла плитки, либо null
   *          если конфигурация не задана
   */
  getSnapPosition(
    col: number,
    row: number,
    tileSize: number = DEFAULT_TILE_SIZE.width
  ): { x: number; y: number } | null {
    if (!this.config) return null;

    const { gridOffset, scale } = this.config;

    // Масштабированный размер ячейки
    const scaledCellSize = BASE_GRID.CELL_SIZE * scale;
    // Масштабированное базовое смещение начала сетки
    const baseOffsetX = BASE_GRID_OFFSET.x * scale;
    const baseOffsetY = BASE_GRID_OFFSET.y * scale;

    // Центр ячейки в экранных координатах с учётом пана (gridOffset вычитается)
    const centerX = baseOffsetX + col * scaledCellSize + scaledCellSize / 2 - gridOffset.x;
    const centerY = baseOffsetY + row * scaledCellSize + scaledCellSize / 2 - gridOffset.y;

    // Размер плитки в экранных пикселях с учётом масштаба
    const scaledTileSize = tileSize * scale;

    // Верхний левый угол плитки: смещаем от центра ячейки на половину размера плитки
    const x = centerX - scaledTileSize / 2;
    const y = centerY - scaledTileSize / 2;

    return { x, y };
  }
}

/** Единственный экземпляр сервиса управления сеткой. Используется глобально. */
export const GridService = new GridServiceClass();

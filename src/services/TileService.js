// ========================================
// СЕРВИС УПРАВЛЕНИЯ ПЛИТКАМИ
// Отвечает за:
// - Генерацию ID плиток
// - Создание новых плиток
// - Размещение в сетке
// - Возврат в спавнер
// ========================================

const TILE_ID_PREFIX = 'tile';
let tileCounter = 1;

export const TileService = {
  /**
   * Генерирует уникальный ID для плитки
   * Формат: tile-<timestamp>-<counter>
   */
  generateTileId: () => {
    return `${TILE_ID_PREFIX}-${Date.now()}-${tileCounter++}`;
  },

  /**
   * Создаёт новую плитку для спавнера
   * @param {Object} tileData - опциональные данные плитки
   * @returns {Object} плитка с ID и текстурой
   */
  createTile: (tileData = null) => {
    const newTile = tileData || {
      id: TileService.generateTileId(),
      texture: 'test1.png',
    };
    console.log(`[TileService] Создана плитка: ${newTile.id}`);
    return newTile;
  },

  /**
   * Размещает плитку в указанной ячейке
   * @param {Map} placedTiles - текущее состояние размещённых плиток
   * @param {number} col - колонка ячейки
   * @param {number} row - строка ячейки
   * @param {Object} tileData - данные плитки
   * @returns {Map} новое состояние placedTiles
   */
  placeTile: (placedTiles, col, row, tileData) => {
    const newMap = new Map(placedTiles);
    const key = `${col},${row}`;

    // Удаляем старую запись этой плитки если есть
    const existingEntry = Array.from(newMap.entries()).find(
      ([_, value]) => value.id === tileData.id
    );
    if (existingEntry) {
      const [existingKey] = existingEntry;
      newMap.delete(existingKey);
      console.log(`[TileService] Удалена старая запись ${existingKey} для ${tileData.id}`);
    }

    newMap.set(key, { ...tileData, col, row });
    console.log(`[TileService] Плитка ${tileData.id} размещена в [${col},${row}]`);
    return newMap;
  },

  /**
   * Удаляет плитку из ячейки
   * @param {Map} placedTiles - текущее состояние
   * @param {number} col - колонка
   * @param {number} row - строка
   * @returns {Map} новое состояние
   */
  removeTile: (placedTiles, col, row) => {
    const newMap = new Map(placedTiles);
    const key = `${col},${row}`;
    newMap.delete(key);
    console.log(`[TileService] Плитка удалена из [${col},${row}]`);
    return newMap;
  },

  /**
   * Перемещает плитку между ячейками
   * @param {Map} placedTiles - текущее состояние
   * @param {number} fromCol - старая колонка
   * @param {number} fromRow - старая строка
   * @param {number} toCol - новая колонка
   * @param {number} toRow - новая строка
   * @param {Object} tileData - данные плитки
   * @returns {Map} новое состояние
   */
  moveTile: (placedTiles, fromCol, fromRow, toCol, toRow, tileData) => {
    const newMap = new Map(placedTiles);
    const fromKey = `${fromCol},${fromRow}`;
    const toKey = `${toCol},${toRow}`;

    newMap.delete(fromKey);

    // Удаляем дубликаты этой плитки
    const otherEntries = Array.from(newMap.entries()).filter(
      ([_, value]) => value.id === tileData.id
    );
    otherEntries.forEach(([key]) => {
      newMap.delete(key);
      console.log(`[TileService] Удалён дубликат ${key}`);
    });

    newMap.set(toKey, { ...tileData, col: toCol, row: toRow });
    console.log(`[TileService] Плитка ${tileData.id} перемещена в [${toCol},${toRow}]`);
    return newMap;
  },

  /**
   * Проверяет занята ли ячейка
   * @param {Map} placedTiles - состояние плиток
   * @param {number} col - колонка
   * @param {number} row - строка
   * @returns {boolean} true если занята
   */
  isCellOccupied: (placedTiles, col, row) => {
    const key = `${col},${row}`;
    return placedTiles.has(key);
  },

  /**
   * Получает плитку в ячейке
   * @param {Map} placedTiles - состояние
   * @param {number} col - колонка
   * @param {number} row - строка
   * @returns {Object|null} плитка или null
   */
  getTileAt: (placedTiles, col, row) => {
    const key = `${col},${row}`;
    return placedTiles.get(key) || null;
  },
};

export default TileService;
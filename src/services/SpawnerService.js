// ========================================
// СЕРВИС СПАВНЕРА
// ========================================

export const SpawnerService = {
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
   * Вычисляет позицию для плитки в спавнере
   * @param {Object} tileSize - размер плитки {width, height}
   * @param {Object} spawnerPos - позиция спавнера {x, y, size}
   * @returns {Object} { x, y }
   */
  getTilePosition: (tileSize, spawnerPos) => {
    return SpawnerService.getSnapToSpawnerPosition(tileSize, spawnerPos);
  },
};

export default SpawnerService;
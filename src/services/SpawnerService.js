// ========================================
// СЕРВИС СПАВНЕРА
// ========================================

/**
 * Вспомогательный сервис для работы с позицией плитки в спавнере.
 *
 * Спавнер — зона на экране, где появляется новая плитка перед тем,
 * как игрок перетащит её на сетку. Сервис вычисляет координаты
 * верхнего левого угла плитки так, чтобы она была выровнена по центру
 * спавнера.
 */
export const SpawnerService = {
  /**
   * Вычисляет позицию верхнего левого угла плитки,
   * центрированной внутри спавнера.
   *
   * Формула: смещение от левого/верхнего края спавнера равно
   * половине разницы между размером спавнера и размером плитки.
   *
   * @param {Object} tileSize    - размер плитки: { width: number, height: number }
   * @param {Object} spawnerPos  - позиция и размер спавнера: { x: number, y: number, size: number }
   * @returns {{ x: number, y: number }} координаты верхнего левого угла плитки
   */
  getSnapToSpawnerPosition: (tileSize, spawnerPos) => {
    if (!spawnerPos || !tileSize) {
      return { x: 0, y: 0 };
    }

    return {
      // Горизонтальный отступ: центрируем плитку по ширине спавнера
      x: spawnerPos.x + (spawnerPos.size - tileSize.width) / 2,
      // Вертикальный отступ: центрируем плитку по высоте спавнера
      y: spawnerPos.y + (spawnerPos.size - tileSize.height) / 2,
    };
  },

  /**
   * Возвращает позицию плитки внутри спавнера.
   *
   * Является псевдонимом getSnapToSpawnerPosition — оставлен для
   * совместимости с вызывающим кодом, который ожидает именно это имя.
   *
   * @param {Object} tileSize    - размер плитки: { width: number, height: number }
   * @param {Object} spawnerPos  - позиция и размер спавнера: { x: number, y: number, size: number }
   * @returns {{ x: number, y: number }} координаты верхнего левого угла плитки
   */
  getTilePosition: (tileSize, spawnerPos) => {
    return SpawnerService.getSnapToSpawnerPosition(tileSize, spawnerPos);
  },
};

export default SpawnerService;

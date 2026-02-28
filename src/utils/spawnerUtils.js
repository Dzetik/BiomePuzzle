// ========================================
// УТИЛИТЫ ДЛЯ РАБОТЫ СО СПАВНЕРОМ
// ========================================

/**
 * Проверяет, находится ли центр плитки над спавнером
 * @param {Object} position - позиция плитки {x, y}
 * @param {Object} tileSize - размер плитки {width, height}
 * @param {Object} spawnerPos - позиция спавнера {x, y, size}
 * @returns {boolean}
 */
export const isCenterOverSpawner = (position, tileSize, spawnerPos) => {
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

/**
 * Вычисляет позицию для центрирования плитки относительно спавнера
 * @param {Object} tileSize - размер плитки
 * @param {Object} spawnerPos - позиция спавнера {x, y, size}
 * @returns {Object} позиция {x, y}
 */
export const getSnapToSpawnerPosition = (tileSize, spawnerPos) => {
  if (!spawnerPos || !tileSize) return { x: 0, y: 0 };
  
  const spawnerCenterX = spawnerPos.x + spawnerPos.size / 2;
  const spawnerCenterY = spawnerPos.y + spawnerPos.size / 2;
  
  return {
    x: Math.round(spawnerCenterX - tileSize.width / 2),
    y: Math.round(spawnerCenterY - tileSize.height / 2)
  };
};
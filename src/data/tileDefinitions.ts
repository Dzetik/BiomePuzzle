import { TileData } from '../models/Tile.types';

export const TILE_DEFINITIONS: TileData[] = [
  {
    id: 'apple',
    textureKey: 'apple',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
  },
  {
    id: 'juice',
    textureKey: 'juice',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
    canSpawnInSpawner: false,
  },
  {
    id: 'bread',
    textureKey: 'bread',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
    canSpawnInSpawner: false,
  },
  {
    id: 'butter',
    textureKey: 'butter',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
  },
  {
    id: 'fire',
    textureKey: 'fire',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
  },
  {
    id: 'millet',
    textureKey: 'millet',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
  },
  {
    id: 'toast',
    textureKey: 'toast',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
    canSpawnInSpawner: false,
  },
  {
    id: 'water',
    textureKey: 'water',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
  },


  /*{
    id: 'sprite1',
    textureKey: 'sprite1',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
  },
  {
    id: 'sprite2',
    textureKey: 'sprite2',
    baseEdges: {
      top: '#236B7C',      // Синий
      right: '#236B7C',
      bottom: '#236B7C',
      left: '#236B7C',
    },
  },
  {
    id: 'sprite3',
    textureKey: 'sprite3',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#236B7C',    // Синий
      bottom: '#4A7C23',
      left: '#236B7C',
    },
  },
  {
    id: 'sprite4',
    textureKey: 'sprite4',
    baseEdges: {
      top: '#236B7C',      // Синий
      right: '#4A7C23',    // Зелёный
      bottom: '#236B7C',
      left: '#4A7C23',
    },
  },
  {
    id: 'sprite5',
    textureKey: 'sprite5',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#236B7C',   // Синий
      left: '#236B7C',
    },
  },*/
];

/**
 * Выбирает случайное определение плитки из пула
 * @param craftingOnly — если true, выбирать только из ингредиентов крафта
 */
export function getRandomTileDefinition(craftingOnly: boolean = false): TileData {
  // 🔑 Фильтруем: canSpawnInSpawner !== false (undefined = true по умолчанию)
  const spawnableTiles = TILE_DEFINITIONS.filter(
    t => t.canSpawnInSpawner !== false
  );
  
  if (spawnableTiles.length === 0) {
    console.warn('[tileDefinitions] ⚠️ Нет плиток с canSpawnInSpawner=true!');
    return TILE_DEFINITIONS[0];
  }
  
  const randomIndex = Math.floor(Math.random() * spawnableTiles.length);
  return spawnableTiles[randomIndex];
}

export default TILE_DEFINITIONS;
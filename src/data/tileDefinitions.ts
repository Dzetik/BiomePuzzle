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
  /*{
    id: 'bread',
    textureKey: 'bread',
    baseEdges: {
      top: '#4A7C23',      // Зелёный
      right: '#4A7C23',
      bottom: '#4A7C23',
      left: '#4A7C23',
    },
    activeSide: 'top',
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
  },*/
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
 */
export function getRandomTileDefinition(): TileData {
  const randomIndex = Math.floor(Math.random() * TILE_DEFINITIONS.length);
  return TILE_DEFINITIONS[randomIndex];
}
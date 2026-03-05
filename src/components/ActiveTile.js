// src/components/ActiveTile.js
// ========================================
// КОМПОНЕНТ АКТИВНОЙ ПЛИТКИ
// Перетаскиваемая плитка из спавнера
// ========================================
import React from 'react';
import { Animated } from 'react-native';
import TileView from './TileView';

const ActiveTile = ({ textureSource, position, width, height, panHandlers, tileId }) => {
  if (!position || !tileId) {
    return null;
  }

  return (
    <TileView
      textureSource={textureSource}
      position={position}
      width={width}
      height={height}
      panHandlers={panHandlers}
      tileId={tileId}
    />
  );
};

export default ActiveTile;
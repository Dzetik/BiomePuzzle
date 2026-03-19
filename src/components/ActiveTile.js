// src/components/ActiveTile.js
// ============================================================================
// КОМПОНЕНТ АКТИВНОЙ ПЛИТКИ
// Перетаскиваемая плитка из спавнера
// ============================================================================
import React from 'react';
import TileView from './TileView';

/**
 * Тонкая обёртка над TileView для плитки спавнера.
 *
 * Ранее содержала дополнительную логику; сейчас существует для изоляции
 * точки входа плитки из спавнера и ранней защиты от рендера с пустым tileId.
 * Если `position` или `tileId` не заданы — возвращает null, чтобы не
 * допускать рендера «призрачной» плитки в (0, 0).
 *
 * @param {any}    textureSource - источник изображения текстуры
 * @param {{ x: number, y: number }} position - текущая позиция плитки (от useDraggableFSM)
 * @param {number} width        - ширина плитки
 * @param {number} height       - высота плитки
 * @param {any}    panHandlers  - обработчики жестов (устаревший Animated API, оставлен для совместимости)
 * @param {string} tileId       - ID плитки
 */
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
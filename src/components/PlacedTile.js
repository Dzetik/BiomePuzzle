// src/components/PlacedTile.js
// ============================================================================
// КОМПОНЕНТ РАЗМЕЩЁННОЙ ПЛИТКИ
// Статичная плитка в сетке (не перетаскивается)
// ============================================================================
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

/**
 * Статичная плитка, размещённая в ячейке сетки.
 *
 * Рендерит изображение текстуры в абсолютной позиции на экране.
 * Не обрабатывает жесты — взаимодействие с размещёнными плитками
 * обеспечивается прозрачным TouchableOpacity-оверлеем в TileView.
 *
 * @param {any}    textureSource - источник изображения (require(...) или { uri })
 * @param {{ x: number, y: number }} position - экранные координаты верхнего левого угла
 * @param {number} width  - ширина плитки в пикселях
 * @param {number} height - высота плитки в пикселях
 * @param {string} tileId - ID плитки (не используется в рендере, но удобен для отладки)
 */
const PlacedTile = ({ textureSource, position, width, height, tileId }) => {
  return (
    <View
      style={[
        styles.tile,
        {
          left: position.x,
          top: position.y,
          width: width,
          height: height,
        },
      ]}
    >
      <Image source={textureSource} style={styles.image} resizeMode="cover" />
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default PlacedTile;
// src/components/PlacedTile.js
// ========================================
// КОМПОНЕНТ РАЗМЕЩЁННОЙ ПЛИТКИ
// Статичная плитка в сетке (не перетаскивается)
// ========================================
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

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
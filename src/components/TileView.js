import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { DEFAULT_TILE_SIZE } from '../constants/tile';

const TileView = ({ 
  textureSource, 
  position = { x: 0, y: 0 }, // значение по умолчанию 
  panHandlers,
}) => {
  return (
    <View 
      style={[
        styles.container,
        {
          left: position.x, // динамические позиции
          top: position.y,
          width: DEFAULT_TILE_SIZE.width,
          height: DEFAULT_TILE_SIZE.height,
        }
      ]} 
      {...panHandlers} // привязка методов касаний
    >
      <Image 
        source={textureSource}
        style={styles.tileImage}
        resizeMode="cover"
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 8, // скругляем углы
    overflow: 'hidden', // чтобы изображение не выходило за скругленные углы
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5, // для Android
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});

export default TileView;
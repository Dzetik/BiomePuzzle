import React from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { DEFAULT_TILE_SIZE } from '../constants/tile';

/**
 * Компонент плитки с поддержкой анимации
 * @param {Object} textureSource - источник изображения
 * @param {Animated.ValueXY} position - анимированная позиция
 * @param {Object} panHandlers - обработчики жестов
 */
const TileView = ({ 
  textureSource, 
  position,
  panHandlers,
}) => {
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          // Используем Animated стиль для позиции
          transform: [
            { translateX: position.x },
            { translateY: position.y }
          ],
          width: DEFAULT_TILE_SIZE.width,
          height: DEFAULT_TILE_SIZE.height,
        }
      ]} 
      {...panHandlers}
    >
      <Image 
        source={textureSource}
        style={styles.tileImage}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});

export default TileView;
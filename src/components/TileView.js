import React from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

const TileView = ({ textureSource, position, width, height, panHandlers }) => {
  const animatedStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y }
    ],
    width: width,
    height: height,
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]} {...panHandlers}>
      <Image source={textureSource} style={styles.tileImage} resizeMode="cover" />
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
    zIndex: 999,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});

export default TileView;
import React from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

// ========================================
// Компонент для отображения перетаскиваемой плитки
// ========================================

const TileView = ({ 
  textureSource,  // Изображение текстуры плитки
  position,       // Animated.ValueXY для позиции
  width,          // Animated.Value для ширины
  height,         // Animated.Value для высоты
  panHandlers     // Обработчики жестов от PanResponder
}) => {
  // Анимированные стили - позиция и размер
  const animatedStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y }
    ],
    width: width,
    height: height,
  };

  return (
    <Animated.View 
      style={[styles.container, animatedStyle]} 
      {...panHandlers} // Привязываем обработчики перетаскивания
    >
      <Image 
        source={textureSource} 
        style={styles.tileImage} 
        resizeMode="cover" // Изображение заполняет всю плитку
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
    zIndex: 999, // Плитка всегда поверх остальных элементов
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});

export default TileView;
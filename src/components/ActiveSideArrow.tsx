// ============================================================================
// КОМПОНЕНТ: УКАЗАТЕЛЬ АКТИВНОЙ СТОРОНЫ ПЛИТКИ
// ============================================================================
// Отрисовывает треугольную стрелку-указатель на краю плитки.
// Стрелка всегда "смотрит" наружу от плитки в направлении activeSide.
// Вращается вместе с плиткой благодаря родительскому transform: rotate.
// ============================================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ActiveSideArrowProps {
  /** Размер основания треугольника (по умолчанию 16) */
  size?: number;
  /** Цвет стрелки (по умолчанию белый с обводкой) */
  color?: string;
  /** Направление: в какую сторону "смотрит" стрелка */
  direction: 'up' | 'right' | 'down' | 'left';
  /** Дополнительные стили для позиционирования */
  style?: object;
}

const ActiveSideArrow: React.FC<ActiveSideArrowProps> = ({
  size = 16,
  color = '#ffffff',
  direction = 'up',
  style = {},
}) => {
  // Вычисляем стили треугольника через border-трюк
  // Треугольник всегда рисуется "вершиной вверх", затем поворачивается
  const triangleStyle = {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderLeftWidth: size / 2,
    borderRightWidth: size / 2,
    borderBottomWidth: size * 0.9,  // Высота треугольника
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: color,
  };

  // Поворот треугольника в зависимости от направления
  const rotation = {
    up: '0deg',
    right: '90deg',
    down: '180deg',
    left: '270deg',
  }[direction];

  return (
    <View 
      style={[
        styles.arrowContainer,
        { transform: [{ rotate: rotation }] },
        style,
      ]}
      pointerEvents="none"  // Стрелка не перехватывает жесты
    >
      {/* Основной треугольник */}
      <View style={[styles.triangle, triangleStyle]} />
      
      {/* Тонкая обводка для контраста на светлом фоне */}
      <View 
        style={[
          styles.triangleOutline,
          {
            ...triangleStyle,
            borderBottomColor: 'rgba(0,0,0,0.4)',
            borderBottomWidth: size * 0.9 + 2,
            borderLeftWidth: size / 2 + 1,
            borderRightWidth: size / 2 + 1,
            position: 'absolute',
            top: -1,
            left: -1,
          },
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  arrowContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,  // Поверх изображения, под дебаг-оверлеем
  },
  triangle: {
    // Стили задаются динамически через border
  },
  triangleOutline: {
    // Обводка для видимости на любом фоне
  },
});

export default ActiveSideArrow;
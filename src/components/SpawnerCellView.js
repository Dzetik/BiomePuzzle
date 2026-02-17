import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { getSpawnerSize, getSpawnerPositionConfig } from '../constants/spawner';

// ========================================
// Утилита для расчета позиции спавнера на экране
// ========================================
export const getSpawnerScreenPosition = () => {
  const { width: screenWidth } = Dimensions.get('window');
  const spawnerSize = getSpawnerSize();
  const positionConfig = getSpawnerPositionConfig();
  
  // Рассчитываем координаты:
  // x = ширина экрана - размер спавнера - отступ справа
  // y = отступ сверху (фиксированный)
  const x = screenWidth - spawnerSize - positionConfig.offset.right;
  const y = positionConfig.offset.top;
  
  return { x, y, size: spawnerSize };
};

// Кэширование позиции спавнера для избежания повторных расчетов
let positionCache = null;
export const getCachedSpawnerPosition = () => {
  if (!positionCache) {
    positionCache = getSpawnerScreenPosition();
  }
  return positionCache;
};

// Сброс кэша (нужно вызывать при изменении размеров экрана)
export const resetSpawnerCache = () => {
  positionCache = null;
};

// ========================================
// Компонент для визуального отображения спавнера
// ========================================
const SpawnerCellView = () => {
  const spawnerPos = getCachedSpawnerPosition();

  return (
    <View 
      style={[
        styles.container,
        {
          left: spawnerPos.x,      // Позиция по X
          top: spawnerPos.y,       // Позиция по Y
          width: spawnerPos.size,  // Ширина спавнера
          height: spawnerPos.size, // Высота спавнера
        }
      ]}
      pointerEvents="none" // Спавнер не должен перехватывать касания
    >
      {/* Зеленая рамка спавнера */}
      <View style={styles.border} />
      {/* Внешнее свечение для визуального выделения */}
      <View style={styles.glow} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100, // Спавнер поверх сетки, но под плиткой
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.2)', // Полупрозрачная заливка
  },
  glow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.1)', // Внешнее свечение
    zIndex: -1,
  },
});

export default SpawnerCellView;
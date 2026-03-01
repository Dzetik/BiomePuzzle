// ========================================
// КОМПОНЕНТ ПЛИТКИ
// Отвечает за:
// - Отрисовку плитки с текстурой
// - Применение жестов перетаскивания
// - Отображение отладочной информации (координаты, ячейка)
// - Следование за анимированными значениями позиции и размера
// ========================================

import React from 'react';
import { Animated, Image, View, Text, StyleSheet } from 'react-native';
import { useGrid } from '../context/GridContext';
import { useZoom } from '../hooks/useZoom';
import { findNearestCell } from '../utils/gridUtils';

const TileView = ({ 
  textureSource,  // Источник изображения для текстуры плитки
  position,       // Animated.ValueXY - позиция плитки
  width,          // Animated.Value - ширина плитки
  height,         // Animated.Value - высота плитки
  panHandlers     // Обработчики жестов из PanResponder
}) => {
  
  // Получаем текущее смещение сетки и масштаб для корректного определения ячейки
  const { offset } = useGrid();
  const { scale } = useZoom();
  
  // Состояние для отладочной информации (отображается на плитке)
  const [debugInfo, setDebugInfo] = React.useState({ 
    x: 0, y: 0,    // Текущие координаты угла плитки
    col: 0, row: 0  // Текущая ячейка, в которой находится плитка
  });
  
  // ========================================
  // ОТСЛЕЖИВАНИЕ ПОЗИЦИИ ПЛИТКИ
  // ========================================
  
  /**
   * Подписываемся на изменения анимированной позиции
   * При каждом изменении:
   * 1. Получаем актуальные размеры из анимированных значений
   * 2. Вычисляем центр плитки
   * 3. Находим ближайшую ячейку к центру
   * 4. Обновляем отладочную информацию
   */
  React.useEffect(() => {
    const listener = position.addListener((value) => {
      // Получаем текущие размеры (могут меняться при зуме)
      const currentWidth = width.__getValue();
      const currentHeight = height.__getValue();
      
      // Центр плитки = угол + половина размера
      const centerX = value.x + currentWidth / 2;
      const centerY = value.y + currentHeight / 2;
      
      // Находим ближайшую ячейку с учётом текущих offset и scale
      const cell = findNearestCell(
        centerX,
        centerY,
        scale,
        offset.x,
        offset.y
      );
      
      // Обновляем отображение
      setDebugInfo({
        x: Math.round(value.x),
        y: Math.round(value.y),
        col: cell.col,
        row: cell.row
      });
    });
    
    // Отписываемся при размонтировании
    return () => position.removeListener(listener);
  }, [position, width, height, offset, scale]);

  // ========================================
  // ОТРИСОВКА
  // ========================================
  
  return (
    <Animated.View
      {...panHandlers}  // Подключаем обработчики жестов
      style={[
        styles.tile,
        {
          left: position.x,   // Анимируемая позиция по X
          top: position.y,     // Анимируемая позиция по Y
          width: width,        // Анимируемая ширина
          height: height,      // Анимируемая высота
        }
      ]}
    >
      {/* Текстура плитки */}
      <Image 
        source={textureSource} 
        style={styles.image}
        resizeMode="cover"
      />
      
      {/* Отладочная информация (поверх текстуры) */}
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>
          {debugInfo.col},{debugInfo.row}  {/* Текущая ячейка */}
        </Text>
        <Text style={styles.debugTextSmall}>
          {debugInfo.x},{debugInfo.y}       {/* Текущие координаты */}
        </Text>
      </View>
    </Animated.View>
  );
};

// ========================================
// СТИЛИ
// ========================================

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',           // Позиционирование поверх сетки
    borderRadius: 8,                // Скруглённые углы
    overflow: 'hidden',              // Чтобы изображение не вылезало за скругления
    borderWidth: 2,                  // Белая рамка для визуального выделения
    borderColor: '#fff',
    elevation: 5,                    // Тень для Android
    shadowColor: '#000',              // Тень для iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  image: {
    width: '100%',                    // Растягиваем на всю плитку
    height: '100%',
  },
  debugOverlay: {
    position: 'absolute',              // Накладываем поверх изображения
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', // Полупрозрачный чёрный фон
    padding: 4,
  },
  debugText: {
    color: 'yellow',                   // Жёлтый для основной информации
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugTextSmall: {
    color: 'white',                    // Белый для дополнительной информации
    fontSize: 8,
    textAlign: 'center',
  },
});

export default TileView;
import React from 'react';
import { Animated, Image, View, Text, StyleSheet } from 'react-native';
import { useGrid } from '../context/GridContext'; // Добавляем импорт

const TileView = ({ textureSource, position, width, height, panHandlers }) => {
  const { offset } = useGrid(); // Получаем текущий offset сетки
  
  // Создаем слушатель для отслеживания позиции в реальном времени
  const [debugInfo, setDebugInfo] = React.useState({ x: 0, y: 0, col: 0, row: 0 });
  
  React.useEffect(() => {
    const listener = position.addListener((value) => {
      // Вычисляем центр плитки в абсолютных координатах
      const centerX = value.x + (width.__getValue() / 2);
      const centerY = value.y + (height.__getValue() / 2);
      
      // Переводим в координаты сетки с учётом offset
      // Формула: координата в сетке = (абсолютная координата + offset - baseOffset) / cellSize
      const cellSize = 90; // Базовый размер ячейки
      const baseOffset = 0; // Временное упрощение
      
      const gridX = centerX + offset.x - baseOffset;
      const gridY = centerY + offset.y - baseOffset;
      
      const col = Math.floor(gridX / cellSize);
      const row = Math.floor(gridY / cellSize);
      
      setDebugInfo({
        x: Math.round(value.x),
        y: Math.round(value.y),
        col: col,
        row: row
      });
    });
    
    return () => position.removeListener(listener);
  }, [position, width, height, offset]); // Добавляем offset в зависимости

  return (
    <Animated.View
      {...panHandlers}
      style={[
        styles.tile,
        {
          left: position.x,
          top: position.y,
          width: width,
          height: height,
        }
      ]}
    >
      <Image 
        source={textureSource} 
        style={styles.image}
        resizeMode="cover"
      />
      {/* Отладочная информация поверх плитки */}
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>
          {debugInfo.col},{debugInfo.row}
        </Text>
        <Text style={styles.debugTextSmall}>
          {debugInfo.x},{debugInfo.y}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
  },
  debugText: {
    color: 'yellow',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugTextSmall: {
    color: 'white',
    fontSize: 8,
    textAlign: 'center',
  },
});

export default TileView;
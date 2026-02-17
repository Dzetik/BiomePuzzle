import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Dimensions } from 'react-native';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView, { resetSpawnerCache } from './src/components/SpawnerCellView';
import useDraggable from './src/hooks/useDraggable';
import { getSnapToSpawnerPosition } from './src/utils/gridUtils';
import { getSpawnerSize } from './src/constants/spawner'; // Импортируем getSpawnerSize

// Текстура для тестовой плитки
const testTexture = require('./assets/images/textures/test1.png');

const App = () => {
  // Сбрасываем кэш позиции спавнера при изменении размеров экрана
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', resetSpawnerCache);
    return () => subscription?.remove();
  }, []);

  // Получаем размер спавнера для начального размера плитки
  const spawnerSize = getSpawnerSize();
  const initialTileSize = { width: spawnerSize, height: spawnerSize };
  
  // Начальная позиция плитки - центрированная относительно спавнера
  // Используем размер спавнера для правильного центрирования
  const initialPosition = getSnapToSpawnerPosition(initialTileSize);
  
  // Получаем все необходимое от хука перетаскивания
  const { position, width, height, panHandlers } = useDraggable(initialPosition, initialTileSize);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      {/* Сетка (фон) */}
      <GridView />
      {/* Визуальный спавнер */}
      <SpawnerCellView />
      {/* Перетаскиваемая плитка */}
      <TileView 
        textureSource={testTexture}
        position={position}
        width={width}
        height={height}
        panHandlers={panHandlers}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Темный фон для контраста
  },
});

export default App;
import React, { useMemo } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';;
import useDraggable from './src/hooks/useDraggable';
import { GRID_OFFSET } from './src/constants/grid';

// ВРЕМЕННО: require напрямую для проверки
const testTexture = require('./assets/images/textures/test1.png');

const App = () => {
  // useMemo — начальная позиция НЕ пересоздается при ререндерах
    const initialPosition = useMemo(() => {
    const pos = {
      x: GRID_OFFSET.x,
      y: GRID_OFFSET.y,
    };
    return pos;
  }, []);

  const { position, panHandlers } = useDraggable(initialPosition);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      <GridView />
      <TileView 
        textureSource={testTexture}
        position={position}
        panHandlers={panHandlers}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});

export default App;
import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Dimensions } from 'react-native';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import SpawnerCellView, { resetSpawnerCache } from './src/components/SpawnerCellView';
import useDraggable from './src/hooks/useDraggable';
import { getSnapToSpawnerPosition } from './src/utils/gridUtils';
import { TILE_SIZES } from './src/constants/tile';

const testTexture = require('./assets/images/textures/test1.png');

const App = () => {
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', resetSpawnerCache);
    return () => subscription?.remove();
  }, []);

  const initialPosition = getSnapToSpawnerPosition(TILE_SIZES.medium);
  const { position, width, height, panHandlers } = useDraggable(initialPosition);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      <GridView />
      <SpawnerCellView />
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
    backgroundColor: '#1a1a1a',
  },
});

export default App;
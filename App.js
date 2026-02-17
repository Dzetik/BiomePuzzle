import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import TileView from './src/components/TileView';
import GridView from './src/components/GridView';
import useDraggable from './src/hooks/useDraggable';

const testTexture = require('./assets/images/textures/test1.png');

const App = () => {
  const { position, panHandlers } = useDraggable();

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
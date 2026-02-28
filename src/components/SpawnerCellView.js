import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSpawner } from '../hooks/useSpawner';

const SpawnerCellView = () => {
  const spawnerPos = useSpawner();

  return (
    <View 
      style={[
        styles.container,
        {
          left: spawnerPos.x,
          top: spawnerPos.y,
          width: spawnerPos.size,
          height: spawnerPos.size,
        }
      ]}
      pointerEvents="none"
    >
      <View style={styles.border} />
      <View style={styles.glow} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
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
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  glow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    zIndex: -1,
  },
});

export default SpawnerCellView;
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSpawner } from '../hooks/useSpawner';
import { 
  getGravityZoneSize,
  getGravityZonePadding,
  getGravityZoneVisual,
  isGravityZoneEnabled 
} from '../constants/spawner';

const SpawnerCellView = () => {
  const spawnerPos = useSpawner();
  
  // Получаем настройки из конфига
  const zoneEnabled = isGravityZoneEnabled();
  const zoneVisual = getGravityZoneVisual();
  const zoneSize = getGravityZoneSize();
  const padding = getGravityZonePadding();

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
      {/* Зона притяжения (отображается только если включена в конфиге) */}
      {zoneEnabled && zoneVisual.showZone && (
        <View 
          style={[
            styles.gravityZone,
            {
              left: -padding,
              top: -padding,
              width: zoneSize,
              height: zoneSize,
              backgroundColor: zoneVisual.color,
              borderColor: zoneVisual.borderColor,
              borderWidth: zoneVisual.borderWidth,
              borderStyle: zoneVisual.borderStyle,
            }
          ]} 
        />
      )}
      
      {/* Основная рамка спавнера */}
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
  gravityZone: {
    position: 'absolute',
    borderRadius: 12, // Делаем скруглённым, чтобы соответствовать спавнеру
    zIndex: -2,
  },
});

export default SpawnerCellView;
import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native'; 
import { getSpawnerSize, getSpawnerPositionConfig } from '../constants/spawner';

// ========================================
// ХУК ДЛЯ ОТСЛЕЖИВАНИЯ ПОЗИЦИИ СПАВНЕРА
// ========================================

let positionCache = null;

const calculateSpawnerPosition = () => {
  const { width: screenWidth } = Dimensions.get('window');
  const spawnerSize = getSpawnerSize();
  const positionConfig = getSpawnerPositionConfig();
  
  const x = screenWidth - spawnerSize - positionConfig.offset.right;
  const y = positionConfig.offset.top;
  
  return { x, y, size: spawnerSize };
};

export const useSpawnerPosition = () => {
  const [position, setPosition] = useState(() => calculateSpawnerPosition());

  useEffect(() => {
    // Обновляем позицию при изменении размеров экрана
    const subscription = Dimensions.addEventListener('change', () => {
      setPosition(calculateSpawnerPosition());
    });

    return () => subscription?.remove();
  }, []);

  return position;
};

// Для совместимости с существующим кодом
export const getCachedSpawnerPosition = () => {
  if (!positionCache) {
    positionCache = calculateSpawnerPosition();
  }
  return positionCache;
};

export const resetSpawnerCache = () => {
  positionCache = null;
};
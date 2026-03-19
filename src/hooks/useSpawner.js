import { useState, useEffect, useCallback } from 'react';
import { Dimensions } from 'react-native';
import { getSpawnerSize, getSpawnerPositionConfig } from '../constants/spawner';

// ============================================================================
// ХУК ПОЗИЦИИ СПАВНЕРА
// ============================================================================

/**
 * Отслеживает актуальную позицию и размер спавнера на экране.
 *
 * Спавнер — область в правом верхнем углу экрана, где появляется новая плитка.
 * Его позиция зависит от ширины экрана и пересчитывается при изменении
 * ориентации устройства или размера окна (разделённый экран на Android).
 *
 * @returns {{ x: number, y: number, size: number }} — текущая позиция и размер спавнера
 */
export const useSpawner = () => {
  /**
   * Позиция инициализируется сразу при создании хука через функцию-инициализатор,
   * что исключает рендер с нулевыми координатами.
   */
  const [spawnerPos, setSpawnerPos] = useState(() => {
    const { width: screenWidth } = Dimensions.get('window');
    const spawnerSize = getSpawnerSize();
    const positionConfig = getSpawnerPositionConfig();

    // x = правый край экрана минус ширина спавнера минус отступ
    const x = screenWidth - spawnerSize - positionConfig.offset.right;
    // y = фиксированный отступ сверху
    const y = positionConfig.offset.top;

    return { x, y, size: spawnerSize };
  });

  /**
   * Пересчитывает и сохраняет позицию спавнера по текущим размерам экрана.
   *
   * Мемоизирован без зависимостей: вызываемые функции (getSpawnerSize,
   * getSpawnerPositionConfig, Dimensions) стабильны между рендерами.
   */
  const updateSpawnerPosition = useCallback(() => {
    const { width: screenWidth } = Dimensions.get('window');
    const spawnerSize = getSpawnerSize();
    const positionConfig = getSpawnerPositionConfig();

    const x = screenWidth - spawnerSize - positionConfig.offset.right;
    const y = positionConfig.offset.top;

    setSpawnerPos({ x, y, size: spawnerSize });
  }, []);

  // Подписка на изменение размеров экрана (поворот, split-screen)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', updateSpawnerPosition);
    return () => subscription?.remove();
  }, [updateSpawnerPosition]);

  return spawnerPos;
};

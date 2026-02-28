import { useState, useEffect, useCallback } from 'react';
import { Dimensions } from 'react-native';
import { getSpawnerSize, getSpawnerPositionConfig } from '../constants/spawner';

// ========================================
// Хук для отслеживания позиции спавнера на экране
// Спавнер - это зелёная область, куда возвращаются плитки
// Его позиция зависит от размеров экрана и должна пересчитываться при повороте
// ========================================

export const useSpawner = () => {
  // Состояние для хранения позиции и размера спавнера
  // Используем функцию инициализации, чтобы вычислить сразу при создании хука
  const [spawnerPos, setSpawnerPos] = useState(() => {
    // Получаем текущую ширину экрана
    const { width: screenWidth } = Dimensions.get('window');
    
    // Получаем размер спавнера из конфига (100px)
    const spawnerSize = getSpawnerSize();
    
    // Получаем конфигурацию позиции (отступ справа 20px, сверху 80px)
    const positionConfig = getSpawnerPositionConfig();
    
    // Вычисляем координаты:
    // x = ширина экрана - размер спавнера - отступ справа
    // y = отступ сверху (фиксированный)
    const x = screenWidth - spawnerSize - positionConfig.offset.right;
    const y = positionConfig.offset.top;
    
    return { x, y, size: spawnerSize };
  });

  // Функция обновления позиции спавнера
  // Вызывается при изменении размеров экрана (поворот, разделённый экран)
  const updateSpawnerPosition = useCallback(() => {
    // Получаем актуальную ширину экрана
    const { width: screenWidth } = Dimensions.get('window');
    
    // Заново получаем размер и конфигурацию (на случай если они изменятся)
    const spawnerSize = getSpawnerSize();
    const positionConfig = getSpawnerPositionConfig();
    
    // Пересчитываем координаты
    const x = screenWidth - spawnerSize - positionConfig.offset.right;
    const y = positionConfig.offset.top;
    
    setSpawnerPos({ x, y, size: spawnerSize });
  }, []); // Нет зависимостей, так как все функции не меняются

  // Эффект для отслеживания изменений размеров экрана
  useEffect(() => {
    // Подписываемся на событие изменения размеров
    const subscription = Dimensions.addEventListener('change', updateSpawnerPosition);
    
    // Отписываемся при размонтировании
    return () => subscription?.remove();
  }, [updateSpawnerPosition]); // Зависимость стабильна из-за useCallback

  // Возвращаем актуальную позицию спавнера
  // { x: number, y: number, size: number }
  return spawnerPos;
};
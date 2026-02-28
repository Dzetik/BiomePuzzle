import { useRef, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';

// ========================================
// Хук для обработки жеста щипка (pinch-to-zoom)
// Отвечает за масштабирование всей игры двумя пальцами
// ========================================

export const usePinchZoom = (scale, setScale, MIN_SCALE, MAX_SCALE) => {
  // Храним масштаб на момент начала жеста
  // Нужен для корректного расчёта: новый масштаб = старый * множитель
  const baseScaleRef = useRef(1);

  // Создаём жест щипка
  const pinchGesture = Gesture.Pinch()
    // Начало жеста - когда два пальца коснулись экрана
    .onStart(() => {
      console.log('[Pinch] Начало');
      baseScaleRef.current = scale; // Запоминаем текущий масштаб как базовый
    })
    
    // Обновление жеста - пальцы двигаются
    .onUpdate((event) => {
      // Игнорируем очень маленькие изменения (дрожание пальцев)
      if (Math.abs(event.scale - 1) < 0.01) return;
      
      // Вычисляем новый масштаб: базовый * множитель сжатия/растяжения
      const newScale = baseScaleRef.current * event.scale;
      
      // Ограничиваем масштаб допустимыми пределами
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      
      setScale(clampedScale); // Обновляем масштаб в контексте
    })
    
    // Завершение жеста - пальцы отпущены
    .onEnd(() => {
      console.log('[Pinch] Конец');
    })
    // Указываем, что этот жест не должен конфликтовать с панорамированием
    // Пустой массив означает, что жест работает изолированно
    .simultaneousWithExternalGesture([]);

  return pinchGesture; // Возвращаем готовый жест для подключения к компоненту
};

export default usePinchZoom;
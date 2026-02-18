import { useRef, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';

// ========================================
// Хук для обработки жеста щипка (pinch-to-zoom)
// ========================================

const usePinchZoom = (scale, setScale, minScale, maxScale) => {
  // Масштаб на момент начала жеста
  const baseScaleRef = useRef(scale);

  // Запоминаем начальный масштаб при старте жеста
  const onPinchStart = useCallback(() => {
    baseScaleRef.current = scale;
  }, [scale]);

  // Обновляем масштаб при движении пальцев
  const onPinchUpdate = useCallback((pinchScale) => {
    // pinchScale = 1 в начале, >1 при увеличении, <1 при уменьшении
    const newScale = baseScaleRef.current * pinchScale;
    setScale(Math.min(maxScale, Math.max(minScale, newScale)));
  }, [setScale, minScale, maxScale]);

  // Создаем жест щипка
  const pinchGesture = Gesture.Pinch()
    .onStart(onPinchStart)
    .onUpdate((event) => {
      onPinchUpdate(event.scale);
    });

  return pinchGesture;
};

export default usePinchZoom;
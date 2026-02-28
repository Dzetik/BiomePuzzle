import { useRef, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';

// ========================================
// Хук для обработки жеста щипка (pinch-to-zoom)
// ========================================

export const usePinchZoom = (scale, setScale, MIN_SCALE, MAX_SCALE) => {
  const baseScaleRef = useRef(1);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      console.log('[Pinch] Начало');
      baseScaleRef.current = scale;
    })
    .onUpdate((event) => {
      // Игнорируем очень маленькие изменения
      if (Math.abs(event.scale - 1) < 0.01) return;
      
      const newScale = baseScaleRef.current * event.scale;
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      console.log('[Pinch] Масштаб:', clampedScale.toFixed(2), 'scale factor:', event.scale.toFixed(2));
      setScale(clampedScale);
    })
    .onEnd(() => {
      console.log('[Pinch] Конец');
    })
    // Указываем, что этот жест не должен конфликтовать с панорамированием
    .simultaneousWithExternalGesture([]);

  return pinchGesture;
};

export default usePinchZoom;


/*const usePinchZoom = (scale, setScale, minScale, maxScale) => {
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

export default usePinchZoom;*/
import React, { createContext, useContext, useState, useCallback } from 'react';

// ============================================================================
// КОНТЕКСТ И ХУК УПРАВЛЕНИЯ МАСШТАБОМ
// ============================================================================

/** Минимально допустимый масштаб сетки. */
const MIN_SCALE = 0.8;
/** Максимально допустимый масштаб сетки. */
const MAX_SCALE = 2.0;

const ZoomContext = createContext(null);

/**
 * Провайдер масштаба игровой сетки.
 *
 * Оборачивает дерево компонентов, которым нужен доступ к текущему zoom.
 * Ограничивает масштаб диапазоном [MIN_SCALE, MAX_SCALE].
 *
 * @param {{ children: React.ReactNode, initialScale?: number }} props
 * @param props.children     - дочерние компоненты
 * @param props.initialScale - начальный масштаб (по умолчанию 1.0)
 */
export const ZoomProvider = ({ children, initialScale = 1.0 }) => {
  const [scale, setScale] = useState(initialScale);

  /**
   * Обновляет масштаб с автоматическим ограничением в допустимый диапазон.
   *
   * @param {number} newScale - желаемый новый масштаб
   */
  const updateScale = useCallback((newScale) => {
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale)));
  }, []);

  const value = {
    scale,
    setScale: updateScale,
    MIN_SCALE,
    MAX_SCALE,
  };

  return (
    <ZoomContext.Provider value={value}>
      {children}
    </ZoomContext.Provider>
  );
};

/**
 * Хук для доступа к текущему масштабу из любого компонента.
 *
 * @returns {{ scale: number, setScale: (n: number) => void, MIN_SCALE: number, MAX_SCALE: number }}
 * @throws Error если вызван вне дерева ZoomProvider
 */
export const useZoom = () => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useCallback } from 'react';

// ========================================
// Хук для управления масштабом игры
// ========================================

// Границы масштабирования
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.0;

// Создаем контекст для доступа к масштабу из любого компонента
const ZoomContext = createContext(null);

// Провайдер масштаба - оборачивает всё приложение
export const ZoomProvider = ({ children, initialScale = 1.0 }) => {
  const [scale, setScale] = useState(initialScale);

  // Функция изменения масштаба с проверкой границ
  const updateScale = useCallback((newScale) => {
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale)));
  }, []);

  const value = {
    scale,           // Текущий масштаб
    setScale: updateScale, // Функция для изменения
    MIN_SCALE,
    MAX_SCALE,
  };

  return (
    <ZoomContext.Provider value={value}>
      {children}
    </ZoomContext.Provider>
  );
};

// Хук для использования масштаба в компонентах
export const useZoom = () => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
};
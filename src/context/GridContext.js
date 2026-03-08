// ========================================
// ГРИД КОНТЕКСТ - С ГАРАНТИРОВАННОЙ ИНИЦИАЛИЗАЦИЕЙ
// ========================================
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { BASE_GRID_OFFSET } from '../constants/grid';

const GridContext = createContext(null);

export const GridProvider = ({ children }) => {
  // ✅ ГАРАНТИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ: offset всегда имеет x и y
  const [offset, setOffset] = useState({
    x: BASE_GRID_OFFSET.x,
    y: BASE_GRID_OFFSET.y,
  });

  const updateOffset = useCallback((dx, dy) => {
    console.log('[GridContext] updateOffset вызван с:', { dx, dy });
    setOffset(prev => {
      const newOffset = {
        x: (prev?.x || 0) + dx,
        y: (prev?.y || 0) + dy
      };
      console.log('[GridContext] Новый offset:', newOffset);
      return newOffset;
    });
  }, []);

  const setOffsetDirect = useCallback((newOffset) => {
    console.log('[GridContext] setOffsetDirect:', newOffset);
    // ✅ ЗАЩИТА: если newOffset undefined, используем дефолт
    setOffset(newOffset || {
      x: BASE_GRID_OFFSET.x,
      y: BASE_GRID_OFFSET.y,
    });
  }, []);

  const resetOffset = useCallback(() => {
    setOffset({
      x: BASE_GRID_OFFSET.x,
      y: BASE_GRID_OFFSET.y,
    });
  }, []);

  // ✅ MEMO: value всегда стабилен и содержит offset с x и y
  const value = useMemo(() => ({
    offset,
    updateOffset,
    setOffsetDirect,
    resetOffset,
  }), [offset, updateOffset, setOffsetDirect, resetOffset]);

  console.log('[GridContext] Рендер с offset:', offset);

  return (
    <GridContext.Provider value={value}>
      {children}
    </GridContext.Provider>
  );
};

export const useGrid = () => {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error('useGrid must be used within a GridProvider');
  }
  // ✅ ГАРАНТИЯ: offset всегда определён
  return context;
};

export default GridContext;
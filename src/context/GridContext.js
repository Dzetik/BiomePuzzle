import React, { createContext, useContext, useState, useCallback } from 'react';

const GridContext = createContext(null);

export const GridProvider = ({ children }) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const updateOffset = useCallback((dx, dy) => {
    console.log('[GridContext] updateOffset вызван с:', { dx, dy });
    setOffset(prev => {
      const newOffset = {
        x: prev.x + dx,
        y: prev.y + dy
      };
      console.log('[GridContext] Новый offset:', newOffset);
      return newOffset;
    });
  }, []);

  const setOffsetDirect = useCallback((newOffset) => {
    console.log('[GridContext] setOffsetDirect:', newOffset);
    setOffset(newOffset);
  }, []);

  const value = {
    offset,
    updateOffset,
    setOffsetDirect,
  };

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
  return context;
};
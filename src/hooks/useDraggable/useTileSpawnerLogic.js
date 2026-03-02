import { useCallback, useEffect, useRef } from 'react';
import { isCenterOverSpawner } from '../../utils/spawnerUtils';
import { getSpawnerSize } from '../../constants/spawner';
import { useTiles } from '../../context/TilesContext';

export const useTileSpawnerLogic = ({
  getTileId,
  spawnerPos,
  isSpawnerReady,
  currentTileSize,
  currentPositionRef,
  animateSize,
  getTileSize,
  scale,
  isInSpawner,
  setIsInSpawner,
  onSpawnerStateChange,
  tileData,
}) => {
  
  const prevIsInSpawnerRef = useRef(isInSpawner);
  const wasTakenFromSpawnerRef = useRef(false);
  
  const isFreshSpawnerTileRef = useRef(false);
  
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };
  
  const { 
    takeTileFromSpawner, 
    returnTileToSpawner,
    getSpawnerTile,
  } = useTiles();

  const getSpawnerTileRef = useRef(getSpawnerTile);
  const takeTileFromSpawnerRef = useRef(takeTileFromSpawner);
  
  useEffect(() => {
    getSpawnerTileRef.current = getSpawnerTile;
    takeTileFromSpawnerRef.current = takeTileFromSpawner;
  }, [getSpawnerTile, takeTileFromSpawner]);

  const getLogId = useCallback(() => {
    const id = getTileId();
    return id || 'unknown';
  }, [getTileId]);

  // ========================================
  // СБРОС ФЛАГОВ ПРИ СМЕНЕ ПЛИТКИ
  // ========================================

  useEffect(() => {
    if (tileData?.id) {
      console.log(`[SpawnerLogic] Новая плитка ${tileData.id}, сброс флагов`);
      wasTakenFromSpawnerRef.current = false;
      isFreshSpawnerTileRef.current = true;
      
      setTimeout(() => {
        isFreshSpawnerTileRef.current = false;
        console.log(`[SpawnerLogic] Сброс флага isFreshSpawnerTileRef для ${tileData.id}`);
      }, 500);
    }
  }, [tileData?.id]);

  // ========================================
  // ПРОВЕРКИ
  // ========================================

  const checkIfInSpawner = useCallback((position) => {
    if (!isSpawnerReady || !spawnerPos) return false;
    
    const spawnerCheckSize = { 
      width: spawnerSize, 
      height: spawnerSize 
    };
    
    return isCenterOverSpawner(
      position,
      spawnerCheckSize,
      spawnerPos
    );
  }, [isSpawnerReady, spawnerPos, spawnerSize]);

  // ========================================
  // ОБРАБОТЧИК ИЗМЕНЕНИЯ ПОЗИЦИИ
  // ========================================

  const handlePositionChange = useCallback((newPosition) => {
    if (!isSpawnerReady) return;
    
    if (isFreshSpawnerTileRef.current) {
      return;
    }
    
    const inSpawner = checkIfInSpawner(newPosition);
    const logId = getLogId();
    
    if (inSpawner && isInSpawner) {
      return;
    }
    
    if (inSpawner !== isInSpawner) {
      console.log(`[Tile ${logId}] ${inSpawner ? 'Вход' : 'Выход'} из спавнера`);
      setIsInSpawner(inSpawner);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(inSpawner);
      }
      
      if (inSpawner) {
        wasTakenFromSpawnerRef.current = true;
      }
    }
  }, [isSpawnerReady, checkIfInSpawner, isInSpawner, setIsInSpawner, onSpawnerStateChange, getLogId]);

  // ========================================
  // УПРАВЛЕНИЕ РАЗМЕРОМ
  // ========================================

  const updateSizeForSpawner = useCallback((inSpawner, immediate = false) => {
    if (inSpawner) {
      animateSize(spawnerTileSize, immediate);
    } else {
      const targetSize = getTileSize(scale);
      animateSize(targetSize, immediate);
    }
  }, [animateSize, getTileSize, scale, spawnerTileSize]);

  useEffect(() => {
    if (prevIsInSpawnerRef.current !== isInSpawner) {
      const logId = getLogId();
      console.log(`[Tile ${logId}] isInSpawner изменился:`, isInSpawner);
      
      updateSizeForSpawner(isInSpawner, false);
      
      prevIsInSpawnerRef.current = isInSpawner;
    }
  }, [isInSpawner, updateSizeForSpawner, getLogId]);

  useEffect(() => {
    if (!isInSpawner && isSpawnerReady) {
      updateSizeForSpawner(false, false);
    }
  }, [scale, isInSpawner, isSpawnerReady, updateSizeForSpawner]);

  // ========================================
  // ПРИНУДИТЕЛЬНОЕ УПРАВЛЕНИЕ СОСТОЯНИЕМ
  // ========================================

  const setInSpawner = useCallback(() => {
    if (!isInSpawner) {
      const logId = getLogId();
      console.log(`[Tile ${logId}] Принудительный вход в спавнер`);
      setIsInSpawner(true);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(true);
      }
      
      if (tileData) {
        returnTileToSpawner(tileData);
      }
      
      wasTakenFromSpawnerRef.current = true;
    }
  }, [isInSpawner, setIsInSpawner, onSpawnerStateChange, tileData, returnTileToSpawner, getLogId]);

  const setOutOfSpawner = useCallback(() => {
    if (isInSpawner) {
      const logId = getLogId();
      console.log(`[Tile ${logId}] Принудительный выход из спавнера`);
      setIsInSpawner(false);
      
      if (onSpawnerStateChange) {
        onSpawnerStateChange(false);
      }
      
      wasTakenFromSpawnerRef.current = true;
    }
  }, [isInSpawner, setIsInSpawner, onSpawnerStateChange, getLogId]);

  // ========================================
  // ВЗЯТИЕ ПЛИТКИ ИЗ СПАВНЕРА
  // ========================================

  const acquireTileFromSpawner = useCallback(() => {
    const logId = getLogId();
    
    const currentSpawnerTile = getSpawnerTileRef.current();
    console.log(`[Tile ${logId}] spawnerTile через ref:`, currentSpawnerTile?.id || 'null');
    
    if (!wasTakenFromSpawnerRef.current && currentSpawnerTile) {
      const tile = takeTileFromSpawnerRef.current();
      if (tile) {
        console.log(`[Tile ${logId}] Получена плитка ${tile.id} из спавнера`);
        wasTakenFromSpawnerRef.current = true;
        return tile;
      }
    }
    return null;
  }, [getLogId]);

  // ========================================
  // ВОЗВРАЩАЕМЫЙ API
  // ========================================
  
  return {
    spawnerTileSize,
    handlePositionChange,
    setInSpawner,
    setOutOfSpawner,
    checkIfInSpawner,
    acquireTileFromSpawner,
    wasTakenFromSpawner: wasTakenFromSpawnerRef.current,
  };
};
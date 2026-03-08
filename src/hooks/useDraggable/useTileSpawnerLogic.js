import { useCallback, useEffect, useRef } from 'react';
import { SpawnerService } from '../../services/SpawnerService';
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
  
  const { takeTileFromSpawner, returnTileToSpawner, getSpawnerTile } = useTiles();

  const getSpawnerTileRef = useRef(getSpawnerTile);
  const takeTileFromSpawnerRef = useRef(takeTileFromSpawner);

  useEffect(() => {
    getSpawnerTileRef.current = getSpawnerTile;
    takeTileFromSpawnerRef.current = takeTileFromSpawner;
  }, [getSpawnerTile, takeTileFromSpawner]);

  const getLogId = useCallback(() => getTileId() || 'unknown', [getTileId]);

  useEffect(() => {
    if (tileData?.id) {
      wasTakenFromSpawnerRef.current = false;
      isFreshSpawnerTileRef.current = true;
      setTimeout(() => { isFreshSpawnerTileRef.current = false; }, 500);
    }
  }, [tileData?.id]);

  const checkIfInSpawner = useCallback((position) => {
    if (!isSpawnerReady) return false;
    
    if (
      !spawnerPos || 
      typeof spawnerPos.x !== 'number' || 
      typeof spawnerPos.y !== 'number' || 
      typeof spawnerPos.size !== 'number' ||
      spawnerPos.size <= 0
    ) return false;
    
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') return false;
    
    try {
      return SpawnerService.isCenterOverSpawner(
        position,
        { width: spawnerSize, height: spawnerSize },
        spawnerPos
      );
    } catch {
      return false;
    }
  }, [isSpawnerReady, spawnerPos, spawnerSize]);

  const handlePositionChange = useCallback((newPosition) => {
    if (!isSpawnerReady || isFreshSpawnerTileRef.current) return;
    if (!newPosition || typeof newPosition.x !== 'number' || typeof newPosition.y !== 'number') return;

    try {
      const inSpawner = checkIfInSpawner(newPosition);
      if (inSpawner === isInSpawner) return;
      
      setIsInSpawner(inSpawner);
      if (onSpawnerStateChange) onSpawnerStateChange(inSpawner);
      if (inSpawner) wasTakenFromSpawnerRef.current = true;
    } catch (e) {
      console.error('[handlePositionChange] Error:', e);
    }
  }, [isSpawnerReady, checkIfInSpawner, isInSpawner, setIsInSpawner, onSpawnerStateChange]);

  const updateSizeForSpawner = useCallback((inSpawner, immediate = false) => {
    if (!animateSize) return;
    const targetSize = inSpawner ? spawnerTileSize : getTileSize(scale);
    animateSize(targetSize, immediate);
  }, [animateSize, getTileSize, scale, spawnerTileSize]);

  useEffect(() => {
    if (prevIsInSpawnerRef.current !== isInSpawner) {
      updateSizeForSpawner(isInSpawner, false);
      prevIsInSpawnerRef.current = isInSpawner;
    }
  }, [isInSpawner, updateSizeForSpawner]);

  useEffect(() => {
    if (!isFreshSpawnerTileRef.current && !isInSpawner && isSpawnerReady) {
      updateSizeForSpawner(false, false);
    }
  }, [scale, isInSpawner, isSpawnerReady, updateSizeForSpawner]);

  const setInSpawner = useCallback(() => {
    if (!isInSpawner) {
      setIsInSpawner(true);
      if (onSpawnerStateChange) onSpawnerStateChange(true);
      if (tileData) returnTileToSpawner(tileData);
      wasTakenFromSpawnerRef.current = true;
    }
  }, [isInSpawner, setIsInSpawner, onSpawnerStateChange, tileData, returnTileToSpawner]);

  const setOutOfSpawner = useCallback(() => {
    if (isInSpawner) {
      setIsInSpawner(false);
      if (onSpawnerStateChange) onSpawnerStateChange(false);
      wasTakenFromSpawnerRef.current = true;
    }
  }, [isInSpawner, setIsInSpawner, onSpawnerStateChange]);

  const acquireTileFromSpawner = useCallback(() => {
    const currentSpawnerTile = getSpawnerTileRef.current();
    if (!wasTakenFromSpawnerRef.current && currentSpawnerTile) {
      const tile = takeTileFromSpawnerRef.current();
      if (tile) {
        wasTakenFromSpawnerRef.current = true;
        return tile;
      }
    }
    return null;
  }, []);

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
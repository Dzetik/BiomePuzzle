import { useRef, useEffect, useState } from 'react';
import { PanResponder, Animated } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid, isCenterOverSpawner } from '../utils/gridUtils';
import { DEFAULT_TILE_SIZE, TILE_SIZES } from '../constants/tile';
import { getSpawnerSize } from '../constants/spawner';

const useDraggable = (initialPosition = null) => {
  const [isInSpawner, setIsInSpawner] = useState(false);
  
  const spawnerSize = getSpawnerSize();
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize };
  
  const startPosition = initialPosition || { x: 0, y: 0 };
  
  const widthAnim = useRef(new Animated.Value(TILE_SIZES.medium.width)).current;
  const heightAnim = useRef(new Animated.Value(TILE_SIZES.medium.height)).current;
  const currentTileSize = useRef(TILE_SIZES.medium);
  
  const position = useRef(new Animated.ValueXY(startPosition)).current;
  const currentPositionRef = useRef({ x: position.x._value, y: position.y._value });
  
  const boundsRef = useRef(getScreenBounds(
    DEFAULT_TILE_SIZE.width, 
    DEFAULT_TILE_SIZE.height
  ));
  
  const dragData = useRef({ basePosition: null, touchOffset: null });

  const animateSize = (targetSize) => {
    currentTileSize.current = targetSize;
    Animated.parallel([
      Animated.spring(widthAnim, { 
        toValue: targetSize.width, 
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      }),
      Animated.spring(heightAnim, { 
        toValue: targetSize.height, 
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      })
    ]).start();
  };

  useEffect(() => {
    const listenerId = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y };
      
      // Проверяем, находится ли плитка в зоне спавнера
      const inSpawner = isCenterOverSpawner(value, currentTileSize.current);
      
      if (inSpawner !== isInSpawner) {
        setIsInSpawner(inSpawner);
        // Меняем размер при входе/выходе из спавнера
        const targetSize = inSpawner ? spawnerTileSize : TILE_SIZES.medium;
        animateSize(targetSize);
      }
    });
    
    return () => position.removeListener(listenerId);
  }, [isInSpawner, spawnerSize]);

  const animateToPosition = (targetPosition) => {
    Animated.spring(position, {
      toValue: targetPosition,
      useNativeDriver: false,
      friction: 8,
      tension: 80,
    }).start();
  };
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (_, gesture) => {
        position.stopAnimation();
        const currentPos = currentPositionRef.current;
        dragData.current = {
          basePosition: { ...currentPos },
          touchOffset: {
            x: gesture.x0 - currentPos.x,
            y: gesture.y0 - currentPos.y,
          },
        };
      },
      
      onPanResponderMove: (_, gesture) => {
        const { basePosition } = dragData.current;
        const newPosition = {
          x: basePosition.x + gesture.dx,
          y: basePosition.y + gesture.dy,
        };
        const clampedPosition = clampPosition(newPosition, boundsRef.current);
        position.setValue(clampedPosition);
      },
      
      onPanResponderRelease: () => {
        const currentPos = currentPositionRef.current;
        if (!currentPos) return;
        
        const snappedPosition = snapToGrid(currentPos, currentTileSize.current);
        animateToPosition(snappedPosition);
        dragData.current = { basePosition: null, touchOffset: null };
      },
    })
  ).current;

  return {
    position,
    width: widthAnim,
    height: heightAnim,
    panHandlers: panResponder.panHandlers,
    isInSpawner,
  };
};

export default useDraggable;
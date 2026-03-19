// ============================================================================
// КОМПОНЕНТ: ОТОБРАЖЕНИЕ ПЛИТКИ
// ============================================================================
// Универсальный рендерер плитки для трёх контекстов:
//   - спавнер (перетаскиваемая, position: absolute, высокий zIndex)
//   - инвентарь (position: relative, выравнивается внутри InventoryCell)
//   - размещённая на сетке (position: absolute + TouchableOpacity-оверлей)
// ============================================================================

// src/components/TileView.tsx
import React from 'react';
import { Image, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { StyleProp, ViewStyle } from 'react-native'; 
import { useGrid } from '../context/GridContext';
import { useZoom } from '../hooks/useZoom';
import { Tile } from '../models/Tile';
import ActiveSideArrow from './ActiveSideArrow';

interface TileViewProps {
  textureSource: any;
  position: { x: number; y: number };
  width: number;
  height: number;
  gesture?: any;
  tileId: string;
  rotation?: number;
  isInInventory?: boolean;
  debugLabel?: string;
  
  /** Активная сторона плитки (направление стрелки) */
  activeSide?: 'top' | 'right' | 'bottom' | 'left';
  
  /** Полный объект плитки (если передан — activeSide берётся из него) */
  tile?: Tile | null;
  
  /** Явно показать/скрыть стрелку (по умолчанию: показывать если activeSide задан) */
  showArrow?: boolean;
  
  /** Флаг: плитка размещена и статична (не перетаскивается) */
  isPlaced?: boolean;
  /** Колбэк нажатия на размещённую плитку */
  onPlacedTilePress?: (tile: Tile) => void;
}

/**
 * Главный рендерер плитки.
 *
 * Определяет `activeSide` из `tile.activeSide` (приоритет) или из пропа `activeSide`.
 * Позицию стрелки (`arrowConfig`) вычисляет через `useMemo` — пересчёт только при
 * изменении `resolvedActiveSide` или размеров плитки.
 *
 * Для размещённых плиток (`isPlaced=true`) поверх View рендерятся два дополнительных
 * элемента: прозрачный TouchableOpacity для перехвата тапа и полупрозрачный highlight-слой
 * для визуального фидбека. Оба слоя используют тот же `position.x/y`, что и плитка.
 *
 * zIndex-стратегия:
 * - Инвентарь: 10000 (поверх игровой сетки, но под модальными окнами)
 * - Размещённые: 100 (определяется `debugLabel`)
 * - Спавнер/перетаскивание: 999999 (поверх всего)
 *
 * @param textureSource     - источник изображения текстуры
 * @param position          - экранная позиция (игнорируется в режиме инвентаря)
 * @param width             - ширина плитки в пикселях
 * @param height            - высота плитки в пикселях
 * @param gesture           - жест из useDraggableFSM (передаётся через panHandlers)
 * @param tileId            - ID плитки (используется в логах и как key)
 * @param rotation          - угол поворота в градусах
 * @param isInInventory     - режим инвентаря (влияет на position и zIndex)
 * @param debugLabel        - метка для отладочного оверлея
 * @param activeSide        - явная активная сторона (если не задана в tile)
 * @param tile              - полный объект плитки (activeSide берётся из него)
 * @param showArrow         - принудительно показать/скрыть стрелку
 * @param isPlaced          - плитка статична на сетке (включает tap-оверлей)
 * @param onPlacedTilePress - колбэк при нажатии на размещённую плитку
 */
const TileView: React.FC<TileViewProps> = ({
  textureSource,
  position,
  width,
  height,
  gesture,
  tileId = 'unknown',
  rotation = 0,
  isInInventory = false,
  debugLabel = '',
  activeSide,
  tile,
  showArrow,
  isPlaced = false,
  onPlacedTilePress,
}) => {
  const { offset } = useGrid();
  const { scale } = useZoom();
  
  const resolvedActiveSide = tile?.activeSide ?? activeSide;
  const shouldShowArrow = showArrow !== undefined ? showArrow : !!resolvedActiveSide;
  
  // ============================================================================
  // ВЫЧИСЛЕНИЕ ПОЗИЦИИ СТРЕЛКИ
  // ============================================================================
  const arrowConfig = React.useMemo(() => {
    if (!shouldShowArrow || !resolvedActiveSide) return null;
    
    const arrowSize = 16;
    const arrowOffset = 4;
    
    let x = 0, y = 0;
    let direction: 'up' | 'right' | 'down' | 'left' = 'up';
    
    switch (resolvedActiveSide) {
      case 'top':
        x = (width - arrowSize) / 2;
        y = arrowOffset;
        direction = 'up';
        break;
      case 'right':
        x = width - arrowSize - arrowOffset;
        y = (height - arrowSize * 0.9) / 2;
        direction = 'right';
        break;
      case 'bottom':
        x = (width - arrowSize) / 2;
        y = height - arrowSize * 0.9 - arrowOffset;
        direction = 'down';
        break;
      case 'left':
        x = arrowOffset;
        y = (height - arrowSize * 0.9) / 2;
        direction = 'left';
        break;
    }
    
    return { position: { x, y }, direction, size: arrowSize };
  }, [shouldShowArrow, resolvedActiveSide, width, height]);
  
  // ============================================================================
  // СТИЛИ КОНТЕЙНЕРА ПЛИТКИ
  // ============================================================================
  const tileStyle = {
    position: (isInInventory ? 'relative' : 'absolute') as 'relative' | 'absolute',
    
    ...(!isInInventory && {
      left: typeof position?.x === 'number' ? position.x : 0,
      top: typeof position?.y === 'number' ? position.y : 0,
    }),
    
    width: typeof width === 'number' ? width : 50,
    height: typeof height === 'number' ? height : 50,
    
    transform: [{ rotate: `${rotation}deg` }],
    
    ...(isInInventory && {
      alignSelf: 'center' as const,
    }),
    
    zIndex: isInInventory ? 10000 : (debugLabel?.includes('Placed') ? 100 : 999999),
    elevation: isInInventory ? 10000 : (debugLabel?.includes('Placed') ? 100 : 999999),
  } satisfies StyleProp<ViewStyle>;

  // ============================================================================
  // РЕНДЕР
  // ============================================================================
  return (
    <>
      {/* Основной контент плитки */}
      <View style={[styles.tile, tileStyle]} {...(gesture ? { ...gesture.panHandlers } : {})} collapsable={false}>
        
        {/* Изображение текстуры */}
        <Image 
          source={textureSource} 
          style={styles.image} 
          resizeMode="cover"
          onLoad={() => __DEV__ && console.log(`[TileView] Image loaded: ${tileId}`)}
          onError={(e) => __DEV__ && console.error(`[TileView] Image error: ${tileId}`, e.nativeEvent?.error)}
        />
        
        {/* Стрелка активной стороны */}
        {shouldShowArrow && arrowConfig && (
          <View 
            style={{
              position: 'absolute',
              left: arrowConfig.position.x,
              top: arrowConfig.position.y,
              zIndex: 15,
            }}
            pointerEvents="none"
          >
            <ActiveSideArrow 
              direction={arrowConfig.direction}
              size={arrowConfig.size}
              color="#ffffff"
            />
          </View>
        )}
        
      </View>
      
      {/* ======================================================================== */}
      {/* ПРОЗРАЧНЫЙ ОВЕРЛЕЙ ДЛЯ ТАПОВ                                             */}
      {/* ======================================================================== */}
      {isPlaced && !gesture && onPlacedTilePress && tile && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onPlacedTilePress(tile)}
          style={{
            position: 'absolute',
            left: typeof position?.x === 'number' ? position.x : 0,
            top: typeof position?.y === 'number' ? position.y : 0,
            width: typeof width === 'number' ? width : 50,
            height: typeof height === 'number' ? height : 50,
            // zIndex на 1 выше, чтобы перехватывать тапы поверх плитки
            zIndex: (typeof tileStyle.zIndex === 'number' ? tileStyle.zIndex : 0) + 1,
            borderRadius: 8, 
          }}
        />
      )}
      
      {/* Визуальный фидбек при нажатии */}
      {isPlaced && !gesture && onPlacedTilePress && tile && (
        <View 
          style={[
            styles.placedHighlight,
            {
              position: 'absolute',
              left: typeof position?.x === 'number' ? position.x : 0,
              top: typeof position?.y === 'number' ? position.y : 0,
              width: typeof width === 'number' ? width : 50,
              height: typeof height === 'number' ? height : 50,
              zIndex: (typeof tileStyle.zIndex === 'number' ? tileStyle.zIndex : 0) + 2,
            }
          ]} 
          pointerEvents="none" 
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  tile: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  image: { 
    width: '100%', 
    height: '100%',
    zIndex: 1,
  },
  debugOverlay: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', 
    padding: 4,
    zIndex: 10,
  },
  debugText: { 
    color: 'yellow', 
    fontSize: 10, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  debugTextSmall: { 
    color: 'white', 
    fontSize: 8, 
    textAlign: 'center' 
  },
  placedHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    opacity: 0,
  },
});

export default TileView;
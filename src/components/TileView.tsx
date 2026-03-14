// src/components/TileView.tsx
import React from 'react';
import { Animated, Image, View, Text, StyleSheet } from 'react-native';
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
  
  // ============================================================================
  // 🔑 Пропсы для активной стороны (крафт)
  // ============================================================================
  /** Активная сторона плитки (направление стрелки) */
  activeSide?: 'top' | 'right' | 'bottom' | 'left';
  
  /** Полный объект плитки (если передан — activeSide берётся из него) */
  tile?: Tile | null;
  
  /** Явно показать/скрыть стрелку (по умолчанию: показывать если activeSide задан) */
  showArrow?: boolean;
}

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
}) => {
  const { offset } = useGrid();
  const { scale } = useZoom();
  
  // ============================================================================
  // 🔑 ОПРЕДЕЛЕНИЕ ACTIVE SIDE
  // ============================================================================
  const resolvedActiveSide = tile?.activeSide ?? activeSide;
  const shouldShowArrow = showArrow !== undefined ? showArrow : !!resolvedActiveSide;
  
  // ============================================================================
  // 🔑 ВЫЧИСЛЕНИЕ ПОЗИЦИИ СТРЕЛКИ (в локальных координатах плитки)
  // ============================================================================
  const arrowConfig = React.useMemo(() => {
    if (!shouldShowArrow || !resolvedActiveSide) return null;
    
    const arrowSize = 16;      // Размер основания треугольника
    const arrowOffset = 4;     // Отступ стрелки от края плитки (внутрь)
    
    // Позиция в локальных координатах (до применения rotation)
    let x = 0, y = 0;
    let direction: 'up' | 'right' | 'down' | 'left' = 'up';
    
    switch (resolvedActiveSide) {
      case 'top':
        // Стрелка по центру сверху, смотрит вверх
        x = (width - arrowSize) / 2;
        y = arrowOffset;  // Чуть внутри от верхнего края
        direction = 'up';
        break;
      case 'right':
        // Стрелка по центру справа, смотрит вправо
        x = width - arrowSize - arrowOffset;
        y = (height - arrowSize * 0.9) / 2;  // 0.9 = высота треугольника
        direction = 'right';
        break;
      case 'bottom':
        // Стрелка по центру снизу, смотрит вниз
        x = (width - arrowSize) / 2;
        y = height - arrowSize * 0.9 - arrowOffset;
        direction = 'down';
        break;
      case 'left':
        // Стрелка по центру слева, смотрит влево
        x = arrowOffset;
        y = (height - arrowSize * 0.9) / 2;
        direction = 'left';
        break;
    }
    
    return { position: { x, y }, direction, size: arrowSize };
  }, [shouldShowArrow, resolvedActiveSide, width, height]);
  
  // ============================================================================
  // 🔍 ОТЛАДКА: Лог рендера
  // ============================================================================
  /*React.useEffect(() => {
    if (__DEV__) {
      console.log(`[TileView] 🎬 ${debugLabel || tileId}:`, {
        position: { x: Math.round(position?.x || 0), y: Math.round(position?.y || 0) },
        size: { width, height },
        rotation,
        activeSide: resolvedActiveSide,
        showingArrow: shouldShowArrow && !!arrowConfig,
      });
    }
  }, [tileId, debugLabel, position?.x, position?.y, width, height, rotation, resolvedActiveSide, shouldShowArrow, arrowConfig]);*/

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
    
    // 🔑 ВРАЩЕНИЕ ПРИМЕНЯЕТСЯ КО ВСЕМУ КОНТЕЙНЕРУ
    // Всё внутри (изображение, стрелка, дебаг) повернётся вместе
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
    <Animated.View style={[styles.tile, tileStyle]} {...(gesture ? { ...gesture.panHandlers } : {})}>
      
      {/* 🔹 Изображение текстуры плитки */}
      <Image 
        source={textureSource} 
        style={styles.image} 
        resizeMode="cover"
        onLoad={() => __DEV__ && console.log(`[TileView] ✅ Image loaded: ${tileId}`)}
        onError={(e) => __DEV__ && console.error(`[TileView] ❌ Image error: ${tileId}`, e.nativeEvent?.error)}
      />
      
      {/* ======================================================================== */}
      {/* 🔹 СТРЕЛКА АКТИВНОЙ СТОРОНЫ — отдельный слой, НЕ в debug overlay */}
      {/* ======================================================================== */}
      {shouldShowArrow && arrowConfig && (
        <View 
          style={{
            position: 'absolute',
            left: arrowConfig.position.x,
            top: arrowConfig.position.y,
            // Не добавляем transform здесь — вращение уже на родительском контейнере!
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
      
      {/* ======================================================================== */}
      {/* 🔹 ДЕБАГ ОВЕРЛЕЙ — отдельный слой, под стрелкой */}
      {/* ======================================================================== */}
      {/*<View style={styles.debugOverlay}>
        <Text style={styles.debugText}>{tileId}</Text>
        <Text style={styles.debugTextSmall}>
          {Math.round(position?.x || 0)},{Math.round(position?.y || 0)}
        </Text>
        <Text style={styles.debugTextSmall}>🔄 {rotation}°</Text>
        
        {/* 🔑 Показываем ИСХОДНОЕ направление (до поворота) для отладки */}
        {/*{resolvedActiveSide && (
          <Text style={[styles.debugTextSmall, { color: '#0f0', marginTop: 2 }]}>
            ➤ {resolvedActiveSide} (local)
          </Text>
        )}
      </View>*/}
      
    </Animated.View>
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
    // Убедимся что изображение не перекрывает стрелку
    zIndex: 1,
  },
  debugOverlay: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', 
    padding: 4,
    zIndex: 10,  // Под стрелкой (15), но поверх изображения (1)
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
});

export default TileView;
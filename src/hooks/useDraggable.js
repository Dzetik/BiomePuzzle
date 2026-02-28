import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { PanResponder, Animated } from 'react-native';
import { getScreenBounds, clampPosition } from '../utils/constraints';
import { snapToGrid } from '../utils/gridUtils';
import { getSpawnerSize } from '../constants/spawner';
import { isCenterOverSpawner, getSnapToSpawnerPosition } from '../utils/spawnerUtils';
import { useZoom } from './useZoom';
import { useTiles } from '../context/TilesContext';
import { useGrid } from '../context/GridContext';
import { useSpawner } from './useSpawner';
import { getCellSize, findNearestCell, getCellCenter } from '../utils/gridUtils';

// ========================================
// Хук для управления перетаскиваемой плиткой
// Поддерживает: перетаскивание, притягивание к сетке/спавнеру, масштабирование
// ========================================

const useDraggable = (initialPosition = null, tileId = null) => {
  // Все хуки на верхнем уровне (правила хуков)
  const { scale } = useZoom(); // Текущий масштаб игры
  const { isCellOccupied, addTile, moveTile, getTileAt, getAllTiles } = useTiles(); // Работа с плитками в контексте
  const { offset } = useGrid(); // Смещение виртуальной камеры
  const spawnerPos = useSpawner(); // Позиция спавнера на экране
  
  const [isSpawnerReady, setIsSpawnerReady] = useState(false); // Флаг готовности спавнера
  const scaleRef = useRef(scale); // Реф для доступа к scale в колбэках
  const offsetRef = useRef(offset); // Реф для доступа к offset в колбэках
  
  // Обновляем ref при изменении offset и scale
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]); // Срабатывает при изменении масштаба
  
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]); // Срабатывает при изменении смещения сетки
  
  // Эффект для отслеживания готовности спавнера
  useEffect(() => {
    if (spawnerPos.size > 0) {
      setIsSpawnerReady(true);
    }
  }, [spawnerPos]); // Срабатывает при получении позиции спавнера
  
  const [isInSpawner, setIsInSpawner] = useState(true); // Флаг нахождения плитки в спавнере
  
  // Целевая ячейка плитки - null пока плитка в спавнере
  // Хранит координаты ячейки, в которой должна находиться плитка
  const targetCellRef = useRef(null);
  
  // Размеры
  const spawnerSize = getSpawnerSize(); // Получаем размер спавнера из конфига
  const spawnerTileSize = { width: spawnerSize, height: spawnerSize }; // Размер плитки в спавнере
  
  // Функция получения размера плитки под текущий масштаб
  const getTileSize = useCallback((s) => ({
    width: getCellSize(s),
    height: getCellSize(s)
  }), []); // Зависимостей нет, так как getCellSize - чистая функция
  
  // Начальная позиция с проверкой готовности спавнера
  const startPosition = useMemo(() => {
    if (initialPosition) return initialPosition; // Если передана начальная позиция, используем её
    if (isSpawnerReady) {
      return getSnapToSpawnerPosition(spawnerTileSize, spawnerPos); // Центрируем в спавнере
    }
    // Возвращаем временную позицию, пока спавнер не готов
    return { x: 0, y: 0 };
  }, [initialPosition, isSpawnerReady, spawnerPos, spawnerTileSize]); // Пересчитываем при изменении этих значений
  
  // Анимированные значения
  const widthAnim = useRef(new Animated.Value(spawnerTileSize.width)).current; // Анимируемая ширина
  const heightAnim = useRef(new Animated.Value(spawnerTileSize.height)).current; // Анимируемая высота
  const position = useRef(new Animated.ValueXY(startPosition)).current; // Анимируемая позиция (x, y)
  
  // Refs для синхронного доступа к текущим значениям (без задержек анимации)
  const currentTileSize = useRef(spawnerTileSize); // Текущий размер плитки
  const currentPositionRef = useRef({ x: position.x._value, y: position.y._value }); // Текущая позиция

  /**
   * Эффект: при монтировании проверяем, есть ли уже плитка в какой-то ячейке
   * Если плитка уже была размещена ранее, загружаем её оттуда
   */
  useEffect(() => {
    if (!isSpawnerReady) return; // Ждём готовности спавнера
    
    if (tileId) {
      const allTiles = getAllTiles(); // Получаем все размещённые плитки
      const existingTile = allTiles.find(t => t.id === tileId); // Ищем нашу плитку по ID
      
      if (existingTile) {
        // Плитка уже где-то есть - перемещаем её туда
        console.log(`[Tile ${tileId}] Загружена из ячейки:`, existingTile.col, existingTile.row);
        targetCellRef.current = { col: existingTile.col, row: existingTile.row };
        setIsInSpawner(false);
        
        // Вычисляем центр целевой ячейки с учётом масштаба и смещения
        const cellCenter = getCellCenter(
          existingTile.col, 
          existingTile.row, 
          scale, 
          offset.x, 
          offset.y
        );
        
        // Вычисляем позицию верхнего левого угла плитки
        const newPosition = {
          x: Math.round(cellCenter.x - currentTileSize.current.width / 2),
          y: Math.round(cellCenter.y - currentTileSize.current.height / 2),
        };
        
        console.log(`[Tile ${tileId}] Установка позиции:`, newPosition);
        position.setValue(newPosition); // Устанавливаем без анимации
      } else {
        console.log(`[Tile ${tileId}] Нет в сохранённых, в спавнере`);
        
        // Устанавливаем позицию в спавнере
        const spawnerPosition = getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
        position.setValue(spawnerPosition);
        
        // ВАЖНО: Не устанавливаем targetCellRef для плитки в спавнере!
        targetCellRef.current = null;
        setIsInSpawner(true);
      }
    }
  }, [tileId, getAllTiles, scale, offset, position, currentTileSize, spawnerPos, isSpawnerReady]);

  /**
   * Проверяет, свободна ли ячейка
   * @param {number} col - колонка
   * @param {number} row - строка
   * @returns {boolean} true если ячейка свободна или занята этой же плиткой
   */
  const isCellFree = useCallback((col, row) => {
    const tileAtCell = getTileAt(col, row); // Получаем плитку в ячейке
    return !tileAtCell || tileAtCell.id === tileId; // Свободна или это наша же плитка
  }, [getTileAt, tileId]);

  /**
   * Обновляет целевую ячейку по текущей позиции плитки
   * Вызывается при выходе из спавнера и других случаях
   */
  const updateTargetCell = useCallback(() => {
    const pos = currentPositionRef.current;
    const size = currentTileSize.current;
    const currentOffset = offsetRef.current;
    
    // Вычисляем центр плитки
    const center = {
      x: pos.x + size.width / 2,
      y: pos.y + size.height / 2
    };
    
    // Находим ближайшую ячейку к центру
    const cell = findNearestCell(
      center.x, 
      center.y, 
      scaleRef.current,
      currentOffset.x,
      currentOffset.y
    );
    
    targetCellRef.current = { col: cell.col, row: cell.row };
  }, []); // Зависимостей нет, используем refs

  /**
   * Пытается занять ячейку
   * @param {number} col - колонка
   * @param {number} row - строка
   * @returns {boolean} true если успешно заняли
   */
  const tryOccupyCell = useCallback((col, row) => {
    console.log(`[Tile ${tileId}] Попытка занять ячейку [${col},${row}]`);
    
    if (isCellFree(col, row)) {
      const allTiles = getAllTiles();
      const existingTile = allTiles.find(t => t.id === tileId); // Ищем, есть ли уже плитка где-то
      
      if (existingTile) {
        // Плитка уже есть в другой ячейке - перемещаем
        console.log(`[Tile ${tileId}] Перемещение из [${existingTile.col},${existingTile.row}] в [${col},${row}]`);
        moveTile(existingTile.col, existingTile.row, col, row, { id: tileId, texture: 'test1' });
      } else {
        // Новая плитка - добавляем
        console.log(`[Tile ${tileId}] Добавление в [${col},${row}]`);
        addTile(col, row, { id: tileId, texture: 'test1' });
      }
      return true;
    }
    
    console.log(`[Tile ${tileId}] Ячейка [${col},${row}] занята, отмена`);
    return false;
  }, [isCellFree, addTile, moveTile, getAllTiles, tileId]);

  /**
   * Анимирует изменение размера плитки
   * @param {Object} targetSize - целевой размер {width, height}
   */
  const animateSize = useCallback((targetSize) => {
    currentTileSize.current = targetSize; // Сразу обновляем ref
    Animated.parallel([
      Animated.spring(widthAnim, { 
        toValue: targetSize.width, 
        useNativeDriver: false 
      }),
      Animated.spring(heightAnim, { 
        toValue: targetSize.height, 
        useNativeDriver: false 
      })
    ]).start(); // Запускаем параллельную анимацию ширины и высоты
  }, [widthAnim, heightAnim]);

  /**
   * Анимирует перемещение плитки в целевую позицию
   * @param {Object} targetPosition - целевая позиция {x, y}
   */
  const animateToPosition = useCallback((targetPosition) => {
    Animated.spring(position, {
      toValue: targetPosition,
      useNativeDriver: false,
    }).start(); // Плавно перемещаем плитку
  }, [position]);

  /**
   * Эффект: при изменении масштаба перемещаем плитку в целевую ячейку
   * Чтобы плитка оставалась в своей ячейке при зуме
   */
  useEffect(() => {
    if (isInSpawner || !isSpawnerReady) return; // Не обрабатываем для плитки в спавнере
    
    // Проверяем, что targetCellRef.current существует
    if (!targetCellRef.current) {
      console.log(`[Tile ${tileId}] Нет целевой ячейки для зума`);
      return;
    }
    
    const newTileSize = getTileSize(scale); // Новый размер под масштаб
    const currentOffset = offsetRef.current;
    
    // Получаем центр целевой ячейки в новом масштабе
    const cellCenter = getCellCenter(
      targetCellRef.current.col,
      targetCellRef.current.row,
      scale,
      currentOffset.x,
      currentOffset.y
    );
    
    // Вычисляем новую позицию верхнего левого угла
    const newPosition = {
      x: Math.round(cellCenter.x - newTileSize.width / 2),
      y: Math.round(cellCenter.y - newTileSize.height / 2),
    };
    
    animateSize(newTileSize);
    animateToPosition(newPosition);
    
  }, [scale, isInSpawner, isSpawnerReady, getTileSize, animateSize, animateToPosition, tileId]);

  /**
   * Эффект: отслеживание позиции для определения входа/выхода из спавнера
   * Меняет размер плитки при входе/выходе
   */
  useEffect(() => {
    if (!isSpawnerReady) return;
    
    // Подписываемся на изменения позиции
    const listenerId = position.addListener((value) => {
      currentPositionRef.current = { x: value.x, y: value.y }; // Обновляем ref
      
      // Проверяем, находится ли центр плитки над спавнером
      const inSpawner = isCenterOverSpawner(value, currentTileSize.current, spawnerPos);
      
      if (inSpawner !== isInSpawner) {
        setIsInSpawner(inSpawner); // Обновляем состояние
        
        if (inSpawner) {
          animateSize(spawnerTileSize); // В спавнере - размер спавнера
        } else {
          animateSize(getTileSize(scaleRef.current)); // Вне спавнера - обычный размер
          // При выходе из спавнера НЕ обновляем targetCellRef
          // targetCellRef обновится только при отпускании в ячейку
        }
      }
    });
    
    // Отписываемся при размонтировании
    return () => position.removeListener(listenerId);
  }, [isInSpawner, spawnerTileSize, getTileSize, animateSize, tileId, position, spawnerPos, isSpawnerReady]);

  /**
   * PanResponder для обработки перетаскивания пальцем
   * Содержит всю логику жестов: начало, движение, завершение
   */
  const panResponder = useRef(
    PanResponder.create({
      // Разрешаем всегда начинать жест
      onStartShouldSetPanResponder: () => true,
      
      // Начало перетаскивания (палец коснулся)
      onPanResponderGrant: (_, gesture) => {
        console.log(`[Tile ${tileId}] Начало перетаскивания`);
        position.stopAnimation(); // Останавливаем текущую анимацию
        
        const currentPos = currentPositionRef.current;
        const currentOffset = offsetRef.current;
        
        // Проверяем, нужно ли скорректировать позицию (после панорамирования)
        // Только если плитка НЕ в спавнере И есть целевая ячейка
        if (!isInSpawner && targetCellRef.current) {
          const targetCell = targetCellRef.current;
          // Вычисляем, где должна быть плитка в идеале
          const cellCenter = getCellCenter(
            targetCell.col,
            targetCell.row,
            scaleRef.current,
            currentOffset.x,
            currentOffset.y
          );
          
          const expectedPosition = {
            x: Math.round(cellCenter.x - currentTileSize.current.width / 2),
            y: Math.round(cellCenter.y - currentTileSize.current.height / 2),
          };
          
          // Если позиции не совпадают больше чем на 1px, корректируем
          if (Math.abs(expectedPosition.x - currentPos.x) > 1 || 
              Math.abs(expectedPosition.y - currentPos.y) > 1) {
            console.log(`[Tile ${tileId}] Корректировка позиции после панорамирования`);
            position.setValue(expectedPosition);
            currentPositionRef.current = expectedPosition;
          }
        }
        
        const adjustedPos = currentPositionRef.current; // Берём актуальную позицию
        
        // Сохраняем данные для перетаскивания
        dragData.current = {
          basePosition: { ...adjustedPos }, // Базовая позиция в момент касания
          touchOffset: {
            x: gesture.x0 - adjustedPos.x, // Смещение точки касания от угла плитки по X
            y: gesture.y0 - adjustedPos.y, // Смещение точки касания от угла плитки по Y
          },
        };
      },
      
      // Движение пальца
      onPanResponderMove: (_, gesture) => {
        const { basePosition, touchOffset } = dragData.current;
        
        // Вычисляем новую позицию: точка касания - смещение
        // gesture.x0 + gesture.dx - текущая позиция пальца
        const newPosition = {
          x: gesture.x0 + gesture.dx - touchOffset.x,
          y: gesture.y0 + gesture.dy - touchOffset.y,
        };
        
        // Ограничиваем позицию экраном
        const bounds = getScreenBounds(
          currentTileSize.current.width,
          currentTileSize.current.height
        );
        const clampedPosition = clampPosition(newPosition, bounds);
        position.setValue(clampedPosition); // Мгновенно обновляем позицию
      },
      
      // Завершение перетаскивания (палец отпущен)
      onPanResponderRelease: () => {
        console.log(`[Tile ${tileId}] Завершение перетаскивания`);
        const currentPos = currentPositionRef.current;
        if (!currentPos) return;
        
        const currentOffset = offsetRef.current;
        
        // Вычисляем центр плитки
        const centerX = currentPos.x + currentTileSize.current.width / 2;
        const centerY = currentPos.y + currentTileSize.current.height / 2;
        
        // Вычисляем центр спавнера
        const spawnerCenterX = spawnerPos.x + spawnerPos.size / 2;
        const spawnerCenterY = spawnerPos.y + spawnerPos.size / 2;
        
        // Расстояние от центра плитки до центра спавнера
        const distanceToSpawner = Math.sqrt(
          Math.pow(centerX - spawnerCenterX, 2) + 
          Math.pow(centerY - spawnerCenterY, 2)
        );
        
        // Порог для притягивания к спавнеру (2 размера спавнера)
        // Если плитка ближе этого расстояния - летит в спавнер
        const spawnerThreshold = spawnerPos.size * 2;
        
        // ЕСЛИ ПЛИТКА БЛИЗКО К СПАВНЕРУ - ПРИТЯГИВАЕМ К СПАВНЕРУ
        if (distanceToSpawner < spawnerThreshold) {
          console.log(`[Tile ${tileId}] ПРИТЯГИВАЕМ К СПАВНЕРУ!`);
          
          // Получаем позицию для центрирования в спавнере
          const spawnerPosition = getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
          
          // Если плитка была в сетке, удаляем её оттуда
          if (!isInSpawner && targetCellRef.current) {
            const allTiles = getAllTiles();
            const existingTile = allTiles.find(t => t.id === tileId);
            if (existingTile) {
              console.log(`[Tile ${tileId}] Удаляем из ячейки [${existingTile.col},${existingTile.row}]`);
              removeTile(existingTile.col, existingTile.row); // Удаляем из контекста
            }
          }
          
          // Перемещаем в спавнер
          animateToPosition(spawnerPosition);
          setIsInSpawner(true);
          targetCellRef.current = null; // Сбрасываем целевую ячейку
          
          dragData.current = { basePosition: null, touchOffset: null };
          return; // Завершаем обработку
        }
        
        // ИНАЧЕ - ПРИТЯГИВАЕМ К СЕТКЕ
        console.log(`[Tile ${tileId}] Притягиваем к сетке`);
        
        // Используем snapToGrid для притягивания к сетке
        const snappedPosition = snapToGrid(
          currentPos, 
          currentTileSize.current, 
          scaleRef.current,
          currentOffset.x,
          currentOffset.y
        );
        
        // Вычисляем центр после притягивания
        const snappedCenter = {
          x: snappedPosition.x + currentTileSize.current.width / 2,
          y: snappedPosition.y + currentTileSize.current.height / 2
        };
        
        // Находим целевую ячейку по центру
        const targetCell = findNearestCell(
          snappedCenter.x, 
          snappedCenter.y, 
          scaleRef.current,
          currentOffset.x,
          currentOffset.y
        );
        
        console.log(`[Tile ${tileId}] Целевая ячейка: [${targetCell.col},${targetCell.row}]`);
        
        // Пытаемся занять ячейку
        if (isCellFree(targetCell.col, targetCell.row)) {
          // Ячейка свободна
          const allTiles = getAllTiles();
          const existingTile = allTiles.find(t => t.id === tileId);
          
          if (existingTile) {
            // Перемещаем существующую плитку
            moveTile(existingTile.col, existingTile.row, targetCell.col, targetCell.row, { id: tileId, texture: 'test1' });
          } else {
            // Добавляем новую плитку
            addTile(targetCell.col, targetCell.row, { id: tileId, texture: 'test1' });
          }
          
          animateToPosition(snappedPosition); // Анимируем перемещение
          targetCellRef.current = { col: targetCell.col, row: targetCell.row }; // Запоминаем ячейку
          setIsInSpawner(false); // Теперь плитка не в спавнере
        } else {
          // Ячейка занята - возвращаемся
          console.log(`[Tile ${tileId}] Ячейка занята, возврат`);
          
          if (!isInSpawner && targetCellRef.current) {
            // Возврат в предыдущую ячейку
            const prevCellCenter = getCellCenter(
              targetCellRef.current.col,
              targetCellRef.current.row,
              scaleRef.current,
              currentOffset.x,
              currentOffset.y
            );
            const prevPosition = {
              x: prevCellCenter.x - currentTileSize.current.width / 2,
              y: prevCellCenter.y - currentTileSize.current.height / 2,
            };
            animateToPosition(prevPosition);
          } else {
            // Возврат в спавнер
            const spawnerPosition = getSnapToSpawnerPosition(currentTileSize.current, spawnerPos);
            animateToPosition(spawnerPosition);
          }
        }
      },
      
      // Жест прерван (например, системным уведомлением)
      onPanResponderTerminate: () => {
        dragData.current = { basePosition: null, touchOffset: null };
      },
    })
  ).current;

  // Данные для перетаскивания (внутреннее состояние хука)
  const dragData = useRef({ basePosition: null, touchOffset: null });

  // Возвращаем API для компонента
  return {
    position,           // Animated.ValueXY для позиции
    width: widthAnim,   // Animated.Value для ширины
    height: heightAnim, // Animated.Value для высоты
    panHandlers: panResponder.panHandlers, // Обработчики жестов для View
    isInSpawner,        // Флаг нахождения в спавнере
  };
};

export default useDraggable;
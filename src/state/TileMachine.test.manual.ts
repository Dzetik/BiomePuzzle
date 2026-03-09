// src/state/TileMachine.test.manual.ts
import { TileStateMachine } from './tileMachine';
import { Animated } from 'react-native';
// import { Tile } from '../models'; // ← Раскомментируйте, если нужен тип для tile

// Создаём тестовый контекст
const testContext = {
  tileId: 'test-tile-1',
  tileType: 'hint',
  
  // ← НОВОЕ: Поле tile (обязательно по интерфейсу TileContext)
  tile: null,  // Для теста достаточно null
  
  position: { x: 0, y: 0 },
  size: { width: 50, height: 50 },
  spawnerPosition: { x: 0, y: 0, width: 50, height: 50 },
  isInSpawner: true,
  animatedPosition: new Animated.ValueXY({ x: 0, y: 0 }),
  animatedSize: {
    width: new Animated.Value(50),
    height: new Animated.Value(50),
  },
  isAnimating: false,
  meta: {},
  createdAt: Date.now(),
};

// Создаём машину
const machine = new TileStateMachine(testContext);

// Проверяем начальное состояние
console.log('✅ Initial state:', machine.getState()); // SPAWNER_IDLE

// Отправляем событие TAKEN_FROM_SPAWN
const result1 = machine.send({ type: 'TAKEN_FROM_SPAWN' });
console.log('✅ After TAKEN_FROM_SPAWN:', machine.getState()); // DRAGGING
console.log('✅ Actions:', result1?.actions);

// Отправляем событие DRAG_MOVE
const result2 = machine.send({ type: 'DRAG_MOVE', payload: { x: 100, y: 200 } });
console.log('✅ After DRAG_MOVE:', machine.getState()); // DRAGGING
console.log('✅ Position:', machine.getContext().position); // { x: 100, y: 200 }

// Отправляем событие DRAG_END
const result3 = machine.send({ type: 'DRAG_END', payload: { x: 100, y: 200 } });
console.log('✅ After DRAG_END:', machine.getState()); // PLACING (или как у вас названо)

// Отправляем событие CELL_FOUND (свободная ячейка)
const result4 = machine.send({ 
  type: 'CELL_FOUND', 
  payload: { col: 2, row: 3, isFree: true, scale: 1, baseTileSize: 80 } 
});
console.log('✅ After CELL_FOUND:', machine.getState()); // PLACED

// Проверяем историю
console.log('✅ History:', machine.getHistory());
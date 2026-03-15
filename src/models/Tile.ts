// ============================================================================
// МОДЕЛЬ ПЛИТКИ
// ============================================================================
// Хранит состояние отдельной плитки: ID, текстуру, поворот, цвета рёбер,
// активную сторону (для крафта).
// ============================================================================

import { Edge, Rotation, Color, EdgeColors, TileData } from './Tile.types';
import { TILE_DEFINITIONS } from '../data/tileDefinitions';

// ============================================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ПОЛУЧЕНИЕ БАЗОВЫХ РЁБЕР ПО TEXTUREKEY
// ============================================================================
const getBaseEdgesFromTextureKey = (textureKey: string): EdgeColors => {
  const definition = TILE_DEFINITIONS.find(def => def.textureKey === textureKey);
  
  if (definition?.baseEdges) {
    return definition.baseEdges;
  }
  
  return { top: 'gray', right: 'gray', bottom: 'gray', left: 'gray' };
};

// ============================================================================
// КЛАСС ПЛИТКИ
// ============================================================================
export class Tile {
  public readonly id: string;
  public readonly textureKey: string;
  
  private _rotation: Rotation = 0;
  private _baseEdges: EdgeColors;
  
  // ============================================================================
  // 🔑 НОВОЕ: Активная сторона плитки
  // ============================================================================
  private _activeSide?: Edge;

  // ============================================================================
  // КОНСТРУКТОР
  // ============================================================================
  constructor(data: TileData & { rotation?: Rotation; activeSide?: Edge }) {
    this.id = data.id;
    this.textureKey = data.textureKey;
    
    this._baseEdges = data.baseEdges ?? getBaseEdgesFromTextureKey(data.textureKey);
    this._rotation = (data.rotation ?? 0) as Rotation;
    
    // ========================================================================
    // 🔑 НОВОЕ: Сохраняем activeSide если передана
    // ========================================================================
    this._activeSide = data.activeSide;
  }

  // ============================================================================
  // ГЕТТЕР: ТЕКУЩИЙ УГОЛ ПОВОРОТА
  // ============================================================================
  public get rotation(): Rotation {
    return this._rotation;
  }

  public setRotation(rotation: Rotation): void {
    this._rotation = rotation;
  }

  // ============================================================================
  // 🔑 НОВОЕ: ГЕТТЕР/СЕТТЕР ДЛЯ ACTIVE SIDE
  // ============================================================================
  
  /**
   * Возвращает активную сторону плитки (направление стрелки)
   * @returns Edge | undefined
   */
  public get activeSide(): Edge | undefined {
    return this._activeSide;
  }
  
  /**
   * Устанавливает активную сторону плитки
   * @param side - направление или undefined для удаления стрелки
   * 
   * 🔑 Теперь можно использовать:
   * - tile.activeSide = 'top' (через сеттер)
   * - tile.setActiveSide('top') (через метод)
   */
  public set activeSide(side: Edge | undefined) {
    this._activeSide = side;
  }
  
  /**
   * Устанавливает активную сторону плитки (метод для совместимости)
   * @param side - направление или undefined для удаления стрелки
   */
  public setActiveSide(side: Edge | undefined): void {
    this._activeSide = side;
  }

  // ============================================================================
  // 🔑 НОВОЕ: ВСПОМОГАТЕЛЬНЫЙ МЕТОД — получить экранные координаты стрелки
  // ============================================================================
  /**
   * Вычисляет позицию и поворот для отрисовки стрелки на нужной стороне.
   * Учитывает поворот плитки.
   * 
   * @param width - ширина плитки
   * @param height - высота плитки
   * @returns { position: {x, y}, rotation: number } для стилей стрелки
   */
  public getArrowStyle(width: number, height: number): { 
    position: { x: number; y: number }; 
    rotation: number;
    align: 'center' | 'flex-start' | 'flex-end';
    justify: 'center' | 'flex-start' | 'flex-end';
  } | null {
    if (!this._activeSide) return null;
    
    // Базовые отступы стрелки от края плитки
    const arrowOffset = 8;  // px от края
    const arrowSize = 20;   // px размер стрелки
    
    // Вычисляем итоговое направление с учётом поворота плитки
    // Формула: (базовое направление + шаги поворота) % 4
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const baseIndex = edges.indexOf(this._activeSide);
    const steps = this._rotation / 90;
    const finalIndex = (baseIndex + steps + 4) % 4; // +4 для обработки отрицательных значений
    const finalEdge = edges[finalIndex];
    
    // Определяем позицию и выравнивание для каждой стороны
    let x = 0, y = 0, align: any = 'center', justify: any = 'center';
    
    switch (finalEdge) {
      case 'top':
        x = (width - arrowSize) / 2;  // по центру по горизонтали
        y = -arrowOffset;              // чуть выше верхней границы
        align = 'center';
        justify = 'flex-end';          // прижать к верху контейнера
        break;
      case 'right':
        x = width - arrowOffset;       // чуть правее правой границы
        y = (height - arrowSize) / 2;  // по центру по вертикали
        align = 'flex-start';          // прижать к левому краю контейнера
        justify = 'center';
        break;
      case 'bottom':
        x = (width - arrowSize) / 2;
        y = height - arrowOffset;      // чуть ниже нижней границы
        align = 'center';
        justify = 'flex-start';        // прижать к низу контейнера
        break;
      case 'left':
        x = -arrowOffset;              // чуть левее левой границы
        y = (height - arrowSize) / 2;
        align = 'flex-end';            // прижать к правому краю контейнера
        justify = 'center';
        break;
    }
    
    // Поворот самой иконки стрелки (чтобы она всегда "смотрела" наружу)
    // Базовая стрелка смотрит вверх (0°), поворачиваем под сторону
    const arrowRotation = finalIndex * 90;
    
    return {
      position: { x, y },
      rotation: arrowRotation,
      align,
      justify,
    };
  }

  // ============================================================================
  // ГЕТТЕР: ЦВЕТА РЁБЕР С УЧЁТОМ ПОВОРОТА
  // ============================================================================
  public get currentEdges(): EdgeColors {
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const steps = this._rotation / 90;
    
    const result: Partial<EdgeColors> = {};

    edges.forEach((edge, index) => {
      const baseIndex = (index - steps + 4) % 4;
      const baseEdge = edges[baseIndex];
      result[edge] = this._baseEdges[baseEdge as Edge];
    });

    return result as EdgeColors;
  }

  // ============================================================================
  // МЕТОД: ПОВОРОТ НА 90° ПО ЧАСОВОЙ СТРЕЛКЕ
  // ============================================================================
  public rotate(): void {
    this._rotation = ((this._rotation + 90) % 360) as Rotation;
  }

  public resetRotation(): void {
    this._rotation = 0;
  }

  public getEdgeColor(edge: Edge): Color {
    return this.currentEdges[edge];
  }
}
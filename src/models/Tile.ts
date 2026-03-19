// ============================================================================
// МОДЕЛЬ ПЛИТКИ
// ============================================================================
// Хранит состояние отдельной плитки: ID, текстуру, поворот, цвета рёбер,
// активную сторону (для крафта).
// ============================================================================

import { Edge, Rotation, Color, EdgeColors, TileData } from './Tile.types';
import { TILE_DEFINITIONS } from '../data/tileDefinitions';

/**
 * Возвращает базовые цвета рёбер для указанной текстуры из TILE_DEFINITIONS.
 * Если определение не найдено, возвращает серые рёбра по умолчанию.
 *
 * @param textureKey - ключ текстуры плитки
 * @returns объект с цветами четырёх рёбер
 */
const getBaseEdgesFromTextureKey = (textureKey: string): EdgeColors => {
  const definition = TILE_DEFINITIONS.find(def => def.textureKey === textureKey);

  if (definition?.baseEdges) {
    return definition.baseEdges;
  }

  // Запасное значение: все рёбра серые
  return { top: 'gray', right: 'gray', bottom: 'gray', left: 'gray' };
};

/**
 * Модель игровой плитки.
 *
 * Инкапсулирует идентификатор, текстуру, угол поворота, цвета рёбер
 * и активную сторону (направление стрелки для системы крафта).
 *
 * Все методы изменения состояния либо мутируют объект напрямую (для
 * внутреннего использования), либо возвращают новый экземпляр
 * (иммутабельный вариант, предпочтительный для React-состояния).
 */
export class Tile {
  public readonly id: string;
  public readonly textureKey: string;

  private _rotation: Rotation = 0;
  private _baseEdges: EdgeColors;

  // Направление стрелки в локальных координатах плитки (до применения поворота)
  private _activeSide?: Edge;

  /**
   * Создаёт экземпляр плитки.
   *
   * Если baseEdges не переданы, они автоматически определяются по textureKey
   * из TILE_DEFINITIONS. Если и там нет — используются серые рёбра.
   *
   * @param data - данные плитки: id, textureKey, опционально baseEdges, rotation, activeSide
   */
  constructor(data: TileData & { rotation?: Rotation; activeSide?: Edge }) {
    this.id = data.id;
    this.textureKey = data.textureKey;

    // baseEdges берётся из аргумента или вычисляется по textureKey
    this._baseEdges = data.baseEdges ?? getBaseEdgesFromTextureKey(data.textureKey);
    this._rotation = (data.rotation ?? 0) as Rotation;
    this._activeSide = data.activeSide;
  }

  /**
   * Текущий угол поворота плитки в градусах (0, 90, 180, 270).
   */
  public get rotation(): Rotation {
    return this._rotation;
  }

  /**
   * Устанавливает угол поворота напрямую (мутирующий метод).
   * Использовать только вне React-состояния.
   *
   * @param rotation - новый угол (0 | 90 | 180 | 270)
   */
  public setRotation(rotation: Rotation): void {
    this._rotation = rotation;
  }

  /**
   * Активная сторона плитки — направление стрелки в локальных координатах.
   * Используется системой крафта для проверки цепочек.
   * Возвращает undefined, если стрелка не задана.
   */
  public get activeSide(): Edge | undefined {
    return this._activeSide;
  }

  /**
   * Устанавливает активную сторону плитки.
   *
   * @param side - направление стрелки или undefined для её удаления
   */
  public set activeSide(side: Edge | undefined) {
    this._activeSide = side;
  }

  /**
   * Устанавливает активную сторону плитки (метод-аналог сеттера).
   * Оставлен для явного вызова там, где синтаксис сеттера неудобен.
   *
   * @param side - направление стрелки или undefined для её удаления
   */
  public setActiveSide(side: Edge | undefined): void {
    this._activeSide = side;
  }

  /**
   * Вычисляет параметры отрисовки стрелки активной стороны с учётом
   * текущего поворота плитки.
   *
   * Возвращает абсолютную позицию стрелки относительно плитки, угол
   * поворота иконки стрелки и параметры выравнивания для flexbox-контейнера.
   * Возвращает null, если activeSide не задана.
   *
   * @param width  - ширина плитки в пикселях
   * @param height - высота плитки в пикселях
   * @returns объект с полями position, rotation, align, justify или null
   */
  public getArrowStyle(width: number, height: number): {
    position: { x: number; y: number };
    rotation: number;
    align: 'center' | 'flex-start' | 'flex-end';
    justify: 'center' | 'flex-start' | 'flex-end';
  } | null {
    if (!this._activeSide) return null;

    // Отступ стрелки от края плитки в пикселях
    const arrowOffset = 8;
    // Размер иконки стрелки в пикселях
    const arrowSize = 20;

    // Определяем итоговое направление стрелки с учётом поворота плитки.
    // Формула: (индекс базовой стороны + шаги поворота) mod 4
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const baseIndex = edges.indexOf(this._activeSide);
    const steps = this._rotation / 90;
    // +4 гарантирует неотрицательный результат при отрицательных шагах
    const finalIndex = (baseIndex + steps + 4) % 4;
    const finalEdge = edges[finalIndex];

    let x = 0, y = 0, align: any = 'center', justify: any = 'center';

    // Вычисляем экранные координаты и выравнивание для каждой из сторон
    switch (finalEdge) {
      case 'top':
        x = (width - arrowSize) / 2; // горизонтальный центр плитки
        y = -arrowOffset;             // выступает над верхней границей
        align = 'center';
        justify = 'flex-end';         // прижать к верху flexbox-контейнера
        break;
      case 'right':
        x = width - arrowOffset;      // выступает за правую границу
        y = (height - arrowSize) / 2; // вертикальный центр плитки
        align = 'flex-start';         // прижать к левому краю контейнера
        justify = 'center';
        break;
      case 'bottom':
        x = (width - arrowSize) / 2;
        y = height - arrowOffset;     // выступает под нижней границей
        align = 'center';
        justify = 'flex-start';       // прижать к низу контейнера
        break;
      case 'left':
        x = -arrowOffset;             // выступает за левую границу
        y = (height - arrowSize) / 2;
        align = 'flex-end';           // прижать к правому краю контейнера
        justify = 'center';
        break;
    }

    // Угол поворота иконки стрелки: базовая иконка смотрит вверх (0 градусов)
    const arrowRotation = finalIndex * 90;

    return {
      position: { x, y },
      rotation: arrowRotation,
      align,
      justify,
    };
  }

  /**
   * Цвета всех четырёх рёбер с учётом текущего поворота плитки.
   *
   * При повороте на N шагов по часовой стрелке каждое текущее ребро
   * получает цвет ребра, сдвинутого на N позиций против часовой стрелки
   * в массиве ['top', 'right', 'bottom', 'left'].
   */
  public get currentEdges(): EdgeColors {
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const steps = this._rotation / 90;

    const result: Partial<EdgeColors> = {};

    edges.forEach((edge, index) => {
      // Ребро на позиции index при повороте берёт цвет из позиции (index - steps)
      const baseIndex = (index - steps + 4) % 4;
      const baseEdge = edges[baseIndex];
      result[edge] = this._baseEdges[baseEdge as Edge];
    });

    return result as EdgeColors;
  }

  /**
   * Поворачивает плитку на 90 градусов по часовой стрелке (мутирующий метод).
   * Предназначен только для внутреннего использования вне React-состояния.
   */
  public rotate(): void {
    this._rotation = ((this._rotation + 90) % 360) as Rotation;
  }

  /**
   * Сбрасывает угол поворота до 0 градусов (мутирующий метод).
   */
  public resetRotation(): void {
    this._rotation = 0;
  }

  /**
   * Возвращает цвет указанного ребра с учётом текущего поворота.
   *
   * @param edge - сторона плитки ('top' | 'right' | 'bottom' | 'left')
   * @returns цвет ребра
   */
  public getEdgeColor(edge: Edge): Color {
    return this.currentEdges[edge];
  }

  /**
   * Создаёт новый экземпляр плитки с указанным углом поворота.
   * Исходный объект не изменяется — метод безопасен для React-состояния.
   *
   * @param newRotation - целевой угол поворота (0 | 90 | 180 | 270)
   * @returns новый экземпляр Tile с обновлённым rotation
   *
   * @example
   * const newTile = oldTile.withRotation(90);
   * setTiles(prev => prev.map(t => t.id === oldTile.id ? newTile : t));
   */
  public withRotation(newRotation: Rotation): Tile {
    return new Tile({
      id: this.id,
      textureKey: this.textureKey,
      baseEdges: this._baseEdges,
      activeSide: this._activeSide,
      rotation: newRotation,
    });
  }

  /**
   * Создаёт новый экземпляр плитки, повёрнутый на +90 градусов по часовой стрелке.
   * Исходный объект не изменяется — метод безопасен для React-состояния.
   *
   * @returns новый экземпляр Tile с rotation, увеличенным на 90 градусов
   *
   * @example
   * const rotatedTile = tile.rotated();
   * setInventoryTiles(prev => prev.map(t => t.id === tile.id ? rotatedTile : t));
   */
  public rotated(): Tile {
    return new Tile({
      id: this.id,
      textureKey: this.textureKey,
      baseEdges: this._baseEdges,
      activeSide: this._activeSide,
      rotation: ((this._rotation + 90) % 360) as Rotation,
    });
  }
}

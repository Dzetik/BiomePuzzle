import { Edge, Rotation, Color, EdgeColors, TileData } from './Tile.types';

export class Tile {
  public readonly id: string;
  public readonly textureKey: string;
  
  private _rotation: Rotation;
  private _baseEdges: EdgeColors;

  constructor(data: TileData) {
    this.id = data.id;
    this.textureKey = data.textureKey;
    this._baseEdges = data.baseEdges;
    this._rotation = 0;
  }

  /**
   * Текущий угол поворота
   */
  public get rotation(): Rotation {
    return this._rotation;
  }

  /**
   * Вычисляет цвета рёбер с учётом текущего поворота.
   * Не мутирует объект, возвращает новое вычисленное значение.
   */
  public get currentEdges(): EdgeColors {
    const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
    const steps = this._rotation / 90;
    
    const result: Partial<EdgeColors> = {};

    edges.forEach((edge, index) => {
      // Логика поворота по часовой стрелке:
      // Если повернули на 90 (1 step), то текущий 'top' был 'left' (index - 1)
      const baseIndex = (index - steps + 4) % 4;
      const baseEdge = edges[baseIndex];
      
      result[edge] = this._baseEdges[baseEdge as Edge];
    });

    return result as EdgeColors;
  }

  /**
   * Поворачивает плитку на 90 градусов по часовой стрелке
   */
  public rotate(): void {
    this._rotation = ((this._rotation + 90) % 360) as Rotation;
  }

  /**
   * Сбрасывает поворот в 0 (используется при возврате в спавнер)
   */
  public resetRotation(): void {
    this._rotation = 0;
  }

  /**
   * Получает цвет конкретного ребра с учётом поворота
   */
  public getEdgeColor(edge: Edge): Color {
    return this.currentEdges[edge];
  }
}
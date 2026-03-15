// ============================================================================
// КОНФИГУРАЦИЯ СИСТЕМЫ КРАФТА
// ============================================================================
// Глобальные флаги для управления поведением крафта.
// Позволяет включать/отключать систему без изменения кода.
// ============================================================================

export interface CraftingConfig {
  /** Включить ли систему крафта (по умолчанию true) */
  enabled: boolean;
  
  /** Проверять рецепты при размещении плитки */
  checkOnPlace: boolean;
  
  /** Проверять рецепты при повороте плитки (опционально) */
  checkOnRotate: boolean;
  
  /** Проигрывать анимацию при крафте */
  animateMerge: boolean;
  
  /** Задержка между шагами цепочки (в миллисекундах) */
  chainDelayMs: number;
  
  /** Режим отладки: логирование и визуализация */
  debugMode: boolean;
  
  /** Показывать ли отладочную визуализацию проверенных цепочек */
  debugVisualize: boolean;

  maxChainDepth: number;
}

export const CRAFTING_CONFIG: CraftingConfig = {
  enabled: true,
  checkOnPlace: true,
  checkOnRotate: false,  // Пока не реализовано
  animateMerge: true,
  chainDelayMs: 150,
  debugMode: __DEV__ ?? false,
  debugVisualize: __DEV__ ?? false,
  maxChainDepth: 10,
};

export default CRAFTING_CONFIG;
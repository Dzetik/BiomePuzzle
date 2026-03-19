// src/state/tileMachine.config.ts

import { TileMachineConfig, TileEvent } from './tileMachine.types';

// ============================================================================
// КОНФИГУРАЦИЯ ПО УМОЛЧАНИЮ
// ============================================================================

/**
 * Стандартная конфигурация машины состояний плитки.
 *
 * Используется как база при создании конфигурации через `createTileConfig()`.
 * В dev-режиме логирование и отладка включены автоматически.
 */
export const DEFAULT_TILE_CONFIG: TileMachineConfig = {
  animationDuration: 300,   // мс — длительность snap/return анимаций
  snapThreshold: 50,        // px — порог притяжения плитки к ячейке
  dragMoveDebounce: 0,      // 0 = дебаунс отключён
  debugMode: process.env.NODE_ENV !== 'production',
  logHistoryLimit: 50,      // максимум 50 записей в истории переходов
  animationTension: 35,
  animationFriction: 8,
};

// ============================================================================
// ХЕЛПЕР ДЛЯ СЛИЯНИЯ КОНФИГОВ
// ============================================================================

/**
 * Создаёт конфигурацию машины состояний на основе `DEFAULT_TILE_CONFIG`
 * с применением переданных переопределений.
 *
 * @param overrides - частичная конфигурация; незаданные поля берутся из DEFAULT_TILE_CONFIG
 * @returns полная конфигурация TileMachineConfig
 */
export const createTileConfig = (
  overrides: Partial<TileMachineConfig> = {}
): TileMachineConfig => ({
  ...DEFAULT_TILE_CONFIG,
  ...overrides,
});

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Флаги функциональности для управления поведением FSM.
 *
 * `USE_TILE_FSM` — включает использование машины состояний (управляется
 * переменной окружения). `SHOW_TILE_DEBUG` и `LOG_TRANSITIONS` активны
 * в любом не-продакшен окружении.
 */
export const FEATURE_FLAGS = {
  /** Включить FSM-архитектуру для плиток (env: USE_TILE_FSM=true). */
  USE_TILE_FSM: process.env.USE_TILE_FSM === 'true',
  /** Показывать отладочные оверлеи на плитках. */
  SHOW_TILE_DEBUG: process.env.NODE_ENV !== 'production',
  /** Логировать переходы состояний в консоль. */
  LOG_TRANSITIONS: process.env.NODE_ENV !== 'production',
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Проверяет, является ли событие событием перетаскивания (DRAG_MOVE или DRAG_END).
 *
 * Сужает тип `TileEvent` до объединения событий с payload `{ x, y }`,
 * позволяя безопасно обращаться к `event.payload` без приведения типов.
 *
 * @param event - событие для проверки
 * @returns true если событие является DRAG_MOVE или DRAG_END
 */
export const isDragEvent = (
  event: TileEvent
): event is Extract<TileEvent, { type: 'DRAG_MOVE' | 'DRAG_END' }> => {
  return event.type === 'DRAG_MOVE' || event.type === 'DRAG_END';
};

/**
 * Проверяет, является ли событие событием нахождения ячейки (CELL_FOUND).
 *
 * Сужает тип до события с payload `{ col, row, isFree, scale?, baseTileSize? }`.
 *
 * @param event - событие для проверки
 * @returns true если событие является CELL_FOUND
 */
export const isCellEvent = (
  event: TileEvent
): event is Extract<TileEvent, { type: 'CELL_FOUND' }> => {
  return event.type === 'CELL_FOUND';
};

/**
 * Проверяет, что событие имеет указанный тип и содержит поле `payload`.
 *
 * Универсальный type guard для событий с произвольной нагрузкой.
 * Позволяет безопасно обращаться к `event.payload` в generic-коде.
 *
 * @param event - событие для проверки
 * @param type  - ожидаемый тип события
 * @returns true если событие имеет указанный тип и содержит payload
 */
export const hasPayload = <T extends TileEvent['type']>(
  event: TileEvent,
  type: T
): event is Extract<TileEvent, { type: T } & { payload: any }> => {
  return event.type === type && 'payload' in event;
};

// src/constants/inventory.ts

// ============================================================================
// КОНФИГУРАЦИЯ ИНВЕНТАРЯ ПЛИТОК
// ============================================================================
// Все параметры инвентаря вынесены в константы для лёгкого изменения баланса.
// Изменение этих значений не требует правки компонентов и логики.
// ============================================================================

import { DEFAULT_TILE_SIZE } from './tile';

// ============================================================================
// РАЗМЕРЫ И ПОЗИЦИОНИРОВАНИЕ
// ============================================================================

// Высота всей панели инвентаря (в пикселях)
// Должна быть достаточно большой для плитки + отступы + кнопки
export const INVENTORY_HEIGHT = 110;

// Размер одной ячейки/плитки (должен совпадать с размером плитки на гриде)
export const INVENTORY_CELL_SIZE = DEFAULT_TILE_SIZE.width; // 80px

// Отступ между плитками в инвентаре (в пикселях)
export const INVENTORY_CELL_SPACING = 8;

// Горизонтальные отступы по краям панели (до кнопок)
export const INVENTORY_PADDING_HORIZONTAL = 16;

// Размер кнопок прокрутки (квадратные)
export const INVENTORY_SCROLL_BUTTON_SIZE = 40;

// Отступ от кнопок до области плиток
export const INVENTORY_BUTTON_MARGIN = 8;

// ============================================================================
// ЗОНА СБРОСА (DROP ZONE)
// ============================================================================
// Зона сброса = сама панель инвентаря.
// Эти константы используются для определения попадания плитки при драге.
// ============================================================================

// Отступ от низа экрана для зоны сброса (учитывает safe area на iOS)
export const INVENTORY_DROP_ZONE_PADDING_BOTTOM = 0;

// Дополнительный "буфер" сверху панели для более удобного сброса (в пикселях)
// Плитка будет считаться сброшенной в инвентарь даже если отпущена чуть выше панели
export const INVENTORY_DROP_ZONE_BUFFER_TOP = 20;

// Вычисляемая высота зоны сброса (панель + буфер)
export const INVENTORY_DROP_ZONE_TOTAL_HEIGHT = 
  INVENTORY_HEIGHT + INVENTORY_DROP_ZONE_BUFFER_TOP;

// ============================================================================
// КОЛИЧЕСТВО СЛОТОВ
// ============================================================================

// Максимальное количество плиток в инвентаре (не считая счётчик)
// При достижении этого лимита добавление новых плиток блокируется
export const INVENTORY_MAX_SLOTS = 5;

// Количество слотов, видимых на экране одновременно (включая счётчик)
// Определяет ширину видимого окна прокрутки
export const INVENTORY_VISIBLE_SLOTS = 3;

// ============================================================================
// ЦВЕТА И СТИЛИ
// ============================================================================

// Цвет фона всей панели инвентаря
export const INVENTORY_BACKGROUND_COLOR = '#2a2a2a';

// Цвет фона счётчика свободных мест (первый слот)
export const INVENTORY_COUNTER_BACKGROUND_COLOR = '#3a3a3a';

// Цвет фона ячейки с плиткой
export const INVENTORY_CELL_BACKGROUND_COLOR = '#333333';

// Цвет текста счётчика
export const INVENTORY_COUNTER_TEXT_COLOR = '#ffffff';

// Цвет текста подписи счётчика (например, "своб.")
export const INVENTORY_COUNTER_LABEL_COLOR = '#aaaaaa';

// Цвет кнопок прокрутки
export const INVENTORY_BUTTON_BACKGROUND_COLOR = '#444444';

// Цвет иконок/текста кнопок прокрутки
export const INVENTORY_BUTTON_TEXT_COLOR = '#ffffff';

// Цвет кнопок в неактивном состоянии (когда некуда скроллить)
export const INVENTORY_BUTTON_DISABLED_COLOR = '#222222';

// Цвет кнопок в неактивном состоянии (текст)
export const INVENTORY_BUTTON_DISABLED_TEXT_COLOR = '#555555';

// Рамка вокруг ячейки с плиткой
export const INVENTORY_CELL_BORDER_COLOR = '#555555';

// Рамка вокруг счётчика
export const INVENTORY_COUNTER_BORDER_COLOR = '#666666';

// ============================================================================
// АНИМАЦИЯ
// ============================================================================

// Длительность анимации прокрутки (в миллисекундах)
export const INVENTORY_SCROLL_ANIMATION_DURATION = 200;

// Длительность анимации возврата плитки в инвентарь (в миллисекундах)
export const INVENTORY_RETURN_ANIMATION_DURATION = 300;

// ============================================================================
// ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ (помощники)
// ============================================================================

// Ширина одного слота (ячейка + отступы)
export const INVENTORY_SLOT_WIDTH = INVENTORY_CELL_SIZE + INVENTORY_CELL_SPACING;

// Ширина видимой области с плитками (без кнопок)
export const INVENTORY_VISIBLE_WIDTH = 
  INVENTORY_VISIBLE_SLOTS * INVENTORY_SLOT_WIDTH;

// Общая ширина всего контента (для максимального скролла)
export const INVENTORY_TOTAL_WIDTH = 
  (INVENTORY_MAX_SLOTS + 1) * INVENTORY_SLOT_WIDTH; // +1 для счётчика

// Максимальный оффсет прокрутки (в слотах)
export const INVENTORY_MAX_SCROLL_OFFSET = 
  INVENTORY_MAX_SLOTS - INVENTORY_VISIBLE_SLOTS + 1;

// ============================================================================
// ПРОВЕРКИ И ВАЛИДАЦИЯ
// ============================================================================

// Убедиться, что конфигурация корректна
if (INVENTORY_VISIBLE_SLOTS > INVENTORY_MAX_SLOTS + 1) {
  console.warn(
    '[Inventory] ⚠️ INVENTORY_VISIBLE_SLOTS больше чем INVENTORY_MAX_SLOTS + 1. ' +
    'Это может привести к некорректному отображению.'
  );
}

if (INVENTORY_HEIGHT < INVENTORY_CELL_SIZE + 20) {
  console.warn(
    '[Inventory] ⚠️ INVENTORY_HEIGHT слишком мал. ' +
    'Рекомендуется минимум INVENTORY_CELL_SIZE + 20px для отступов.'
  );
}

// ============================================================================
// ЭКСПОРТ ОБЪЕКТОМ (для удобства импорта)
// ============================================================================

export const INVENTORY_CONFIG = {
  // Размеры
  HEIGHT: INVENTORY_HEIGHT,
  CELL_SIZE: INVENTORY_CELL_SIZE,
  CELL_SPACING: INVENTORY_CELL_SPACING,
  PADDING_HORIZONTAL: INVENTORY_PADDING_HORIZONTAL,
  SCROLL_BUTTON_SIZE: INVENTORY_SCROLL_BUTTON_SIZE,
  BUTTON_MARGIN: INVENTORY_BUTTON_MARGIN,
  
  // Зона сброса
  DROP_ZONE_PADDING_BOTTOM: INVENTORY_DROP_ZONE_PADDING_BOTTOM,
  DROP_ZONE_BUFFER_TOP: INVENTORY_DROP_ZONE_BUFFER_TOP,
  DROP_ZONE_TOTAL_HEIGHT: INVENTORY_DROP_ZONE_TOTAL_HEIGHT,
  
  // Количество
  MAX_SLOTS: INVENTORY_MAX_SLOTS,
  VISIBLE_SLOTS: INVENTORY_VISIBLE_SLOTS,
  
  // Цвета
  BACKGROUND_COLOR: INVENTORY_BACKGROUND_COLOR,
  COUNTER_BACKGROUND_COLOR: INVENTORY_COUNTER_BACKGROUND_COLOR,
  CELL_BACKGROUND_COLOR: INVENTORY_CELL_BACKGROUND_COLOR,
  COUNTER_TEXT_COLOR: INVENTORY_COUNTER_TEXT_COLOR,
  COUNTER_LABEL_COLOR: INVENTORY_COUNTER_LABEL_COLOR,
  BUTTON_BACKGROUND_COLOR: INVENTORY_BUTTON_BACKGROUND_COLOR,
  BUTTON_TEXT_COLOR: INVENTORY_BUTTON_TEXT_COLOR,
  BUTTON_DISABLED_COLOR: INVENTORY_BUTTON_DISABLED_COLOR,
  BUTTON_DISABLED_TEXT_COLOR: INVENTORY_BUTTON_DISABLED_TEXT_COLOR,
  CELL_BORDER_COLOR: INVENTORY_CELL_BORDER_COLOR,
  COUNTER_BORDER_COLOR: INVENTORY_COUNTER_BORDER_COLOR,
  
  // Анимация
  SCROLL_ANIMATION_DURATION: INVENTORY_SCROLL_ANIMATION_DURATION,
  RETURN_ANIMATION_DURATION: INVENTORY_RETURN_ANIMATION_DURATION,
  
  // Вычисляемые
  SLOT_WIDTH: INVENTORY_SLOT_WIDTH,
  VISIBLE_WIDTH: INVENTORY_VISIBLE_WIDTH,
  TOTAL_WIDTH: INVENTORY_TOTAL_WIDTH,
  MAX_SCROLL_OFFSET: INVENTORY_MAX_SCROLL_OFFSET,
};

export default INVENTORY_CONFIG;
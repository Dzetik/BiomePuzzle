// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ КВЕСТАМИ (с поддержкой прогресса для сохранений)
// ============================================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Quest, QUESTS, getQuestById } from '../constants/quests';

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Текущий прогресс выполнения активного квеста.
 *
 * Хранит ID квеста и словарь собранных плиток по типу текстуры.
 * Обновляется при каждом изменении инвентаря или сетки.
 */
export interface QuestProgress {
  questId: string;
  /** Количество собранных плиток по типу: { textureKey -> count }. */
  currentCounts: Record<string, number>;
}

/**
 * Публичный интерфейс контекста квестов.
 *
 * Содержит состояние активного квеста, прогресс, действия пользователя,
 * методы сериализации для системы сохранений и счётчики наград.
 */
export interface QuestContextType {
  /** Текущий активный квест или null если квест не выбран. */
  activeQuest: Quest | null;
  /** Прогресс активного квеста или null если квест не активен. */
  questProgress: QuestProgress | null;

  // Действия
  setActiveQuest: (quest: Quest | null) => void;
  refreshQuest: () => void;
  checkQuestCompletion: (tileCounts: Record<string, number>) => boolean;
  submitQuest: (tileCounts: Record<string, number>) => boolean;

  // Для системы сохранений
  getQuestData: () => {
    activeQuestId: string | null;
    completedQuests: string[];
    activeQuestProgress: Record<string, number>;
  };
  setQuestProgressFromSave: (progress: Record<string, number>) => void;

  // Награды
  gold: number;
  experience: number;
  addGold: (amount: number) => void;
  addExperience: (amount: number) => void;

  /** Список ID завершённых квестов. */
  completedQuests: string[];
  markQuestCompleted: (questId: string) => void;
}

// ============================================================================
// КОНТЕКСТ
// ============================================================================

const QuestContext = createContext<QuestContextType | undefined>(undefined);

// ============================================================================
// ПРОВАЙДЕР
// ============================================================================

interface QuestProviderProps {
  children: React.ReactNode;
}

/**
 * Провайдер контекста квестов.
 *
 * Управляет жизненным циклом квестов: выбор случайного задания, отслеживание
 * прогресса, проверка условий сдачи, начисление наград и переход к следующему
 * квесту. Синхронизирует данные с `global.questData` для передачи в SaveService
 * без прямой зависимости между контекстами.
 */
export const QuestProvider: React.FC<QuestProviderProps> = ({ children }) => {
  const [activeQuest, setActiveQuestState] = useState<Quest | null>(null);
  const [questProgress, setQuestProgress] = useState<QuestProgress | null>(null);
  const [gold, setGold] = useState(0);
  const [experience, setExperience] = useState(0);
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);

  /**
   * Выбирает новый случайный квест и инициализирует пустой прогресс.
   *
   * Приоритет — незавершённые квесты. Если все квесты пройдены,
   * выбирает случайный из всего списка (повтор).
   */
  const refreshQuest = useCallback(() => {
    // Фильтруем уже пройденные квесты; если всё пройдено — берём любой
    const availableQuests = QUESTS.filter(q => !completedQuests.includes(q.id));
    const randomQuest = availableQuests.length > 0
      ? availableQuests[Math.floor(Math.random() * availableQuests.length)]
      : QUESTS[Math.floor(Math.random() * QUESTS.length)];

    setActiveQuestState(randomQuest);
    // Сброс прогресса: новый квест начинается с нуля
    setQuestProgress({
      questId: randomQuest.id,
      currentCounts: {},
    });
  }, [completedQuests]);

  /**
   * Устанавливает активный квест вручную.
   *
   * При передаче null очищает и квест, и прогресс.
   * Используется при загрузке сохранения для восстановления конкретного квеста.
   *
   * @param quest - квест для активации или null для сброса
   */
  const setActiveQuest = useCallback((quest: Quest | null) => {
    setActiveQuestState(quest);
    if (quest) {
      setQuestProgress({
        questId: quest.id,
        currentCounts: {},
      });
    } else {
      setQuestProgress(null);
    }
  }, []);

  /**
   * Обновляет счётчик собранных плиток указанного типа в прогрессе квеста.
   *
   * Вызывается при каждом изменении состояния инвентаря или сетки.
   * Ничего не делает, если квест не активен.
   *
   * @param textureKey - тип текстуры плитки
   * @param count      - количество добавляемых плиток (может быть отрицательным)
   */
  const updateQuestProgress = useCallback((textureKey: string, count: number) => {
    if (!activeQuest || !questProgress) return;

    setQuestProgress(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentCounts: {
          ...prev.currentCounts,
          // Накопительный счётчик: добавляем к существующему значению
          [textureKey]: (prev.currentCounts[textureKey] || 0) + count,
        },
      };
    });
  }, [activeQuest, questProgress]);

  /**
   * Проверяет, выполнены ли все условия активного квеста.
   *
   * Сравнивает переданные счётчики плиток с требованиями квеста.
   * Не изменяет состояние — только читает.
   *
   * @param tileCounts - актуальные счётчики плиток из TilesContext.getTileCounts()
   * @returns true если все требования квеста удовлетворены
   */
  const checkQuestCompletion = useCallback((tileCounts: Record<string, number>): boolean => {
    if (!activeQuest) return false;

    return activeQuest.requirements.every(req => {
      const current = tileCounts[req.textureKey] || 0;
      return current >= req.required;
    });
  }, [activeQuest]);

  /**
   * Сдаёт активный квест и начисляет награды.
   *
   * Алгоритм:
   * 1. Повторная проверка выполнимости (защита от гонок).
   * 2. Фиксация финального прогресса в состоянии.
   * 3. Начисление gold и experience.
   * 4. Добавление квеста в completedQuests.
   * 5. Выбор нового квеста через refreshQuest с задержкой 500 мс
   *    (чтобы UI успел отобразить результат).
   *
   * @param tileCounts - актуальные счётчики плиток
   * @returns true при успешной сдаче, false если условия не выполнены
   */
  const submitQuest = useCallback((tileCounts: Record<string, number>): boolean => {
    if (!activeQuest || !questProgress) return false;

    // Повторная проверка — защита от состояния гонки между рендерами
    const canSubmit = activeQuest.requirements.every(req => {
      const current = tileCounts[req.textureKey] || 0;
      return current >= req.required;
    });

    if (!canSubmit) return false;

    // Фиксируем финальный прогресс перед завершением (для корректного сохранения)
    const finalProgress: Record<string, number> = {};
    activeQuest.requirements.forEach(req => {
      finalProgress[req.textureKey] = req.required;
    });
    setQuestProgress(prev => prev ? { ...prev, currentCounts: finalProgress } : prev);

    // Начисление наград
    setGold(prev => prev + activeQuest.reward.gold);
    setExperience(prev => prev + activeQuest.reward.experience);

    // Регистрируем квест как завершённый
    setCompletedQuests(prev => [...prev, activeQuest.id!]);

    console.log('[QuestContext] Квест сдан:', {
      questId: activeQuest.id,
      gold: activeQuest.reward.gold,
      experience: activeQuest.reward.experience,
    });

    // Небольшая задержка перед новым квестом — UI успевает показать анимацию завершения
    setTimeout(() => {
      refreshQuest();
    }, 500);

    return true;
  }, [activeQuest, questProgress, refreshQuest]);

  /**
   * Формирует снимок данных квеста для записи в сохранение.
   *
   * Возвращает плоский объект без ссылок на экземпляры Quest.
   * Используется SaveService через TilesContext → global.questData.
   *
   * @returns объект с activeQuestId, completedQuests и activeQuestProgress
   */
  const getQuestData = useCallback(() => {
    return {
      activeQuestId: activeQuest?.id || null,
      completedQuests,
      activeQuestProgress: questProgress?.currentCounts || {},
    };
  }, [activeQuest?.id, completedQuests, questProgress?.currentCounts]);

  /**
   * Восстанавливает прогресс активного квеста из сохранения.
   *
   * Перезаписывает currentCounts при условии, что квест уже активен.
   * Вызывается после loadGame в TilesContext.
   *
   * @param progress - словарь прогресса { textureKey -> count } из сохранения
   */
  const setQuestProgressFromSave = useCallback((progress: Record<string, number>) => {
    if (activeQuest) {
      setQuestProgress({
        questId: activeQuest.id,
        currentCounts: progress,
      });
    }
  }, [activeQuest]);

  /**
   * Помечает квест как завершённый без начисления наград.
   *
   * Используется при восстановлении сохранения: загруженные completedQuests
   * регистрируются по одному через этот метод.
   * Дублирование защищено проверкой includes().
   *
   * @param questId - идентификатор завершённого квеста
   */
  const markQuestCompleted = useCallback((questId: string) => {
    setCompletedQuests(prev => {
      // Идемпотентность: повторная регистрация не изменяет массив
      if (prev.includes(questId)) return prev;
      return [...prev, questId];
    });
  }, []);

  /**
   * Добавляет золото к текущему балансу.
   *
   * @param amount - количество добавляемых монет
   */
  const addGold = useCallback((amount: number) => {
    setGold(prev => prev + amount);
  }, []);

  /**
   * Добавляет опыт к текущему счётчику.
   *
   * @param amount - количество добавляемых очков опыта
   */
  const addExperience = useCallback((amount: number) => {
    setExperience(prev => prev + amount);
  }, []);

  // ============================================================================
  // СИНХРОНИЗАЦИЯ С GLOBAL.QUESTDATA
  // ============================================================================

  /**
   * Синхронизирует данные квеста с `global.questData` при каждом значимом изменении.
   *
   * `global.questData` — разделяемый мост между QuestContext и TilesContext:
   * SaveService читает данные квеста именно оттуда, не имея прямой зависимости
   * от QuestContext.
   *
   * Зависимости используют примитивы (id, length) вместо объектов, чтобы
   * избежать лишних срабатываний при неизменном содержимом.
   */
  useEffect(() => {
    const questData = {
      activeQuestId: activeQuest?.id || null,
      completedQuests: completedQuests,
      activeQuestProgress: questProgress?.currentCounts || {},
    };

    (global as any).questData = questData;

    if (__DEV__) {
      console.log('[QuestContext] Synced questData:', questData);
    }
  }, [
    activeQuest?.id,                // Только ID, не весь объект Quest
    completedQuests.length,         // Длина массива, не сам массив
    questProgress?.questId,         // ID квеста прогресса
    // Количество ключей в прогрессе как примитив вместо объекта
    questProgress?.currentCounts ? Object.keys(questProgress.currentCounts).length : 0
  ]);

  const contextValue: QuestContextType = {
    activeQuest,
    questProgress,
    setActiveQuest,
    refreshQuest,
    checkQuestCompletion,
    submitQuest,

    getQuestData,
    setQuestProgressFromSave,

    gold,
    experience,
    addGold,
    addExperience,

    completedQuests,
    markQuestCompleted,
  };

  return (
    <QuestContext.Provider value={contextValue}>
      {children}
    </QuestContext.Provider>
  );
};

// ============================================================================
// ХУК ДЛЯ ИСПОЛЬЗОВАНИЯ КОНТЕКСТА
// ============================================================================

/**
 * Хук для доступа к QuestContext.
 *
 * Выбрасывает ошибку, если вызван вне дерева QuestProvider.
 *
 * @returns значение QuestContextType
 * @throws Error если вызван вне QuestProvider
 */
export const useQuests = (): QuestContextType => {
  const context = useContext(QuestContext);
  if (!context) {
    throw new Error('useQuests must be used within a QuestProvider');
  }
  return context;
};

export default QuestContext;

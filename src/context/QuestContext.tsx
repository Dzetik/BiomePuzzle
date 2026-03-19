// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ КВЕСТАМИ (с поддержкой прогресса для сохранений)
// ============================================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Quest, QUESTS, getQuestById } from '../constants/quests';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface QuestProgress {
  questId: string;
  currentCounts: Record<string, number>; // textureKey -> count
}

export interface QuestContextType {
  // Активный квест
  activeQuest: Quest | null;
  questProgress: QuestProgress | null;
  
  // Действия
  setActiveQuest: (quest: Quest | null) => void;
  refreshQuest: () => void;
  checkQuestCompletion: (tileCounts: Record<string, number>) => boolean;
  submitQuest: (tileCounts: Record<string, number>) => boolean;
  
  // 🔑 НОВОЕ: Для системы сохранений
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
  
  // 🔑 НОВОЕ: Список завершённых квестов
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

export const QuestProvider: React.FC<QuestProviderProps> = ({ children }) => {
  const [activeQuest, setActiveQuestState] = useState<Quest | null>(null);
  const [questProgress, setQuestProgress] = useState<QuestProgress | null>(null);
  const [gold, setGold] = useState(0);
  const [experience, setExperience] = useState(0);
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);

  // Инициализация случайного квеста при старте
  const refreshQuest = useCallback(() => {
    const availableQuests = QUESTS.filter(q => !completedQuests.includes(q.id));
    const randomQuest = availableQuests.length > 0 
      ? availableQuests[Math.floor(Math.random() * availableQuests.length)]
      : QUESTS[Math.floor(Math.random() * QUESTS.length)];
    
    setActiveQuestState(randomQuest);
    setQuestProgress({
      questId: randomQuest.id,
      currentCounts: {},
    });
  }, [completedQuests]);

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

  // 🔑 НОВОЕ: Обновление прогресса при сдаче плиток
  const updateQuestProgress = useCallback((textureKey: string, count: number) => {
    if (!activeQuest || !questProgress) return;
    
    setQuestProgress(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentCounts: {
          ...prev.currentCounts,
          [textureKey]: (prev.currentCounts[textureKey] || 0) + count,
        },
      };
    });
  }, [activeQuest, questProgress]);

  // Проверка доступности сдачи квеста
  const checkQuestCompletion = useCallback((tileCounts: Record<string, number>): boolean => {
    if (!activeQuest) return false;
    
    return activeQuest.requirements.every(req => {
      const current = tileCounts[req.textureKey] || 0;
      return current >= req.required;
    });
  }, [activeQuest]);

  // Сдача квеста (возвращает true если успешно)
  const submitQuest = useCallback((tileCounts: Record<string, number>): boolean => {
    if (!activeQuest || !questProgress) return false;
    
    // Проверяем доступность
    const canSubmit = activeQuest.requirements.every(req => {
      const current = tileCounts[req.textureKey] || 0;
      return current >= req.required;
    });
    
    if (!canSubmit) return false;
    
    // 🔑 НОВОЕ: Сохраняем прогресс перед завершением (для сохранений)
    const finalProgress: Record<string, number> = {};
    activeQuest.requirements.forEach(req => {
      finalProgress[req.textureKey] = req.required;
    });
    setQuestProgress(prev => prev ? { ...prev, currentCounts: finalProgress } : prev);
    
    // Начисляем награды
    setGold(prev => prev + activeQuest.reward.gold);
    setExperience(prev => prev + activeQuest.reward.experience);
    
    // 🔑 НОВОЕ: Помечаем квест как завершённый
    setCompletedQuests(prev => [...prev, activeQuest.id!]);
    
    console.log('[QuestContext] ✅ Квест сдан:', {
      questId: activeQuest.id,
      gold: activeQuest.reward.gold,
      experience: activeQuest.reward.experience,
    });
    
    // Берём новый квест
    setTimeout(() => {
      refreshQuest();
    }, 500);
    
    return true;
  }, [activeQuest, questProgress, refreshQuest]);

  // 🔑 НОВОЕ: Экспорт данных квеста для сохранения
  const getQuestData = useCallback(() => {
    return {
      activeQuestId: activeQuest?.id || null,
      completedQuests,
      activeQuestProgress: questProgress?.currentCounts || {},
    };
  }, [activeQuest?.id, completedQuests, questProgress?.currentCounts]);

  // 🔑 НОВОЕ: Восстановление прогресса из сохранения
  const setQuestProgressFromSave = useCallback((progress: Record<string, number>) => {
    if (activeQuest) {
      setQuestProgress({
        questId: activeQuest.id,
        currentCounts: progress,
      });
    }
  }, [activeQuest]);

  // 🔑 НОВОЕ: Пометить квест как завершённый (для загрузок)
  const markQuestCompleted = useCallback((questId: string) => {
    setCompletedQuests(prev => {
      if (prev.includes(questId)) return prev;
      return [...prev, questId];
    });
  }, []);

  const addGold = useCallback((amount: number) => {
    setGold(prev => prev + amount);
  }, []);

  const addExperience = useCallback((amount: number) => {
    setExperience(prev => prev + amount);
  }, []);

  // ============================================================================
  // 🔑 ИСПРАВЛЕННАЯ СИНХРОНИЗАЦИЯ С GLOBAL (одна, со стабильными зависимостями)
  // ============================================================================
  useEffect(() => {
    const questData = {
      activeQuestId: activeQuest?.id || null,
      completedQuests: completedQuests,
      activeQuestProgress: questProgress?.currentCounts || {},
    };
    
    // Всегда обновляем global.questData
    (global as any).questData = questData;
    
    if (__DEV__) {
      console.log('[QuestContext] 📝 Synced questData:', questData);
    }
  }, [
    activeQuest?.id,  // 👈 Только ID, не весь объект
    completedQuests.length,  // 👈 Длина массива, не весь массив
    questProgress?.questId,  // 👈 ID квеста прогресса
    // 👇 Количество ключей в прогрессе (примитив вместо объекта)
    questProgress?.currentCounts ? Object.keys(questProgress.currentCounts).length : 0
  ]);

  const contextValue: QuestContextType = {
    activeQuest,
    questProgress,
    setActiveQuest,
    refreshQuest,
    checkQuestCompletion,
    submitQuest,
    
    // 🔑 НОВОЕ: Экспорт для сохранений
    getQuestData,
    setQuestProgressFromSave,
    
    gold,
    experience,
    addGold,
    addExperience,
    
    // 🔑 НОВОЕ: Завершённые квесты
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

export const useQuests = (): QuestContextType => {
  const context = useContext(QuestContext);
  if (!context) {
    throw new Error('useQuests must be used within a QuestProvider');
  }
  return context;
};

export default QuestContext;
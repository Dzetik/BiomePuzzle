// ============================================================================
// КОНТЕКСТ УПРАВЛЕНИЯ КВЕСТАМИ
// ============================================================================

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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
  
  // Награды
  gold: number;
  experience: number;
  addGold: (amount: number) => void;
  addExperience: (amount: number) => void;
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

  // Инициализация случайного квеста при старте
  const refreshQuest = useCallback(() => {
    const randomQuest = QUESTS[Math.floor(Math.random() * QUESTS.length)];
    setActiveQuestState(randomQuest);
    setQuestProgress({
      questId: randomQuest.id,
      currentCounts: {},
    });
  }, []);

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
    
    // Начисляем награды
    setGold(prev => prev + activeQuest.reward.gold);
    setExperience(prev => prev + activeQuest.reward.experience);
    
    console.log('[QuestContext] ✅ Квест сдан:', {
      questId: activeQuest.id,
      gold: activeQuest.reward.gold,
      experience: activeQuest.reward.experience,
    });
    
    // Очищаем текущий квест и берём новый
    setTimeout(() => {
      refreshQuest();
    }, 500);
    
    return true;
  }, [activeQuest, questProgress, refreshQuest]);

  const addGold = useCallback((amount: number) => {
    setGold(prev => prev + amount);
  }, []);

  const addExperience = useCallback((amount: number) => {
    setExperience(prev => prev + amount);
  }, []);

  const contextValue: QuestContextType = {
    activeQuest,
    questProgress,
    setActiveQuest,
    refreshQuest,
    checkQuestCompletion,
    submitQuest,
    gold,
    experience,
    addGold,
    addExperience,
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
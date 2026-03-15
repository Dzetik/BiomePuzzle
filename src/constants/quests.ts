// ============================================================================
// КОНСТАНТЫ КВЕСТОВ
// ============================================================================

export interface QuestRequirement {
  textureKey: string;
  required: number;
}

export interface Quest {
  id: string;
  number: number;
  title: string;
  description: string;
  requirements: QuestRequirement[];
  reward: {
    gold: number;
    experience: number;
  };
}

export const QUESTS: Quest[] = [
  {
    id: 'quest-001',
    number: 1,
    title: 'Первый урожай',
    description: 'Соберите и сдайте яблоки для местного рынка',
    requirements: [
      { textureKey: 'apple', required: 5 },
    ],
    reward: {
      gold: 100,
      experience: 50,
    },
  },
  {
    id: 'quest-002',
    number: 2,
    title: 'Сок',
    description: 'Создайте сок',
    requirements: [
      { textureKey: 'juice', required: 3 },
    ],
    reward: {
      gold: 100,
      experience: 50,
    },
  },
  {
    id: 'quest-003',
    number: 3,
    title: 'Хлеб',
    description: 'Создайте хлеб',
    requirements: [
      { textureKey: 'bread', required: 2 },
    ],
    reward: {
      gold: 100,
      experience: 50,
    },
  },
  {
    id: 'quest-004',
    number: 4,
    title: 'Тост',
    description: 'Создайте тост',
    requirements: [
      { textureKey: 'sandwich', required: 1 },
    ],
    reward: {
      gold: 100,
      experience: 50,
    },
  },
];

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

export const getRandomQuest = (): Quest => {
  const randomIndex = Math.floor(Math.random() * QUESTS.length);
  return QUESTS[randomIndex];
};

export const getQuestById = (questId: string): Quest | undefined => {
  return QUESTS.find(q => q.id === questId);
};
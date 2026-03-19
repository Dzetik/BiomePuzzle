// ============================================================================
// КОМПОНЕНТ: КНИГА КВЕСТОВ
// ============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { Quest, QUESTS } from '../constants/quests';
import { useQuests } from '../context/QuestContext';
import { TEXTURE_MAP, DEFAULT_TEXTURE } from '../constants/textures';

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Пропсы модального окна книги квестов.
 *
 * @param visible       - управляет видимостью модала
 * @param onClose       - закрыть модал
 * @param tileCounts    - карта textureKey → суммарное количество плиток
 *                        (поле + инвентарь); используется для проверки выполнения требований
 * @param onSubmitQuest - колбэк сдачи квеста (вызывается только если `canSubmit`)
 */
export interface QuestBookProps {
  visible: boolean;
  onClose: () => void;
  tileCounts: Record<string, number>;
  onSubmitQuest: () => void;
}

// ============================================================================
// КОМПОНЕНТ: Отображение требования квеста
// ============================================================================

interface QuestRequirementItemProps {
  textureKey: string;
  required: number;
  current: number;
}

/**
 * Строка одного требования квеста: иконка плитки, прогресс (current / required)
 * и зелёная галочка при выполнении.
 *
 * @param textureKey - ключ текстуры требуемой плитки
 * @param required   - сколько плиток нужно сдать
 * @param current    - сколько плиток игрок имеет на данный момент
 */
const QuestRequirementItem: React.FC<QuestRequirementItemProps> = ({
  textureKey,
  required,
  current,
}) => {
  const textureSource = TEXTURE_MAP[textureKey] || DEFAULT_TEXTURE;
  const isComplete = current >= required;

  return (
    <View style={styles.requirementItem}>
      <View style={[styles.requirementTile, { borderColor: isComplete ? '#4CAF50' : '#888' }]}>
        <View style={styles.texturePlaceholder}>
          <Text style={styles.textureKeyText}>{textureKey}</Text>
        </View>
      </View>
      
      <View style={styles.requirementInfo}>
        <Text style={styles.textureKeyName}>
          {textureKey.replace(/_/g, ' ')}
        </Text>
        <Text style={[
          styles.requirementCount,
          { color: isComplete ? '#4CAF50' : '#FF9800' }
        ]}>
          {current} / {required}
        </Text>
      </View>
      
      {isComplete && (
        <View style={styles.completeBadge}>
          <Text style={styles.completeBadgeText}>✓</Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// КОМПОНЕНТ: Отображение квеста
// ============================================================================

interface QuestCardProps {
  quest: Quest;
  tileCounts: Record<string, number>;
  canSubmit: boolean;
  onSubmit: () => void;
}

const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  tileCounts,
  canSubmit,
  onSubmit,
}) => {
  return (
    <View style={styles.questCard}>
      {/* Заголовок квеста */}
      <View style={styles.questHeader}>
        <View style={styles.questNumberBadge}>
          <Text style={styles.questNumberText}>#{quest.number}</Text>
        </View>
        <View style={styles.questTitleContainer}>
          <Text style={styles.questTitle}>{quest.title}</Text>
          <Text style={styles.questDescription}>{quest.description}</Text>
        </View>
      </View>

      {/* Требования */}
      <View style={styles.requirementsContainer}>
        <Text style={styles.requirementsTitle}>Требуется:</Text>
        {quest.requirements.map((req, index) => (
          <QuestRequirementItem
            key={`${quest.id}-req-${index}`}
            textureKey={req.textureKey}
            required={req.required}
            current={tileCounts[req.textureKey] || 0}
          />
        ))}
      </View>

      {/* Награда */}
      <View style={styles.rewardContainer}>
        <Text style={styles.rewardTitle}>Награда:</Text>
        <View style={styles.rewardItems}>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardIcon}>💰</Text>
            <Text style={styles.rewardText}>{quest.reward.gold} зол.</Text>
          </View>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardIcon}>⭐</Text>
            <Text style={styles.rewardText}>{quest.reward.experience} XP</Text>
          </View>
        </View>
      </View>

      {/* Кнопка сдачи */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { opacity: canSubmit ? 1 : 0.5, backgroundColor: canSubmit ? '#4CAF50' : '#666' }
        ]}
        onPress={onSubmit}
        disabled={!canSubmit}
        activeOpacity={0.7}
      >
        <Text style={styles.submitButtonText}>
          {canSubmit ? '✅ Сдать квест' : '⏳ Недостаточно ресурсов'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ: Книга квестов
// ============================================================================

export const QuestBook: React.FC<QuestBookProps> = ({
  visible,
  onClose,
  tileCounts,
  onSubmitQuest,
}) => {
  const { activeQuest, checkQuestCompletion, gold, experience } = useQuests();

  const canSubmit = activeQuest ? checkQuestCompletion(tileCounts) : false;

  const handleQuestSubmit = () => {
    if (canSubmit) {
      onSubmitQuest();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.questBookContainer}>
          {/* Заголовок */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.bookTitle}>📜 Книга квестов</Text>
              <Text style={styles.playerStats}>
                💰 {gold} зол. | ⭐ {experience} XP
              </Text>
            </View>
            
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Контент квеста */}
          <ScrollView
            style={styles.questScrollView}
            contentContainerStyle={styles.questScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {activeQuest ? (
              <QuestCard
                quest={activeQuest}
                tileCounts={tileCounts}
                canSubmit={canSubmit}
                onSubmit={handleQuestSubmit}
              />
            ) : (
              <View style={styles.noQuestContainer}>
                <Text style={styles.noQuestText}>📭 Нет активного квеста</Text>
                <Text style={styles.noQuestSubtext}>
                  Завершите текущий квест, чтобы получить новый
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Подсказка */}
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              💡 Плитки сдаются сначала с поля, затем из инвентаря
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// СТИЛИ
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlayTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  questBookContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: '#2a2a3a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: 3,
    borderTopColor: '#FF9800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flex: 1,
  },
  bookTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerStats: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  questScrollView: {
    flex: 1,
  },
  questScrollContent: {
    paddingBottom: 16,
  },
  questCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  questHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  questNumberBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  questNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  questTitleContainer: {
    flex: 1,
  },
  questTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  questDescription: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  requirementsContainer: {
    marginBottom: 16,
  },
  requirementsTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  requirementTile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  texturePlaceholder: {
    width: 32,
    height: 32,
    backgroundColor: '#555',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textureKeyText: {
    color: '#fff',
    fontSize: 9,
    textAlign: 'center',
  },
  requirementInfo: {
    flex: 1,
    marginLeft: 12,
  },
  textureKeyName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  requirementCount: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: '600',
  },
  completeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rewardContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  rewardTitle: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  rewardItems: {
    flexDirection: 'row',
    gap: 16,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  rewardText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noQuestContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noQuestText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noQuestSubtext: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
  hintContainer: {
    marginTop: 'auto',
    padding: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  hintText: {
    color: '#aaa',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
});

export default QuestBook;
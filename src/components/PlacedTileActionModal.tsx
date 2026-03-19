// ============================================================================
// КОМПОНЕНТ: Модальное окно действий для размещённой плитки
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
} from 'react-native';
import { Tile } from '../models/Tile';

/**
 * Пропсы модального окна действий для размещённой плитки.
 *
 * @param visible       - управляет видимостью модала
 * @param tile          - плитка, для которой открыто меню; null → модал не рендерится
 * @param onClose       - закрыть модал без действия
 * @param onDelete      - удалить плитку безвозвратно
 * @param onToInventory - переместить плитку с поля в инвентарь
 * @param onSubmit      - сдать плитку (функция закомментирована в UI, оставлена для будущего)
 */
export interface PlacedTileActionModalProps {
  visible: boolean;
  tile: Tile | null;
  onClose: () => void;
  onDelete: (tileId: string) => void;
  onToInventory: (tileId: string) => void;
  onSubmit: (tileId: string) => void;
}

/**
 * Анимированное модальное меню действий для размещённой плитки.
 *
 * Появляется при тапе на плитку на сетке. Анимация: Animated.parallel запускает
 * одновременно fade (150ms timing) и spring-масштабирование от 0.9 → 1.0.
 * При скрытии значения немедленно сбрасываются (без анимации), чтобы следующее
 * открытие начиналось с корректного начального состояния.
 *
 * Тап по полупрозрачному оверлею (`overlayTouch`) вызывает `onClose`.
 * Каждая кнопка действия вызывает `handleAction`, который диспатчит нужный
 * колбэк и затем автоматически закрывает модал.
 */
export const PlacedTileActionModal: React.FC<PlacedTileActionModalProps> = ({
  visible,
  tile,
  onClose,
  onDelete,
  onToInventory,
  onSubmit,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  /**
   * Выполняет выбранное действие над плиткой и закрывает модал.
   *
   * @param action - тип действия: 'delete' | 'inventory' | 'submit'
   */
  const handleAction = (action: 'delete' | 'inventory' | 'submit') => {
    if (!tile) return;
    
    switch (action) {
      case 'delete':
        onDelete(tile.id);
        break;
      case 'inventory':
        onToInventory(tile.id);
        break;
      case 'submit':
        onSubmit(tile.id);
        break;
    }
    onClose();
  };

  if (!tile) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[styles.modalOverlay, { opacity: fadeAnim }]}
      >
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View 
          style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}
        >
          {/* Заголовок */}
          <View style={styles.header}>
            <Text style={styles.tileName}>
              {tile.textureKey.replace(/_/g, ' ')}
            </Text>
          </View>

          {/* Кнопки действий */}
          <View style={styles.actionsContainer}>
            
            {/* Удалить */}
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleAction('delete')}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>Удалить</Text>
              <Text style={styles.actionButtonSubtext}>
                Безвозвратно удалить плитку
              </Text>
            </TouchableOpacity>

            {/* На склад */}
            <TouchableOpacity
              style={[styles.actionButton, styles.inventoryButton]}
              onPress={() => handleAction('inventory')}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>На склад</Text>
              <Text style={styles.actionButtonSubtext}>
                Поместить плитку на склад
              </Text>
            </TouchableOpacity>

            {/* Сдать */}
            {/*<TouchableOpacity
              style={[styles.actionButton, styles.submitButton]}
              onPress={() => handleAction('submit')}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>Сдать</Text>
              <Text style={styles.actionButtonSubtext}>
                Завершить задачу (ресурсы позже)
              </Text>
            </TouchableOpacity>*/}

          </View>

          {/* Кнопка отмены */}
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  overlayTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: Math.min(SCREEN_WIDTH - 40, 340),
    backgroundColor: '#2a2a3a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#555',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  tileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tileId: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionButtonSubtext: {
    color: '#aaa',
    fontSize: 11,
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    borderColor: '#dc3545',
  },
  inventoryButton: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderColor: '#ffc107',
  },
  submitButton: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    borderColor: '#28a745',
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PlacedTileActionModal;
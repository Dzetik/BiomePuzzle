// ============================================================================
// КНИГА РЕЦЕПТОВ
// ============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Recipe, RECIPES } from '../constants/recipes';
import { TEXTURE_MAP, DEFAULT_TEXTURE } from '../constants/textures';

const RECIPE_TILE_SIZE = 45;           
const RECIPE_RESULT_TILE_SIZE = 65;  
const RECIPE_TILE_SPACING = 8;

// ============================================================================
// Отображение одной плитки в рецепте
// ============================================================================

/**
 * Иконка одной плитки внутри строки рецепта.
 *
 * @param textureKey - ключ текстуры из TEXTURE_MAP
 * @param label      - подпись под иконкой (обычно textureKey)
 * @param isResult   - если true, используется увеличенный размер RECIPE_RESULT_TILE_SIZE
 */
const RecipeTile: React.FC<{
  textureKey: string;
  label?: string;
  isResult?: boolean;
}> = ({
  textureKey,
  label,
  isResult = false,
}) => {
  const textureSource = TEXTURE_MAP[textureKey] || DEFAULT_TEXTURE;
  const tileSize = isResult ? RECIPE_RESULT_TILE_SIZE : RECIPE_TILE_SIZE;

  return (
    <View style={styles.recipeTileContainer}>
      <View style={[styles.recipeTile, { width: tileSize, height: tileSize }]}>
        <Image
          source={textureSource}
          style={styles.recipeTileImage}
          resizeMode="cover"
        />
      </View>
      {label && <Text style={styles.recipeTileLabel}>{textureKey}</Text>}
    </View>
  );
};

// ============================================================================
// КОМПОНЕНТ: Переносимые ингредиенты
// ============================================================================

/**
 * Горизонтальная цепочка ингредиентов рецепта со стрелками «→» между ними.
 *
 * @param sequence - упорядоченный список textureKey ингредиентов
 */
const RecipeIngredients: React.FC<{ sequence: string[] }> = ({ sequence }) => {
  return (
    <View style={styles.ingredientsWrapper}>
      {sequence.map((textureKey, index) => (
        <React.Fragment key={`ing-${index}`}>
          <View style={styles.ingredientItem}>
            <RecipeTile textureKey={textureKey} />
          </View>
          {index < sequence.length - 1 && (
            <Text style={styles.plusSign}>→</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

// ============================================================================
// КОМПОНЕНТ: Отображение одного рецепта
// ============================================================================

/**
 * Строка одного рецепта: цепочка ингредиентов + результат.
 *
 * @param recipe - объект рецепта из RECIPES (id, sequence, result)
 */
const RecipeRow: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  return (
    <View style={styles.recipeRow}>
      {/* Ингредиенты */}
      <RecipeIngredients sequence={recipe.sequence} />
      <View style={styles.resultWrapper}>
        <RecipeTile 
          textureKey={recipe.result.textureKey} 
          isResult={true}  
        />
      </View>
    </View>
  );
};

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ: Книга рецептов
// ============================================================================
export interface RecipeBookProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Модальное окно книги рецептов.
 *
 * Показывает все рецепты из константы RECIPES в виде скроллируемого списка.
 * Каждый рецепт: цепочка ингредиентов (RecipeIngredients) → результат (RecipeTile).
 *
 * Поддерживает закрытие свайпом вниз: Pan-жест отслеживает `translationY`;
 * при смещении > 100px вызывает `onClose`. Горизонтальная прокрутка ScrollView
 * не конфликтует с Pan-жестом, так как Pan применяется к контейнеру целиком.
 *
 * @param visible - управляет видимостью модала
 * @param onClose - колбэк закрытия
 */
export const RecipeBook: React.FC<RecipeBookProps> = ({ visible, onClose }) => {
  
  React.useEffect(() => {
    if (__DEV__ && visible) {
      console.log('[RecipeBook] 📖 OPENED - Recipes:', RECIPES.length);
    }
  }, [visible]);
  
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Можно добавить логику перетаскивания если нужно
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        onClose();
      }
    });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.recipeBookContainer}>
            
            {/* Заголовок с кнопкой закрытия */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.bookTitle}>📖 Книга рецептов</Text>
                <Text style={styles.bookSubtitle}>
                  Собери цепочку плиток со стрелками
                </Text>
              </View>
              
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Подсказка про стрелки */}
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>
                💡 Стрелки плиток должны указывать на следующий ингредиент в цепочке!
              </Text>
            </View>

            {/* Список рецептов */}
            <ScrollView
              style={styles.recipesScrollView}
              contentContainerStyle={styles.recipesScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              {RECIPES.length > 0 ? (
                RECIPES.map((recipe) => (
                  <RecipeRow key={recipe.id} recipe={recipe} />
                ))
              ) : (
                <Text style={styles.noRecipesText}>Нет доступных рецептов</Text>
              )}
            </ScrollView>
          </View>
        </GestureDetector>
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
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  recipeBookContainer: {
    width: Math.min(SCREEN_WIDTH - 40, 450),
    height: SCREEN_HEIGHT * 0.92,
    backgroundColor: '#2a2a3a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#555',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  bookTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bookSubtitle: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
  },
  recipesScrollView: {
    flex: 0,
    width: '100%',
  },
  recipesScrollContent: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  noRecipesText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  recipeRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,  
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 95,  
  },
  ingredientsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 4,
  },
  ingredientItem: {
    alignItems: 'center',
  },
  plusSign: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 6,
  },
  resultWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  recipeTileContainer: {
    alignItems: 'center',
    marginHorizontal: RECIPE_TILE_SPACING / 2,
  },
  recipeTile: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#444',
  },
  recipeTileImage: {
    width: '100%',
    height: '100%',
  },
  recipeTileLabel: {
    color: '#ccc',
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: RECIPE_TILE_SIZE,
  },
  resultContainer: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  hintContainer: {
    marginVertical: 12,
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

export default RecipeBook;
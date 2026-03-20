# BiomePuzzle

Мобильная игра-головоломка на базе React Native + Expo.

**Платформы:** Android, iOS
**Пакет:** `com.dzetik.BiomePuzzle`
**Версия:** 1.0.0

---

## Требования

| Инструмент | Версия |
|---|---|
| Node.js | >= 18.x |
| npm / yarn | актуальная |
| Expo CLI | >= 18.3.0 |
| EAS CLI | >= 18.3.0 (для облачных сборок) |
| Android Studio | для локальных Android-сборок |
| Xcode | для локальных iOS-сборок (только macOS) |

---

## Установка зависимостей

```bash
npm install
```

### Основные зависимости (из package.json)

| Пакет | Версия |
|---|---|
| expo | ~54.0.33 |
| react | 19.1.0 |
| react-native | 0.81.5 |
| react-native-gesture-handler | ~2.28.0 |
| react-native-safe-area-context | ~5.6.0 |
| @react-native-async-storage/async-storage | 2.2.0 |
| expo-constants | ~18.0.13 |
| expo-status-bar | ~3.0.9 |

---

## Локальный запуск (Expo Dev Client)

### Запуск Metro-сервера

```bash
npm start
# или
npx expo start
```

После запуска Expo откроет браузер с QR-кодом. Отсканируйте его приложением **Expo Go** на устройстве, находящемся в той же сети.

### Запуск на конкретной платформе

```bash
# Android (требует запущенного эмулятора или подключённого устройства)
npm run android
# или
npx expo start --android

# iOS (только macOS, требует Xcode и симулятора)
npm run ios
# или
npx expo start --ios

# Web (для быстрой отладки UI)
npm run web
```

## Структура проекта

```
BiomePuzzle/
├── App.tsx                  # Корневой компонент
├── app.json                 # Конфигурация Expo (имя, пакет, иконки)
├── eas.json                 # Профили EAS Build
├── package.json             # Зависимости и скрипты
├── tsconfig.json            # Настройки TypeScript
├── assets/                  # Иконки, сплэш-экран, текстуры
└── src/
    ├── components/          # UI-компоненты
    ├── context/             # React Context (состояние игры, квесты)
    ├── hooks/               # Хуки (жесты, зум, инвентарь, автосохранение)
    ├── models/              # Классы данных (Tile)
    ├── services/            # Бизнес-логика (крафт, сохранение, сетка)
    ├── state/               # FSM плитки (tileMachine)
    ├── constants/           # Константы (сетка, рецепты, квесты, текстуры)
    └── utils/               # Утилиты (координаты, ограничения, отладка)
```
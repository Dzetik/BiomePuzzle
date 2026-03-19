// ============================================================================
// ХУК АВТОМАТИЧЕСКОГО СОХРАНЕНИЯ
// ============================================================================

import { useEffect, useRef } from 'react';
import { useTiles } from '../context/TilesContext';

/**
 * Хук периодического автосохранения игрового состояния.
 *
 * Запускает рекурсивную цепочку setTimeout с заданным интервалом.
 * При размонтировании компонента выполняет финальное сохранение.
 *
 * Используется setTimeout (а не setInterval), чтобы следующее сохранение
 * не начиналось до завершения предыдущего — это исключает наложение
 * асинхронных вызовов AsyncStorage при медленной записи.
 *
 * @param intervalMs - интервал между сохранениями в миллисекундах (по умолчанию 30 000 мс)
 */
export const useAutoSave = (intervalMs: number = 30000) => {
  const { saveGame } = useTiles();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Финальное сохранение при размонтировании компонента (например, при сворачивании приложения)
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      console.log('[AutoSave] Final save on unmount');
      saveGame();
    };
  }, [saveGame]);

  // Периодическое автосохранение через рекурсивный setTimeout
  useEffect(() => {
    /**
     * Планирует следующее сохранение через `intervalMs` миллисекунд.
     * После записи ждёт 100 мс для гарантии завершения операции AsyncStorage,
     * затем рекурсивно вызывает себя.
     */
    const scheduleSave = () => {
      saveTimeoutRef.current = setTimeout(async () => {
        console.log('[AutoSave] Auto-saving...');
        await saveGame();
        // Небольшая пауза гарантирует, что AsyncStorage успел записать данные на диск
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[AutoSave] Auto-save complete');
        scheduleSave(); // Планируем следующий цикл только после завершения текущего
      }, intervalMs);
    };

    scheduleSave();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [intervalMs, saveGame]);
};

export default useAutoSave;

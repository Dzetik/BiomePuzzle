// ============================================================================
// ХУК АВТОМАТИЧЕСКОГО СОХРАНЕНИЯ
// ============================================================================

import { useEffect, useRef } from 'react';
import { useTiles } from '../context/TilesContext';

export const useAutoSave = (intervalMs: number = 30000) => {
  const { saveGame } = useTiles();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Сохранение при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      console.log('[AutoSave] 📦 Final save on unmount');
      saveGame();
    };
  }, [saveGame]);
  
  // Периодическое авто-сохранение
  useEffect(() => {
    const scheduleSave = () => {
      saveTimeoutRef.current = setTimeout(async () => {
        console.log('[AutoSave] 🔄 Auto-saving...');
        await saveGame();
        // 👇 Небольшая задержка, чтобы AsyncStorage точно успел записать
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[AutoSave] ✅ Auto-save complete');
        scheduleSave();
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
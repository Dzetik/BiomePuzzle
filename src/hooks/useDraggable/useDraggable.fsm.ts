// src/hooks/useDraggable/useDraggable.fsm.ts

import { UseDraggableReturn } from './index';

export const useDraggableFSM = (
  initialTileData: any = null,
  tileId: string | null = null,
  externalInitialPosition: { x: number; y: number } | null = null
): UseDraggableReturn => {
  
  console.log('[useDraggableFSM] FSM mode active - Stage 5 pending');
  
  return {
    position: { x: 0, y: 0 },
    width: 50,
    height: 50,
    panHandlers: {},
    isInSpawner: true,
    state: 'SPAWNER_IDLE',
    send: () => {},
    debug: { enabled: false },
  };
};

export default useDraggableFSM;
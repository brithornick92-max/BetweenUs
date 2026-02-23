// context/MemoryContext.js
// Migrated from legacy memoryManager (AsyncStorage) → DataLayer (SQLite + E2EE)
// The memoryManager is still used only for PDF export and yearly recap,
// which don't need encryption or sync.
import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from './AppContext';
import { useData } from './DataContext';
import { memoryManager, MEMORY_TYPES } from '../utils/memoryManager';

const initialState = {
  memories: [],
  timeline: [],
  milestones: [],
  anniversaries: [],
  isLoading: true,
  lastSync: null,
};

const ACTIONS = {
  LOAD_MEMORIES: 'LOAD_MEMORIES',
  ADD_MEMORY: 'ADD_MEMORY',
  UPDATE_MEMORY: 'UPDATE_MEMORY',
  DELETE_MEMORY: 'DELETE_MEMORY',
  SET_LOADING: 'SET_LOADING',
  SYNC_COMPLETE: 'SYNC_COMPLETE',
};

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOAD_MEMORIES:
      return {
        ...state,
        memories: action.payload.memories,
        timeline: action.payload.timeline,
        milestones: action.payload.milestones,
        anniversaries: action.payload.anniversaries,
        isLoading: false,
      };
    case ACTIONS.ADD_MEMORY:
      const newMemories = [...state.memories, action.payload.memory];
      return {
        ...state,
        memories: newMemories,
        timeline: generateTimeline(newMemories),
      };
    case ACTIONS.UPDATE_MEMORY:
      const updatedMemories = state.memories.map(memory =>
        memory.id === action.payload.memory.id ? action.payload.memory : memory
      );
      return {
        ...state,
        memories: updatedMemories,
        timeline: generateTimeline(updatedMemories),
      };
    case ACTIONS.DELETE_MEMORY:
      const filteredMemories = state.memories.filter(memory => memory.id !== action.payload.id);
      return {
        ...state,
        memories: filteredMemories,
        timeline: generateTimeline(filteredMemories),
      };
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload.loading };
    case ACTIONS.SYNC_COMPLETE:
      return { ...state, lastSync: new Date() };
    default:
      return state;
  }
}

// Helper function to generate chronological timeline
function generateTimeline(memories) {
  return memories
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(memory => ({
      ...memory,
      formattedDate: formatMemoryDate(memory.date),
    }));
}

function formatMemoryDate(date) {
  const memoryDate = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now - memoryDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

const MemoryContext = createContext(null);

export function MemoryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { actions: appActions } = useAppContext();
  const { data: DataLayer } = useData();

  // Load memories from DataLayer (SQLite + E2EE) on mount
  useEffect(() => {
    const loadMemories = async () => {
      try {
        // Primary source: DataLayer (SQLite with encryption)
        const memories = await DataLayer.getMemories({ limit: 500 });

        // Still init legacy manager for PDF export / recap functions only
        await memoryManager.initialize().catch(() => {});

        const milestones = memoryManager.getMilestones?.() || [];
        const anniversaries = memoryManager.getAnniversaries?.() || [];

        dispatch({
          type: ACTIONS.LOAD_MEMORIES,
          payload: {
            memories: memories || [],
            timeline: generateTimeline(memories || []),
            milestones,
            anniversaries,
          }
        });

        // Update app context with memory stats
        const count = memories?.length || 0;
        appActions.updateMemoryStats(
          count,
          count > 0 ? memories[count - 1].created_at || memories[count - 1].date : null
        );
      } catch (error) {
        console.error('Failed to load memories:', error);
        dispatch({ type: ACTIONS.SET_LOADING, payload: { loading: false } });
      }
    };

    loadMemories();
  }, [appActions, DataLayer]);

  const actions = useMemo(() => ({
    addMemory: async (memoryData) => {
      // Write through DataLayer (SQLite + E2EE + sync)
      const memory = await DataLayer.saveMemory({
        content: memoryData.content || memoryData.text || '',
        type: memoryData.type || 'moment',
        mood: memoryData.mood,
        isPrivate: memoryData.isPrivate || false,
        mediaUri: memoryData.mediaUri,
        mimeType: memoryData.mimeType,
        fileName: memoryData.fileName,
      });

      // Also write to legacy manager for PDF/recap (fire-and-forget)
      memoryManager.addMemory(memoryData).catch(() => {});

      dispatch({ type: ACTIONS.ADD_MEMORY, payload: { memory } });

      const currentMemories = stateRef.current.memories;
      const updatedMemories = [...currentMemories, memory];
      appActions.updateMemoryStats(updatedMemories.length, memory.created_at || memory.date);

      return memory;
    },

    updateMemory: async (memoryId, updates) => {
      // DataLayer doesn't have updateMemory yet — use legacy + re-save pattern
      const updatedMemory = await memoryManager.updateMemory(memoryId, updates);

      dispatch({ type: ACTIONS.UPDATE_MEMORY, payload: { memory: updatedMemory } });

      return updatedMemory;
    },

    deleteMemory: async (memoryId) => {
      // Delete from DataLayer (SQLite)
      await DataLayer.deleteMemory(memoryId).catch(() => {});
      // Also remove from legacy manager
      await memoryManager.deleteMemory(memoryId).catch(() => {});

      dispatch({ type: ACTIONS.DELETE_MEMORY, payload: { id: memoryId } });

      const currentMemories = stateRef.current.memories;
      const filteredMemories = currentMemories.filter(memory => memory.id !== memoryId);
      appActions.updateMemoryStats(
        filteredMemories.length,
        filteredMemories.length > 0 ? filteredMemories[filteredMemories.length - 1].date : null
      );
    },

    getMemoriesForDateRange: (startDate, endDate) => {
      return memoryManager.getMemoriesForDateRange(startDate, endDate);
    },

    getMemoriesByType: (type) => {
      return memoryManager.getMemoriesByType(type);
    },

    getAnniversaryThemes: () => {
      // This will be handled by the anniversary theme generator
      return [];
    },

    exportMemories: async (config) => {
      return memoryManager.exportMemories(config);
    },

    syncWithPartner: async () => {
      // Use DataLayer's built-in sync (SyncEngine) instead of legacy cloud sync
      try {
        await DataLayer.sync();
        dispatch({ type: ACTIONS.SYNC_COMPLETE });
        return { success: true };
      } catch (err) {
        console.warn('[MemoryContext] sync failed:', err?.message);
        return { success: false, error: err?.message };
      }
    },
  }), [appActions, DataLayer]);

  return (
    <MemoryContext.Provider value={{ state, actions }}>
      {children}
    </MemoryContext.Provider>
  );
}

export const useMemoryContext = () => {
  const ctx = useContext(MemoryContext);
  if (!ctx) throw new Error("useMemoryContext must be used inside MemoryProvider");
  return ctx;
};

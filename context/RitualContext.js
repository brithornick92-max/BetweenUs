// context/RitualContext.js
import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { useAppContext } from './AppContext';
import { useEntitlements } from './EntitlementsContext';
import StorageRouter from '../services/storage/StorageRouter';
import { ensureNotificationPermissions, scheduleEventNotification } from '../utils/notifications';

// Ritual Types and Templates
export const RITUAL_TYPES = {
  STANDARD: 'standard',
  ROMANTIC: 'romantic',
  DEEP: 'deep',
  PLAYFUL: 'playful',
  CUSTOM: 'custom', // Premium feature
};

const STANDARD_PROMPTS = {
  checkIn: [
    "How are you feeling right now?",
    "What's on your mind tonight?",
    "How was your day, really?",
    "What do you need from me tonight?",
  ],
  appreciation: [
    "What made you smile about us today?",
    "Something I did that you appreciated?",
    "A moment today when you felt loved?",
    "What are you grateful for about our relationship?",
  ],
  dateIdea: [
    "What's one thing we could do together this weekend?",
    "A simple way we could connect tomorrow?",
    "Something new we could try together?",
    "How could we make tomorrow special?",
  ],
};

const initialState = {
  currentRitual: null,
  ritualHistory: [],
  customFlows: [], // Premium feature
  isLoading: false,
  lastCompleted: null,
  streak: 0,
};

const ACTIONS = {
  LOAD_RITUALS: 'LOAD_RITUALS',
  START_RITUAL: 'START_RITUAL',
  UPDATE_RITUAL: 'UPDATE_RITUAL',
  COMPLETE_RITUAL: 'COMPLETE_RITUAL',
  SET_LOADING: 'SET_LOADING',
  LOAD_CUSTOM_FLOWS: 'LOAD_CUSTOM_FLOWS',
  ADD_CUSTOM_FLOW: 'ADD_CUSTOM_FLOW',
};

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOAD_RITUALS:
      return {
        ...state,
        ritualHistory: action.payload.history,
        lastCompleted: action.payload.lastCompleted,
        streak: action.payload.streak,
        isLoading: false,
      };
    case ACTIONS.START_RITUAL:
      return {
        ...state,
        currentRitual: action.payload.ritual,
      };
    case ACTIONS.UPDATE_RITUAL:
      return {
        ...state,
        currentRitual: {
          ...state.currentRitual,
          ...action.payload.updates,
        },
      };
    case ACTIONS.COMPLETE_RITUAL:
      const newHistory = [...state.ritualHistory, action.payload.ritual];
      return {
        ...state,
        currentRitual: null,
        ritualHistory: newHistory,
        lastCompleted: new Date(),
        streak: calculateStreak(newHistory),
      };
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload.loading };
    case ACTIONS.LOAD_CUSTOM_FLOWS:
      return { ...state, customFlows: action.payload.flows };
    case ACTIONS.ADD_CUSTOM_FLOW:
      return { 
        ...state, 
        customFlows: [...state.customFlows, action.payload.flow] 
      };
    default:
      return state;
  }
}

// Helper function to calculate ritual streak
function calculateStreak(history) {
  if (history.length === 0) return 0;
  
  const sortedHistory = history.sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  let currentDate = new Date();
  
  for (const ritual of sortedHistory) {
    const ritualDate = new Date(ritual.date);
    const daysDiff = Math.floor((currentDate - ritualDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      streak++;
      currentDate = ritualDate;
    } else {
      break;
    }
  }
  
  return streak;
}

// Helper function to generate random prompt
function getRandomPrompt(category) {
  const prompts = STANDARD_PROMPTS[category];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

// Helper function to get default prompt for custom ritual elements
function getDefaultPromptForElement(elementId) {
  const elementPrompts = {
    check_in: "How are you feeling right now?",
    appreciation: "What made you smile about us today?",
    date_idea: "What's one thing we could do together this weekend?",
    memory_share: "What's a favorite memory you've been thinking about?",
    intention_setting: "What intention do you want to set for tomorrow?",
    affirmation: "What do you love most about our relationship right now?",
    dream_sharing: "What's a dream or hope you've been carrying in your heart?",
    physical_touch: "How would you like to connect physically right now?",
  };
  
  return elementPrompts[elementId] || "How are you feeling tonight?";
}

// Helper function to generate memory-contextual prompts
function generateMemoryContextualPrompt(category, todayMemories, anniversaryMemories) {
  // Anniversary-specific prompts
  if (anniversaryMemories.length > 0) {
    const anniversary = anniversaryMemories[0];
    const anniversaryPrompts = {
      checkIn: `Today marks ${anniversary.title}. How are you feeling about this special milestone?`,
      appreciation: `On this anniversary of ${anniversary.title}, what are you most grateful for about our journey together?`,
      dateIdea: `How would you like to celebrate ${anniversary.title} together?`,
    };
    return anniversaryPrompts[category] || getRandomPrompt(category);
  }
  
  // Today's memory-specific prompts
  if (todayMemories.length > 0) {
    const memory = todayMemories[0];
    const memoryPrompts = {
      checkIn: `Thinking about ${memory.title}, how are you feeling tonight?`,
      appreciation: `What about ${memory.title} brings you the most joy?`,
      dateIdea: `Inspired by ${memory.title}, what could we do together tomorrow?`,
    };
    return memoryPrompts[category] || getRandomPrompt(category);
  }
  
  // Default prompts with gentle evening tone
  const eveningPrompts = {
    checkIn: [
      "How is your heart feeling as this day comes to an end?",
      "What emotions are you carrying with you tonight?",
      "As you prepare for rest, what's on your mind?",
      "How are you feeling about us tonight?",
    ],
    appreciation: [
      "What moment today made you feel most connected to love?",
      "What's something beautiful you noticed about us today?",
      "What are you grateful for in this moment?",
      "What made you smile about our relationship today?",
    ],
    dateIdea: [
      "What's one gentle way we could connect tomorrow?",
      "How could we make tomorrow feel special together?",
      "What would bring you joy to do with me tomorrow?",
      "What's a simple pleasure we could share tomorrow?",
    ],
  };
  
  const prompts = eveningPrompts[category] || STANDARD_PROMPTS[category];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

const RitualContext = createContext(null);

export function RitualProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { actions: appActions } = useAppContext();
  const { isPremiumEffective: isPremium } = useEntitlements();

  // Load ritual history on mount
  useEffect(() => {
    const loadRituals = async () => {
      try {
        const history = await storage.get(STORAGE_KEYS.RITUAL_HISTORY) || [];
        const lastCompleted = history.length > 0 ? 
          new Date(Math.max(...history.map(r => new Date(r.date)))) : null;
        const streak = calculateStreak(history);
        
        dispatch({
          type: ACTIONS.LOAD_RITUALS,
          payload: { history, lastCompleted, streak }
        });

        // Load custom flows for premium users
        const customFlows = await storage.get(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS) || [];
        dispatch({
          type: ACTIONS.LOAD_CUSTOM_FLOWS,
          payload: { flows: customFlows }
        });
      } catch (error) {
        console.error('Failed to load rituals:', error);
        dispatch({ type: ACTIONS.SET_LOADING, payload: { loading: false } });
      }
    };

    loadRituals();
  }, []);

  const actions = useMemo(() => ({
    startNightRitual: async (type = RITUAL_TYPES.STANDARD) => {
      const ritual = {
        id: `ritual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date(),
        type,
        prompt: getRandomPrompt('checkIn'),
        checkIn: {
          question: getRandomPrompt('checkIn'),
          userAnswer: null,
          partnerAnswer: null,
          isRevealed: false,
        },
        appreciation: {
          question: getRandomPrompt('appreciation'),
          userAnswer: null,
          partnerAnswer: null,
          isRevealed: false,
        },
        dateIdea: {
          question: getRandomPrompt('dateIdea'),
          userAnswer: null,
          partnerAnswer: null,
          isRevealed: false,
        },
        completedAt: null,
        partnerCompleted: false,
      };

      dispatch({ type: ACTIONS.START_RITUAL, payload: { ritual } });
      appActions.setActiveRitual(ritual);
      
      // Gentle haptic feedback for ritual start
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      return ritual;
    },

    updateRitualResponse: async (section, answer) => {
      const currentRitual = stateRef.current.currentRitual;
      if (!currentRitual) throw new Error('No active ritual');
      
      const updates = {
        [section]: {
          ...currentRitual[section],
          userAnswer: answer,
        },
      };
      
      dispatch({ type: ACTIONS.UPDATE_RITUAL, payload: { updates } });
      
      // Note: Partner sync would happen here in production
    },

    completeRitual: async () => {
      if (!stateRef.current.currentRitual) throw new Error('No active ritual');
      
      const completedRitual = {
        ...stateRef.current.currentRitual,
        completedAt: new Date(),
      };
      
      dispatch({ type: ACTIONS.COMPLETE_RITUAL, payload: { ritual: completedRitual } });
      appActions.setActiveRitual(null);
      
      // Persist to storage
      const updatedHistory = [...stateRef.current.ritualHistory, completedRitual];
      await storage.set(STORAGE_KEYS.RITUAL_HISTORY, updatedHistory);
      
      // Gentle haptic feedback for completion
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Note: Partner sync would happen here in production
      
      return completedRitual;
    },

    getRitualWithMemoryContext: async (memoryContext) => {
      // Integrate relevant memories into ritual prompts
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const todayMemories = memoryContext?.getMemoriesForDateRange?.(
        startOfDay,
        endOfDay
      ) || [];
      
      const anniversaryMemories = memoryContext?.getMemoriesByType?.('anniversary')
        ?.filter(memory => {
          const memoryDate = new Date(memory.date);
          return memoryDate.getMonth() === now.getMonth() && 
                 memoryDate.getDate() === now.getDate();
        }) || [];
      
      // Create ritual with memory context
      const ritual = {
        id: `ritual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date(),
        type: RITUAL_TYPES.STANDARD,
        hasMemoryContext: todayMemories.length > 0 || anniversaryMemories.length > 0,
        contextMemories: [...todayMemories, ...anniversaryMemories],
        prompt: getRandomPrompt('checkIn'),
        checkIn: {
          question: generateMemoryContextualPrompt('checkIn', todayMemories, anniversaryMemories),
          userAnswer: null,
          partnerAnswer: null,
          isRevealed: false,
        },
        appreciation: {
          question: generateMemoryContextualPrompt('appreciation', todayMemories, anniversaryMemories),
          userAnswer: null,
          partnerAnswer: null,
          isRevealed: false,
        },
        dateIdea: {
          question: generateMemoryContextualPrompt('dateIdea', todayMemories, anniversaryMemories),
          userAnswer: null,
          partnerAnswer: null,
          isRevealed: false,
        },
        completedAt: null,
        partnerCompleted: false,
      };

      dispatch({ type: ACTIONS.START_RITUAL, payload: { ritual } });
      appActions.setActiveRitual(ritual);
      
      // Gentle haptic feedback for ritual start
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      return ritual;
    },

    createCustomFlow: async (flowData) => {
      // Premium feature - validate access
      const { premiumGatekeeper } = await import('../utils/premiumFeatures');
      const hasAccess = await premiumGatekeeper.canCreateCustomRituals(isPremium);
      if (!hasAccess) {
        throw new Error('Custom ritual flows require premium subscription');
      }
      
      const customFlow = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...flowData,
        createdAt: new Date(),
        isPremium: true,
      };
      
      dispatch({ type: ACTIONS.ADD_CUSTOM_FLOW, payload: { flow: customFlow } });
      
      // Persist to storage
      const updatedFlows = [...stateRef.current.customFlows, customFlow];
      await storage.set(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, updatedFlows);
      
      return customFlow;
    },

    startCustomRitual: async (customFlowId) => {
      // Premium feature - validate access
      const { premiumGatekeeper } = await import('../utils/premiumFeatures');
      const hasAccess = await premiumGatekeeper.canCreateCustomRituals(isPremium);
      if (!hasAccess) {
        throw new Error('Custom ritual flows require premium subscription');
      }
      
      const customFlow = stateRef.current.customFlows.find(flow => flow.id === customFlowId);
      if (!customFlow) {
        throw new Error('Custom flow not found');
      }
      
      // Create ritual based on custom flow
      const ritual = {
        id: `ritual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date(),
        type: RITUAL_TYPES.CUSTOM,
        customFlowId: customFlowId,
        customFlowName: customFlow.name,
        elements: {},
        completedAt: null,
        partnerCompleted: false,
      };
      
      // Initialize elements based on custom flow
      customFlow.elements.forEach(elementId => {
        const customPrompt = customFlow.customPrompts?.[elementId];
        ritual.elements[elementId] = {
          question: customPrompt || getDefaultPromptForElement(elementId),
          userAnswer: null,
          partnerAnswer: null,
          isRevealed: false,
        };
      });
      
      dispatch({ type: ACTIONS.START_RITUAL, payload: { ritual } });
      appActions.setActiveRitual(ritual);
      
      // Gentle haptic feedback for ritual start
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      return ritual;
    },

    updateCustomFlowResponse: async (elementId, answer) => {
      const currentRitual = stateRef.current.currentRitual;
      if (!currentRitual || currentRitual.type !== RITUAL_TYPES.CUSTOM) {
        throw new Error('No active custom ritual');
      }
      
      const updates = {
        elements: {
          ...currentRitual.elements,
          [elementId]: {
            ...currentRitual.elements[elementId],
            userAnswer: answer,
          },
        },
      };
      
      dispatch({ type: ACTIONS.UPDATE_RITUAL, payload: { updates } });
      
      // Note: Partner sync would happen here in production
    },

    deleteCustomFlow: async (flowId) => {
      // Premium feature - validate access
      const { premiumGatekeeper } = await import('../utils/premiumFeatures');
      const hasAccess = await premiumGatekeeper.canCreateCustomRituals(isPremium);
      if (!hasAccess) {
        throw new Error('Custom ritual flows require premium subscription');
      }
      
      const updatedFlows = stateRef.current.customFlows.filter(flow => flow.id !== flowId);
      dispatch({ type: ACTIONS.LOAD_CUSTOM_FLOWS, payload: { flows: updatedFlows } });
      
      // Persist to storage
      await storage.set(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, updatedFlows);
      
      return true;
    },

    scheduleRitualReminder: async (schedule) => {
      // Premium feature - validate access
      const { premiumGatekeeper } = await import('../utils/premiumFeatures');
      const hasAccess = await premiumGatekeeper.canScheduleReminders(isPremium);
      if (!hasAccess) {
        throw new Error('Ritual reminders require premium subscription');
      }

      const when = schedule?.when || schedule?.time;
      if (!when) throw new Error('Reminder time is required');

      const permission = await ensureNotificationPermissions();
      if (!permission?.ok) {
        throw new Error('Notifications are not enabled');
      }

      const notificationId = await scheduleEventNotification({
        title: schedule?.title || 'Ritual Reminder',
        body: schedule?.body || 'Time for your connection ritual.',
        when,
      });

      const existing = (await storage.get(STORAGE_KEYS.RITUAL_REMINDERS)) || [];
      const filtered = existing.filter((item) => item?.id !== schedule?.id);
      const reminder = {
        ...schedule,
        id: schedule?.id || `reminder_${Date.now()}`,
        createdAt: Date.now(),
        notificationId,
        scheduledFor: new Date(when).toISOString(),
      };
      await storage.set(STORAGE_KEYS.RITUAL_REMINDERS, [reminder, ...filtered]);
      return reminder;
    },

    syncWithPartner: async () => {
      const payload = {
        id: `ritual_sync_${Date.now()}`,
        ritual: stateRef.current.currentRitual || null,
        queuedAt: Date.now(),
      };
      await StorageRouter.queueRitualSync(payload);
      return { queued: true };
    },
  }), [appActions, isPremium]);

  return (
    <RitualContext.Provider value={{ state, actions }}>
      {children}
    </RitualContext.Provider>
  );
}

export const useRitualContext = () => {
  const ctx = useContext(RitualContext);
  if (!ctx) throw new Error("useRitualContext must be used inside RitualProvider");
  return ctx;
};

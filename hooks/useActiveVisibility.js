import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

/**
 * Returns true only when the app is in the foreground AND the current screen is focused.
 * Essential for pausing heavy continuous animations (like GlowOrb/LiveVibeSync) 
 * to prevent thermal throttling and battery drain.
 */
export default function useActiveVisibility() {
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
    });
    
    return () => subscription.remove();
  }, []);

  return isFocused && appState === 'active';
}
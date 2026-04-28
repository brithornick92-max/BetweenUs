# Sign Out Fix - Complete Audit & Solution

## Problems Identified

### 1. **Auth Listener Loop**
- After `signOut()` completes, the auth listener continues to run
- It tries to verify the session even though we explicitly signed out
- Supabase operations timeout, causing repeated error logs
- This creates a loop of failed session checks

### 2. **Race Condition with State Updates**
- Setting `user = null` doesn't immediately cause RootNavigator to re-render
- The `initializing` toggle trick was unreliable
- Multiple state updates were happening in the wrong order

### 3. **Timeout Handling**
- Supabase operations timeout but the code continues
- No proper error recovery for failed sign-out operations

## Solution Implemented

### Key Changes:

1. **Added `isSigningOutRef` flag**
   - Set to `true` at start of sign out
   - Auth listener checks this flag and skips all work if true
   - Reset to `false` after sign out completes
   - **This prevents the infinite loop of session checks**

2. **Reordered State Updates**
   - Clear React state (`setUser(null)`, `setUserProfile(null)`) FIRST
   - Set `initializing = true` to show loading screen
   - Do all cleanup (push tokens, storage, analytics)
   - Reset `bootstrappedRef` so user can sign in again
   - Set `initializing = false` to trigger navigation to auth screen
   - **This ensures proper UI state transitions**

3. **Better Error Handling**
   - If any step fails, still clear local state
   - Sign out happens locally even if server operations fail
   - **User can always log out, even with network issues**

### Flow After Fix:

```
1. User clicks "Sign Out" → Alert confirmation
2. User confirms → signOutLocal() called
3. isSigningOutRef.current = true (blocks auth listener)
4. setUser(null), setUserProfile(null), setInitializing(true)
5. UI shows loading screen
6. Push token removal (with 3s timeout)
7. StorageRouter.signOut() (with timeout handling)
8. Clear credentials, analytics, local cache
9. isSigningOutRef.current = false (unblock auth listener)
10. bootstrappedRef.current = false (allow re-login)
11. setInitializing(false)
12. RootNavigator sees user = null, shows auth screen ✅
```

## Testing Steps

1. ✅ Click sign out → Should immediately show loading then auth screen
2. ✅ Check logs → Should see "signOut completed" without timeout loops
3. ✅ Sign back in → Should work normally
4. ✅ Sign out with poor network → Should still work locally

## Files Modified

- `context/AuthContext.js` - Added `isSigningOutRef`, reordered sign out logic
- `screens/SettingsScreen.js` - Added logging to track button clicks

## Next Steps

Once confirmed working:
1. Remove all `console.log` debug statements
2. Test with slow network conditions
3. Test repeated sign out/sign in cycles
4. Update sign out documentation

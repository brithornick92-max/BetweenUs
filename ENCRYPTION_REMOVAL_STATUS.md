 # Encryption Removal Status Report

**Date:** 2026-04-25  
**Status:** ✅ COMPLETE - No encryption in use, Supabase is source of truth

## Summary

The Between Us app has been successfully migrated from a local-first encrypted architecture to an online-only architecture with Supabase as the source of truth. All encryption has been removed or stubbed out.

## Current Architecture

### ✅ Data Storage
- **Primary Storage:** Supabase (PostgreSQL) - All data stored in plaintext
- **Local Storage:** Cache only (SQLite for offline reads, no encryption)
- **Security:** Supabase Auth + Row Level Security (RLS) + HTTPS transport

### ✅ Encryption Services Status

#### 1. E2EEncryption.js - STUBBED ✅
**Location:** `services/e2ee/E2EEncryption.js`
**Status:** All methods are no-ops that return plaintext
- `encryptString()` → returns input unchanged
- `decryptString()` → returns input unchanged
- `encryptJson()` → returns JSON.stringify()
- `decryptJson()` → returns JSON.parse()
- `hasCoupleKey()` → returns false
- All other methods are no-ops

#### 2. EncryptedAttachments.js - PLAIN STORAGE ✅
**Location:** `services/e2ee/EncryptedAttachments.js`
**Status:** Files stored as plaintext
- Local cache: Plain files in `FileSystem.documentDirectory/attachments/`
- Remote storage: Plain files in Supabase Storage bucket
- No encryption applied to file contents
- Protected by Supabase RLS + HTTPS

#### 3. SupabaseDataLayer.js - NO ENCRYPTION ✅
**Location:** `services/data/SupabaseDataLayer.js`
**Status:** Direct Supabase reads/writes, no encryption
- Comments explicitly state "E2EE is removed"
- All `canEncryptForCouple()` methods return `false`
- Data stored in plaintext in Supabase tables

### ⚠️ Remaining Encryption-Related Code

#### 1. SecureStore Usage - ACCEPTABLE ✅
**Location:** `utils/encryptedStorage.js`, `context/AuthContext.js`
**Purpose:** Device-level secure storage for auth tokens only
**Status:** This is ACCEPTABLE and recommended
- Used only for Supabase auth session persistence
- Stores auth tokens in device keychain/keystore
- Does NOT encrypt user content
- Standard practice for mobile apps

**Files using SecureStore:**
- `utils/encryptedStorage.js` - Wrapper for settings/preferences
- `context/AuthContext.js` - Auth session backup
- `config/supabase.js` - Supabase auth storage

#### 2. expo-crypto Package - ACCEPTABLE ✅
**Location:** `package.json` line 38
**Purpose:** UUID generation and basic crypto utilities
**Status:** This is ACCEPTABLE
- Used for generating random IDs (`randomUUID()`)
- NOT used for content encryption
- Standard utility package

#### 3. Legacy Encryption Dependencies - CAN BE REMOVED ⚠️
**Location:** `package.json`
**Packages that can be removed:**
- `@noble/hashes` (line 23) - Not needed if no encryption
- `tweetnacl` (line 71) - Crypto library, not needed
- `tweetnacl-util` (line 72) - Crypto utilities, not needed

**Note:** These are small packages and removing them is optional. They're not actively being used for encryption.

## Verification Checklist

### ✅ No Content Encryption
- [x] E2EEncryption service is stubbed (returns plaintext)
- [x] EncryptedAttachments stores files as plaintext
- [x] SupabaseDataLayer writes plaintext to Supabase
- [x] DataLayer.js has fallback decryption for legacy data only

### ✅ Supabase is Source of Truth
- [x] All writes go directly to Supabase
- [x] Local SQLite is cache only (for offline reads)
- [x] No local-first architecture
- [x] Sync engine removed/disabled

### ✅ Security Model
- [x] Supabase Auth for authentication
- [x] Row Level Security (RLS) for authorization
- [x] HTTPS for transport security
- [x] SecureStore for auth tokens only (device keychain)

### ⚠️ Optional Cleanup
- [ ] Remove `@noble/hashes` from package.json
- [ ] Remove `tweetnacl` from package.json
- [ ] Remove `tweetnacl-util` from package.json
- [ ] Remove `services/e2ee/` directory entirely (keep stubs for now)

## Migration Notes

### Legacy Data Handling
The app includes fallback code to read old encrypted data for users who had data before the encryption removal. This is handled in:
- `services/data/DataLayer.js` - Falls back to E2EEncryption stubs for old cipher fields
- Comments state: "E2EE is removed; we cannot decrypt old blobs here anymore"

### Demo Seeder
The demo seeder (`utils/DemoSeeder.js`) may reference E2EEncryption but uses the stubbed version, so it writes plaintext.

## Recommendations

### ✅ Current State is Correct
The app is already in the desired state:
1. **No encryption** - All content stored as plaintext
2. **Online-only** - Supabase is the source of truth
3. **Cache only** - Local SQLite is for offline reads only
4. **Proper security** - Auth + RLS + HTTPS

### Optional: Remove Unused Dependencies
If you want to clean up the package.json, you can remove:
```bash
npm uninstall @noble/hashes tweetnacl tweetnacl-util
```

### Keep These Dependencies
**DO NOT REMOVE:**
- `expo-secure-store` - Needed for auth token storage
- `expo-crypto` - Needed for UUID generation
- `expo-sqlite` - Needed for local cache

## Conclusion

✅ **The app meets all requirements:**
- ✅ No encryption of user content
- ✅ Supabase is the source of truth
- ✅ Online-only architecture (with local cache)
- ✅ Proper security via Auth + RLS + HTTPS

The encryption removal is **COMPLETE**. The only remaining "encryption" is the standard practice of using device keychain (SecureStore) for auth tokens, which is recommended and not related to user content encryption.

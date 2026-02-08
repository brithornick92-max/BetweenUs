import LocalStorageService from '../LocalStorageService';

class LocalEngine {
  async initialize() {
    return true;
  }

  createAccount(email, password, displayName) {
    return LocalStorageService.createAccount(email, password, displayName);
  }

  signInWithEmailAndPassword(email, password) {
    return LocalStorageService.signInWithEmailAndPassword(email, password);
  }

  signOut() {
    return LocalStorageService.signOut();
  }

  onAuthStateChanged(callback) {
    return LocalStorageService.onAuthStateChanged(callback);
  }

  getUserDocument(userId) {
    return LocalStorageService.getUserDocument(userId);
  }

  updateUserDocument(userId, updates) {
    return LocalStorageService.updateUserDocument(userId, updates);
  }

  deleteUserDocument(userId) {
    return LocalStorageService.deleteUserDocument(userId);
  }

  getPrompts(filters = {}) {
    return LocalStorageService.getPrompts(filters);
  }

  getDates(filters = {}) {
    return LocalStorageService.getDates(filters);
  }

  saveMemory(userId, memoryData) {
    return LocalStorageService.saveMemory(userId, memoryData);
  }

  getUserMemories(userId) {
    return LocalStorageService.getUserMemories(userId);
  }

  updateMemory(memoryId, updates) {
    return LocalStorageService.updateMemory(memoryId, updates);
  }

  deleteMemory(memoryId) {
    return LocalStorageService.deleteMemory(memoryId);
  }

  linkPartner(userId, partnerCode) {
    return LocalStorageService.linkPartner(userId, partnerCode);
  }

  unlinkPartner(userId) {
    return LocalStorageService.unlinkPartner(userId);
  }
}

export default new LocalEngine();

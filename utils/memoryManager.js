// utils/memoryManager.js
import { storage, STORAGE_KEYS, memoryStorage } from './storage';
import CloudEngine from '../services/storage/CloudEngine';
import CoupleKeyService from '../services/security/CoupleKeyService';

// Memory Types (moved here to avoid circular dependency)
export const MEMORY_TYPES = {
  FIRST: 'first',
  ANNIVERSARY: 'anniversary', 
  MILESTONE: 'milestone',
  INSIDE_JOKE: 'inside_joke',
  MOMENT: 'moment',
};

/**
 * Memory Manager Class
 * Handles relationship memory storage, timeline generation, and data persistence
 * Focuses on emotional lock-in through memory preservation
 */

export class MemoryManager {
  constructor() {
    this.memories = new Map();
    this.timeline = [];
    this.milestones = [];
    this.anniversaries = [];
    this.isInitialized = false;
  }

  /**
   * Initialize the memory manager
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      const storedMemories = await memoryStorage.getMemories();
      
      // Load memories into Map for efficient access
      storedMemories.forEach(memory => {
        this.memories.set(memory.id, memory);
      });
      
      // Generate timeline and categorize memories
      this.regenerateTimeline();
      this.categorizeMemories();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MemoryManager:', error);
      throw error;
    }
  }

  /**
   * Add a new memory
   */
  async addMemory(memoryData) {
    const memory = this.createMemoryObject(memoryData);
    
    // Add to local Map
    this.memories.set(memory.id, memory);
    
    // Persist to storage
    await memoryStorage.addMemory(memory);
    
    // Update timeline and categories
    this.regenerateTimeline();
    this.categorizeMemories();
    
    // Check if this creates an anniversary theme
    if (memory.type === MEMORY_TYPES.ANNIVERSARY) {
      await this.createAnniversaryVibeTheme(memory);
    }
    
    return memory;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(memoryId, updates) {
    const existingMemory = this.memories.get(memoryId);
    if (!existingMemory) {
      throw new Error(`Memory with id ${memoryId} not found`);
    }
    
    const updatedMemory = {
      ...existingMemory,
      ...updates,
      updatedAt: new Date(),
    };
    
    // Update in Map
    this.memories.set(memoryId, updatedMemory);
    
    // Persist to storage
    await memoryStorage.updateMemory(updatedMemory);
    
    // Regenerate timeline
    this.regenerateTimeline();
    this.categorizeMemories();
    
    return updatedMemory;
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId) {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      throw new Error(`Memory with id ${memoryId} not found`);
    }
    
    // Remove from Map
    this.memories.delete(memoryId);
    
    // Remove from storage
    await memoryStorage.deleteMemory(memoryId);
    
    // Update timeline and categories
    this.regenerateTimeline();
    this.categorizeMemories();
    
    return true;
  }

  /**
   * Get memories for a specific date range
   */
  getMemoriesForDateRange(startDate, endDate) {
    return Array.from(this.memories.values())
      .filter(memory => {
        const memoryDate = new Date(memory.date);
        return memoryDate >= startDate && memoryDate <= endDate;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Get memories by type
   */
  getMemoriesByType(type) {
    return Array.from(this.memories.values())
      .filter(memory => memory.type === type)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get timeline (chronologically sorted memories)
   */
  getTimeline() {
    return this.timeline;
  }

  /**
   * Get milestones
   */
  getMilestones() {
    return this.milestones;
  }

  /**
   * Get anniversaries
   */
  getAnniversaries() {
    return this.anniversaries;
  }

  /**
   * Search memories by text
   */
  searchMemories(query) {
    const searchTerm = query.toLowerCase();
    return Array.from(this.memories.values())
      .filter(memory => 
        memory.title.toLowerCase().includes(searchTerm) ||
        memory.description.toLowerCase().includes(searchTerm) ||
        memory.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get memories for today's date in history
   */
  getMemoriesForToday() {
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();
    
    return Array.from(this.memories.values())
      .filter(memory => {
        const memoryDate = new Date(memory.date);
        return memoryDate.getMonth() === todayMonth && 
               memoryDate.getDate() === todayDate &&
               memoryDate.getFullYear() !== today.getFullYear();
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get upcoming anniversaries (next 30 days)
   */
  getUpcomingAnniversaries() {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return this.anniversaries.filter(anniversary => {
      const anniversaryDate = new Date(anniversary.date);
      const thisYearAnniversary = new Date(
        today.getFullYear(),
        anniversaryDate.getMonth(),
        anniversaryDate.getDate()
      );
      
      return thisYearAnniversary >= today && thisYearAnniversary <= thirtyDaysFromNow;
    });
  }

  /**
   * Export memories (Premium feature)
   */
  async exportMemories(config) {
    const { format, dateRange, includePhotos, template } = config;
    
    // Get memories in date range
    const memoriesInRange = this.getMemoriesForDateRange(dateRange.start, dateRange.end);
    
    const exportData = {
      memories: memoriesInRange,
      exportDate: new Date(),
      format,
      template,
      includePhotos,
      totalMemories: memoriesInRange.length,
      dateRange,
      metadata: {
        firstMemory: memoriesInRange[0]?.date,
        lastMemory: memoriesInRange[memoriesInRange.length - 1]?.date,
        memoryTypes: this.getMemoryTypeStats(memoriesInRange),
      },
    };
    
    if (format === 'pdf') {
      return this.generatePDFExport(exportData);
    } else if (format === 'json') {
      return this.generateJSONExport(exportData);
    }
    
    return exportData;
  }

  /**
   * Create memory object with proper structure
   */
  createMemoryObject(memoryData) {
    const now = new Date();
    
    return {
      id: memoryData.id || `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: memoryData.type || MEMORY_TYPES.MOMENT,
      title: memoryData.title || '',
      description: memoryData.description || '',
      date: new Date(memoryData.date || now),
      tags: memoryData.tags || [],
      isShared: memoryData.isShared || false,
      createdBy: memoryData.createdBy || 'user',
      createdAt: new Date(memoryData.createdAt || now),
      updatedAt: new Date(),
      photos: memoryData.photos || [], // Premium feature
      location: memoryData.location || null,
      mood: memoryData.mood || null,
      isPrivate: memoryData.isPrivate || false,
      anniversaryYear: memoryData.anniversaryYear || null,
    };
  }

  /**
   * Regenerate chronological timeline
   */
  regenerateTimeline() {
    this.timeline = Array.from(this.memories.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(memory => ({
        ...memory,
        formattedDate: this.formatMemoryDate(memory.date),
        timeAgo: this.getTimeAgo(memory.date),
        isAnniversary: this.isAnniversaryDate(memory.date),
      }));
  }

  /**
   * Categorize memories into milestones and anniversaries
   */
  categorizeMemories() {
    this.milestones = Array.from(this.memories.values())
      .filter(memory => memory.type === MEMORY_TYPES.MILESTONE)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    this.anniversaries = Array.from(this.memories.values())
      .filter(memory => memory.type === MEMORY_TYPES.ANNIVERSARY)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Format memory date for display
   */
  formatMemoryDate(date) {
    const memoryDate = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - memoryDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }

  /**
   * Get time ago string
   */
  getTimeAgo(date) {
    const memoryDate = new Date(date);
    const now = new Date();
    const diffTime = now - memoryDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }

  /**
   * Check if date is an anniversary
   */
  isAnniversaryDate(date) {
    const memoryDate = new Date(date);
    const today = new Date();
    
    return memoryDate.getMonth() === today.getMonth() && 
           memoryDate.getDate() === today.getDate() &&
           memoryDate.getFullYear() !== today.getFullYear();
  }

  /**
   * Create anniversary-themed vibe colors
   */
  async createAnniversaryVibeTheme(memory) {
    // Generate special vibe theme for anniversaries
    const anniversaryTheme = {
      id: `anniversary_${memory.id}`,
      name: memory.title,
      primary: '#B22222', // Deep red from theme
      secondary: '#FFD3E9', // Blush pink
      glow: '#F7BEEF', // Blush rose
      gradient: ['#B22222', '#FFD3E9'],
      isAnniversaryTheme: true,
      anniversaryDate: memory.date,
      memoryId: memory.id,
    };
    
    // Store anniversary theme
    const anniversaryThemes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES) || [];
    anniversaryThemes.push(anniversaryTheme);
    await storage.set(STORAGE_KEYS.ANNIVERSARY_THEMES, anniversaryThemes);
    
    return anniversaryTheme;
  }

  /**
   * Get memory type statistics
   */
  getMemoryTypeStats(memories = null) {
    const memoriesToAnalyze = memories || Array.from(this.memories.values());
    const stats = {};
    
    Object.values(MEMORY_TYPES).forEach(type => {
      stats[type] = memoriesToAnalyze.filter(memory => memory.type === type).length;
    });
    
    return stats;
  }

  /**
   * Generate PDF export (Premium feature)
   */
  async generatePDFExport(exportData) {
    try {
      const { memories, template, includePhotos, dateRange } = exportData;
      
      // Create PDF content structure
      const pdfContent = {
        title: `Our Love Story: ${this.formatDateRange(dateRange)}`,
        subtitle: `${memories.length} precious memories together`,
        coverPage: this.generateCoverPage(memories),
        timeline: this.generateTimelinePages(memories),
        milestones: this.generateMilestonePages(memories.filter(m => m.type === 'milestone')),
        anniversaries: this.generateAnniversaryPages(memories.filter(m => m.type === 'anniversary')),
        photos: includePhotos ? this.generatePhotoPages(memories) : null,
        backCover: this.generateBackCover(memories),
      };
      
      // Generate PDF using HTML template
      const htmlContent = this.generateHTMLTemplate(pdfContent, template);
      
      // For now, return the HTML content and metadata
      // In a real implementation, this would use react-native-print or similar
      return {
        success: true,
        format: 'pdf',
        htmlContent,
        filename: `our_love_story_${new Date().toISOString().split('T')[0]}.pdf`,
        metadata: {
          totalPages: this.calculatePDFPages(pdfContent),
          memoryCount: memories.length,
          dateRange: this.formatDateRange(dateRange),
          includesPhotos: includePhotos,
          template,
        },
        downloadUrl: null, // Would be generated by PDF service
      };
    } catch (error) {
      console.error('PDF export failed:', error);
      return {
        success: false,
        error: error.message,
        data: exportData,
      };
    }
  }

  /**
   * Generate JSON export
   */
  async generateJSONExport(exportData) {
    try {
      const jsonString = JSON.stringify(exportData, null, 2);
      
      return {
        success: true,
        data: jsonString,
        filename: `memories_export_${new Date().toISOString().split('T')[0]}.json`,
        size: jsonString.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get memory statistics for dashboard
   */
  getMemoryStats() {
    const totalMemories = this.memories.size;
    const memoryTypes = this.getMemoryTypeStats();
    const oldestMemory = this.timeline[0];
    const newestMemory = this.timeline[this.timeline.length - 1];
    
    return {
      totalMemories,
      memoryTypes,
      oldestMemory: oldestMemory ? {
        title: oldestMemory.title,
        date: oldestMemory.date,
        timeAgo: oldestMemory.timeAgo,
      } : null,
      newestMemory: newestMemory ? {
        title: newestMemory.title,
        date: newestMemory.date,
        timeAgo: newestMemory.timeAgo,
      } : null,
      upcomingAnniversaries: this.getUpcomingAnniversaries().length,
    };
  }

  /**
   * Clear all memories (for testing/reset)
   */
  async clearAllMemories() {
    this.memories.clear();
    this.timeline = [];
    this.milestones = [];
    this.anniversaries = [];
    
    await storage.remove(STORAGE_KEYS.MEMORIES);
    await storage.remove(STORAGE_KEYS.ANNIVERSARY_THEMES);
    
    return true;
  }

  /**
   * Generate yearly relationship recap (Premium feature)
   */
  async generateYearlyRecap(year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const yearMemories = this.getMemoriesForDateRange(startDate, endDate);
    
    if (yearMemories.length === 0) {
      return {
        success: false,
        error: `No memories found for ${year}`,
      };
    }
    
    const recap = {
      year,
      totalMemories: yearMemories.length,
      highlights: this.getYearHighlights(yearMemories),
      milestones: yearMemories.filter(m => m.type === 'milestone'),
      anniversaries: yearMemories.filter(m => m.type === 'anniversary'),
      monthlyBreakdown: this.getMonthlyBreakdown(yearMemories),
      topMoods: this.getTopMoods(yearMemories),
      favoriteLocations: this.getFavoriteLocations(yearMemories),
      memoryGrowth: this.calculateMemoryGrowth(yearMemories),
      relationshipInsights: this.generateRelationshipInsights(yearMemories),
    };
    
    return {
      success: true,
      recap,
      exportOptions: {
        pdf: true,
        json: true,
        sharing: true,
      },
    };
  }

  /**
   * Sync memories to cloud (Premium feature)
   */
  async syncToCloud(config = {}) {
    try {
      const { includePhotos = false, encryptData = true } = config;
      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID);
      if (!coupleId) {
        return { success: false, error: 'Couple not linked.' };
      }

      const userId = await CloudEngine.getCurrentUserId();
      
      const syncData = {
        memories: Array.from(this.memories.values()),
        anniversaryThemes: await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES) || [],
        syncTimestamp: new Date(),
        deviceId: await this.getDeviceId(),
        version: '1.0',
      };
      
      const coupleKey = await CoupleKeyService.getCoupleKey(coupleId);
      if (encryptData && !coupleKey) {
        return { success: false, error: 'Pairing key not found.' };
      }

      if (encryptData) {
        await CloudEngine.saveCoupleDataEncrypted(
          coupleId,
          'memory_backup_v1',
          { ...syncData, encrypted: true },
          userId,
          true,
          'memory_backup',
          coupleKey
        );
      } else {
        await CloudEngine.saveCoupleData(
          coupleId,
          'memory_backup_v1',
          syncData,
          userId,
          true,
          'memory_backup'
        );
      }
      
      return {
        success: true,
        syncedMemories: syncData.memories.length,
        syncTimestamp: syncData.syncTimestamp,
        backupId: 'memory_backup_v1',
      };
    } catch (error) {
      console.error('Cloud sync failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Restore memories from cloud backup (Premium feature)
   */
  async restoreFromCloud(backupId) {
    try {
      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID);
      if (!coupleId) {
        return { success: false, error: 'Couple not linked.' };
      }

      const coupleKey = await CoupleKeyService.getCoupleKey(coupleId);
      const data = await CloudEngine.getCoupleData(coupleId, backupId || 'memory_backup_v1', coupleKey);
      if (!data || data?.locked) {
        return { success: false, error: 'Backup is locked or unavailable.' };
      }

      const payload = data.value || data;
      const memories = Array.isArray(payload?.memories) ? payload.memories : [];
      await storage.set(STORAGE_KEYS.MEMORIES, memories);
      if (Array.isArray(payload?.anniversaryThemes)) {
        await storage.set(STORAGE_KEYS.ANNIVERSARY_THEMES, payload.anniversaryThemes);
      }

      this.memories.clear();
      memories.forEach((memory) => {
        if (memory?.id) this.memories.set(memory.id, memory);
      });
      this.regenerateTimeline();

      return {
        success: true,
        restoredCount: memories.length,
      };
    } catch (error) {
      console.error('Cloud restore failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper methods for PDF and recap generation
  
  formatDateRange(dateRange) {
    const start = new Date(dateRange.start).toLocaleDateString();
    const end = new Date(dateRange.end).toLocaleDateString();
    return `${start} - ${end}`;
  }
  
  generateCoverPage(memories) {
    const firstMemory = memories[0];
    const lastMemory = memories[memories.length - 1];
    
    return {
      title: 'Our Love Story',
      subtitle: `${memories.length} precious memories`,
      dateRange: firstMemory && lastMemory ? 
        `${new Date(firstMemory.date).getFullYear()} - ${new Date(lastMemory.date).getFullYear()}` : 
        'Our Journey Together',
      coverImage: memories.find(m => m.photos?.length > 0)?.photos[0] || null,
    };
  }
  
  generateTimelinePages(memories) {
    return memories.map(memory => ({
      id: memory.id,
      title: memory.title,
      description: memory.description,
      date: new Date(memory.date).toLocaleDateString(),
      type: memory.type,
      photos: memory.photos || [],
      tags: memory.tags,
    }));
  }
  
  generateMilestonePages(milestones) {
    return milestones.map(milestone => ({
      ...milestone,
      significance: this.getMilestoneSignificance(milestone),
      relatedMemories: this.getRelatedMemories(milestone),
    }));
  }
  
  generateAnniversaryPages(anniversaries) {
    return anniversaries.map(anniversary => ({
      ...anniversary,
      yearsAgo: new Date().getFullYear() - new Date(anniversary.date).getFullYear(),
      celebrationIdeas: this.getAnniversaryCelebrationIdeas(anniversary),
    }));
  }
  
  generatePhotoPages(memories) {
    const photosWithMemories = memories
      .filter(m => m.photos && m.photos.length > 0)
      .map(m => ({
        memoryId: m.id,
        memoryTitle: m.title,
        date: m.date,
        photos: m.photos,
      }));
    
    return photosWithMemories;
  }
  
  generateBackCover(memories) {
    return {
      totalMemories: memories.length,
      timeSpan: this.calculateTimeSpan(memories),
      favoriteQuote: "The best things in life are the people we love, the places we've been, and the memories we've made along the way.",
      generatedDate: new Date().toLocaleDateString(),
    };
  }
  
  generateHTMLTemplate(content, template = 'elegant') {
    // Generate beautiful HTML template for PDF conversion
    const styles = this.getPDFStyles(template);
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${content.title}</title>
          <style>${styles}</style>
        </head>
        <body>
          ${this.renderCoverPage(content.coverPage)}
          ${this.renderTimelinePages(content.timeline)}
          ${content.milestones.length > 0 ? this.renderMilestonePages(content.milestones) : ''}
          ${content.anniversaries.length > 0 ? this.renderAnniversaryPages(content.anniversaries) : ''}
          ${content.photos ? this.renderPhotoPages(content.photos) : ''}
          ${this.renderBackCover(content.backCover)}
        </body>
      </html>
    `;
  }
  
  calculatePDFPages(content) {
    let pages = 1; // Cover page
    pages += Math.ceil(content.timeline.length / 3); // 3 memories per page
    pages += Math.ceil(content.milestones.length / 2); // 2 milestones per page
    pages += Math.ceil(content.anniversaries.length / 2); // 2 anniversaries per page
    if (content.photos) pages += Math.ceil(content.photos.length / 4); // 4 photos per page
    pages += 1; // Back cover
    return pages;
  }
  
  getYearHighlights(memories) {
    // Get the most significant memories of the year
    return memories
      .filter(m => m.type === 'milestone' || m.type === 'anniversary')
      .slice(0, 5)
      .map(m => ({
        title: m.title,
        date: m.date,
        significance: this.getMilestoneSignificance(m),
      }));
  }
  
  getMonthlyBreakdown(memories) {
    const breakdown = {};
    for (let month = 0; month < 12; month++) {
      const monthName = new Date(2000, month).toLocaleDateString('en', { month: 'long' });
      breakdown[monthName] = memories.filter(m => 
        new Date(m.date).getMonth() === month
      ).length;
    }
    return breakdown;
  }
  
  getTopMoods(memories) {
    const moodCounts = {};
    memories.forEach(m => {
      if (m.mood) {
        moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
      }
    });
    
    return Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([mood, count]) => ({ mood, count }));
  }
  
  getFavoriteLocations(memories) {
    const locationCounts = {};
    memories.forEach(m => {
      if (m.location) {
        locationCounts[m.location] = (locationCounts[m.location] || 0) + 1;
      }
    });
    
    return Object.entries(locationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([location, count]) => ({ location, count }));
  }
  
  calculateMemoryGrowth(memories) {
    const monthlyGrowth = {};
    memories.forEach(m => {
      const monthKey = new Date(m.date).toISOString().slice(0, 7); // YYYY-MM
      monthlyGrowth[monthKey] = (monthlyGrowth[monthKey] || 0) + 1;
    });
    
    return monthlyGrowth;
  }
  
  generateRelationshipInsights(memories) {
    return {
      totalSharedMoments: memories.length,
      averageMemoriesPerMonth: memories.length / 12,
      longestMemoryStreak: this.calculateLongestStreak(memories),
      mostActiveMonth: this.getMostActiveMonth(memories),
      relationshipMilestones: memories.filter(m => m.type === 'milestone').length,
    };
  }
  
  getMilestoneSignificance(milestone) {
    // Generate significance description based on milestone type and content
    return `A significant moment in your relationship journey`;
  }
  
  getRelatedMemories(milestone) {
    // Find memories related to this milestone
    const milestoneDate = new Date(milestone.date);
    const weekBefore = new Date(milestoneDate.getTime() - (7 * 24 * 60 * 60 * 1000));
    const weekAfter = new Date(milestoneDate.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    return this.getMemoriesForDateRange(weekBefore, weekAfter)
      .filter(m => m.id !== milestone.id)
      .slice(0, 3);
  }
  
  getAnniversaryCelebrationIdeas(anniversary) {
    // Generate celebration ideas based on anniversary type
    return [
      'Recreate your first date',
      'Visit the place where it all began',
      'Create a photo album of this year',
      'Write letters to your future selves',
    ];
  }
  
  calculateTimeSpan(memories) {
    if (memories.length === 0) return '0 days';
    
    const firstDate = new Date(memories[0].date);
    const lastDate = new Date(memories[memories.length - 1].date);
    const diffTime = Math.abs(lastDate - firstDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 365) return `${diffDays} days`;
    const years = Math.floor(diffDays / 365);
    const remainingDays = diffDays % 365;
    return `${years} year${years > 1 ? 's' : ''} and ${remainingDays} days`;
  }
  
  getPDFStyles(template) {
    // Return CSS styles for PDF template
    return `
      body { 
        font-family: 'Georgia', serif; 
        line-height: 1.6; 
        color: #333; 
        margin: 0; 
        padding: 20px; 
      }
      .cover-page { 
        text-align: center; 
        padding: 100px 0; 
        page-break-after: always; 
      }
      .timeline-page { 
        page-break-inside: avoid; 
        margin-bottom: 40px; 
      }
      .memory-item { 
        border-left: 3px solid #B22222; 
        padding-left: 20px; 
        margin-bottom: 30px; 
      }
      .memory-title { 
        font-size: 18px; 
        font-weight: bold; 
        color: #B22222; 
        margin-bottom: 5px; 
      }
      .memory-date { 
        font-size: 12px; 
        color: #666; 
        margin-bottom: 10px; 
      }
      .memory-description { 
        font-size: 14px; 
        line-height: 1.5; 
      }
    `;
  }
  
  renderCoverPage(coverPage) {
    return `
      <div class="cover-page">
        <h1 style="font-size: 48px; color: #B22222; margin-bottom: 20px;">${coverPage.title}</h1>
        <h2 style="font-size: 24px; color: #666; margin-bottom: 40px;">${coverPage.subtitle}</h2>
        <p style="font-size: 18px; color: #888;">${coverPage.dateRange}</p>
      </div>
    `;
  }
  
  renderTimelinePages(timeline) {
    return timeline.map(memory => `
      <div class="memory-item">
        <div class="memory-title">${memory.title}</div>
        <div class="memory-date">${memory.date}</div>
        <div class="memory-description">${memory.description}</div>
      </div>
    `).join('');
  }
  
  renderMilestonePages(milestones) {
    return `
      <div style="page-break-before: always;">
        <h2 style="color: #B22222; border-bottom: 2px solid #B22222; padding-bottom: 10px;">Our Milestones</h2>
        ${milestones.map(milestone => `
          <div class="memory-item">
            <div class="memory-title">${milestone.title}</div>
            <div class="memory-date">${new Date(milestone.date).toLocaleDateString()}</div>
            <div class="memory-description">${milestone.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  renderAnniversaryPages(anniversaries) {
    return `
      <div style="page-break-before: always;">
        <h2 style="color: #B22222; border-bottom: 2px solid #B22222; padding-bottom: 10px;">Our Anniversaries</h2>
        ${anniversaries.map(anniversary => `
          <div class="memory-item">
            <div class="memory-title">${anniversary.title}</div>
            <div class="memory-date">${new Date(anniversary.date).toLocaleDateString()}</div>
            <div class="memory-description">${anniversary.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  renderPhotoPages(photos) {
    return `
      <div style="page-break-before: always;">
        <h2 style="color: #B22222; border-bottom: 2px solid #B22222; padding-bottom: 10px;">Our Photos</h2>
        ${photos.map(photoGroup => `
          <div style="margin-bottom: 30px;">
            <h3>${photoGroup.memoryTitle}</h3>
            <p style="color: #666; font-size: 12px;">${new Date(photoGroup.date).toLocaleDateString()}</p>
            <!-- Photo placeholders would go here -->
          </div>
        `).join('')}
      </div>
    `;
  }
  
  renderBackCover(backCover) {
    return `
      <div style="page-break-before: always; text-align: center; padding: 100px 0;">
        <h3 style="color: #B22222; margin-bottom: 30px;">Our Journey in Numbers</h3>
        <p style="font-size: 18px; margin-bottom: 10px;">${backCover.totalMemories} precious memories</p>
        <p style="font-size: 18px; margin-bottom: 30px;">${backCover.timeSpan} together</p>
        <p style="font-style: italic; color: #666; margin-bottom: 30px;">"${backCover.favoriteQuote}"</p>
        <p style="font-size: 12px; color: #888;">Generated on ${backCover.generatedDate}</p>
      </div>
    `;
  }
  
  calculateLongestStreak(memories) {
    // Calculate longest consecutive days with memories
    const dates = memories.map(m => new Date(m.date).toDateString()).sort();
    let longestStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currentDate = new Date(dates[i]);
      const diffDays = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
      
      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    return longestStreak;
  }
  
  getMostActiveMonth(memories) {
    const monthCounts = this.getMonthlyBreakdown(memories);
    return Object.entries(monthCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
  }
  
  async getDeviceId() {
    // Get unique device identifier for cloud sync
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();

// Initialize on import - DISABLED to prevent startup errors
// The MemoryContext will initialize this when needed
// memoryManager.initialize().catch(console.error);

export default memoryManager;

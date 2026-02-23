// utils/anniversaryThemes.js
import { storage, STORAGE_KEYS } from './storage';
import { COLORS, GRADIENTS } from './theme';

/**
 * Anniversary Theme Generator
 * Creates special vibe themes based on relationship memories
 */

export class AnniversaryThemeGenerator {
  constructor() {
    this.themeTemplates = {
      'first_date': {
        name: 'First Date',
        primary: COLORS.blushRose,
        secondary: COLORS.blushRoseLight,
        glow: 'rgba(247, 190, 239, 0.4)',
        gradient: [COLORS.blushRose, COLORS.blushRoseLight],
        emotion: 'Where it all began',
      },
      'first_kiss': {
        name: 'First Kiss',
        primary: COLORS.deepRed,
        secondary: COLORS.beetroot,
        glow: 'rgba(178, 34, 34, 0.4)',
        gradient: [COLORS.deepRed, COLORS.beetroot],
        emotion: 'That magical moment',
      },
      'engagement': {
        name: 'Engagement',
        primary: COLORS.mutedGold,
        secondary: COLORS.champagneGold,
        glow: 'rgba(212, 175, 55, 0.4)',
        gradient: GRADIENTS.goldShimmer,
        emotion: 'Forever together',
      },
      'wedding': {
        name: 'Wedding Day',
        primary: COLORS.pureWhite,
        secondary: COLORS.softCream,
        glow: 'rgba(255, 255, 255, 0.4)',
        gradient: [COLORS.pureWhite, COLORS.softCream],
        emotion: 'Our perfect day',
      },
      'anniversary': {
        name: 'Anniversary',
        primary: COLORS.roseGold,
        secondary: COLORS.champagneGold,
        glow: 'rgba(183, 110, 121, 0.4)',
        gradient: [COLORS.roseGold, COLORS.champagneGold],
        emotion: 'Celebrating our love',
      },
      'first_trip': {
        name: 'First Trip',
        primary: COLORS.platinum,
        secondary: COLORS.softCream,
        glow: 'rgba(229, 228, 226, 0.4)',
        gradient: [COLORS.platinum, COLORS.softCream],
        emotion: 'Adventures together',
      },
      'moving_in': {
        name: 'Moving In',
        primary: COLORS.deepPlum,
        secondary: COLORS.charcoal,
        glow: 'rgba(43, 15, 30, 0.4)',
        gradient: [COLORS.deepPlum, COLORS.charcoal],
        emotion: 'Home is with you',
      },
    };
  }

  /**
   * Generate anniversary theme from memory
   */
  generateThemeFromMemory(memory) {
    const memoryTitle = memory.title.toLowerCase();
    let templateKey = 'anniversary'; // Default template
    
    // Match memory title to theme template
    if (memoryTitle.includes('first date') || memoryTitle.includes('met')) {
      templateKey = 'first_date';
    } else if (memoryTitle.includes('first kiss') || memoryTitle.includes('kiss')) {
      templateKey = 'first_kiss';
    } else if (memoryTitle.includes('engagement') || memoryTitle.includes('engaged') || memoryTitle.includes('proposal')) {
      templateKey = 'engagement';
    } else if (memoryTitle.includes('wedding') || memoryTitle.includes('married')) {
      templateKey = 'wedding';
    } else if (memoryTitle.includes('trip') || memoryTitle.includes('vacation') || memoryTitle.includes('travel')) {
      templateKey = 'first_trip';
    } else if (memoryTitle.includes('moved') || memoryTitle.includes('moving') || memoryTitle.includes('home')) {
      templateKey = 'moving_in';
    }
    
    const template = this.themeTemplates[templateKey];
    
    return {
      id: `anniversary_${memory.id}`,
      name: memory.title,
      primary: template.primary,
      secondary: template.secondary,
      glow: template.glow,
      gradient: template.gradient,
      emotion: template.emotion,
      isAnniversaryTheme: true,
      anniversaryDate: memory.date,
      memoryId: memory.id,
      templateKey,
      createdAt: new Date(),
    };
  }

  /**
   * Get anniversary themes for today
   */
  async getTodaysAnniversaryThemes() {
    try {
      const themes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES, []) || [];
      const today = new Date();
      
      return themes.filter(theme => {
        const themeDate = new Date(theme.anniversaryDate);
        return themeDate.getMonth() === today.getMonth() && 
               themeDate.getDate() === today.getDate() &&
               themeDate.getFullYear() !== today.getFullYear(); // Not the same year
      });
    } catch (error) {
      console.error('Failed to get today\'s anniversary themes:', error);
      return [];
    }
  }

  /**
   * Get upcoming anniversary themes (next 7 days)
   */
  async getUpcomingAnniversaryThemes() {
    try {
      const themes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES, []) || [];
      const today = new Date();
      const nextWeek = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      return themes.filter(theme => {
        const themeDate = new Date(theme.anniversaryDate);
        const thisYearTheme = new Date(
          today.getFullYear(),
          themeDate.getMonth(),
          themeDate.getDate()
        );
        
        return thisYearTheme >= today && thisYearTheme <= nextWeek;
      });
    } catch (error) {
      console.error('Failed to get upcoming anniversary themes:', error);
      return [];
    }
  }

  /**
   * Create and store anniversary theme
   */
  async createAnniversaryTheme(memory) {
    try {
      const theme = this.generateThemeFromMemory(memory);
      
      // Get existing themes
      const existingThemes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES, []) || [];
      
      // Check if theme already exists for this memory
      const existingTheme = existingThemes.find(t => t.memoryId === memory.id);
      if (existingTheme) {
        return existingTheme;
      }
      
      // Add new theme
      existingThemes.push(theme);
      await storage.set(STORAGE_KEYS.ANNIVERSARY_THEMES, existingThemes);
      
      return theme;
    } catch (error) {
      console.error('Failed to create anniversary theme:', error);
      return null;
    }
  }

  /**
   * Update anniversary theme
   */
  async updateAnniversaryTheme(themeId, updates) {
    try {
      const themes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES, []) || [];
      const themeIndex = themes.findIndex(t => t.id === themeId);
      
      if (themeIndex === -1) {
        throw new Error('Anniversary theme not found');
      }
      
      themes[themeIndex] = {
        ...themes[themeIndex],
        ...updates,
        updatedAt: new Date(),
      };
      
      await storage.set(STORAGE_KEYS.ANNIVERSARY_THEMES, themes);
      return themes[themeIndex];
    } catch (error) {
      console.error('Failed to update anniversary theme:', error);
      return null;
    }
  }

  /**
   * Delete anniversary theme
   */
  async deleteAnniversaryTheme(themeId) {
    try {
      const themes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES, []) || [];
      const filteredThemes = themes.filter(t => t.id !== themeId);
      
      await storage.set(STORAGE_KEYS.ANNIVERSARY_THEMES, filteredThemes);
      return true;
    } catch (error) {
      console.error('Failed to delete anniversary theme:', error);
      return false;
    }
  }

  /**
   * Get anniversary theme statistics
   */
  async getAnniversaryStats() {
    try {
      const themes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES, []) || [];
      const vibeHistory = await storage.get(STORAGE_KEYS.ANNIVERSARY_VIBE_HISTORY, []) || [];
      
      return {
        totalThemes: themes.length,
        themesUsed: vibeHistory.length,
        mostUsedTemplate: this.getMostUsedTemplate(themes),
        upcomingAnniversaries: (await this.getUpcomingAnniversaryThemes()).length,
      };
    } catch (error) {
      console.error('Failed to get anniversary stats:', error);
      return {
        totalThemes: 0,
        themesUsed: 0,
        mostUsedTemplate: null,
        upcomingAnniversaries: 0,
      };
    }
  }

  /**
   * Get most used template
   */
  getMostUsedTemplate(themes) {
    const templateCounts = {};
    
    themes.forEach(theme => {
      const template = theme.templateKey || 'anniversary';
      templateCounts[template] = (templateCounts[template] || 0) + 1;
    });
    
    let mostUsed = null;
    let maxCount = 0;
    
    Object.entries(templateCounts).forEach(([template, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsed = template;
      }
    });
    
    return mostUsed ? {
      template: mostUsed,
      count: maxCount,
      name: this.themeTemplates[mostUsed]?.name || 'Anniversary',
    } : null;
  }

  /**
   * Suggest anniversary theme based on date
   */
  suggestThemeForDate(date) {
    const month = date.getMonth();
    const day = date.getDate();
    
    // Special date suggestions
    if (month === 1 && day === 14) { // Valentine's Day
      return this.themeTemplates.first_kiss;
    } else if (month === 11 && day === 31) { // New Year's Eve
      return this.themeTemplates.anniversary;
    }
    
    // Default to anniversary theme
    return this.themeTemplates.anniversary;
  }
}

// Singleton instance
export const anniversaryThemeGenerator = new AnniversaryThemeGenerator();

export default anniversaryThemeGenerator;
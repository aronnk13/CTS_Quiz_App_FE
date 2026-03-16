import { finalize, Observable, tap } from 'rxjs';
import { ThemeApiService } from '../services/theme-api.service';
import { SignalrThemeService } from '../services/signalr-theme.service';
import { ThemeCreateModel, ThemeModel } from '../models/theme.model';
import { computed, effect, Injectable, signal } from '@angular/core';

const PREDEFINED_THEMES: ThemeModel[] = [
  // Professional Category - 4 themes
   {
    id: 36,
    name: 'Corporate',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #02073A, #1E8BBE)',
    textColor: '#1a1a1a',
    accentColor: '#4facfe',
    cardBgColor: 'rgba(255,255,255,0.85)',
    isDefault: true,
    category: 'Professional',
    fontStyle: 'Arial'
  },
  {
    id: 1,
    name: 'Ocean Breeze',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #00c6ff, #0072ff)',
    textColor: '#1a1a1a',
    accentColor: '#00b894',
    cardBgColor: 'rgba(255,255,255,0.85)',
    isDefault: true,
    category: 'Professional',
    fontStyle: 'Arial'
  },
  {
    id: 5,
    name: 'Corporate Blue',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #667eea, #764ba2)',
    textColor: '#1a1a1a',
    accentColor: '#a29bfe',
    cardBgColor: 'rgba(255,255,255,0.85)',
    isDefault: true,
    category: 'Professional',
    fontStyle: 'Impact'
  },
  {
    id: 6,
    name: 'Business Green',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #11998e, #38ef7d)',
    textColor: '#1a1a1a',
    accentColor: '#00b894',
    cardBgColor: 'rgba(255,255,255,0.85)',
    isDefault: true,
    category: 'Professional',
    fontStyle: 'Arial'
  },

  {
    id: 32,
    name: 'Navy Elite',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #1e3c72, #2a5298)',
    textColor: '#1a1a1a',
    accentColor: '#4facfe',
    cardBgColor: 'rgba(255,255,255,0.85)',
    isDefault: true,
    category: 'Professional',
    fontStyle: 'Arial'
  },
  
  // Creative Category - 5 themes
  {
    id: 2,
    name: 'Sunset Glow',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #ff9a9e, #fad0c4)',
    textColor: '#2d3436',
    accentColor: '#e17055',
    cardBgColor: 'rgba(255,255,255,0.88)',
    isDefault: true,
    category: 'Creative',
    fontStyle: 'Comic Sans MS'
  },
  {
    id: 8,
    name: 'Rainbow Dreams',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)',
    textColor: '#2d3436',
    accentColor: '#fd79a8',
    cardBgColor: 'rgba(255,255,255,0.88)',
    isDefault: true,
    category: 'Creative',
    fontStyle: 'Bangers'
  },
  {
    id: 9,
    name: 'Purple Fantasy',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #a8edea, #fed6e3)',
    textColor: '#2d3436',
    accentColor: '#6c5ce7',
    cardBgColor: 'rgba(255,255,255,0.88)',
    isDefault: true,
    category: 'Creative',
    fontStyle: 'Pacifico'
  },
  {
    id: 25,
    name: 'Vibrant Coral',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #ff6a88, #ffb199)',
    textColor: '#ffffff',
    accentColor: '#ff6348',
    cardBgColor: 'rgba(255,255,255,0.88)',
    isDefault: true,
    category: 'Creative',
    fontStyle: 'Arial'
  },
  {
    id: 33,
    name: 'Cosmic Burst',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #fa709a, #fee140)',
    textColor: '#2d3436',
    accentColor: '#e84393',
    cardBgColor: 'rgba(255,255,255,0.88)',
    isDefault: true,
    category: 'Creative',
    fontStyle: 'Arial'
  },
  
  // Dark Category - 5 themes
  {
    id: 3,
    name: 'Midnight Dark',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
    textColor: '#ffffff',
    accentColor: '#6c5ce7',
    cardBgColor: 'rgba(0,0,0,0.45)',
    isDefault: true,
    category: 'Dark',
    fontStyle: 'Lobster'
  },
  {
    id: 26,
    name: 'Dark Ocean',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #2c3e50, #34495e)',
    textColor: '#ffffff',
    accentColor: '#3498db',
    cardBgColor: 'rgba(0,0,0,0.45)',
    isDefault: true,
    category: 'Dark',
    fontStyle: 'Arial'
  },
  {
    id: 27,
    name: 'Night Sky',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #141e30, #243b55)',
    textColor: '#ffffff',
    accentColor: '#00d2ff',
    cardBgColor: 'rgba(0,0,0,0.45)',
    isDefault: true,
    category: 'Dark',
    fontStyle: 'Arial'
  },
  {
    id: 28,
    name: 'Deep Purple',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #2d1b69, #7f00ff)',
    textColor: '#ffffff',
    accentColor: '#a29bfe',
    cardBgColor: 'rgba(0,0,0,0.45)',
    isDefault: true,
    category: 'Dark',
    fontStyle: 'Arial'
  },
  {
    id: 34,
    name: 'Carbon Black',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #16222a, #3a6073)',
    textColor: '#ffffff',
    accentColor: '#00cec9',
    cardBgColor: 'rgba(0,0,0,0.45)',
    isDefault: true,
    category: 'Dark',
    fontStyle: 'Arial'
  },
  
  // Light Category - 5 themes
  {
    id: 4,
    name: 'Minimal Light',
    backgroundType: 'solid',
    backgroundValue: '#f7f7fb',
    textColor: '#111111',
    accentColor: '#0984e3',
    cardBgColor: 'rgba(255,255,255,0.95)',
    isDefault: true,
    category: 'Light',
    fontStyle: 'Comic Sans MS'
  },
  {
    id: 29,
    name: 'Soft Cream',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
    textColor: '#2d3436',
    accentColor: '#fd79a8',
    cardBgColor: 'rgba(255,255,255,0.95)',
    isDefault: true,
    category: 'Light',
    fontStyle: 'Arial'
  },
  {
    id: 30,
    name: 'Cloud White',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #e0e7ff, #ffffff)',
    textColor: '#2d3436',
    accentColor: '#6c5ce7',
    cardBgColor: 'rgba(255,255,255,0.95)',
    isDefault: true,
    category: 'Light',
    fontStyle: 'Arial'
  },
  {
    id: 31,
    name: 'Pastel Sky',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #cfd9df, #e2ebf0)',
    textColor: '#2d3436',
    accentColor: '#74b9ff',
    cardBgColor: 'rgba(255,255,255,0.95)',
    isDefault: true,
    category: 'Light',
    fontStyle: 'Arial'
  },
  {
    id: 35,
    name: 'Mint Fresh',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #d4fc79, #96e6a1)',
    textColor: '#2d3436',
    accentColor: '#00b894',
    cardBgColor: 'rgba(255,255,255,0.95)',
    isDefault: true,
    category: 'Light',
    fontStyle: 'Arial'
  },
  
  // Animation Category - 5 themes
  {
    id: 10,
    name: 'Blinking Stars',
    backgroundType: 'solid',
    backgroundValue: '#1a1a2e',
    textColor: '#ffffff',
    accentColor: '#ffd700',
    cardBgColor: 'rgba(0,0,0,0.6)',
    isDefault: true,
    category: 'Animation',
    animation: 'blinking',
    fontStyle: 'Pacifico'
  },
  {
    id: 11,
    name: 'Moving Stars',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    textColor: '#ffffff',
    accentColor: '#00d4ff',
    cardBgColor: 'rgba(0,0,0,0.5)',
    isDefault: true,
    category: 'Animation',
    animation: 'moving-stars',
    fontStyle: 'Bangers'
  },
  {
    id: 12,
    name: 'Falling Snow',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #e6f2ff, #b3d9ff)',
    textColor: '#2c3e50',
    accentColor: '#3498db',
    cardBgColor: 'rgba(255,255,255,0.8)',
    isDefault: true,
    category: 'Animation',
    animation: 'snow',
    fontStyle: 'Lobster'
  },
  {
    id: 13,
    name: 'Confetti Burst',
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #ff9a9e, #fad0c4, #ffecd2)',
    textColor: '#2d3436',
    accentColor: '#e17055',
    cardBgColor: 'rgba(255,255,255,0.85)',
    isDefault: true,
    category: 'Animation',
    animation: 'confetti',
    fontStyle: 'Comic Sans MS'
  },
  {
    id: 14,
    name: 'Galaxy',
    backgroundType: 'solid',
    backgroundValue: '#0a0a1a',
    textColor: '#ffffff',
    accentColor: '#8a2be2',
    cardBgColor: 'rgba(0,0,0,0.7)',
    isDefault: true,
    category: 'Animation',
    animation: 'galaxy',
    fontStyle: 'Impact'
  },
  
  // Images Category - 5 festival themes
  {
    id: 20,
    name: 'Diwali Festival',
    backgroundType: 'image',
    backgroundValue: 'https://images.unsplash.com/photo-1592843997881-cab3860b1067?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    textColor: '#ffffff',
    accentColor: '#ff6b00',
    cardBgColor: 'rgba(0,0,0,0.6)',
    isDefault: true,
    category: 'Images',
    fontStyle: 'Lobster'
  },
  {
    id: 21,
    name: 'Christmas',
    backgroundType: 'image',
    backgroundValue: 'https://images.unsplash.com/photo-1511268011861-691ed210aae8?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    textColor: '#ffffff',
    accentColor: '#c41e3a',
    cardBgColor: 'rgba(0,0,0,0.5)',
    isDefault: true,
    category: 'Images',
    fontStyle: 'Pacifico'
  },
  {
    id: 22,
    name: 'Holi Colors',
    backgroundType: 'image',
    backgroundValue: 'https://images.unsplash.com/photo-1508898578281-774ac4893c0c?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    textColor: '#ffffff',
    accentColor: '#ff1744',
    cardBgColor: 'rgba(0,0,0,0.6)',
    isDefault: true,
    category: 'Images',
    fontStyle: 'Bangers'
  },
  {
    id: 23,
    name: 'New Year',
    backgroundType: 'image',
    backgroundValue: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1920&q=80',
    textColor: '#ffffff',
    accentColor: '#ffd700',
    cardBgColor: 'rgba(0,0,0,0.7)',
    isDefault: true,
    category: 'Images',
    fontStyle: 'Impact'
  },
  {
    id: 24,
    name: 'Easter Spring',
    backgroundType: 'image',
    backgroundValue: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1920&q=80',
    textColor: '#2c3e50',
    accentColor: '#ff6b9d',
    cardBgColor: 'rgba(255,255,255,0.8)',
    isDefault: true,
    category: 'Images',
    fontStyle: 'Comic Sans MS'
  }
];

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private _themes = signal<ThemeModel[]>(PREDEFINED_THEMES);
  private _currentTheme = signal<ThemeModel | null>(null);
  private _loading = signal(false);

  themes = computed(() => this._themes());
  currentTheme = computed(() => this._currentTheme());
  loading = computed(() => this._loading());

  constructor(private api: ThemeApiService, private hub: SignalrThemeService) {
    // Auto-apply theme whenever currentTheme changes
    effect(() => {
      const theme = this._currentTheme();
      console.log('🎨 Effect triggered, current theme:', theme);
      if (theme) {
        console.log('🎨 Calling applyThemeToDocument');
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => this.applyThemeToDocument(theme), 0);
      }
    });
  }

  /** ✅ Load themes from DB + merge with predefined */
  loadThemes(hostId?: string) {
    this._loading.set(true);

    const host = hostId || 'H001'; // Default to H001 if not provided

    this.api.getThemes(host).pipe(
      tap((dbThemes) => {
        // Map backend response to frontend model using mapBackendTheme
        const mappedThemes = (dbThemes ?? []).map(t => this.mapBackendTheme(t));
        const merged = this.mergeThemes(PREDEFINED_THEMES, mappedThemes);
        this._themes.set(merged);
      }),
      finalize(() => this._loading.set(false))
    ).subscribe({
      error: (err) => {
        console.error('Load themes error:', err);
        this._themes.set(PREDEFINED_THEMES);
      }
    });
  }

  /**
   * ✅ Create theme in DB and add to UI immediately
   * ✅ Return Observable so caller can navigate AFTER success
   */
  createTheme(payload: ThemeCreateModel, hostId?: string): Observable<ThemeModel> {
    this._loading.set(true);

    const safePayload: ThemeCreateModel = {
      name: payload.name?.trim() || 'Custom Theme',
      textColor: payload.textColor?.trim() || '#111111',
      accentColor: payload.accentColor?.trim() || '#6c5ce7',
      primaryColor: payload.primaryColor?.trim() || '#6c5ce7',
      secondaryColor: payload.secondaryColor?.trim() || '#a29bfe',
      backgroundColor: payload.backgroundColor || 'gradient',  // ✅ Use provided backgroundColor or default to 'gradient'
      fontStyle: payload.fontStyle || 'Arial',
      category: payload.category || 'Custom'
    };

    console.log('🎨 ThemeStore.createTheme safePayload:', safePayload);
    console.log('🔍 backgroundColor field value:', safePayload.backgroundColor);
    console.log('🔍 backgroundColor field type:', typeof safePayload.backgroundColor);
    
    // ✅ CRITICAL CHECK: Verify backgroundColor is not empty
    if (!safePayload.backgroundColor || safePayload.backgroundColor === '') {
      console.error('❌ CRITICAL ERROR: backgroundColor is empty in safePayload!');
      console.error('Original payload.backgroundColor:', payload.backgroundColor);
    }

    const host = hostId || 'H001'; // Default to H001 if not provided

    return this.api.createCustomTheme(host, safePayload).pipe(
      tap((created) => {
        console.log('🎨 Theme created successfully:', created);
        // Map backend response to frontend model using mapBackendTheme
        const mappedTheme = this.mapBackendTheme(created);
        this._themes.update(list => [mappedTheme, ...list]);
      }),
      finalize(() => this._loading.set(false))
    );
    
  }

  /** ✅ Delete custom theme */
  deleteTheme(themeId: number, hostId?: string): Observable<void> {
    console.log('🗑️ Deleting theme:', themeId);
    
    const host = hostId || 'H001'; // Default to H001 if not provided
    
    return this.api.deleteTheme(themeId, host).pipe(
      tap({
        next: () => {
          console.log('✅ DELETE request successful. Theme removed from backend.');
          // Remove from local state
          this._themes.update(list => list.filter(t => t.id !== themeId));
          console.log('💾 Theme removed from local themes list');
        },
        error: (err) => {
          console.error('❌ DELETE request failed:', err);
          console.error('Error details:', {
            status: err.status,
            statusText: err.statusText,
            message: err.message,
            error: err.error
          });
        }
      })
    );
  }

  /** ✅ Update custom theme */
  updateTheme(themeId: number, hostId: string, payload: ThemeCreateModel): Observable<ThemeModel> {
    console.log('🔧 ThemeStore.updateTheme called with:', { themeId, hostId, payload });
    
    return this.api.updateTheme(themeId, hostId, payload).pipe(
      tap((updated) => {
        console.log('✅ PUT request successful. Updated theme received:', updated);
        const mappedTheme = this.mapBackendTheme(updated);
        console.log('🗺️ Mapped theme:', mappedTheme);
        this._themes.update(list => 
          list.map(t => t.id === themeId ? mappedTheme : t)
        );
        console.log('💾 Local themes list updated');
      }),
      tap({
        error: (err) => {
          console.error('❌ PUT request failed:', err);
          console.error('Error details:', {
            status: err.status,
            statusText: err.statusText,
            message: err.message,
            error: err.error
          });
        }
      })
    );
  }

  /** ✅ Upload image file and get Base64 data URL */
  uploadThemeImage(file: File): Observable<{ imageUrl: string }> {
    console.log('📤 ThemeStore.uploadThemeImage called');
    return this.api.uploadThemeImage(file);
  }

  /** ✅ SignalR: connect + join room + listen */
  async initRoomThemeSync(roomId: string) {
    console.log('🔗 initRoomThemeSync called for room:', roomId);
    try {
      await this.hub.connect();
      console.log('✅ SignalR connected');
      
      await this.hub.joinRoom(roomId);
      console.log('✅ Joined room:', roomId);

      this.hub.offThemeChanged();
      this.hub.onThemeChanged((theme) => {
        console.log('📡 Theme changed event received:', theme);
        // Map theme from backend to frontend model
        const mappedTheme = this.mapBackendTheme(theme);
        console.log('📡 Mapped theme:', mappedTheme);
        this._currentTheme.set(mappedTheme);
        this.applyThemeToDocument(mappedTheme);
      });

      // Late joiner support - get current theme if room exists (silently fail if not)
      this.api.getCurrentTheme(roomId).subscribe({
        next: (theme) => {
          console.log('✅ Room theme loaded for late joiner:', theme.name);
          const mappedTheme = this.mapBackendTheme(theme);
          this._currentTheme.set(mappedTheme);
          this.applyThemeToDocument(mappedTheme);
        },
        error: (err) => {
          console.log('ℹ️ No existing theme in room (expected for new rooms):', err.status);
          // Silently ignore - expected when room doesn't exist or no theme applied
        }
      });
    } catch (e) {
      console.error('SignalR init error:', e);
    }
  }

  /** ✅ Apply theme: instant UI + save in DB */
  applyTheme(roomId: string, theme: ThemeModel) {
    console.log('🎨 applyTheme called with roomId:', roomId, 'theme:', theme);
    
    // 1. Apply immediately to UI
    this.applyThemeToDocument(theme);
    
    // 2. Set as current theme (triggers effect as backup)
    this._currentTheme.set(theme);
    
    // 3. Save to backend (only if we have a valid roomId)
    if (!roomId || roomId === '' || roomId === 'undefined') {
      console.log('ℹ️ Skipping backend save - no valid roomId');
      return;
    }
    
    // ✅ Save theme to room - backend should broadcast via SignalR
    this.api.applyTheme({ roomId, themeId: theme.id }).subscribe({
      next: () => {
        console.log('✅ Theme saved to room:', roomId);
        console.log('✅ Backend should now broadcast to all participants in room');
      },
      error: (err) => {
        console.error('❌ Failed to save theme to room:', err);
        console.error('❌ This means participants will NOT receive the theme change');
        // Silently ignore - room may not exist when browsing/editing themes
      }
    });
  }

  applyThemeToRoom(roomId: string, themeId: number) {
    return this.api.applyTheme({ roomId, themeId });
  }

  setSelectedTheme(theme: ThemeModel) {
    this._currentTheme.set(theme);
  }

  // ===== SESSION-BASED THEME MANAGEMENT =====

  /** ✅ SignalR: connect + join session + listen */
  async initSessionThemeSync(sessionCode: string) {
    console.log('🔗 initSessionThemeSync called for session:', sessionCode);
    try {
      await this.hub.connect();
      console.log('✅ SignalR connected');
      
      await this.hub.joinSession(sessionCode);
      console.log('✅ Joined session:', sessionCode);

      this.hub.offThemeChanged();
      this.hub.onThemeChanged((theme) => {
        console.log('📡 Session theme changed event received:', theme);
        // Map theme from backend to frontend model
        const mappedTheme = this.mapBackendTheme(theme);
        console.log('📡 Mapped session theme:', mappedTheme);
        this._currentTheme.set(mappedTheme);
        this.applyThemeToDocument(mappedTheme);
      });

      // Late joiner support - get current theme if session exists (silently fail if not)
      this.api.getCurrentSessionTheme(sessionCode).subscribe({
        next: (theme) => {
          console.log('✅ Session theme loaded for late joiner:', theme.name);
          const mappedTheme = this.mapBackendTheme(theme);
          this._currentTheme.set(mappedTheme);
          this.applyThemeToDocument(mappedTheme);
        },
        error: (err) => {
          console.log('ℹ️ No existing theme in session (expected for new sessions):', err.status);
          // Silently ignore - expected when session doesn't exist or no theme applied
        }
      });
    } catch (e) {
      console.error('SignalR session init error:', e);
    }
  }

  /** ✅ Apply theme to session: instant UI + save in DB */
  applyThemeToSession(sessionCode: string, theme: ThemeModel, hostId: string) {
    console.log('🎨 applyThemeToSession called with sessionCode:', sessionCode, 'theme:', theme);
    
    // 1. Apply immediately to UI
    this.applyThemeToDocument(theme);
    
    // 2. Set as current theme (triggers effect as backup)
    this._currentTheme.set(theme);
    
    // 3. Save to backend (session-based)
    this.api.applyThemeToSession({ sessionCode, themeId: theme.id }, hostId).subscribe({
      next: () => {
        console.log('✅ Theme saved to session:', sessionCode);
        console.log('✅ Backend should now broadcast to all participants in session');
      },
      error: (err) => {
        console.error('❌ Failed to save theme to session:', err);
        console.error('❌ This means participants will NOT receive the theme change');
      }
    });
  }

  /** ✅ Disconnect from session theme sync */
  async disconnectSessionThemeSync(sessionCode: string) {
    console.log('🔗 disconnectSessionThemeSync called for session:', sessionCode);
    try {
      await this.hub.leaveSession(sessionCode);
      this.hub.offThemeChanged();
      await this.hub.disconnect();
    } catch (e) {
      console.error('SignalR session disconnect error:', e);
    }
  }

  // ===== HOST-LEVEL THEME MANAGEMENT =====

  /** ✅ Apply theme to host: save as host preference */
  applyThemeToHost(themeId: number, hostId: string) {
    console.log('🎨 applyThemeToHost called with themeId:', themeId, 'hostId:', hostId);
    
    // Find the theme from loaded themes
    const theme = this.themes().find(t => t.id === themeId);
    if (!theme) {
      console.error('❌ Theme not found:', themeId);
      return;
    }

    // 1. Apply immediately to UI
    this.applyThemeToDocument(theme);
    
    // 2. Set as current theme
    this._currentTheme.set(theme);
    
    // 3. Save to backend (host-level)
    this.api.applyThemeToHost(themeId, hostId).subscribe({
      next: () => {
        console.log('✅ Theme saved to host preferences:', hostId);
      },
      error: (err) => {
        console.error('❌ Failed to save theme to host preferences:', err);
      }
    });
  }

  /** ✅ Load host's saved theme preference */
  loadHostTheme(hostId: string) {
    console.log('📥 loadHostTheme called for hostId:', hostId);
    
    this.api.getHostTheme(hostId).subscribe({
      next: (theme) => {
        console.log('✅ Host theme loaded:', theme.name);
        const mappedTheme = this.mapBackendTheme(theme);
        this._currentTheme.set(mappedTheme);
        this.applyThemeToDocument(mappedTheme);
      },
      error: (err) => {
        if (err.status === 404) {
          console.log('ℹ️ No saved theme for host (expected for new hosts)');
        } else {
          console.error('❌ Failed to load host theme:', err);
        }
      }
    });
  }

  /** ✅ Copy host theme to session when quiz is published */
  async copyHostThemeToSession(sessionCode: string, hostId: string) {
    console.log('🔄 copyHostThemeToSession called');
    console.log('🔄 sessionCode:', sessionCode);
    console.log('🔄 hostId:', hostId);
    
    this.api.getHostTheme(hostId).subscribe({
      next: (hostTheme) => {
        console.log('✅ Host theme retrieved:', hostTheme.name);
        const mappedTheme = this.mapBackendTheme(hostTheme);
        
        // Apply to session
        this.applyThemeToSession(sessionCode, mappedTheme, hostId);
        console.log('✅ Host theme copied to session');
      },
      error: (err) => {
        if (err.status === 404) {
          console.log('ℹ️ No host theme to copy (host has not selected a theme)');
        } else {
          console.error('❌ Failed to copy host theme to session:', err);
        }
      }
    });
  }

  /** Map backend theme (with primaryColor/secondaryColor) to frontend model */
  private mapBackendTheme(theme: any): ThemeModel {
    console.log('🔄 mapBackendTheme input:', theme);
    console.log('🔄 fontStyle from backend:', theme.fontStyle);
    
    // Decode backgroundColor to determine type
    const bgColor = theme.backgroundColor || '';
    let backgroundType: 'solid' | 'gradient' | 'image' = 'gradient';
    let backgroundValue = '';

    if (bgColor.startsWith('solid:')) {
      backgroundType = 'solid';
      const color = bgColor.substring(6);
      backgroundValue = color;
    } else if (bgColor.startsWith('image:')) {
      backgroundType = 'image';
      // Extract the URL from backgroundColor
      backgroundValue = bgColor.substring(6);
      // Also use imageUrl field if available from backend
      if (theme.imageUrl) {
        backgroundValue = theme.imageUrl;
      }
    } else {
      // gradient
      backgroundType = 'gradient';
      backgroundValue = `linear-gradient(135deg, ${theme.primaryColor || '#6c5ce7'}, ${theme.secondaryColor || '#a29bfe'})`;
    }

    // ✅ FIX: All themes from backend (custom themes) should be editable
    // Backend might return isDefault: true, but we need to override it
    // Only PREDEFINED_THEMES array should have isDefault: true
    const mappedTheme = {
      ...theme,
      gradientColor1: theme.primaryColor || theme.gradientColor1,
      gradientColor2: theme.secondaryColor || theme.gradientColor2,
      backgroundType: backgroundType,
      backgroundValue: backgroundValue,
      imageUrl: backgroundType === 'image' ? backgroundValue : undefined,
      cardBgColor: theme.cardBgColor || 'rgba(255,255,255,0.85)',
      category: theme.category || 'Custom',
      animation: theme.animation || 'none',
      isDefault: false  // ✅ Force custom themes to be editable
    };
    
    console.log('🔄 mapBackendTheme output:', mappedTheme);
    console.log('🔄 fontStyle preserved:', mappedTheme.fontStyle);
    
    return mappedTheme;
  }

  /** Merge predefined + db themes (db overrides by name) */
  private mergeThemes(predefined: ThemeModel[], dbThemes: ThemeModel[]) {
    const map = new Map<string, ThemeModel>();
    predefined.forEach(t => map.set(t.name.toLowerCase(), t));
    dbThemes.forEach(t => map.set(t.name.toLowerCase(), t));
    return Array.from(map.values());
  }

  /** ✅ Apply theme safely (no empty colors) */
  // private applyThemeToDocument(theme: ThemeModel) {
  //   const text = theme.textColor?.trim() || '#111111';
  //   const accent = theme.accentColor?.trim() || '#6c5ce7';
  //   const card = theme.cardBgColor?.trim() || 'rgba(255,255,255,0.85)';
  //   const bg = theme.backgroundValue?.trim() || '#f7f7fb';

  //   document.documentElement.style.setProperty('--app-text', text);
  //   document.documentElement.style.setProperty('--app-accent', accent);
  //   document.documentElement.style.setProperty('--card-bg', card);

  //   if (theme.backgroundType === 'image') {
  //     document.body.style.backgroundImage = `url('${bg}')`;
  //     document.body.style.backgroundSize = 'cover';
  //     document.body.style.backgroundPosition = 'center';
  //     document.body.style.backgroundRepeat = 'no-repeat';
  //     document.body.style.backgroundColor = 'transparent';
  //     document.body.style.background = 'transparent';
  //   } else {
  //     document.body.style.backgroundImage = 'none';
  //     document.body.style.background = bg;
  //   }

  //   document.body.style.color = `var(--app-text)`;
  //   document.body.style.transition = 'background 0.3s ease, color 0.3s ease';
  // }

  applyThemeToDocument(theme: any) {
    console.log('🎨 applyThemeToDocument START');
    console.log('🎨 Theme received:', theme);
    console.log('🎨 Theme fontStyle from parameter:', theme.fontStyle);
    
    // Check if we're on the landing page - if so, don't apply theme
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath === '/landing' || currentPath.includes('/landing')) {
      console.log('🚫 Skipping theme application - on landing page');
      return;
    }
    
    const body = document.body;
    const html = document.documentElement;

    // Clear all previous background properties and animation classes
    body.style.background = '';
    body.style.backgroundColor = '';
    body.style.backgroundImage = '';
    body.style.backgroundSize = '';
    body.style.backgroundPosition = '';
    body.style.backgroundRepeat = '';
    body.style.backgroundAttachment = '';
    html.style.background = '';
    html.style.backgroundColor = '';
    
    // Remove all animation classes
    body.classList.remove('anim-fade', 'anim-slide', 'anim-zoom', 'anim-pulse', 'anim-gradient-shift', 'anim-particles');
    
    // Remove particle element if exists
    const existingParticle = document.querySelector('.particle-extra');
    if (existingParticle) {
      existingParticle.remove();
    }

    // Apply text color
    const textColor = theme.textColor || '#ffffff';
    const accentColor = theme.accentColor || '#6c5ce7';
    const cardBg = theme.cardBgColor || 'rgba(255,255,255,0.85)';
    const fontStyle = theme.fontStyle || 'Arial';
    
    // Add proper font family with fallbacks
    let fontFamily = fontStyle;
    if (fontStyle === 'Arial') {
      fontFamily = 'Arial, Helvetica, sans-serif';
    } else if (fontStyle === 'Comic Sans MS') {
      fontFamily = '"Comic Sans MS", "Brush Script MT", cursive';
    } else if (fontStyle === 'Impact') {
      fontFamily = 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
    } else if (fontStyle === 'Pacifico') {
      fontFamily = '"Pacifico", "Brush Script MT", sans-serif';
    } else if (fontStyle === 'Bangers') {
      fontFamily = '"Bangers", "Impact", sans-serif';
    } else if (fontStyle === 'Lobster') {
      fontFamily = '"Lobster", Georgia, serif';
    }
    
    html.style.setProperty('--text-color', textColor);
    html.style.setProperty('--accent-color', accentColor);
    html.style.setProperty('--card-bg', cardBg);
    html.style.setProperty('--app-text', textColor);
    html.style.setProperty('--app-accent', accentColor);
    html.style.setProperty('--app-font', fontFamily);
    
    // Apply font to html element as well
    html.style.fontFamily = fontFamily;

    console.log('🎨 Text color:', textColor);
    console.log('🎨 Font style:', fontStyle);
    console.log('🎨 Font family:', fontFamily);

    // Map backend properties to gradient colors
    const gradientColor1 = theme.gradientColor1 || theme.primaryColor;
    const gradientColor2 = theme.gradientColor2 || theme.secondaryColor;
    
    console.log('🎨 Properties check:', {
      backgroundType: theme.backgroundType,
      backgroundValue: theme.backgroundValue,
      gradientColor1: gradientColor1,
      gradientColor2: gradientColor2,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor
    });

    // Priority 1: Use backgroundType and backgroundValue if explicitly set (handles images, solids, and predefined themes)
    if (theme.backgroundType && theme.backgroundValue) {
      const bgType = theme.backgroundType;
      const bgValue = theme.backgroundValue;
      
      console.log('🎨 Applying predefined theme:', bgType, bgValue);

      // Apply to HTML element for full coverage
      html.style.margin = '0';
      html.style.padding = '0';
      html.style.minHeight = '100vh';
      html.style.height = '100%';
      html.style.width = '100%';

      // Set base styles on body
      body.style.margin = '0';
      body.style.padding = '0';
      body.style.color = textColor;
      body.style.minHeight = '100vh';
      body.style.height = 'auto';
      body.style.width = '100%';
      body.style.setProperty('font-family', fontFamily, 'important');

      if (bgType === 'image') {
        html.style.backgroundColor = '#000';
        html.style.backgroundImage = `url("${bgValue}")`;
        html.style.backgroundSize = 'cover';
        html.style.backgroundPosition = 'center';
        html.style.backgroundRepeat = 'no-repeat';
        html.style.backgroundAttachment = 'fixed';
        
        body.style.backgroundColor = 'transparent';
        body.style.backgroundImage = `url("${bgValue}")`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundAttachment = 'fixed';
      } else if (bgType === 'solid') {
        // solid color
        html.style.background = bgValue;
        body.style.background = bgValue;
      } else {
        // gradient
        html.style.background = bgValue;
        body.style.background = bgValue;
      }
      
      console.log('✅ Predefined theme applied');
      // Apply animation after setting background
      this.applyAnimation(theme.animation || 'none');
      return;
    }

    // Priority 2: Use primaryColor/secondaryColor or gradientColor1/gradientColor2 for gradient themes without explicit backgroundType
    if (gradientColor1 && gradientColor2) {
      const gradientBg = `linear-gradient(135deg, ${gradientColor1}, ${gradientColor2})`;
      console.log('🎨 Applying gradient fallback:', gradientBg);
      
      // Apply to HTML element for full coverage
      html.style.margin = '0';
      html.style.padding = '0';
      html.style.minHeight = '100vh';
      html.style.height = '100%';
      html.style.width = '100%';
      html.style.background = gradientBg;
      
      // Apply to body
      body.style.margin = '0';
      body.style.padding = '0';
      body.style.color = textColor;
      body.style.background = gradientBg;
      body.style.minHeight = '100vh';
      body.style.height = 'auto';
      body.style.width = '100%';
      body.style.setProperty('font-family', fontFamily, 'important');
      
      console.log('✅ Custom gradient applied with font:', fontFamily);
      // Apply animation after setting background
      this.applyAnimation(theme.animation || 'none');
      return;
    }

    // Fallback
    console.log('⚠️ No background info, using default');
    
    // Apply to HTML element for full coverage
    html.style.margin = '0';
    html.style.padding = '0';
    html.style.minHeight = '100vh';
    html.style.height = '100%';
    html.style.width = '100%';
    html.style.background = '#f7f7fb';
    
    // Apply to body
    body.style.margin = '0';
    body.style.padding = '0';
    body.style.color = textColor;
    body.style.background = '#f7f7fb';
    body.style.minHeight = '100vh';
    body.style.height = 'auto';
    body.style.width = '100%';
    body.style.setProperty('font-family', fontFamily, 'important');
    
    // Apply animation class if specified
    this.applyAnimation(theme.animation || 'none');
  }

  private applyAnimation(animation: string) {
    const body = document.body;
    
    // Remove all existing animation classes
    body.classList.remove('anim-fade', 'anim-slide', 'anim-zoom', 'anim-pulse', 'anim-gradient-shift', 
                         'anim-wave', 'anim-stars', 'anim-particles', 'anim-floating-objects', 'anim-neon-pulse',
                         'anim-blinking', 'anim-moving-stars', 'anim-snow', 'anim-confetti', 'anim-galaxy');
    
    // Remove all extra elements if they exist
    const elementsToRemove = [
      '.particle-extra', '.star-extra', 
      '.floating-extra-1', '.floating-extra-2', '.floating-extra-3', '.floating-extra-4', '.floating-extra-5', '.floating-extra-6', '.floating-extra-7',
      '.neon-extra-1', '.neon-extra-2',
      '.blink-extra-1', '.blink-extra-2', '.blink-extra-3', '.blink-extra-4', '.blink-extra-5', '.blink-extra-6', '.blink-extra-7', '.blink-extra-8',
      '.moving-star-1', '.moving-star-2', '.moving-star-3', '.moving-star-4', '.moving-star-5', '.moving-star-6', '.moving-star-7',
      '.snow-1', '.snow-2', '.snow-3', '.snow-4', '.snow-5', '.snow-6', '.snow-7', '.snow-8', '.snow-9', '.snow-10',
      '.confetti-1', '.confetti-2', '.confetti-3', '.confetti-4', '.confetti-5', '.confetti-6', '.confetti-7', '.confetti-8', '.confetti-9', '.confetti-10',
      '.galaxy-star-1', '.galaxy-star-2', '.galaxy-star-3', '.galaxy-star-4', '.galaxy-star-5', '.galaxy-star-6', '.galaxy-star-7', '.galaxy-star-8', '.galaxy-star-9'
    ];
    
    elementsToRemove.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) el.remove();
    });
    
    // Add new animation class
    if (animation && animation !== 'none') {
      body.classList.add(`anim-${animation}`);
      
      // For particles animation, add extra particle element
      if (animation === 'particles') {
        const particle = document.createElement('div');
        particle.className = 'particle-extra';
        body.appendChild(particle);
      }
      
      // For stars animation, add extra star element
      if (animation === 'stars') {
        const star = document.createElement('div');
        star.className = 'star-extra';
        star.textContent = '⭐';
        body.appendChild(star);
      }
      
      // For matrix animation, add multiple code streams
      if (animation === 'matrix') {
        for (let i = 1; i <= 3; i++) {
          const matrix = document.createElement('div');
          matrix.className = `matrix-extra-${i}`;
          matrix.textContent = '01001010110101001010101010101001010110101001010101010101001010';
          body.appendChild(matrix);
        }
      }
      
      // For floating-objects animation, add cosmic objects
      if (animation === 'floating-objects') {
        const objects = ['🌙', '✨', '🌟', '💫', '🪐', '🌍', '☄️'];
        objects.forEach((emoji, i) => {
          const obj = document.createElement('div');
          obj.className = `floating-extra-${i + 1}`;
          obj.textContent = emoji;
          body.appendChild(obj);
        });
      }
      
      // For neon-pulse animation, add neon circles
      if (animation === 'neon-pulse') {
        for (let i = 1; i <= 2; i++) {
          const neon = document.createElement('div');
          neon.className = `neon-extra-${i}`;
          body.appendChild(neon);
        }
      }
      
      // For blinking animation
      if (animation === 'blinking') {
        const emojis = ['⭐', '✨', '💫', '🌟', '⭐', '✨', '💫', '🌠'];
        for (let i = 1; i <= 8; i++) {
          const blink = document.createElement('div');
          blink.className = `blink-extra-${i}`;
          blink.textContent = emojis[i - 1];
          body.appendChild(blink);
        }
      }
      
      // For moving-stars animation
      if (animation === 'moving-stars') {
        const emojis = ['✨', '⭐', '💫', '🌟', '✨', '⭐', '💫'];
        for (let i = 1; i <= 7; i++) {
          const star = document.createElement('div');
          star.className = `moving-star-${i}`;
          star.textContent = emojis[i - 1];
          body.appendChild(star);
        }
      }
      
      // For snow animation
      if (animation === 'snow') {
        const emojis = ['❄️', '☃️', '❄️', '⛄', '❄️', '☃️', '❄️', '⛄', '❄️', '☃️'];
        for (let i = 1; i <= 10; i++) {
          const snow = document.createElement('div');
          snow.className = `snow-${i}`;
          snow.textContent = emojis[i - 1];
          body.appendChild(snow);
        }
      }
      
      // For confetti animation
      if (animation === 'confetti') {
        const emojis = ['🎈', '🎊', '🎉', '🎁', '🎀', '🎂', '🎈', '🎊', '🎉', '🎁'];
        for (let i = 1; i <= 10; i++) {
          const confetti = document.createElement('div');
          confetti.className = `confetti-${i}`;
          confetti.textContent = emojis[i - 1];
          body.appendChild(confetti);
        }
      }
      
      // For galaxy animation
      if (animation === 'galaxy') {
        const emojis = ['⭐', '✨', '🌟', '💫', '🌠', '⭐', '✨', '🌟', '💫'];
        for (let i = 1; i <= 9; i++) {
          const star = document.createElement('div');
          star.className = `galaxy-star-${i}`;
          star.textContent = emojis[i - 1];
          body.appendChild(star);
        }
      }
    }
  }  
}
// Session-based theme management interfaces
export interface ApplySessionThemeRequest {
  sessionCode: string; // Using sessionCode instead of sessionId to match backend
  themeId: number;
}

// Keep the old room-based interface for backward compatibility
export interface ApplyThemeRequest {
  roomId: string;
  themeId: number;
}
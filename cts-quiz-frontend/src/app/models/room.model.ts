export interface ApplyThemeRequest {
  roomId: string;
  themeId: number;
}

export interface ApplyThemeToSessionRequest {
  sessionId: number;
  themeId: number;
}

export interface RoomModel {
  id: string;
  name: string;
  hostId: string;
  isActive: boolean;
  createdAt: string;
  themeId?: number;
}
// src/app/services/theme-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ThemeCreateModel, ThemeModel } from '../models/theme.model';
import { ApplyThemeRequest } from '../models/room.model';
import { ApplySessionThemeRequest } from '../models/session-theme.model';

@Injectable({ providedIn: 'root' })
export class ThemeApiService {
  // Normalize trailing slash: 'http://localhost:5195/api'
  private base = environment.apiUrl.replace(/\/+$/, '');

  constructor(private http: HttpClient) {}

  // ======================== THEMES ========================

  // GET /api/host/themes?hostId=H001
  getThemes(hostId: string) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.get<ThemeModel[]>(`${this.base}/host/themes`, { params });
  }

  // POST /api/host/themes/custom?hostId=H001
  createCustomTheme(hostId: string, payload: ThemeCreateModel) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.post<ThemeModel>(`${this.base}/host/themes/custom`, payload, { params });
  }

  // GET /api/host/themes/{id}
  getThemeById(id: number) {
    return this.http.get<ThemeModel>(`${this.base}/host/themes/${id}`);
  }

  // PUT /api/host/themes/{id}?hostId=H001
  updateTheme(themeId: number, hostId: string, payload: ThemeCreateModel) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.put<ThemeModel>(`${this.base}/host/themes/${themeId}`, payload, { params });
  }

  // DELETE /api/host/themes/{id}?hostId=H001
  deleteTheme(themeId: number, hostId: string) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.delete<void>(`${this.base}/host/themes/${themeId}`, { params });
  }

  // POST /api/host/themes/upload-image
  uploadThemeImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${this.base}/host/themes/upload-image`, formData);
  }

  // ======================== ROOMS ========================

  // GET /api/host/rooms/current-theme?roomId=R001
  getCurrentTheme(roomId: string) {
    const params = new HttpParams().set('roomId', roomId);
    return this.http.get<ThemeModel>(`${this.base}/host/rooms/current-theme`, { params });
  }

  // POST /api/host/rooms/apply-theme
  applyTheme(payload: ApplyThemeRequest) {
    return this.http.post<void>(`${this.base}/host/rooms/apply-theme`, payload);
  }

  // ======================== HOST THEMES ========================

  // POST /api/host/themes/{themeId}/apply-to-host?hostId=H001
  applyThemeToHost(themeId: number, hostId: string) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.post<void>(`${this.base}/host/themes/${themeId}/apply-to-host`, {}, { params });
  }

  // GET /api/host/themes/host/{hostId}
  getHostTheme(hostId: string) {
    return this.http.get<ThemeModel>(`${this.base}/host/themes/host/${hostId}`);
  }

  // ======================== SESSIONS ========================

  // GET /api/host/session-themes/current/{sessionCode}
  getCurrentSessionTheme(sessionCode: string) {
    return this.http.get<ThemeModel>(`${this.base}/host/session-themes/current/${sessionCode}`);
  }

  // POST /api/host/session-themes/apply?hostId=H001
  applyThemeToSession(payload: ApplySessionThemeRequest, hostId: string) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.post<void>(`${this.base}/host/session-themes/apply`, payload, { params });
  }

  // DELETE /api/host/session-themes/{sessionId}
  removeThemeFromSession(sessionId: number) {
    return this.http.delete<void>(`${this.base}/host/session-themes/${sessionId}`);
  }
}
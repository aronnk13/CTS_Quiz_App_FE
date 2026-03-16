import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LeaderboardEntry {
  leaderboardId: number;
  quizSessionId: number;
  participantId: string;
  participantName: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  totalTimeInMs: number;
  rank: number;
  lastUpdated: Date;
  correctPercentage?: number;
  formattedTime?: string;
}

export interface LeaderboardSnapshot {
  quizSessionId: number;
  quizTitle: string;
  totalParticipants: number;
  rankings: LeaderboardEntry[];
  showToParticipants: boolean;
  lastUpdated: Date;
}

export interface LeaderboardUpdate {
  sessionId: number;
  questionId: number;
  updatedEntries: LeaderboardEntry[];
  participantId: number;
  playerName: string;
  newTotalScore: number;
  scoreDelta: number;
  oldRank: number;
  newRank: number;
  rankDelta: number;
  streakCorrect: number;
}

export interface LeaderboardSettings {
  sessionId: number;
  showAfterEachQuestion: boolean;
  showAtEndOnly: boolean;
  isVisible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private apiUrl = `${environment.apiBaseUrl}/Host`;
  
  // Observable for leaderboard visibility state
  private leaderboardVisible$ = new BehaviorSubject<boolean>(false);
  public leaderboardVisibility$ = this.leaderboardVisible$.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get current leaderboard for a session
   */
  getLeaderboard(sessionId: number): Observable<LeaderboardSnapshot> {
    return this.http.get<LeaderboardSnapshot>(`${this.apiUrl}/Leaderboard/session/${sessionId}`);
  }

  /**
   * Get current leaderboard by session code
   */
  getLeaderboardByCode(sessionCode: string): Observable<LeaderboardSnapshot> {
    return this.http.get<LeaderboardSnapshot>(`${this.apiUrl}/Leaderboard/session/code/${sessionCode}`);
  }

  /**
   * Get leaderboard settings for a session
   */
  getLeaderboardSettings(sessionId: number): Observable<LeaderboardSettings> {
    return this.http.get<LeaderboardSettings>(`${this.apiUrl}/Leaderboard/settings/${sessionId}`);
  }

  /**
   * Update leaderboard visibility settings
   */
  updateLeaderboardSettings(settings: LeaderboardSettings): Observable<any> {
    return this.http.put(`${this.apiUrl}/Leaderboard/settings`, settings);
  }

  /**
   * Toggle leaderboard visibility for participants
   */
  toggleLeaderboardVisibility(sessionId: number, isVisible: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/Leaderboard/toggle-visibility`, {
      sessionId,
      isVisible
    });
  }

  /**
   * Set show after each question setting
   */
  setShowAfterEachQuestion(sessionId: number, enabled: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/Leaderboard/set-after-question`, {
      sessionId,
      enabled
    });
  }

  /**
   * Set show at end only setting
   */
  setShowAtEndOnly(sessionId: number, enabled: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/Leaderboard/set-end-only`, {
      sessionId,
      enabled
    });
  }

  /**
   * Trigger leaderboard display to participants
   */
  showLeaderboardToParticipants(sessionId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/Leaderboard/show/${sessionId}`, {});
  }

  /**
   * Hide leaderboard from participants
   */
  hideLeaderboardFromParticipants(sessionId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/Leaderboard/hide/${sessionId}`, {});
  }

  /**
   * Get leaderboard after specific question
   */
  getLeaderboardAfterQuestion(sessionId: number, questionId: number): Observable<LeaderboardSnapshot> {
    return this.http.get<LeaderboardSnapshot>(
      `${this.apiUrl}/Leaderboard/session/${sessionId}/question/${questionId}`
    );
  }

  /**
   * Update local visibility state
   */
  setVisibility(visible: boolean): void {
    this.leaderboardVisible$.next(visible);
  }

  /**
   * Get current visibility state
   */
  getVisibility(): boolean {
    return this.leaderboardVisible$.value;
  }
}

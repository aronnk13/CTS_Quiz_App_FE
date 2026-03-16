import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject, Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  QuizPublishData,
  QuizPublishRequest,
  QuizPublishResponse,
  QuizStatusUpdate,
  ParticipantJoinedData,
  QuizSessionData,
  QuizSessionEndData,
  ConnectionState,
  CreateQuizSessionRequest,
  CreateQuizSessionResponse
} from '../models/quiz-publish.models';

@Injectable({
  providedIn: 'root'
})
export class QuizPublishService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiBase = `${environment.apiUrl}/Host/QuizSession`;
  private hubConnection: signalR.HubConnection | null = null;
  private isIntentionalDisconnect = false; // Flag to track intentional disconnects
  
  // Connection state
  public connectionState$ = new BehaviorSubject<ConnectionState>('disconnected');
  
  // Real-time event streams
  public quizPublished$ = new Subject<QuizPublishData>();
  public quizStatusChanged$ = new Subject<QuizStatusUpdate>();
  public participantJoined$ = new Subject<ParticipantJoinedData>();
  public quizSessionStarted$ = new Subject<QuizSessionData>();
  public quizSessionEnded$ = new Subject<QuizSessionEndData>();
  
  constructor() {}

  /**
   * Initialize SignalR connection for quiz publishing
   * @param hostId - The host user ID
   */
  public async initializeConnection(hostId: string): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      console.log('[QuizPublish] Already connected');
      return;
    }

    // Reset intentional disconnect flag when starting a new connection
    this.isIntentionalDisconnect = false;
    this.connectionState$.next('connecting');

    // ✅ FIX: Get JWT token from AuthService
    const token = this.authService.getToken();
    console.log('🔐 [QuizPublish] JWT Token Status:', token ? '✅ Present' : '⚠️ Missing');
    console.log('   - Token length:', token?.length || 0, 'characters');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.signalRUrl}`, {
        // Allow transport fallback (WebSocket → SSE → Long Polling)
        // ✅ FIXED: Pass JWT token via accessTokenFactory
        accessTokenFactory: () => {
          const currentToken = this.authService.getToken();
          console.log('[QuizPublish] Sending token in SignalR connection:', currentToken ? '✅ Present' : '❌ Missing');
          return currentToken || '';
        }
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext: any) => {
          // Exponential backoff: 0s, 2s, 10s, 30s
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          return 30000;
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Register event handlers
    this.registerServerEvents();

    // Handle connection lifecycle
    this.hubConnection.onreconnecting(() => {
      console.warn('[QuizPublish] ⚠️ Reconnecting... (SignalR automatic reconnect)');
      console.log('[QuizPublish] Current time:', new Date().toISOString());
      this.connectionState$.next('connecting');
    });

    this.hubConnection.onreconnected(async () => {
      console.log('[QuizPublish] ✅ Reconnected successfully at', new Date().toISOString());
      this.connectionState$.next('connected');
      // Rejoin host group after reconnection
      try {
        await this.joinHostGroup(hostId);
        console.log('[QuizPublish] ✅ Successfully rejoined host group after reconnection');
      } catch (error) {
        console.error('[QuizPublish] 🔴 Failed to rejoin host group after reconnection:', {
          error: error,
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.hubConnection.onclose((error: any) => {
      const closeDetails = {
        error: error,
        errorMessage: error?.message || 'No error message',
        timestamp: new Date().toISOString(),
        connectionState: this.hubConnection?.state,
        wasIntentional: this.isIntentionalDisconnect
      };
      
      // Only log as error if it wasn't an intentional disconnect
      if (this.isIntentionalDisconnect) {
        console.log('[QuizPublish] ✓ Connection closed intentionally:', closeDetails);
      } else {
        console.error('[QuizPublish] ❌ Connection closed unexpectedly:', closeDetails);
      }
      
      this.connectionState$.next('disconnected');
      
      // Only attempt auto-reconnect if:
      // 1. It wasn't an intentional disconnect
      // 2. There was an error OR connection state indicates unexpected closure
      if (!this.isIntentionalDisconnect && (error || this.hubConnection?.state !== signalR.HubConnectionState.Disconnected)) {
        console.warn('[QuizPublish] ⚠️ Attempting to reconnect in 5 seconds...');
        console.log('[QuizPublish] Current connection state:', this.hubConnection?.state);
        
        setTimeout(() => {
          console.log('[QuizPublish] 🔄 Initiating auto-reconnect...');
          this.initializeConnection(hostId).catch(err => {
            console.error('[QuizPublish] 🔴 Auto-reconnect failed:', {
              error: err,
              message: err?.message,
              timestamp: new Date().toISOString()
            });
          });
        }, 5000);
      } else {
        console.log('[QuizPublish] Connection closed cleanly. No auto-reconnect triggered.');
      }
    });

    try {
      await this.hubConnection.start();
      console.log('[QuizPublish] ✅ Connected to Quiz Hub at', new Date().toISOString());
      console.log('[QuizPublish] Hub URL:', `${environment.signalRUrl}`);
      this.connectionState$.next('connected');
      
      // Join the host group to receive updates
      await this.joinHostGroup(hostId);
      console.log('[QuizPublish] ✅ Successfully joined host group');
    } catch (error) {
      console.error('[QuizPublish] 🔴 Connection failed:', {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        url: `${environment.signalRUrl}`,
        timestamp: new Date().toISOString()
      });
      this.connectionState$.next('disconnected');
      throw error;
    }
  }

  /**
   * Register handlers for server-to-client events
   */
  private registerServerEvents(): void {
    if (!this.hubConnection) return;

    // When a quiz is published
    this.hubConnection.on('QuizPublished', (data: QuizPublishData) => {
      console.log('[QuizPublish] Quiz published:', data);
      this.quizPublished$.next(data);
    });

    // When quiz status changes (DRAFT -> LIVE -> COMPLETED)
    this.hubConnection.on('QuizStatusChanged', (data: QuizStatusUpdate) => {
      console.log('[QuizPublish] Quiz status changed:', data);
      this.quizStatusChanged$.next(data);
    });

    // When a participant joins the quiz
    this.hubConnection.on('ParticipantJoinedQuiz', (data: ParticipantJoinedData) => {
      console.log('[QuizPublish] Participant joined:', data);
      this.participantJoined$.next(data);
    });

    // When quiz session starts
    this.hubConnection.on('QuizSessionStarted', (data: QuizSessionData) => {
      console.log('[QuizPublish] Quiz session started:', data);
      this.quizSessionStarted$.next(data);
    });

    // When quiz session ends
    this.hubConnection.on('QuizSessionEnded', (data: QuizSessionEndData) => {
      console.log('[QuizPublish] Quiz session ended:', data);
      this.quizSessionEnded$.next(data);
    });

    // When quiz ends (from host group notifications)
    this.hubConnection.on('QuizEnded', (data: any) => {
      console.log('[QuizPublish] Quiz ended (host notification):', data);
      this.quizSessionEnded$.next({
        quizNumber: data.sessionCode || data.SessionCode,
        endedAt: data.endedAt || data.EndedAt || new Date().toISOString()
      });
    });
  }

  /**
   * Join host group to receive updates for this host's quizzes
   */
  private async joinHostGroup(hostId: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      console.warn('[QuizPublish] Cannot join host group - not connected');
      return;
    }

    try {
      await this.hubConnection.invoke('JoinHostGroup', hostId);
      console.log(`[QuizPublish] Joined host group: ${hostId}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to join host group:', error);
    }
  }

  /**
   * Publish a quiz (make it LIVE) - Calls backend API
   * @param quizId - The quiz ID to publish
   * @param quizNumber - The quiz number
   * @param publishedBy - The host/user ID
   * @param startTime - Quiz start time
   * @param endTime - Quiz end time
   */
  public async publishQuiz(
    quizId: number, 
    quizNumber: string, 
    publishedBy: string,
    startTime?: string,
    endTime?: string
  ): Promise<QuizPublishResponse> {
    const url = `${this.apiBase}/publish`;
    
    // Validate start time is not in the past
    if (startTime) {
      const selectedStartDate = new Date(startTime);
      const now = new Date();
      
      if (selectedStartDate <= now) {
        throw new Error('Please select a future date and time for quiz publication. Past dates are not allowed.');
      }
    }
    
    // Validate end time is after start time
    if (startTime && endTime) {
      const selectedStartDate = new Date(startTime);
      const selectedEndDate = new Date(endTime);
      
      if (selectedEndDate <= selectedStartDate) {
        throw new Error('End time must be after start time.');
      }
    }
    
    const payload: QuizPublishRequest = {
      quizId,
      quizNumber,
      publishedBy,
      startTime: startTime || new Date().toISOString(),
      endTime: endTime
    };

    console.log('========================================');
    console.log('📤 PUBLISHING QUIZ - REQUEST PAYLOAD');
    console.log('========================================');
    console.log('URL:', url);
    console.log('Method: POST');
    console.log('Payload (JSON):', JSON.stringify(payload, null, 2));
    console.log('Payload (Object):', payload);
    console.log('========================================');

    try {
      const response = await firstValueFrom(
        this.http.post<QuizPublishResponse>(url, payload)
      );
      
      // Also record in Publish table for calendar
      await this.recordPublishForCalendar(quizId, publishedBy);
      
      console.log('========================================');
      console.log('✅ QUIZ PUBLISHED SUCCESSFULLY');
      console.log('========================================');
      console.log('Response (JSON):', JSON.stringify(response, null, 2));
      console.log('Response (Object):', response);
      console.log('========================================');
      return response;
    } catch (error: any) {
      console.error('========================================');
      console.error('❌ PUBLISH FAILED - ERROR DETAILS');
      console.error('========================================');
      console.error('Status:', error.status);
      console.error('Status Text:', error.statusText);
      console.error('Error Message:', error.error?.message || error.message);
      console.error('Backend Error (JSON):', JSON.stringify(error.error, null, 2));
      console.error('Full Error Object:', error);
      console.error('========================================');
      throw error;
    }
  }

  /**
   * Record quiz publish in Publish table for calendar tracking
   */
  private async recordPublishForCalendar(quizId: number, publishedBy: string): Promise<void> {
    const publishUrl = `${environment.apiUrl}/host/publish`;
    const publishPayload = {
      quizId: quizId,
      questionId: null,
      publishedBy: publishedBy
    };

    try {
      await firstValueFrom(
        this.http.post(publishUrl, publishPayload)
      );
      console.log('[QuizPublish] Recorded in Publish table for calendar');
    } catch (error) {
      console.error('[QuizPublish] Failed to record in Publish table:', error);
      // Don't throw error, as the main publish operation succeeded
    }
  }

  /**
   * Unpublish a quiz (set back to DRAFT) - Calls backend API
   */
  public async unpublishQuiz(quizNumber: string): Promise<void> {
    const url = `${this.apiBase}/unpublish?quizNumber=${encodeURIComponent(quizNumber)}`;
    
    try {
      await firstValueFrom(
        this.http.post(url, {})
      );
      console.log(`[QuizPublish] Unpublished quiz ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to unpublish quiz:', error);
      throw error;
    }
  }

  /**
   * Complete a quiz (set to COMPLETED) - Calls backend API
   */
  public async completeQuiz(quizNumber: string): Promise<void> {
    const url = `${this.apiBase}/complete?quizNumber=${encodeURIComponent(quizNumber)}`;
    
    try {
      await firstValueFrom(
        this.http.post(url, {})
      );
      console.log(`[QuizPublish] Completed quiz ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to complete quiz:', error);
      throw error;
    }
  }

  /**
   * Create a QuizSession - Designed for SignalR integration from result component
   * This creates a new entry in the QuizSession table with quiz_id, host_id, session_code, etc.
   * @param quizId - The quiz ID
   * @param hostId - The host user ID
   * @param quizNumber - The quiz number (used as session_code)
   * @param startedAt - Optional start time (defaults to now)
   * @param endedAt - Optional end time
   * @param status - Session status (default: 'Active')
   */
  public async createQuizSession(
    quizId: number,
    hostId: string,
    quizNumber: string,
    startedAt?: string,
    endedAt?: string,
    status: string = 'Active'
  ): Promise<CreateQuizSessionResponse> {
    const url = `${this.apiBase}/create`;
    
    const payload: CreateQuizSessionRequest = {
      quizId,
      hostId,
      sessionCode: quizNumber,
      startedAt: startedAt || new Date().toISOString(), // Use scheduled time or current time
      endedAt,
      status
    };

    console.log('========================================');
    console.log('📤 CREATING QUIZ SESSION - REQUEST PAYLOAD');
    console.log('========================================');
    console.log('URL:', url);
    console.log('Method: POST');
    console.log('Payload (JSON):', JSON.stringify(payload, null, 2));
    console.log('Payload (Object):', payload);
    console.log('========================================');

    try {
      const response = await firstValueFrom(
        this.http.post<CreateQuizSessionResponse>(url, payload)
      );
      console.log('========================================');
      console.log('✅ QUIZ SESSION CREATED SUCCESSFULLY');
      console.log('========================================');
      console.log('Response (JSON):', JSON.stringify(response, null, 2));
      console.log('Response (Object):', response);
      console.log('Session ID:', response.sessionId);
      console.log('Session Code:', response.sessionCode);
      console.log('========================================');
      return response;
    } catch (error: any) {
      console.error('========================================');
      console.error('❌ CREATE SESSION FAILED - ERROR DETAILS');
      console.error('========================================');
      console.error('Status:', error.status);
      console.error('Status Text:', error.statusText);
      console.error('Error Message:', error.error?.message || error.message);
      console.error('Backend Error (JSON):', JSON.stringify(error.error, null, 2));
      console.error('Full Error Object:', error);
      console.error('========================================');
      throw error;
    }
  }

  /**
   * Get quiz session by session code
   * @param sessionCode - The session code (quiz number)
   */
  public async getQuizSessionByCode(sessionCode: string): Promise<CreateQuizSessionResponse> {
    const url = `${this.apiBase}/by-code/${encodeURIComponent(sessionCode)}`;
    
    try {
      const response: any = await firstValueFrom(
        this.http.get<any>(url)
      );
      
      // Map to handle both PascalCase and camelCase
      return {
        sessionId: response.SessionId || response.sessionId,
        quizId: response.QuizId || response.quizId,
        hostId: response.HostId || response.hostId,
        sessionCode: response.SessionCode || response.sessionCode,
        startedAt: response.StartedAt || response.startedAt,
        endedAt: response.EndedAt || response.endedAt,
        status: response.Status || response.status,
        autoModeEnabled: response.AutoModeEnabled ?? response.autoModeEnabled ?? true,
        currentQuestionId: response.CurrentQuestionId || response.currentQuestionId,
        currentQuestionStartTime: response.CurrentQuestionStartTime || response.currentQuestionStartTime,
        timerDurationSeconds: response.TimerDurationSeconds || response.timerDurationSeconds
      };
    } catch (error: any) {
      // Don't log 404 errors as they're expected when sessions are completed/deleted
      if (error.status !== 404) {
        console.error('[QuizPublish] Failed to get quiz session:', error);
      }
      throw error;
    }
  }

  /**
   * Update quiz session status
   * @param sessionId - The session ID
   * @param status - New status (Active, Completed, etc.)
   */
  public async updateQuizSessionStatus(sessionId: number, status: string): Promise<CreateQuizSessionResponse> {
    const url = `${this.apiBase}/${sessionId}/status`;
    
    try {
      const response = await firstValueFrom(
        this.http.put<CreateQuizSessionResponse>(url, { status })
      );
      console.log(`[QuizPublish] Updated session ${sessionId} status to: ${status}`);
      return response;
    } catch (error) {
      console.error('[QuizPublish] Failed to update session status:', error);
      throw error;
    }
  }

  /**
   * Start quiz session (when participants can join and take quiz)
   */
  public async startQuizSession(quizNumber: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to Quiz Hub');
    }

    try {
      await this.hubConnection.invoke('StartQuizSession', quizNumber);
      console.log(`[QuizPublish] Started quiz session ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to start quiz session:', error);
      throw error;
    }
  }

  /**
   * End quiz session
   */
  public async endQuizSession(quizNumber: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to Quiz Hub');
    }

    try {
      await this.hubConnection.invoke('EndQuizSession', quizNumber);
      console.log(`[QuizPublish] Ended quiz session ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to end quiz session:', error);
      throw error;
    }
  }

  /**
   * Broadcast a message to all participants in a quiz
   */
  public async broadcastToParticipants(quizNumber: string, message: string, data?: any): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to Quiz Hub');
    }

    try {
      await this.hubConnection.invoke('BroadcastToQuizParticipants', quizNumber, message, data);
      console.log(`[QuizPublish] Broadcast message to quiz ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to broadcast message:', error);
      throw error;
    }
  }

  /**
   * Get active participants count for a quiz - Calls backend API
   */
  public async getActiveParticipants(quizNumber: string): Promise<number> {
    const url = `${this.apiBase}/${encodeURIComponent(quizNumber)}/participants/count`;
    
    try {
      const response = await firstValueFrom(
        this.http.get<{ quizNumber: string; participantCount: number }>(url)
      );
      return response.participantCount;
    } catch (error) {
      console.error('[QuizPublish] Failed to get active participants:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the hub
   */
  public async disconnect(): Promise<void> {
    if (this.hubConnection) {
      const currentState = this.hubConnection.state;
      console.log('[QuizPublish] Disconnecting... Current state:', currentState);
      
      // Set flag to prevent auto-reconnect
      this.isIntentionalDisconnect = true;
      
      try {
        // Only attempt to stop if not already disconnected
        if (currentState !== signalR.HubConnectionState.Disconnected && 
            currentState !== signalR.HubConnectionState.Disconnecting) {
          await this.hubConnection.stop();
          console.log('[QuizPublish] Successfully disconnected from Quiz Hub');
        } else {
          console.log('[QuizPublish] Already disconnected or disconnecting');
        }
        
        this.connectionState$.next('disconnected');
        this.hubConnection = null;
      } catch (error) {
        console.error('[QuizPublish] Error during disconnect:', error);
        // Even if there's an error, set connection to null and update state
        this.hubConnection = null;
        this.connectionState$.next('disconnected');
      } finally {
        // Reset the flag after a short delay
        setTimeout(() => {
          this.isIntentionalDisconnect = false;
        }, 1000);
      }
    } else {
      console.log('[QuizPublish] No active connection to disconnect');
    }
  }

  // Observable getters for components to subscribe
  public get connectionState(): Observable<ConnectionState> {
    return this.connectionState$.asObservable();
  }

  public get onQuizPublished(): Observable<QuizPublishData> {
    return this.quizPublished$.asObservable();
  }

  public get onQuizStatusChanged(): Observable<QuizStatusUpdate> {
    return this.quizStatusChanged$.asObservable();
  }

  public get onParticipantJoined(): Observable<ParticipantJoinedData> {
    return this.participantJoined$.asObservable();
  }

  public get onQuizSessionStarted(): Observable<QuizSessionData> {
    return this.quizSessionStarted$.asObservable();
  }

  public get onQuizSessionEnded(): Observable<QuizSessionEndData> {
    return this.quizSessionEnded$.asObservable();
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState$.value;
  }

  /**
   * Set show leaderboard after each question
   */
  public async setShowLeaderboardAfterQuestion(sessionCode: string, enabled: boolean): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to hub');
    }

    try {
      await this.hubConnection.invoke('SetShowLeaderboardAfterQuestion', sessionCode, enabled);
      console.log(`[QuizPublish] Set ShowLeaderboardAfterQuestion to ${enabled} for session ${sessionCode}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to set ShowLeaderboardAfterQuestion:', error);
      throw error;
    }
  }

  /**
   * Set show leaderboard at end only
   */
  public async setShowLeaderboardAtEndOnly(sessionCode: string, enabled: boolean): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to hub');
    }

    try {
      await this.hubConnection.invoke('SetShowLeaderboardAtEndOnly', sessionCode, enabled);
      console.log(`[QuizPublish] Set ShowLeaderboardAtEndOnly to ${enabled} for session ${sessionCode}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to set ShowLeaderboardAtEndOnly:', error);
      throw error;
    }
  }

  /**
   * Set leaderboard display duration in seconds
   */
  public async setLeaderboardDisplayDuration(sessionCode: string, durationSeconds: number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to hub');
    }

    try {
      await this.hubConnection.invoke('SetLeaderboardDisplayDuration', sessionCode, durationSeconds);
      console.log(`[QuizPublish] Set leaderboard display duration to ${durationSeconds}s for session ${sessionCode}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to set leaderboard display duration:', error);
      throw error;
    }
  }

  /**
   * Notify backend to start quiz automatically in auto-mode
   * This initializes CurrentQuestionId, CurrentQuestionStartTime, and TimerDurationSeconds
   */
  public async notifyAutoStartQuiz(sessionCode: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to hub');
    }

    try {
      await this.hubConnection.invoke('NotifyAutoStartQuiz', sessionCode);
      console.log(`[QuizPublish] Notified auto-start for session ${sessionCode}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to notify auto-start:', error);
      throw error;
    }
  }

  /**
   * Get connection status diagnostics
   * Useful for debugging connection issues
   */
  public getConnectionDiagnostics(): {
    isConnected: boolean;
    connectionState: string;
    hubUrl: string;
    timestamp: string;
    connectionDetails: any;
  } {
    const state = this.hubConnection?.state;
    const stateNames: { [key: number]: string } = {
      0: 'CONNECTING',
      1: 'CONNECTED',
      2: 'RECONNECTING',
      3: 'DISCONNECTING',
      4: 'DISCONNECTED'
    };

    let connectionStateName = 'UNKNOWN';
    if (state !== undefined && typeof state === 'number' && state in stateNames) {
      connectionStateName = stateNames[state];
    }

    const diagnostics = {
      isConnected: state === signalR.HubConnectionState.Connected,
      connectionState: connectionStateName,
      hubUrl: `${environment.signalRUrl}`,
      timestamp: new Date().toISOString(),
      connectionDetails: {
        state: state,
        hasConnection: !!this.hubConnection,
        connectionId: (this.hubConnection as any)?.connectionId || 'N/A'
      }
    };

    console.log('[QuizPublish] 🔍 Connection Diagnostics:', diagnostics);
    return diagnostics;
  }

  /**
   * Force reconnect
   */
  public async forceReconnect(hostId: string): Promise<void> {
    console.log('[QuizPublish] 🔄 Force reconnecting...');
    await this.disconnect();
    await this.initializeConnection(hostId);
    console.log('[QuizPublish] ✅ Force reconnect completed');
  }

  /**
   * Get JWT token from AuthService
   */
  private getToken(): string | null {
    return this.authService.getToken();
  }

}
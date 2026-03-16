import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { LeaderboardService } from './leaderboard.service';
import { SessionData, QuestionData, ParticipantDetail, ConnectionStatus } from '../models/host-lobby.model';
import { Subject, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HostLobbyService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private leaderboardService = inject(LeaderboardService);

  // SignalR Hub Connection
  private hubConnection?: signalR.HubConnection;

  // Connection state observables
  public connectionStatus$ = new BehaviorSubject<ConnectionStatus>('connecting');

  // SignalR event streams
  public hostPresenceStatus$ = new Subject<any>();
  public sessionStateSync$ = new Subject<any>();
  public submissionProgressUpdate$ = new Subject<any>();
  public quizEndedConfirmation$ = new Subject<any>();
  public participantCountUpdated$ = new Subject<number>();
  public quizStarted$ = new Subject<string>();
  public joinedHostSession$ = new Subject<string>();
  public joinedSession$ = new Subject<string>();
  public sessionSync$ = new Subject<any>();
  public forceNavigateToQuestion$ = new Subject<any>();
  public navigationCommandSent$ = new Subject<number>();
  public timerSync$ = new Subject<any>();
  public participantDetails$ = new Subject<any>();
  public leaderboardDurationUpdated$ = new Subject<any>();
  public leaderboardSettingUpdated$ = new Subject<any>();
  public leaderboardUpdateTopN$ = new Subject<any>();
  public showPodium$ = new Subject<any>();
  public leaderboardUpdateProgressive$ = new Subject<any>();
  public leaderboardUpdateCategory$ = new Subject<any>();
  public optionCountsUpdate$ = new Subject<any>();
  public personalRankUpdate$ = new Subject<any>();
  public quizEnded$ = new Subject<any>();
  public showLeaderboardAtEnd$ = new Subject<any>();
  public reconnecting$ = new Subject<Error | undefined>();
  public reconnected$ = new Subject<string | undefined>();
  public connectionClosed$ = new Subject<Error | undefined>();

  constructor() {}

  /**
   * Initialize SignalR connection for host lobby
   */
  async initializeSignalR(sessionCode: string): Promise<void> {
    try {
      this.connectionStatus$.next('connecting');

      // Get JWT token from AuthService
      const token = this.authService.getToken();
      console.log('🔐 [HostLobbyService] JWT Token Status:', token ? '✅ Present' : '⚠️ Missing');
      console.log('   - Token length:', token?.length || 0, 'characters');

      // When using skipNegotiation with WebSocket, pass token via query string
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${environment.signalRUrl}?access_token=${encodeURIComponent(token || '')}`, {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Add reconnection event handlers
      this.hubConnection.onreconnecting((error: Error | undefined) => {
        console.warn('⚠️ [HostLobbyService] SignalR reconnecting...', error);
        this.connectionStatus$.next('connecting');
        this.reconnecting$.next(error);
      });

      this.hubConnection.onreconnected(async (connectionId: string | undefined) => {
        console.log('✅ [HostLobbyService] SignalR reconnected!', connectionId);
        this.connectionStatus$.next('connected');
        this.reconnected$.next(connectionId);

        // Rejoin groups after reconnection
        try {
          await this.hubConnection!.invoke('JoinHostSession', sessionCode);
          await this.hubConnection!.invoke('JoinSession', sessionCode);
        } catch (error) {
          console.error('❌ [HostLobbyService] Failed to rejoin after reconnection:', error);
        }
      });

      this.hubConnection.onclose((error: Error | undefined) => {
        console.error('❌ [HostLobbyService] SignalR connection closed!', error);
        this.connectionStatus$.next('disconnected');
        this.connectionClosed$.next(error);
      });

      // Register event handlers
      this.registerSignalRHandlers();

      // Start connection
      await this.hubConnection.start();
      console.log('[HostLobbyService] SignalR connected');

      // Check if host is already present (rejoining)
      await this.hubConnection.invoke('CheckHostPresence', sessionCode);

      // Join session as host (join host-specific group)
      await this.hubConnection.invoke('JoinHostSession', sessionCode);
      console.log('[HostLobbyService] Joined host session group');

      // Also join regular session group to receive QuizStarted events
      await this.hubConnection.invoke('JoinSession', sessionCode);
      console.log('[HostLobbyService] Joined regular session group');

      this.connectionStatus$.next('connected');
    } catch (error) {
      console.error('[HostLobbyService] SignalR connection failed:', error);
      this.connectionStatus$.next('disconnected');
      throw error;
    }
  }

  /**
   * Register SignalR event handlers
   */
  private registerSignalRHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('HostPresenceStatus', (data: any) => this.hostPresenceStatus$.next(data));
    this.hubConnection.on('SessionStateSync', (data: any) => this.sessionStateSync$.next(data));
    this.hubConnection.on('SubmissionProgressUpdate', (data: any) => this.submissionProgressUpdate$.next(data));
    this.hubConnection.on('QuizEndedConfirmation', (data: any) => this.quizEndedConfirmation$.next(data));
    this.hubConnection.on('ParticipantCountUpdated', (count: number) => this.participantCountUpdated$.next(count));
    this.hubConnection.on('QuizStarted', (sessionCode: string) => this.quizStarted$.next(sessionCode));
    this.hubConnection.on('JoinedHostSession', (sessionCode: string) => this.joinedHostSession$.next(sessionCode));
    this.hubConnection.on('JoinedSession', (sessionCode: string) => this.joinedSession$.next(sessionCode));
    this.hubConnection.on('SessionSync', (data: any) => this.sessionSync$.next(data));
    this.hubConnection.on('ForceNavigateToQuestion', (data: any) => this.forceNavigateToQuestion$.next(data));
    this.hubConnection.on('NavigationCommandSent', (questionId: number) => this.navigationCommandSent$.next(questionId));
    this.hubConnection.on('TimerSync', (data: any) => this.timerSync$.next(data));
    this.hubConnection.on('ParticipantDetails', (data: any) => this.participantDetails$.next(data));
    this.hubConnection.on('LeaderboardDurationUpdated', (data: any) => this.leaderboardDurationUpdated$.next(data));
    this.hubConnection.on('LeaderboardSettingUpdated', (data: any) => this.leaderboardSettingUpdated$.next(data));
    this.hubConnection.on('LeaderboardUpdateTopN', (data: any) => this.leaderboardUpdateTopN$.next(data));
    this.hubConnection.on('ShowPodium', (data: any) => this.showPodium$.next(data));
    this.hubConnection.on('LeaderboardUpdateProgressive', (data: any) => this.leaderboardUpdateProgressive$.next(data));
    this.hubConnection.on('LeaderboardUpdateCategory', (data: any) => this.leaderboardUpdateCategory$.next(data));
    this.hubConnection.on('OptionCountsUpdate', (data: any) => this.optionCountsUpdate$.next(data));
    this.hubConnection.on('PersonalRankUpdate', (data: any) => this.personalRankUpdate$.next(data));
    this.hubConnection.on('QuizEnded', (data: any) => this.quizEnded$.next(data));
    this.hubConnection.on('ShowLeaderboardAtEnd', (data: any) => this.showLeaderboardAtEnd$.next(data));
  }

  /**
   * Disconnect from SignalR
   */
  async disconnectSignalR(sessionCode: string): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.invoke('LeaveHostSession', sessionCode);
        await this.hubConnection.stop();
        console.log('[HostLobbyService] SignalR disconnected');
      } catch (error) {
        console.error('[HostLobbyService] Error disconnecting:', error);
      }
    }
  }

  /**
   * Invoke SignalR method
   */
  async invokeHub(method: string, ...args: any[]): Promise<any> {
    if (!this.hubConnection || this.connectionStatus$.value !== 'connected') {
      throw new Error('Not connected to SignalR hub');
    }
    return await this.hubConnection.invoke(method, ...args);
  }

  /**
   * Load session data from backend
   */
  async loadSessionData(sessionCode: string): Promise<{ session: SessionData; questions: QuestionData[] }> {
    // Get session data
    const sessionResponse = await fetch(`${environment.apiBaseUrl}/Host/QuizSession/by-code/${sessionCode}`);
    if (!sessionResponse.ok) {
      throw new Error(`Failed to fetch session: ${sessionResponse.statusText}`);
    }
    const session = await sessionResponse.json();

    // Get quiz questions
    const questionsResponse = await fetch(`${environment.apiBaseUrl}/Participate/Session/${session.sessionId}/questions`);
    if (!questionsResponse.ok) {
      throw new Error(`Failed to fetch questions: ${questionsResponse.statusText}`);
    }
    const data = await questionsResponse.json();

    const sessionData: SessionData = {
      sessionId: session.sessionId,
      sessionCode: session.sessionCode || sessionCode,
      quizName: data.quizTitle || session.quizName || 'Quiz',
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      status: session.status || 'Active',
      totalQuestions: data.questions?.length || 0
    };

    const questions: QuestionData[] = data.questions?.map((q: any, index: number) => ({
      questionId: q.questionId,
      questionText: q.questionText,
      timerSeconds: q.timerSeconds || 30,
      questionNumber: index + 1
    })) || [];

    return { session: sessionData, questions };
  }

  /**
   * Get participant count
   */
  async getParticipantCount(sessionId: number): Promise<number> {
    try {
      const response = await fetch(`${environment.apiBaseUrl}/Host/QuizSession/${sessionId}/participants/count`);
      if (response.ok) {
        const countData = await response.json();
        return countData.count || countData.participantCount || 0;
      }
    } catch (error) {
      console.warn('[HostLobbyService] Could not fetch participant count:', error);
    }
    return 0;
  }

  /**
   * Load participant details using Leaderboard API
   */
  async loadParticipantDetails(sessionId: number): Promise<ParticipantDetail[]> {
    try {
      const leaderboard = await this.leaderboardService.getLeaderboard(sessionId).toPromise();
      
      if (leaderboard && leaderboard.rankings) {
        return leaderboard.rankings.map((entry: any) => ({
          participantId: entry.participantId || 0,
          nickname: entry.participantName || 'Unknown',
          totalScore: entry.score || 0,
          hasSubmittedCurrentQuestion: entry.hasSubmittedCurrentQuestion || false,
          totalAnswered: entry.totalAnswered || 0,
          correctAnswers: entry.correctAnswers || 0,
          joinedAt: entry.joinedAt
        }));
      }
    } catch (error) {
      console.error('[HostLobbyService] Failed to load participant details:', error);
    }
    return [];
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionCode: string): Promise<any> {
    const response = await fetch(`${environment.apiBaseUrl}/Host/QuizSession/by-code/${sessionCode}`);
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch session status');
  }

  /**
   * Get leaderboard data
   */
  async getLeaderboardData(sessionId: number, type: string): Promise<any> {
    const url = `${environment.apiUrl}/Host/Leaderboard/${type}/${sessionId}`;
    return await this.http.get(url).toPromise();
  }

  /**
   * Get option counts data
   */
  async getOptionCountsData(sessionId: number, questionId: number): Promise<any> {
    const url = `${environment.apiUrl}/Host/Leaderboard/option-counts/${sessionId}/${questionId}`;
    return await this.http.get(url).toPromise();
  }
 
  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionStatus$.value === 'connected';
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus$.value;
  }
}

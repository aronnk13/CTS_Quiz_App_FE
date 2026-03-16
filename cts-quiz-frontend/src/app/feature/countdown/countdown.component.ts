import { Component, OnDestroy, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import * as signalR from '@microsoft/signalr';
import { ParticipantService } from '../../services/participant.service';

interface SessionData {
  sessionId: number;
  quizId: number;
  quizTitle: string;
  startedAt: string;
  endedAt: string;
  status: string;
}

@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './countdown.component.html',
  styleUrls: ['./countdown.component.css']
})
export class CountdownComponent implements OnInit, OnDestroy {
  sessionData: SessionData | null = null;
  participantName: string = '';
  sessionCode: string = '';
  sessionType: string = 'quiz'; // quiz, survey, or poll
  contentTitle: string = 'Quiz'; // Display title
  
  quizStartTime: Date | null = null;
  quizEndTime: Date | null = null;
  
  timeUntilStart = signal({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  isWaiting = signal(true);
  hasStarted = signal(false);
  lastBackWarnAt: number = 0;

  private intervalId?: number;
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private participantService = inject(ParticipantService);
  
  private hubConnection?: signalR.HubConnection;

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    console.log('[Countdown] Component initialized');

    // Load session data from localStorage
    const sessionDataStr = localStorage.getItem('sessionData');
    const participantNameStr = localStorage.getItem('participantName');
    const sessionTypeStr = localStorage.getItem('sessionType');
    
    console.log('[Countdown] localStorage data:');
    console.log('  - sessionData:', sessionDataStr);
    console.log('  - participantName:', participantNameStr);
    console.log('  - sessionType:', sessionTypeStr);
    
    if (!sessionDataStr) {
      console.error('[Countdown] No session data found in localStorage');
      this.snackBar.open('No session data found. Please join a quiz first.', 'Close', { duration: 3000 });
      this.router.navigate(['/participant']);
      return;
    }

    try {
      this.sessionData = JSON.parse(sessionDataStr);
      console.log('[Countdown] Parsed sessionData:', this.sessionData);
      
      // Fetch live session data from backend to get accurate start/end times
      if (this.sessionData?.sessionId) {
        try {
          console.log('[Countdown] Fetching live session data from backend for sessionId:', this.sessionData.sessionId);
          const liveSession = await this.participantService.getSessionQuestions(this.sessionData.sessionId);
          console.log('[Countdown] Live session data received:', liveSession);
          
          // Update with live start time from backend
          if (liveSession.startedAt) {
            this.sessionData.startedAt = liveSession.startedAt;
            console.log('[Countdown] ===== START TIME DEBUG =====');
            console.log('[Countdown] Raw startedAt from backend:', liveSession.startedAt);
            console.log('[Countdown] Type:', typeof liveSession.startedAt);
            console.log('[Countdown] ServerTime from backend:', liveSession.serverTime);
            console.log('[Countdown] ===========================');
          } else {
            console.warn('[Countdown] No startedAt in live session data');
          }
        } catch (error) {
          console.error('[Countdown] Failed to fetch live session data:', error);
          console.log('[Countdown] Continuing with cached data from localStorage');
          // Continue with cached data if API fails
        }
      }
    } catch (error) {
      console.error('[Countdown] Failed to parse sessionData:', error);
      this.snackBar.open('Invalid session data. Please try joining again.', 'Close', { duration: 3000 });
      this.router.navigate(['/participant']);
      return;
    }
    
    this.participantName = participantNameStr || 'Participant';
    
    // Get session code and sessionType from query params (prioritize query params over localStorage)
    this.route.queryParams.subscribe(params => {
      console.log('[Countdown] Query params:', params);
      this.sessionCode = params['code'] || '';
      // Use sessionType from query params if available, otherwise fall back to localStorage
      this.sessionType = params['sessionType'] || sessionTypeStr || 'quiz';
      
      // Ensure sessionType is lowercase for consistency
      this.sessionType = this.sessionType.toLowerCase();
      console.log('[Countdown] Session type:', this.sessionType);
      
      // Set display title based on type
      if (this.sessionType === 'survey') {
        this.contentTitle = this.sessionData?.quizTitle || 'Survey';
      } else if (this.sessionType === 'poll') {
        this.contentTitle = this.sessionData?.quizTitle || 'Poll';
      } else {
        this.contentTitle = this.sessionData?.quizTitle || 'Quiz';
      }
      console.log('[Countdown] Content title:', this.contentTitle);
    });

    if (this.sessionData) {
      console.log('[Countdown] Session data:', this.sessionData);
      
      // Parse dates with validation
      if (this.sessionData.startedAt) {
        const startDate = new Date(this.sessionData.startedAt);
        console.log('[Countdown] ===== DATE PARSING =====');
        console.log('[Countdown] Input string:', this.sessionData.startedAt);
        console.log('[Countdown] Parsed Date object:', startDate);
        console.log('[Countdown] Date ISO string:', startDate.toISOString());
        console.log('[Countdown] Date local string:', startDate.toLocaleString());
        console.log('[Countdown] Current time:', new Date().toISOString());
        console.log('[Countdown] =======================');
        if (!isNaN(startDate.getTime())) {
          this.quizStartTime = startDate;
          console.log('[Countdown] Valid start time:', this.quizStartTime);
        } else {
          console.error('[Countdown] Invalid startedAt date:', this.sessionData.startedAt);
          this.snackBar.open('Invalid quiz start time. Please contact the host.', 'Close', { duration: 5000 });
        }
      } else {
        console.warn('[Countdown] No startedAt in session data');
      }
      
      if (this.sessionData.endedAt) {
        const endDate = new Date(this.sessionData.endedAt);
        if (!isNaN(endDate.getTime())) {
          this.quizEndTime = endDate;
          console.log('[Countdown] Valid end time:', this.quizEndTime);
        } else {
          console.error('[Countdown] Invalid endedAt date:', this.sessionData.endedAt);
        }
      } else {
        console.warn('[Countdown] No endedAt in session data');
      }
      
      // Check if quiz has a valid start time and if it's in the future
      // Auto-navigate based on time for all session types
      if (this.quizStartTime) {
        const now = new Date();
        const timeDiff = this.quizStartTime.getTime() - now.getTime();
        const timeDiffSeconds = Math.floor(timeDiff / 1000);
        
        console.log('[Countdown] Time check:');
        console.log('[Countdown] - Current time:', now.toLocaleString());
        console.log('[Countdown] - Start time:', this.quizStartTime.toLocaleString());
        console.log('[Countdown] - Time difference:', timeDiffSeconds, 'seconds');
        console.log('[Countdown] - Session type:', this.sessionType);
        
        // Only consider session as "already started" if start time is more than 5 seconds in the past
        // This prevents treating newly created sessions as "already started"
        if (timeDiff < -5000) {
          console.log('[Countdown] Session already started (more than 5 seconds in the past), navigating');
          this.hasStarted.set(true);
          this.isWaiting.set(false);
          this.navigateToQuiz();
        } else if (timeDiff < 0) {
          // If within 5 seconds, treat as starting now
          console.log('[Countdown] Session starting now (within 5 seconds)');
          this.hasStarted.set(true);
          this.isWaiting.set(false);
          this.navigateToQuiz();
        } else {
          // Start countdown timer for future start time
          console.log('[Countdown] Session starts in the future - showing countdown');
          this.hasStarted.set(false);
          this.isWaiting.set(true);
          this.startCountdown();
          
          // Initialize SignalR connection for host-triggered start (backup mechanism)
          this.initializeSignalR();
        }
      } else {
        // No start time set - wait for host to start via SignalR
        console.log('[Countdown] No start time set, waiting for host to start');
        console.log('[Countdown] - Session type:', this.sessionType);
        this.hasStarted.set(false);
        this.isWaiting.set(true);
        this.initializeSignalR();
      }
    }
  }

  @HostListener('window:popstate')
  onPopState(): void {
    this.lockBackNavigation();

    const now = Date.now();
    if (now - this.lastBackWarnAt > 2000) {
      this.lastBackWarnAt = now;
      this.snackBar.open('Back navigation is disabled while waiting for the quiz.', 'Close', { duration: 2000 });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    event.preventDefault();
    event.returnValue = '';
  }

  private lockBackNavigation(): void {
    window.history.pushState(null, '', window.location.href);
  }

  private initializeSignalR(): void {
    // Prevent multiple connections
    if (this.hubConnection) {
      console.log('[Countdown] SignalR connection already exists, skipping initialization');
      return;
    }

    console.log('[Countdown] Initializing SignalR connection to quizSessionHub');
    
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('', {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000]) // Retry intervals in milliseconds
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Handle reconnection events
    this.hubConnection.onreconnecting((error) => {
      console.log('[Countdown] SignalR reconnecting...', error);
    });

    this.hubConnection.onreconnected((connectionId) => {
      console.log('[Countdown] SignalR reconnected with ID:', connectionId);
      // Rejoin the session after reconnection
      if (this.sessionCode) {
        this.hubConnection?.invoke('JoinSession', this.sessionCode)
          .catch(err => console.error('[Countdown] Error rejoining session after reconnect:', err));
      }
    });

    this.hubConnection.onclose((error) => {
      console.log('[Countdown] SignalR connection closed', error);
    });

    // Listen for quiz/survey/poll started event
    this.hubConnection.on('QuizStarted', (sessionCode: string) => {
      console.log('[Countdown] Session started notification received for:', sessionCode);
      this.hasStarted.set(true);
      this.isWaiting.set(false);
      this.stopCountdown();
      this.snackBar.open(`${this.sessionType.charAt(0).toUpperCase() + this.sessionType.slice(1)} is starting now!`, 'Close', { duration: 2000 });
      setTimeout(() => this.navigateToQuiz(), 1000);
    });

    // Start connection
    this.hubConnection.start()
      .then(() => {
        console.log('[Countdown] SignalR Connected successfully');
        console.log('[Countdown] Joining session:', this.sessionCode);
        if (this.sessionCode) {
          return this.hubConnection?.invoke('JoinSession', this.sessionCode);
        }
        return Promise.resolve();
      })
      .then(() => {
        console.log('[Countdown] Successfully joined session:', this.sessionCode);
      })
      .catch((err: any) => {
        console.error('[Countdown] Error with SignalR:', err);
        this.snackBar.open('Connection error. Waiting room may not update automatically.', 'Close', { duration: 5000 });
      });
  }

  private startCountdown(): void {
    this.updateTimeRemaining();
    
    this.intervalId = setInterval(() => {
      this.updateTimeRemaining();
      
      // When countdown reaches zero
      if (this.quizStartTime && new Date() >= this.quizStartTime) {
        // Auto-navigate when time is reached for all session types
        console.log('[Countdown] Time reached - navigating to session');
        this.hasStarted.set(true);
        this.isWaiting.set(false);
        this.stopCountdown();
        this.navigateToQuiz();
      }
    }, 1000) as unknown as number;
  }

  private updateTimeRemaining(): void {
    if (!this.quizStartTime) {
      console.log('[Countdown] updateTimeRemaining - no quizStartTime set');
      return;
    }

    const now = new Date();
    const diff = this.quizStartTime.getTime() - now.getTime();
    console.log('[Countdown] updateTimeRemaining - now:', now.toISOString(), 'start:', this.quizStartTime.toISOString(), 'diff (ms):', diff);

    if (diff <= 0) {
      console.log('[Countdown] updateTimeRemaining - time has passed, setting to zero');
      this.timeUntilStart.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    this.timeUntilStart.set({ days, hours, minutes, seconds });
  }

  private stopCountdown(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private navigateToQuiz(): void {
    // Use the component's sessionType property instead of reading from localStorage again
    const sessionType = (this.sessionType || 'quiz').toLowerCase();
    
    // Get IDs from query params first, then fall back to localStorage
    let pollId = '';
    let surveyId = '';
    let quizId = '';
    let participantId = '';
    
    this.route.queryParams.subscribe(params => {
      pollId = params['pollId'] || localStorage.getItem('currentPollId') || localStorage.getItem('pollId') || '';
      surveyId = params['surveyId'] || localStorage.getItem('currentSurveyId') || localStorage.getItem('surveyId') || '';
      quizId = params['quizId'] || localStorage.getItem('currentQuizId') || localStorage.getItem('quizId') || '';
      participantId = params['participantId'] || localStorage.getItem('participantId') || '';
    }).unsubscribe();
    
    console.log('[Countdown] navigateToQuiz called');
    console.log('[Countdown] - Component sessionType:', this.sessionType);
    console.log('[Countdown] - Using sessionType:', sessionType);
    console.log('[Countdown] - pollId:', pollId);
    console.log('[Countdown] - surveyId:', surveyId);
    console.log('[Countdown] - quizId:', quizId);
    console.log('[Countdown] - participantId:', participantId);
    console.log('[Countdown] - sessionCode:', this.sessionCode);
    
    if (sessionType === 'poll' && pollId && participantId) {
      console.log('[Countdown] Redirecting poll to quiz component');
      this.router.navigate(['/quiz'], {
        queryParams: { 
          sessionCode: this.sessionCode,
          participantId: participantId,
          pollId: pollId,
          sessionType: 'poll'
        }
      });
    } else if (sessionType === 'survey' && surveyId && participantId) {
      console.log('[Countdown] Redirecting survey to quiz component');
      this.router.navigate(['/quiz'], {
        queryParams: { 
          sessionCode: this.sessionCode,
          participantId: participantId,
          surveyId: surveyId,
          sessionType: 'survey'
        }
      });
    } else if (sessionType === 'quiz' && quizId && participantId) {
      console.log('[Countdown] Redirecting to quiz');
      this.router.navigate(['/quiz'], {
        queryParams: {
          sessionCode: this.sessionCode,
          participantId: participantId,
          quizId: quizId
        }
      });
    } else {
      // Fallback
      console.log('[Countdown] Unknown session type or missing IDs, redirecting to participant');
      console.log('[Countdown] Debug - sessionType:', sessionType, 'pollId:', pollId, 'surveyId:', surveyId, 'quizId:', quizId, 'participantId:', participantId);
      this.router.navigate(['/participant']);
    }
  }

  ngOnDestroy(): void {
    console.log('[Countdown] Component destroying, cleaning up...');
    this.stopCountdown();
    
    if (this.hubConnection) {
      const state = this.hubConnection.state;
      console.log('[Countdown] SignalR connection state:', state);
      
      // Only try to leave session if connected
      if (state === signalR.HubConnectionState.Connected && this.sessionCode) {
        // Use Promise with timeout to prevent hanging
        Promise.race([
          this.hubConnection.invoke('LeaveSession', this.sessionCode),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
        ])
          .then(() => console.log('[Countdown] Left session:', this.sessionCode))
          .catch(err => {
            // Silently ignore if connection already closed
            if (err?.message !== 'Timeout' && !err?.message?.includes('closed')) {
              console.error('[Countdown] Error leaving session:', err);
            }
          });
      }
      
      // Stop connection - ignore errors if already closed
      if (state !== signalR.HubConnectionState.Disconnected) {
        this.hubConnection.stop()
          .then(() => console.log('[Countdown] SignalR connection stopped'))
          .catch(err => {
            // Silently ignore if connection already stopped
            if (!err?.message?.includes('closed') && !err?.message?.includes('stop')) {
              console.error('[Countdown] Error stopping SignalR:', err);
            }
          });
      }
        
      this.hubConnection = undefined;
    }
  }

  get formattedStartTime(): string {
    if (!this.quizStartTime || isNaN(this.quizStartTime.getTime())) return 'Not set';
    return this.quizStartTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  get formattedEndTime(): string {
    if (!this.quizEndTime || isNaN(this.quizEndTime.getTime())) return 'Not set';
    return this.quizEndTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  get formattedStartDate(): string {
    if (!this.quizStartTime || isNaN(this.quizStartTime.getTime())) return 'Not set';
    return this.quizStartTime.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  get progress(): number {
    if (!this.quizStartTime || !this.sessionData) return 0;
    
    const now = new Date();
    const start = this.quizStartTime;
    const totalWaitTime = start.getTime() - now.getTime();
    
    if (totalWaitTime <= 0) return 100;
    
    // Calculate progress based on time remaining
    const maxWaitTime = 60 * 60 * 1000; // 1 hour max for progress calculation
    const progress = Math.min(100, ((maxWaitTime - totalWaitTime) / maxWaitTime) * 100);
    
    return Math.max(0, progress);
  }
}

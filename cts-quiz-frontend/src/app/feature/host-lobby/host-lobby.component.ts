import { Component, OnInit, OnDestroy, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LeaderboardService } from '../../services/leaderboard.service';

import { HostLobbyService } from '../../services/host-lobby.service';
import { 
  ParticipantProgress, 
  QuestionTimer, 
  SessionData, 
  QuestionData, 
  ParticipantDetail,
  SessionType,
  ConnectionStatus,
  Mode,
  LeaderboardMode,
  InteractiveOverlayType
} from '../../models/host-lobby.model';
import { LeaderboardTopnComponent } from '../leaderboard-topn/leaderboard-topn.component';
import { LeaderboardPodiumComponent } from '../leaderboard-podium/leaderboard-podium.component';
import { LeaderboardProgressiveComponent } from '../leaderboard-progressive/leaderboard-progressive.component';
import { LeaderboardCategoryComponent } from '../leaderboard-category/leaderboard-category.component';
import { OptionBargraphComponent } from '../option-bargraph/option-bargraph.component';

@Component({
  selector: 'app-host-lobby',
  templateUrl: './host-lobby.component.html',
  styleUrls: ['./host-lobby.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule,
            LeaderboardTopnComponent, LeaderboardPodiumComponent, LeaderboardProgressiveComponent,
            LeaderboardCategoryComponent, OptionBargraphComponent]
})
export class HostLobbyComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private http = inject(HttpClient);
  private hostLobbyService = inject(HostLobbyService);
  private leaderboardService = inject(LeaderboardService);
  
  // Component state
  sessionCode = signal<string>('');
  quizId = signal<number>(0);
  sessionId = signal<number>(0);
  pollId = signal<number>(0);
  surveyId = signal<number>(0);
  sessionType = signal<SessionType>('quiz');
  mode = signal<Mode>('auto'); // Start in auto mode
  connectionStatus = signal<ConnectionStatus>('connecting');
  hostJustJoined = signal<boolean>(false); // Track if host just joined mid-session
  
  // Session and quiz state
  sessionData = signal<SessionData | null>(null);
  currentQuestion = signal<QuestionData | null>(null);
  allQuestions = signal<QuestionData[]>([]);
  quizStarted = signal<boolean>(false);
  waitingForStart = signal<boolean>(true);
  countdown = signal<number>(0);
  private countdownInterval: any;
  private questionTimerInterval: any;
  private participantRefreshInterval: any; // ✅ Bug #3: Periodic participant sync
  private isProcessingTimerExpiry: boolean = false; // Prevent re-entry
  private processedTimerExpiries = new Set<number>(); // Track which questions have had timer expiry handled
  
  // Live quiz state
  currentQuestionId = signal<number>(1);
  participantProgress = signal<ParticipantProgress>({
    totalParticipants: 0,
    submittedCount: 0,
    percentage: 0
  });
  questionTimer = signal<QuestionTimer>({
    questionId: 1,
    remainingSeconds: 0,
    totalSeconds: 0
  });
  
  leaderboardVisible = signal<boolean>(false);
  showLeaderboardAfterQuestion = signal<boolean>(false);
  showLeaderboardAtEndOnly = signal<boolean>(false);
  quizEnded = signal<boolean>(false);
  // jumpToQuestion: number = 1; // REMOVED: Force navigation causes duplicate submissions
  
  // NEW: Interactive-Style Leaderboard Modes
  showTopNLeaderboard = signal<boolean>(false);
  showPodiumLeaderboard = signal<boolean>(false);
  showProgressiveLeaderboard = signal<boolean>(false);
  showCategoryLeaderboard = signal<boolean>(false);
  showOptionBarGraph = signal<boolean>(true); // Option bar graph (default enabled)
  selectedLeaderboardMode = signal<LeaderboardMode>(null);
  
  // Leaderboard overlay for host view
  showLeaderboardOverlay = signal<boolean>(false);
  leaderboardData = signal<any>(null);
  isLoadingLeaderboard = signal<boolean>(false);
  leaderboardDisplayDuration = signal<number>(5); // Default 5 seconds
  
  // NEW: Interactive-Style Overlays
  showInteractiveOverlay = signal<boolean>(false);
  interactiveOverlayType = signal<InteractiveOverlayType>(null);
  interactiveOverlayData = signal<any>(null);
  
  // Participant list with live status
  participantList = signal<ParticipantDetail[]>([]);
  
  // Prevent multiple end quiz calls
  private isEndingQuiz = false;
  
  // Computed properties
  progressPercentage = computed(() => this.participantProgress().percentage);
  timerProgress = computed(() => {
    const timer = this.questionTimer();
    if (timer.totalSeconds === 0) return 0;
    return (timer.remainingSeconds / timer.totalSeconds) * 100;
  });
  timerDisplay = computed(() => {
    const seconds = this.questionTimer().remainingSeconds;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });
  countdownDisplay = computed(() => {
    const seconds = this.countdown();
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });
  currentQuestionText = computed(() => this.currentQuestion()?.questionText || 'Loading...');
  currentQuestionNumber = computed(() => this.currentQuestion()?.questionNumber || 1);
  totalQuestions = computed(() => this.allQuestions().length);

  constructor() {
    // Watch for timer expiration and handle leaderboard/question advancement
    effect(() => {
      const timer = this.questionTimer();
      const isStarted = this.quizStarted();
      const isEnded = this.quizEnded();
      
      // Only process if quiz is active and timer has expired (0 or below)
      if (isStarted && !isEnded && timer.remainingSeconds <= 0 && timer.totalSeconds > 0) {
        // Check if this question's timer expiry was already processed
        if (this.processedTimerExpiries.has(timer.questionId)) {
          console.log('[HostLobby] Timer expiry already processed for question:', timer.questionId, '- skipping');
          return;
        }
        
        // Prevent multiple triggers
        if (!this.isProcessingTimerExpiry) {
          this.isProcessingTimerExpiry = true;
          console.log('[HostLobby] Timer expired for question:', timer.questionId, 'remaining:', timer.remainingSeconds);
          
          // Mark this question as processed
          this.processedTimerExpiries.add(timer.questionId);
          
          // Use setTimeout to break out of the effect context
          setTimeout(() => {
            this.handleTimerExpiry().finally(() => {
              this.isProcessingTimerExpiry = false;
            });
          }, 0);
        }
      }
    });

    // Subscribe to service event streams
    this.subscribeToServiceEvents();
  }

  ngOnInit() {
    console.log('[HostLobby] Component initialized');
    // Get query parameters
    this.route.queryParams.subscribe(async params => {
      const code = params['sessionCode'] || '';
      const id = +params['quizId'] || 0;
      const pollIdParam = +params['pollId'] || 0;
      const surveyIdParam = +params['surveyId'] || 0;
      const mode = params['mode'] === 'auto' ? 'auto' : 'manual';
      const type = params['sessionType'] || 'quiz';
      
      console.log('[HostLobby] Params:', { sessionCode: code, quizId: id, pollId: pollIdParam, surveyId: surveyIdParam, mode, sessionType: type });
      
      this.sessionCode.set(code);
      this.quizId.set(id);
      this.pollId.set(pollIdParam);
      this.surveyId.set(surveyIdParam);
      this.mode.set(mode);
      this.sessionType.set(type as SessionType);
      
      if (this.sessionCode()) {
        console.log('[HostLobby] Loading session data...');
        await this.loadSessionData();
        console.log('[HostLobby] Session loaded, initializing SignalR...');
        await this.initializeSignalR();
        console.log('[HostLobby] Initialization complete');
        console.log('[HostLobby] Final state - waiting:', this.waitingForStart(), 'started:', this.quizStarted(), 'countdown:', this.countdown());
        
        // Start periodic session status check (every 3 seconds)
        this.startSessionStatusPolling();
      } else {
       this.snackBar.open('⚠️ No session code provided', 'Close', { duration: 4000 });
        this.router.navigate(['/host/manage-content']);
      }
    });
  }

  ngOnDestroy() {
    this.disconnectSignalR();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.questionTimerInterval) {
      clearInterval(this.questionTimerInterval);
    }
    // Clear participant refresh interval
    if (this.participantRefreshInterval) {
      clearInterval(this.participantRefreshInterval);
    }
  }

  /**
   * Subscribe to service event streams
   */
  private subscribeToServiceEvents(): void {
    // Connection status
    this.hostLobbyService.connectionStatus$.subscribe(status => {
      this.connectionStatus.set(status);
    });

    // Reconnection handlers
    this.hostLobbyService.reconnecting$.subscribe(() => {
      this.snackBar.open('⚠️ Reconnecting...', 'Close', { duration: 2000 });
    });

    this.hostLobbyService.reconnected$.subscribe(async () => {
      this.snackBar.open('✅ Reconnected successfully', 'Close', { duration: 2000 });
    });

    this.hostLobbyService.connectionClosed$.subscribe(() => {
      this.snackBar.open('⚠️ Connection lost - Please refresh the page', 'Close', { duration: 5000 });
    });

    // Host presence status
    this.hostLobbyService.hostPresenceStatus$.subscribe((data: any) => {
      console.log('[HostLobby] Host presence status received:', data);
      const hostPresent = data.HostPresent || data.hostPresent;
      
      if (!hostPresent) {
        this.mode.set('manual');
        this.hostJustJoined.set(false);
      }
    });

    // Session state sync
    this.hostLobbyService.sessionStateSync$.subscribe((data: any) => {
      console.log('[HostLobby] Session state sync received:', data);
      const showAfterQuestion = data.ShowLeaderboardAfterQuestion ?? data.showLeaderboardAfterQuestion ?? false;
      const showAtEndOnly = data.ShowLeaderboardAtEndOnly ?? data.showLeaderboardAtEndOnly ?? false;
      const currentQuestionId = data.CurrentQuestionId ?? data.currentQuestionId;
      const remainingSeconds = data.RemainingSeconds ?? data.remainingSeconds ?? 0;
      const totalSeconds = data.TotalSeconds ?? data.totalSeconds ?? 0;
      
      this.showLeaderboardAfterQuestion.set(showAfterQuestion);
      this.showLeaderboardAtEndOnly.set(showAtEndOnly);
      this.mode.set('manual');
      this.hostJustJoined.set(true);
      
      if (currentQuestionId) {
        const question = this.allQuestions().find(q => q.questionId === currentQuestionId);
        if (question) {
          this.currentQuestion.set(question);
          this.currentQuestionId.set(currentQuestionId);
          
          this.questionTimer.set({
            questionId: currentQuestionId,
            remainingSeconds: Math.max(0, remainingSeconds),
            totalSeconds: totalSeconds > 0 ? totalSeconds : question.timerSeconds
          });
          
          console.log('[HostLobby] Synced to current question:', question.questionNumber, 'Timer:', remainingSeconds, '/', totalSeconds);
          
          if (totalSeconds > 0 && remainingSeconds > 0) {
            this.quizStarted.set(true);
            this.waitingForStart.set(false);
          }
        }
      }
      
      this.snackBar.open('🎮 Switched to MANUAL mode - You are now in control', 'Close', { duration: 4000 });
    });

    // Submission progress updates
    this.hostLobbyService.submissionProgressUpdate$.subscribe((data: any) => {
      console.log('[HostLobby] Submission progress received:', data);
      const percentage = data.Percentage || data.percentage || 0;
      const totalParticipants = data.TotalParticipants || data.totalParticipants || 0;
      const submittedCount = data.SubmittedCount || data.submittedCount || 0;
      const questionId = data.QuestionId || data.questionId;
      
      if (questionId === this.currentQuestionId()) {
        this.participantProgress.set({
          totalParticipants: totalParticipants,
          submittedCount: submittedCount,
          percentage: Math.round(percentage)
        });
        
        this.loadParticipantDetails();
        console.log('[HostLobby] Updated progress:', submittedCount, '/', totalParticipants, '(', percentage, '%)');
      }
    });

    // Participant count updates
    this.hostLobbyService.participantCountUpdated$.subscribe(count => {
      const current = this.participantProgress();
      this.participantProgress.set({
        ...current,
        totalParticipants: count
      });
      console.log('[HostLobby] Participant count:', count);
      this.loadParticipantDetails();
    });

    // Quiz started
    this.hostLobbyService.quizStarted$.subscribe(async () => {
      console.log('[HostLobby] QuizStarted event received');
      this.waitingForStart.set(false);
      this.quizStarted.set(true);
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      await this.loadParticipantDetails();
      if (this.currentQuestion()) {
        await this.startQuestionTimer();
      }
    });

    // Force navigate to question
    this.hostLobbyService.forceNavigateToQuestion$.subscribe((data: any) => {
      console.log('[HostLobby] Force navigate received:', data);
      const questionId = data.QuestionId || data.questionId;
      const timerSeconds = data.TimerSeconds || data.timerSeconds;
      
      if (questionId) {
        const question = this.allQuestions().find(q => q.questionId === questionId);
        if (question) {
          this.currentQuestion.set(question);
          this.currentQuestionId.set(questionId);
          
          if (timerSeconds) {
            this.questionTimer.set({
              questionId: questionId,
              remainingSeconds: timerSeconds,
              totalSeconds: timerSeconds
            });
          }
          
          this.loadParticipantDetails();
        }
      }
    });

    // Leaderboard events
    this.hostLobbyService.leaderboardUpdateTopN$.subscribe((data: any) => {
      console.log('[HostLobby] Top-N Leaderboard Update received:', data);
      this.interactiveOverlayData.set(data);
      this.interactiveOverlayType.set('topn');
      this.showInteractiveOverlay.set(true);
    });

    this.hostLobbyService.showPodium$.subscribe((data: any) => {
      console.log('[HostLobby] Podium Leaderboard received:', data);
      this.interactiveOverlayData.set(data);
      this.interactiveOverlayType.set('podium');
      this.showInteractiveOverlay.set(true);
    });

    this.hostLobbyService.leaderboardUpdateProgressive$.subscribe((data: any) => {
      console.log('[HostLobby] Progressive Leaderboard Update received:', data);
      this.interactiveOverlayData.set(data);
      this.interactiveOverlayType.set('progressive');
      this.showInteractiveOverlay.set(true);
    });

    this.hostLobbyService.leaderboardUpdateCategory$.subscribe((data: any) => {
      console.log('[HostLobby] Category Leaderboard Update received:', data);
      this.interactiveOverlayData.set(data);
      this.interactiveOverlayType.set('category');
      this.showInteractiveOverlay.set(true);
    });

    this.hostLobbyService.optionCountsUpdate$.subscribe((data: any) => {
      console.log('[HostLobby] Option Counts Update received:', data);
      this.interactiveOverlayData.set(data);
      this.interactiveOverlayType.set('option-bar');
      this.showInteractiveOverlay.set(true);
    });

    // Quiz ended
    this.hostLobbyService.quizEnded$.subscribe((data: any) => {
      console.log('[HostLobby] Quiz auto-ended:', data);
      this.quizEnded.set(true);
      this.quizStarted.set(false);
      
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
      if (this.questionTimerInterval) {
        clearInterval(this.questionTimerInterval);
        this.questionTimerInterval = null;
      }
      
      this.snackBar.open('🏁 Quiz completed! Redirecting to results...', 'Close', { duration: 3000 });
      
      setTimeout(() => {
        this.router.navigate(['/results-analysis'], {
          queryParams: { sessionCode: this.sessionCode() }
        });
      }, 1500);
    });

    this.hostLobbyService.showLeaderboardAtEnd$.subscribe((data: any) => {
      console.log('[HostLobby] Final leaderboard shown:', data);
      this.quizEnded.set(true);
      this.snackBar.open('🏆 Final leaderboard displayed to participants', 'Close', { duration: 3000 });
    });
  }

  /**
   * Load session data and questions from backend
   */
  private async loadSessionData() {
    try {
      console.log('[HostLobby] Loading session data for code:', this.sessionCode());
      
      const { session, questions } = await this.hostLobbyService.loadSessionData(this.sessionCode());
      
      this.sessionId.set(session.sessionId);
      this.quizId.set(session.sessionId); // Note: Using sessionId as fallback
      
      // Store sessionId in localStorage for leaderboard component
      localStorage.setItem('currentSessionId', session.sessionId.toString());
      console.log('[HostLobby] Stored sessionId in localStorage:', session.sessionId);
      
      this.sessionData.set(session);
      this.allQuestions.set(questions);
      console.log('[HostLobby] Loaded questions:', questions.length);
      
      // Get session details for leaderboard settings
      const sessionDetails = await this.hostLobbyService.getSessionStatus(this.sessionCode());
      if (sessionDetails.showLeaderboardAfterQuestion !== undefined) {
        this.showLeaderboardAfterQuestion.set(sessionDetails.showLeaderboardAfterQuestion);
      }
      if (sessionDetails.showLeaderboardAtEndOnly !== undefined) {
        this.showLeaderboardAtEndOnly.set(sessionDetails.showLeaderboardAtEndOnly);
      }
      
      // Fetch current participant count
      const initialCount = await this.hostLobbyService.getParticipantCount(session.sessionId);
      this.participantProgress.update(p => ({
        ...p,
        totalParticipants: initialCount
      }));
      
      if (questions.length > 0) {
        this.currentQuestion.set(questions[0]);
        this.currentQuestionId.set(questions[0].questionId);
        
        // Check if timer data exists in session (quiz already started)
        if (sessionDetails.currentQuestionId && sessionDetails.currentQuestionStartTime && sessionDetails.timerDurationSeconds) {
          console.log('[HostLobby] Quiz already in progress - syncing timer from session data');
          
          const startTime = new Date(sessionDetails.currentQuestionStartTime).getTime();
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          const remaining = Math.max(0, Math.floor(sessionDetails.timerDurationSeconds - elapsed));
          
          const currentQ = questions.find(q => q.questionId === sessionDetails.currentQuestionId);
          if (currentQ) {
            this.currentQuestion.set(currentQ);
            this.currentQuestionId.set(currentQ.questionId);
          }
          
          this.questionTimer.set({
            questionId: sessionDetails.currentQuestionId,
            remainingSeconds: remaining,
            totalSeconds: sessionDetails.timerDurationSeconds
          });
        } else {
          this.questionTimer.set({
            questionId: questions[0].questionId,
            remainingSeconds: questions[0].timerSeconds,
            totalSeconds: questions[0].timerSeconds
          });
        }
      }
      
      // Check if quiz has started
      if (sessionDetails.startedAt) {
        const startTime = new Date(sessionDetails.startedAt).getTime();
        const now = Date.now();
        
        if (startTime <= now) {
          this.quizStarted.set(true);
          this.waitingForStart.set(false);
        } else {
          const secondsUntilStart = Math.floor((startTime - now) / 1000);
          this.countdown.set(secondsUntilStart);
          this.waitingForStart.set(true);
          this.quizStarted.set(false);
          this.startCountdown();
        }
      } else {
        this.countdown.set(300);
        this.waitingForStart.set(true);
        this.quizStarted.set(false);
        this.startCountdown();
      }
    } catch (error) {
      console.error('[HostLobby] Failed to load session data:', error);
      this.snackBar.open('⚠️ Failed to load session data', 'Close', { duration: 4000 });
    }
  }

  /**
   * Start countdown timer to quiz start
   */
  private startCountdown() {
    console.log('[HostLobby] Starting countdown timer with initial value:', this.countdown());
    
    // Clear any existing interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.countdownInterval = setInterval(async () => {
      const current = this.countdown();
      if (current <= 0) {
        console.log('[HostLobby] Countdown finished - starting quiz');
        clearInterval(this.countdownInterval);
        this.waitingForStart.set(false);
        this.quizStarted.set(true);
        
        // Always call forceStartQuiz to notify backend and participants
        await this.forceStartQuiz();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  /**
   * Start question timer with broadcast
   */
  private async startQuestionTimer() {
    console.log('[HostLobby] Starting question timer for question:', this.currentQuestionId());
    
    // Clear any existing timer
    if (this.questionTimerInterval) {
      clearInterval(this.questionTimerInterval);
      this.questionTimerInterval = null;
    }
    
    const currentQuestion = this.currentQuestion();
    if (!currentQuestion) {
      console.error('[HostLobby] No current question to start timer for');
      return;
    }
    
    const timerSeconds = currentQuestion.timerSeconds || 30;
    const questionId = currentQuestion.questionId;
    
    console.log('[HostLobby] Timer initialized:', timerSeconds, 'seconds for question', questionId);
    
    // Set initial timer state
    this.questionTimer.set({
      questionId: questionId,
      remainingSeconds: timerSeconds,
      totalSeconds: timerSeconds
    });
    
    // Broadcast initial timer to participants
    try {
      if (this.hostLobbyService.isConnected()) {
        await this.hostLobbyService.invokeHub('BroadcastTimer', 
          this.sessionCode(), 
          questionId, 
          timerSeconds, 
          timerSeconds
        );
        console.log('[HostLobby] Initial timer broadcast sent');
      }
    } catch (error) {
      console.error('[HostLobby] Failed to broadcast initial timer:', error);
    }
    
    // Start countdown interval
    this.questionTimerInterval = setInterval(async () => {
      const currentTimer = this.questionTimer();
      
      if (currentTimer.questionId !== questionId) {
        console.log('[HostLobby] Timer question mismatch, stopping interval');
        clearInterval(this.questionTimerInterval);
        this.questionTimerInterval = null;
        return;
      }
      
      const newRemaining = currentTimer.remainingSeconds - 1;
      
      if (newRemaining < 0) {
        console.log('[HostLobby] ⏰ Timer expired!');
        clearInterval(this.questionTimerInterval);
        this.questionTimerInterval = null;
        
        // Set to 0 to show timer expired
        this.questionTimer.set({
          questionId: questionId,
          remainingSeconds: 0,
          totalSeconds: currentTimer.totalSeconds
        });
        
        // Broadcast final timer state (0 seconds)
        try {
          if (this.hostLobbyService.isConnected()) {
            await this.hostLobbyService.invokeHub('BroadcastTimer', 
              this.sessionCode(), 
              questionId, 
              0, 
              currentTimer.totalSeconds
            );
          }
        } catch (error) {
          console.error('[HostLobby] Failed to broadcast final timer:', error);
        }
        
        // Handle timer expiry (show leaderboard, advance question)
        await this.handleTimerExpiry();
        return;
      }
      
      // Update local timer
      this.questionTimer.set({
        questionId: questionId,
        remainingSeconds: newRemaining,
        totalSeconds: currentTimer.totalSeconds
      });
      
      // Broadcast timer update to participants every second
      try {
        if (this.hostLobbyService.isConnected()) {
          await this.hostLobbyService.invokeHub('BroadcastTimer', 
            this.sessionCode(), 
            questionId, 
            newRemaining, 
            currentTimer.totalSeconds
          );
          
          // Log every 10 seconds or when time is low
          if (newRemaining % 10 === 0 || newRemaining <= 5) {
            console.log('[HostLobby] Timer broadcast:', newRemaining, 's remaining');
          }
        }
      } catch (error) {
        console.error('[HostLobby] Failed to broadcast timer update:', error);
      }
    }, 1000);
    
    console.log('[HostLobby] Question timer interval started');
  }

  /**
   * Initialize SignalR connection for host lobby
   */
  private async initializeSignalR() {
    try {
      await this.hostLobbyService.initializeSignalR(this.sessionCode());
      
      // Fetch participant list immediately after connection
      console.log('[HostLobby] ✅ Fetching initial participant list...');
      await this.loadParticipantDetails();
      
      // Start periodic participant refresh for activity sync
      this.startParticipantRefresh();
      
      this.snackBar.open('🎮 Connected to quiz session', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('[HostLobby] SignalR connection failed:', error);
      this.snackBar.open('⚠️ Failed to connect to quiz session', 'Close', { duration: 4000 });
    }
  }

  /**
   * Force start the quiz (manual mode)
   */
  async forceStartQuiz() {
    if (!this.hostLobbyService.isConnected()) {
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      console.log('[HostLobby] Force starting quiz for session:', this.sessionCode());
      
      // Update session startedAt in backend and notify all participants
      // Pass TRUE for isForceStart parameter to override scheduled start time
      await this.hostLobbyService.invokeHub('NotifyQuizStart', this.sessionCode(), true);
      
      this.waitingForStart.set(false);
      this.quizStarted.set(true);
      
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      
      // Start the first question timer immediately after quiz starts
      if (this.currentQuestion()) {
        console.log('[HostLobby] Starting timer for first question');
        await this.startQuestionTimer();
      }
      
      this.snackBar.open('🚀 Quiz FORCE STARTED! Start time updated to NOW.', 'Close', { duration: 4000 });
      console.log('[HostLobby] Quiz force started successfully');
    } catch (error) {
      console.error('[HostLobby] Force start failed:', error);
      this.snackBar.open('⚠️ Failed to start quiz', 'Close', { duration: 3000 });
    }
  }

  /**
   * Handle timer expiration - show leaderboard if enabled, then move to next question
   */
  private async handleTimerExpiry() {
    console.log('[HostLobby] ===== TIMER EXPIRED =====');
    console.log('[HostLobby] ⏰ Timer expired for question', this.currentQuestionNumber());
    console.log('[HostLobby] Show leaderboard after question:', this.showLeaderboardAfterQuestion());
    
    try {
      // Check if this is the last question
      const currentNum = this.currentQuestionNumber();
      const total = this.totalQuestions();
      
      console.log('[HostLobby] Current:', currentNum, 'Total:', total);
      
      if (currentNum >= total) {
        console.log('[HostLobby] Last question completed, ending quiz...');
        
        // Broadcast final leaderboard to participants if enabled (NO HOST POPUP)
        if (this.showLeaderboardAfterQuestion() && this.sessionId() && this.currentQuestionId()) {
          console.log('[HostLobby] 📊 Broadcasting final leaderboard to participants only...');
          
          // Broadcast final leaderboard to participants
          if (this.hostLobbyService.isConnected()) {
            const duration = this.leaderboardDisplayDuration();
            try {
              await this.hostLobbyService.invokeHub('ShowLeaderboardAfterQuestion', 
                this.sessionCode(), 
                this.currentQuestionId(), 
                duration
              );
              
              // Wait for participant display duration
              await new Promise(resolve => setTimeout(resolve, duration * 1000));
            } catch (error) {
              console.error('[HostLobby] Failed to broadcast final leaderboard:', error);
            }
          }
        }
        
        await this.manualEndQuiz(true); // Skip confirmation for auto-end
      } else {
        // ✅ MANUAL MODE: Timer expired, broadcast enabled leaderboards to participants
        console.log('[HostLobby] Timer expired - checking enabled leaderboard types for broadcasting');
        
        // Check connection status before broadcasting
        if (this.hostLobbyService.isConnected() && this.sessionId() && this.currentQuestionId()) {
          
          // ALWAYS broadcast Option Bar Graph first (participants will see it for 10 seconds)
          console.log('[HostLobby] 📊 Broadcasting Option Bar Graph to all participants...');
          try {
            await this.hostLobbyService.invokeHub('BroadcastOptionCounts', this.sessionId(), this.currentQuestionId());
            
            // Fetch and show option bar data for host immediately
            console.log('[HostLobby] 📊 Fetching Option Bar data for host display...');
            const optionData = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/option-counts/${this.sessionId()}/${this.currentQuestionId()}`).toPromise();
            this.interactiveOverlayData.set(optionData);
            this.interactiveOverlayType.set('option-bar');
            this.showInteractiveOverlay.set(true);
          } catch (error) {
            console.error('[HostLobby] Failed to broadcast/fetch Option Counts:', error);
          }
          
          // Wait 10 seconds before broadcasting leaderboard type (so option bar displays fully)
          console.log('[HostLobby] ⏳ Waiting 10 seconds for Option Bar display...');
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          console.log('[HostLobby] ✅ Option Bar period complete, now broadcasting leaderboard type...');
          
          // Close option bar overlay for host
          this.showInteractiveOverlay.set(false);
          
          // Broadcast specific leaderboard type that is toggled ON (shown after 10 sec option bar)
          
          // Broadcast Top-N Leaderboard if toggled
          if (this.showTopNLeaderboard()) {
            console.log('[HostLobby] 🎮 Broadcasting Top-N Leaderboard to participants (toggle enabled)...');
            try {
              await this.hostLobbyService.invokeHub('BroadcastTopNLeaderboard', this.sessionId(), 10);
              
              // Fetch and show Top-N data for host
              console.log('[HostLobby] 🎮 Fetching Top-N data for host display...');
              const topNData = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/top-n/${this.sessionId()}/10`).toPromise();
              this.interactiveOverlayData.set(topNData);
              this.interactiveOverlayType.set('topn');
              this.showInteractiveOverlay.set(true);
            } catch (error) {
              console.error('[HostLobby] Failed to broadcast/fetch Top-N:', error);
            }
          }
          
          // Broadcast Progressive Leaderboard if toggled
          else if (this.showProgressiveLeaderboard()) {
            console.log('[HostLobby] 🔥 Broadcasting Progressive Leaderboard to participants (toggle enabled)...');
            try {
              await this.hostLobbyService.invokeHub('BroadcastProgressiveLeaderboard', this.sessionId());
              
              // Fetch and show Progressive data for host
              console.log('[HostLobby] 🔥 Fetching Progressive data for host display...');
              const progressiveData = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/progressive/${this.sessionId()}`).toPromise();
              this.interactiveOverlayData.set(progressiveData);
              this.interactiveOverlayType.set('progressive');
              this.showInteractiveOverlay.set(true);
            } catch (error) {
              console.error('[HostLobby] Failed to broadcast/fetch Progressive:', error);
            }
          }
          
          // Broadcast Category Leaderboard if toggled
          else if (this.showCategoryLeaderboard()) {
            console.log('[HostLobby] 📊 Broadcasting Category Leaderboard to participants (toggle enabled)...');
            try {
              await this.hostLobbyService.invokeHub('BroadcastCategoryLeaderboard', this.sessionId());
              
              // Fetch and show Category data for host
              console.log('[HostLobby] 📊 Fetching Category data for host display...');
              const categoryData = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/category/${this.sessionId()}`).toPromise();
              this.interactiveOverlayData.set(categoryData);
              this.interactiveOverlayType.set('category');
              this.showInteractiveOverlay.set(true);
            } catch (error) {
              console.error('[HostLobby] Failed to broadcast/fetch Category:', error);
            }
          }
          
          // If showLeaderboardAfterQuestion is enabled but no specific type, broadcast full leaderboard
          else if (this.showLeaderboardAfterQuestion()) {
            console.log('[HostLobby] 📊 Broadcasting Full Leaderboard to participants (default enabled)...');
            try {
              await this.hostLobbyService.invokeHub('ShowLeaderboardAfterQuestion', 
                this.sessionCode(), 
                this.currentQuestionId(), 
                0 // Manual mode - no auto-close
              );
              
              // Fetch and show full leaderboard data for host
              console.log('[HostLobby] 📊 Fetching Full Leaderboard data for host display...');
              const fullData = await this.leaderboardService.getLeaderboard(this.sessionId()).toPromise();
              this.leaderboardData.set(fullData);
              this.showLeaderboardOverlay.set(true);
            } catch (error) {
              console.error('[HostLobby] Failed to broadcast/fetch Full Leaderboard:', error);
            }
          }
        } else {
          console.warn('[HostLobby] ⚠️ Cannot broadcast - Connection status:', this.connectionStatus(), 'IsConnected:', this.hostLobbyService.isConnected());
        }
        
        console.log('[HostLobby] Timer expired - broadcasts complete, waiting for host to navigate');
      }
      console.log('[HostLobby] ===========================');
    } catch (error) {
      console.error('[HostLobby] Error handling timer expiry:', error);
      this.snackBar.open('⚠️ Error advancing question', 'Close', { duration: 3000 });
    }
  }

  /**
   * Navigate to the next question (used by Next Question button and timer expiry)
   * If showLeaderboard is true, displays leaderboard before navigating
   */
  async goToNextQuestion(showLeaderboard: boolean = false) {
    console.log('[HostLobby] ===== goToNextQuestion CALLED =====');
    console.log('[HostLobby] showLeaderboard parameter:', showLeaderboard);
    console.log('[HostLobby] showLeaderboardAfterQuestion():', this.showLeaderboardAfterQuestion());
    console.log('[HostLobby] Connection status:', this.connectionStatus());
    
    if (!this.hostLobbyService.isConnected()) {
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    const currentNum = this.currentQuestionNumber();
    const total = this.totalQuestions();
    
    console.log('[HostLobby] Current question:', currentNum, '/ Total:', total);
    
    if (currentNum >= total) {
      this.snackBar.open('⚠️ Already at the last question', 'Close', { duration: 2000 });
      return;
    }

    try {
      // ✅ Close any visible leaderboard before navigating
      if (this.showLeaderboardOverlay()) {
        console.log('[HostLobby] Closing leaderboard overlay before navigation');
        this.showLeaderboardOverlay.set(false);
        this.leaderboardData.set(null);
      }
      
      const nextQuestionNum = currentNum + 1;
      const nextQuestion = this.allQuestions().find(q => q.questionNumber === nextQuestionNum);
      
      if (!nextQuestion) {
        console.error('[HostLobby] Next question not found:', nextQuestionNum);
        this.snackBar.open('⚠️ Next question not found', 'Close', { duration: 3000 });
        return;
      }
      
      console.log('[HostLobby] ===== NAVIGATING TO NEXT QUESTION =====');
      console.log('[HostLobby] From Q', currentNum, 'to Q', nextQuestionNum);
      console.log('[HostLobby] Question ID:', nextQuestion.questionId, 'Timer:', nextQuestion.timerSeconds);
      
      // 1. Broadcast ForceNavigate to all participants
      await this.hostLobbyService.invokeHub('ForceNavigate', this.sessionCode(), nextQuestion.questionId);
      console.log('[HostLobby] ✅ Sent ForceNavigate to participants');
      
      // 2. Update host's local state
      this.currentQuestionId.set(nextQuestion.questionId);
      this.currentQuestion.set(nextQuestion);
      
      // 3. Reset participant progress for new question
      this.participantProgress.update(p => ({
        ...p,
        submittedCount: 0,
        percentage: 0
      }));
      
      // 4. Initialize host's timer display
      this.questionTimer.set({
        questionId: nextQuestion.questionId,
        remainingSeconds: nextQuestion.timerSeconds,
        totalSeconds: nextQuestion.timerSeconds
      });
      
      // 5. Start the question timer countdown (this will broadcast to participants)
      console.log('[HostLobby] Starting question timer...');
      await this.startQuestionTimer();
      
      console.log('[HostLobby] ✅ Host state updated - Now on Question', nextQuestionNum);
      this.snackBar.open(`✅ Moved to Question ${nextQuestionNum}`, 'Close', { duration: 2000 });
      
      // 6. Reload participant details for the new question
      await this.loadParticipantDetails();
      
    } catch (error) {
      console.error('[HostLobby] Error navigating to next question:', error);
      this.snackBar.open('⚠️ Failed to navigate to next question', 'Close', { duration: 3000 });
    }
  }

  /**
   * Toggle between Auto and Manual mode
   */
  toggleMode() {
    const newMode = this.mode() === 'auto' ? 'manual' : 'auto';
    this.mode.set(newMode);
    
    const message = newMode === 'manual' 
      ? '🎮 Manual Mode: You control everything' 
      : '🤖 Auto Mode: Quiz runs automatically';
    
    this.snackBar.open(message, 'Close', { duration: 3000 });
  }

  /**
   * Toggle show leaderboard after each question
   */
  /**
   * Toggle show leaderboard after each question
   */
  async toggleShowAfterQuestion() {
    console.log('🔍 [DEBUG] toggleShowAfterQuestion called');
    console.log('🔍 [DEBUG] Current setting:', this.showLeaderboardAfterQuestion());
    console.log('🔍 [DEBUG] End-only setting:', this.showLeaderboardAtEndOnly());
    
    if (!this.hostLobbyService.isConnected()) {
      console.error('❌ [DEBUG] Not connected to session');
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      const newSetting = !this.showLeaderboardAfterQuestion();
      console.log('📡 [DEBUG] New setting will be:', newSetting);
      
      // If enabling after-question, disable end-only mode
      if (newSetting) {
        console.log('🔧 [DEBUG] Disabling end-only mode');
        this.showLeaderboardAtEndOnly.set(false);
      }
      
      // Call backend to update setting
      console.log('📡 [DEBUG] Invoking SetShowLeaderboardAfterQuestion...');
      await this.hostLobbyService.invokeHub('SetShowLeaderboardAfterQuestion', this.sessionCode(), newSetting);
      console.log('✅ [DEBUG] Backend updated successfully');
      
      this.showLeaderboardAfterQuestion.set(newSetting);
      console.log('✅ [DEBUG] Local state updated to:', newSetting);
      
      const message = newSetting 
        ? '✅ Leaderboard will show after each question' 
        : '🔒 Leaderboard will NOT show after questions';
      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('❌ [DEBUG] Toggle show after question failed:', error);
      console.error('   - Error details:', JSON.stringify(error, null, 2));
      this.snackBar.open('⚠️ Failed to update setting', 'Close', { duration: 3000 });
    }
  }

  /**
   * Toggle show leaderboard at end only
   */
  async toggleShowAtEndOnly() {
    console.log('🔍 [DEBUG] toggleShowAtEndOnly called');
    console.log('🔍 [DEBUG] Current setting:', this.showLeaderboardAtEndOnly());
    console.log('🔍 [DEBUG] After-question setting:', this.showLeaderboardAfterQuestion());
    
    if (!this.hostLobbyService.isConnected()) {
      console.error('❌ [DEBUG] Not connected to session');
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      const newSetting = !this.showLeaderboardAtEndOnly();
      console.log('📡 [DEBUG] New setting will be:', newSetting);
      
      // If enabling end-only, disable after-question mode
      if (newSetting) {
        console.log('🔧 [DEBUG] Disabling after-question mode');
        this.showLeaderboardAfterQuestion.set(false);
      }
      
      // Call backend to update setting
      console.log('📡 [DEBUG] Invoking SetShowLeaderboardAtEndOnly...');
      await this.hostLobbyService.invokeHub('SetShowLeaderboardAtEndOnly', this.sessionCode(), newSetting);
      console.log('✅ [DEBUG] Backend updated successfully');
      
      this.showLeaderboardAtEndOnly.set(newSetting);
      console.log('✅ [DEBUG] Local state updated to:', newSetting);
      
      const message = newSetting 
        ? '✅ Leaderboard will show only at quiz end' 
        : '🔒 End-only mode disabled';
      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('❌ [DEBUG] Toggle show at end only failed:', error);
      console.error('   - Error details:', JSON.stringify(error, null, 2));
      this.snackBar.open('⚠️ Failed to update setting', 'Close', { duration: 3000 });
    }
  }

  /**
   * Update leaderboard display duration
   */
  async updateLeaderboardDuration(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    
    if (value >= 3 && value <= 30) {
      this.leaderboardDisplayDuration.set(value);
      console.log('⏱️ [DEBUG] Leaderboard display duration updated to:', value, 'seconds');
      
      // Send to backend via SignalR using host lobby's own connection
      if (!this.hostLobbyService.isConnected()) {
        console.error('[HostLobby] Not connected to session');
        this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
        return;
      }
      
      try {
        await this.hostLobbyService.invokeHub('SetLeaderboardDisplayDuration', this.sessionCode(), value);
        console.log(`[HostLobby] ✅ Leaderboard timer synced to backend: ${value}s`);
        this.snackBar.open(`⏱️ Display duration set to ${value} seconds`, 'Close', { duration: 2000 });
      } catch (error) {
        console.error('[HostLobby] Failed to sync leaderboard timer:', error);
        this.snackBar.open('⚠️ Failed to update leaderboard timer', 'Close', { duration: 3000 });
      }
    } else {
      console.warn('⚠️ [DEBUG] Invalid duration:', value);
      input.value = this.leaderboardDisplayDuration().toString();
    }
  }

  // ==================== NEW: INTERACTIVE-STYLE LEADERBOARD METHODS ====================
  
  /**
   * Toggle Dynamic Top-N Leaderboard Mode
   */
  toggleTopNLeaderboard() {
    const newState = !this.showTopNLeaderboard();
    this.showTopNLeaderboard.set(newState);
    this.selectedLeaderboardMode.set(newState ? 'dynamic' : null);
    console.log('[HostLobby] Top-N Leaderboard mode:', newState ? 'ENABLED' : 'DISABLED');
    
    if (newState) {
      // Disable other modes
      this.showPodiumLeaderboard.set(false);
      this.showProgressiveLeaderboard.set(false);
      this.showCategoryLeaderboard.set(false);
      
      this.snackBar.open('✅ Dynamic Top-N Leaderboard Enabled', 'Close', { duration: 2000 });
    } else {
      this.snackBar.open('🔒 Dynamic Leaderboard Disabled', 'Close', { duration: 2000 });
    }
  }

  /**
   * Toggle Podium Leaderboard Mode (Final Top 3)
   */
  togglePodiumLeaderboard() {
    const newState = !this.showPodiumLeaderboard();
    this.showPodiumLeaderboard.set(newState);
    this.selectedLeaderboardMode.set(newState ? 'podium' : null);
    console.log('[HostLobby] Podium Leaderboard mode:', newState ? 'ENABLED' : 'DISABLED');
    
    if (newState) {
      // Disable other modes
      this.showTopNLeaderboard.set(false);
      this.showProgressiveLeaderboard.set(false);
      this.showCategoryLeaderboard.set(false);
      
      this.snackBar.open('🏆 Podium Leaderboard Enabled (Shows at End)', 'Close', { duration: 2000 });
    } else {
      this.snackBar.open('🔒 Podium Leaderboard Disabled', 'Close', { duration: 2000 });
    }
  }

  /**
   * Toggle Progressive Leaderboard Mode (Cumulative + Streaks)
   */
  toggleProgressiveLeaderboard() {
    const newState = !this.showProgressiveLeaderboard();
    this.showProgressiveLeaderboard.set(newState);
    this.selectedLeaderboardMode.set(newState ? 'progressive' : null);
    console.log('[HostLobby] Progressive Leaderboard mode:', newState ? 'ENABLED' : 'DISABLED');
    
    if (newState) {
      // Disable other modes
      this.showTopNLeaderboard.set(false);
      this.showPodiumLeaderboard.set(false);
      this.showCategoryLeaderboard.set(false);
      
      this.snackBar.open('🔥 Progressive Leaderboard Enabled (Shows Streaks)', 'Close', { duration: 2000 });
    } else {
      this.snackBar.open('🔒 Progressive Leaderboard Disabled', 'Close', { duration: 2000 });
    }
  }

  /**
   * Toggle Category-Based Leaderboard Mode (Champions by Category)
   */
  toggleCategoryLeaderboard() {
    const newState = !this.showCategoryLeaderboard();
    this.showCategoryLeaderboard.set(newState);
    this.selectedLeaderboardMode.set(newState ? 'category' : null);
    console.log('[HostLobby] Category Leaderboard mode:', newState ? 'ENABLED' : 'DISABLED');
    
    if (newState) {
      // Disable other modes
      this.showTopNLeaderboard.set(false);
      this.showPodiumLeaderboard.set(false);
      this.showProgressiveLeaderboard.set(false);
      
      this.snackBar.open('📊 Category Leaderboard Enabled (Shows Champions)', 'Close', { duration: 2000 });
    } else {
      this.snackBar.open('🔒 Category Leaderboard Disabled', 'Close', { duration: 2000 });
    }
  }

  /**
   * Toggle Option Bar Graph (Auto-display after each question)
   */
  toggleOptionBarGraph() {
    const newState = !this.showOptionBarGraph();
    this.showOptionBarGraph.set(newState);
    console.log('[HostLobby] Option Bar Graph mode:', newState ? 'ENABLED' : 'DISABLED');
    
    if (newState) {
      this.snackBar.open('📊 Option Bar Graph Enabled (Auto-shows after questions)', 'Close', { duration: 2000 });
    } else {
      this.snackBar.open('🔒 Option Bar Graph Disabled', 'Close', { duration: 2000 });
    }
  }

  /**
   * Check if question timer is currently active
   */
  isTimerActive(): boolean {
    const timer = this.questionTimer();
    return this.quizStarted() && !this.quizEnded() && timer.remainingSeconds > 0 && timer.totalSeconds > 0;
  }

  /**
   * View leaderboard for host (Host view only - does NOT broadcast to participants)
   * Toggles control automatic broadcasting to participants
   */
  async viewInteractiveLeaderboard() {
    const mode = this.selectedLeaderboardMode();
    const sessionId = this.sessionId();
    const questionId = this.currentQuestionId();
    
    if (!sessionId) {
      this.snackBar.open('⚠️ No session ID available', 'Close', { duration: 3000 });
      return;
    }

    try {
      console.log('[HostLobby] View Leaderboard clicked (HOST VIEW ONLY) - Mode:', mode, 'SessionId:', sessionId);
      
      // If no specific mode selected, show default full leaderboard (podium style)
      if (!mode) {
        console.log('[HostLobby] No specific mode selected, showing default full leaderboard for host');
        this.isLoadingLeaderboard.set(true);
        
        // Fetch full leaderboard data for HOST VIEW
        const leaderboard = await this.leaderboardService.getLeaderboard(sessionId).toPromise();
        console.log('[HostLobby] Full leaderboard data loaded for host:', leaderboard);
        
        // Show to host in overlay (NO BROADCAST)
        this.leaderboardData.set(leaderboard);
        this.showLeaderboardOverlay.set(true);
        this.isLoadingLeaderboard.set(false);
        
        return;
      }
      
      // If option bar graph is enabled, show option bar graph for host
      if (this.showOptionBarGraph() && questionId) {
        console.log(`[HostLobby] Showing option bar graph overlay for host (question: ${questionId})`);
        
        // Fetch option counts data for HOST VIEW
        const optionData = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/option-counts/${sessionId}/${questionId}`).toPromise();
        
        this.interactiveOverlayData.set(optionData);
        this.interactiveOverlayType.set('option-bar');
        this.showInteractiveOverlay.set(true);
        
        return;
      }

      // Load appropriate leaderboard data based on selected mode for HOST VIEW
      console.log(`[HostLobby] Showing ${mode} leaderboard overlay for host`);
      this.isLoadingLeaderboard.set(true);
      
      let data: any = null;
      
      switch (mode) {
        case 'dynamic':
          data = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/top-n/${sessionId}/10`).toPromise();
          this.interactiveOverlayType.set('topn');
          break;
          
        case 'podium':
          data = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/podium/${sessionId}`).toPromise();
          this.interactiveOverlayType.set('podium');
          break;
          
        case 'progressive':
          data = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/progressive/${sessionId}`).toPromise();
          this.interactiveOverlayType.set('progressive');
          break;
          
        case 'category':
          data = await this.http.get(`${environment.apiUrl}/Host/Leaderboard/category/${sessionId}`).toPromise();
          this.interactiveOverlayType.set('category');
          break;
      }
      
      this.interactiveOverlayData.set(data);
      this.showInteractiveOverlay.set(true);
      this.isLoadingLeaderboard.set(false);
      
      console.log('[HostLobby] ✅ Interactive leaderboard displayed for HOST (not broadcast to participants)');
      
    } catch (error) {
      console.error('[HostLobby] Failed to load leaderboard:', error);
      this.snackBar.open('⚠️ Failed to load leaderboard', 'Close', { duration: 3000 });
      this.isLoadingLeaderboard.set(false);
    }
  }

  /**
   * Close Interactive overlay
   */
  closeInteractiveOverlay() {
    this.showInteractiveOverlay.set(false);
    this.interactiveOverlayType.set(null);
    this.interactiveOverlayData.set(null);
  }

  // ==================== END NEW METHODS ====================

  /**
   * Load participant details with scores and submission status using Leaderboard API
   */
  async loadParticipantDetails() {
    const sessId = this.sessionId();
    if (!sessId) {
      console.warn('[HostLobby] Cannot load participant details - no session ID');
      return;
    }

    try {
      console.log('[HostLobby] Requesting participant details for session ID:', sessId);
      
      // Use the leaderboard API to get live participant data
      const leaderboard = await this.leaderboardService.getLeaderboard(sessId).toPromise();
      
      if (leaderboard && leaderboard.rankings) {
        console.log('[HostLobby] Leaderboard data received:', leaderboard);
        
        // Map leaderboard data to participant details format
        const participants: ParticipantDetail[] = leaderboard.rankings.map((entry: any) => ({
          participantId: entry.participantId || 0,
          nickname: entry.participantName || 'Unknown',
          totalScore: entry.score || 0,
          hasSubmittedCurrentQuestion: entry.hasSubmittedCurrentQuestion || false,
          totalAnswered: entry.totalAnswered || 0,
          correctAnswers: entry.correctAnswers || 0,
          joinedAt: entry.joinedAt
        }));
        
        this.participantList.set(participants);
        console.log('[HostLobby] Participant list updated, count:', participants.length);
      }
    } catch (error) {
      console.error('[HostLobby] Failed to load participant details:', error);
    }
  }

  /**
   * Manually end the quiz
   */
  async manualEndQuiz(skipConfirmation: boolean = false) {
    // Prevent multiple executions
    if (this.isEndingQuiz) {
      console.log('[HostLobby] Quiz already ending, skipping duplicate call');
      return;
    }
    
    this.isEndingQuiz = true;
    
    if (!skipConfirmation) {
      const confirmed = confirm('⚠️ Are you sure you want to end this quiz? This action cannot be undone.');
      if (!confirmed) {
        this.isEndingQuiz = false;
        return;
      }
    }

    try {
      // Stop any running timers FIRST to prevent re-triggering
      if (this.questionTimerInterval) {
        clearInterval(this.questionTimerInterval);
        this.questionTimerInterval = null;
        console.log('[HostLobby] Timer interval cleared');
      }
      
      // Always set local state
      this.quizEnded.set(true);
      
      // Show leaderboard at end if setting is enabled
      if (this.showLeaderboardAtEndOnly() && this.hostLobbyService.isConnected()) {
        try {
          await this.hostLobbyService.invokeHub('ShowLeaderboardAtEnd', this.sessionCode());
          console.log('[HostLobby] Showing leaderboard at quiz end');
        } catch (error) {
          console.error('[HostLobby] Failed to show leaderboard at end:', error);
        }
      }
      
      // ==================== NEW: BROADCAST PODIUM AT QUIZ END ====================
      
      // Broadcast Podium if enabled
      if (this.showPodiumLeaderboard() && this.hostLobbyService.isConnected()) {
        try {
          console.log('[HostLobby] 🏆 Broadcasting Podium Leaderboard...');
          await this.hostLobbyService.invokeHub('BroadcastPodium', this.sessionId());
          console.log('[HostLobby] ✅ Podium broadcast successful');
        } catch (error) {
          console.error('[HostLobby] Failed to broadcast podium:', error);
        }
      }
      
      // ==================== END NEW ====================
      
      // Check connection and try to notify backend
      if (this.hostLobbyService.isConnected()) {
        await this.hostLobbyService.invokeHub('ManualEnd', this.sessionCode());
        console.log('[HostLobby] Successfully sent ManualEnd to backend');
      } else {
        console.warn('[HostLobby] Not connected to SignalR, ending quiz locally only');
        // Still end the quiz locally even if SignalR is disconnected
        if (!skipConfirmation) {
          this.snackBar.open('⚠️ Connection lost, ending quiz locally', 'Close', { duration: 3000 });
        }
      }
      
      // Show brief success message and navigate immediately
      this.snackBar.open('✅ Quiz ended - Redirecting...', 'Close', { duration: 1500 });
      
      // Navigate to results immediately
      setTimeout(() => {
        this.router.navigate(['/results-analysis'], {
          queryParams: { sessionCode: this.sessionCode() }
        });
      }, 500); // Short delay to allow snackbar to show
    } catch (error) {
      console.error('[HostLobby] Manual end failed:', error);
      
      // Even if backend call fails, still end quiz locally for host
      this.quizEnded.set(true);
      
      if (skipConfirmation) {
        // Auto-end from timer - still navigate to results
        this.snackBar.open('⚠️ Quiz ended - Redirecting...', 'Close', { duration: 1500 });
        setTimeout(() => {
          this.router.navigate(['/results-analysis'], {
            queryParams: { sessionCode: this.sessionCode() }
          });
        }, 500);
      } else {
        // Manual end - show error
        this.snackBar.open('⚠️ Failed to end quiz on server', 'Close', { duration: 3000 });
      }
    }
  }

  /**
   * Start periodic session status polling to detect completion
   */
  private statusPollingInterval: any = null;
  
  private startSessionStatusPolling() {
    // Clear any existing interval
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }
    
    // Poll every 3 seconds
    this.statusPollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${environment.apiBaseUrl}/Host/QuizSession/by-code/${this.sessionCode()}`);
        if (response.ok) {
          const session = await response.json();
          
          // Check if session status changed to Completed
          if (session.status === 'Completed' && !this.quizEnded()) {
            console.log('[HostLobby] 🔍 Detected session completion via polling');
            this.quizEnded.set(true);
            this.quizStarted.set(false);
            
            // Stop timers
            if (this.countdownInterval) {
              clearInterval(this.countdownInterval);
              this.countdownInterval = null;
            }
            if (this.questionTimerInterval) {
              clearInterval(this.questionTimerInterval);
              this.questionTimerInterval = null;
            }
            
            // Stop polling since quiz is completed
            if (this.statusPollingInterval) {
              clearInterval(this.statusPollingInterval);
              this.statusPollingInterval = null;
            }
            
            this.snackBar.open('🏁 Quiz completed!', 'Close', { duration: 3000 });
            
            // Navigate to results after a short delay
            setTimeout(() => {
              this.router.navigate(['/results-analysis'], {
                queryParams: { sessionCode: this.sessionCode() }
              });
            }, 1000);
          }
        }
      } catch (error) {
        console.error('[HostLobby] Error polling session status:', error);
      }
    }, 3000);
  }

  /**
   * ✅ Bug #3: Start periodic participant refresh to sync activity counts
   */
  private startParticipantRefresh() {
    // Clear any existing interval
    if (this.participantRefreshInterval) {
      clearInterval(this.participantRefreshInterval);
    }
    
    console.log('[HostLobby] ✅ Starting participant activity refresh (every 2 seconds)');
    
    // Refresh participant list every 2 seconds to show real-time activity
    this.participantRefreshInterval = setInterval(async () => {
      if (this.hostLobbyService.isConnected() && !this.quizEnded()) {
        await this.loadParticipantDetails();
      }
    }, 2000);
  }

  /**
   * Disconnect from SignalR
   */
  private async disconnectSignalR() {
    // Stop status polling
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
    
    // ✅ Bug #3: Stop participant refresh polling
    if (this.participantRefreshInterval) {
      clearInterval(this.participantRefreshInterval);
      this.participantRefreshInterval = null;
    }
    
    if (this.hostLobbyService.isConnected()) {
      try {
        // Notify backend that host is leaving
        await this.hostLobbyService.invokeHub('LeaveHostSession', this.sessionCode());
        await this.hostLobbyService.disconnectSignalR(this.sessionCode());
        console.log('[HostLobby] SignalR disconnected - Session will switch to AUTO mode');
      } catch (error) {
        console.error('[HostLobby] Error disconnecting:', error);
      }
    }
  }
}

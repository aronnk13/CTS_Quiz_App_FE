import { Component, effect, inject, OnInit, OnDestroy, signal, computed, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment.development';
import { QuizCreationService } from '../../services/quiz-creation.service';
import { QuizListItem } from '../../models/quiz.models';
import { QuizPublishService } from '../../services/quiz-publish.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { PollService } from '../../services/poll.service';
import { SurveyService } from '../../services/survey.service';
import { Subscription } from 'rxjs';
import { ThemeStore } from '../../services/theme-store.service';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { QrcodeComponent } from '../qrcode/qrcode.component';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';
import { AuthService } from '../../services/auth.service';
import { PollOverview } from '../../models/ipoll';
import { Survey, SurveyOverview } from '../../models/isurvey';

export interface Analytics {
  totalParticipants: number;
  averageScore: number;
  completionRate: number;
  topScore: number;
  worstScore: number;
  participantDetails: {
    participantName: string;
    score: number;
    timeTaken: string;
    completedAt: Date;
  }[];
}

@Component({
  selector: 'app-result',
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.css'],
  standalone: true,
  imports: [CommonModule, LoaderComponent, QrcodeComponent],
})
export class ResultComponent implements OnInit, OnDestroy, AfterViewInit {
  private store = inject(QuizCreationService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private quizPublishService = inject(QuizPublishService);
  private dashboardStatsService = inject(DashboardStatsService);
  private pollService = inject(PollService);
  private surveyService = inject(SurveyService);
  private themeStore = inject(ThemeStore);
  private authService = inject(AuthService);
  private subscriptions: Subscription[] = [];
  
  hostQuizzes = signal<QuizListItem[]>([]);
  hostPolls = signal<PollOverview[]>([]);
  hostSurveys = signal<SurveyOverview[]>([]);
  quizAnalytics: { [key: number]: Analytics } = {};
  startTimes: { [key: number]: string } = {};
  endTimes: { [key: number]: string } = {};
  pollStartTimes: { [key: number]: string } = {};
  pollEndTimes: { [key: number]: string } = {};
  surveyStartTimes: { [key: number]: string } = {};
  surveyEndTimes: { [key: number]: string } = {};
  loading = signal(false);
  currentHostId = computed(() => {
    const user = this.authService.currentUser();
    console.log('[ResultComponent] currentHostId computed - user object:', JSON.stringify(user, null, 2));
    const hostId = user?.employeeId || '';
    console.log('[ResultComponent] currentHostId computed - extracted hostId:', hostId);
    return hostId;
  });
  activeSessionIds: Map<string, number> = new Map(); // Map quiz number to session ID
  activePollSessions: Map<number, number> = new Map(); // Map poll ID to session ID
  activeSurveySessions: Map<number, number> = new Map(); // Map survey ID to session ID
  sessionModes: Map<string, boolean> = new Map(); // Map quiz number to AutoModeEnabled (true = auto, false = manual)
  private statusCheckInterval: any;
  private publishingInProgress = new Set<string>(); // Track quizzes currently being published
  
  // Leaderboard settings per session
  leaderboardSettings: { [sessionCode: string]: { showAfterQuestion: boolean, showAtEndOnly: boolean, displayDuration?: number } } = {};
  showLeaderboardPanel: { [quizId: number]: boolean } = {};
  leaderboardDataCache: { [sessionCode: string]: any } = {};
  leaderboardTimers: { [sessionCode: string]: number } = {}; // Duration in seconds

  // Content type selection
  selectedContentType = signal<'quizzes' | 'surveys' | 'polls'>('quizzes');

  // Empty state messages
  emptyStateConfig = computed(() => {
    const type = this.selectedContentType();
    const configs = {
      quizzes: {
        icon: '📭',
        title: 'No Quizzes Found',
        message: 'Create your first quiz to get started.'
      },
      surveys: {
        icon: '📝',
        title: 'No Surveys Found',
        message: 'Create your first survey to collect feedback.'
      },
      polls: {
        icon: '🗳️',
        title: 'No Polls Found',
        message: 'Create your first poll to gather quick responses.'
      }
    };
    return configs[type];
  });

  // Tutorial properties
  private tutorialService = inject(TutorialService);
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'analytics-overview',
      title: '📊 Content Analytics',
      description: 'View key metrics about your content: total quizzes, surveys, polls, questions, and their status.',
      targetElement: '.analytics-grid',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'content-types',
      title: '📋 Content Types',
      description: 'Switch between different content types to manage your quizzes, surveys, and polls separately.',
      targetElement: '.btn-group',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'quiz-list',
      title: '📝 Content Management',
      description: 'View, edit, publish, or schedule your content. Each item shows status, participant count, and available actions.',
      targetElement: '.table-responsive',
      position: 'left',
      skipable: true
    },
    {
      id: 'publish-actions',
      title: '🚀 Publishing Options',
      description: 'Use these buttons to publish content, schedule them, or generate QR codes for easy participant access.',
      targetElement: '.publish-btn',
      position: 'top',
      skipable: true
    },
    {
      id: 'refresh-data',
      title: '🔄 Refresh Data',
      description: 'Click here to reload your content data and see the latest updates and analytics.',
      targetElement: '.btn-primary',
      position: 'left',
      skipable: true
    }
  ];

  analytics = computed(() => {
    const quizzes = this.hostQuizzes();
    const polls = this.hostPolls();
    const surveys = this.hostSurveys();
    
    const draftQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'draft');
    const activeQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'active');
    const completedQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'completed');
    
    return {
      totalQuizzes: quizzes.length,
      draftQuizzes: draftQuizzes.length,
      publishedQuizzes: activeQuizzes.length + completedQuizzes.length,
      totalQuestions: quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0),
      totalSurveys: surveys.length,
      totalPolls: polls.length,
    };
  });

  pageTitle = computed(() => {
    const currentUrl = this.router.url;
    return currentUrl.includes('/host/manage-content') 
      ? '🔧 Content Management Dashboard'
      : '📊 Quiz Analytics Dashboard';
  });

  debugInfo = computed(() => ({
    selectedType: this.selectedContentType(),
    quizCount: this.hostQuizzes().length,
    surveyCount: this.hostSurveys().length,
    pollCount: this.hostPolls().length,
    hasQuizzes: this.hostQuizzes().length > 0,
    hasSurveys: this.hostSurveys().length > 0,
    hasPolls: this.hostPolls().length > 0
  }));

  getCategoryList = computed(() => {
    const categoryMap = new Map<string, number>();
    this.hostQuizzes().forEach(quiz => {
      if (quiz.category) {
        categoryMap.set(quiz.category, (categoryMap.get(quiz.category) || 0) + 1);
      }
    });
    return Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));
  });

  showQRForQuizId = signal<number | null>(null);
  showQRType = signal<'quiz' | 'survey' | 'poll'>('quiz');

  toggleQR(quizId: number, type: 'quiz' | 'survey' | 'poll' = 'quiz') {
    if (this.showQRForQuizId() === quizId && this.showQRType() === type) {
      this.showQRForQuizId.set(null);
      console.log('Hiding QR');
    } else {
      this.showQRForQuizId.set(quizId);
      this.showQRType.set(type);
      console.log(`Showing QR for ${type} ${quizId}`);
    }
  }

  selectContentType(type: 'quizzes' | 'surveys' | 'polls') {
    this.selectedContentType.set(type);
  }

  async loadAllContent() {
    this.loading.set(true);
    try {
      await this.loadQuizzes();
      await this.loadSurveys(); 
      await this.loadPolls();
    } finally {
      this.loading.set(false);
    }
  }

  constructor() {
    effect(() => {
      const quizzes = this.hostQuizzes();
      
      // Calculate analytics
      quizzes.forEach((quiz: QuizListItem) => {
        if (!this.quizAnalytics[quiz.quizId]) {
          this.quizAnalytics[quiz.quizId] = this.calculateAnalytics(quiz);
        }
      });

      // Update shared dashboard stats
      const draftQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'draft').length;
      const activeQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'active').length;
      const completedQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'completed').length;
      const publishedQuizzes = activeQuizzes + completedQuizzes;
      const totalQuestions = quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0);

      this.dashboardStatsService.updateQuizStats(
        quizzes.length,
        draftQuizzes,
        publishedQuizzes,
        totalQuestions
      );
    });
  }

  async ngOnInit() {
    console.log('[ResultComponent] ngOnInit - Initializing...');
    
    // Debug: Check localStorage directly
    if (typeof localStorage !== 'undefined') {
      console.log('[ResultComponent] localStorage check:', {
        hasToken: !!localStorage.getItem('auth_token'),
        hasUser: !!localStorage.getItem('auth_user'),
        userPreview: localStorage.getItem('auth_user')?.substring(0, 100)
      });
    }
    
    // Wait a tick for auth service to initialize from localStorage
    await new Promise(resolve => setTimeout(resolve, 0));
    
    console.log('[ResultComponent] Auth state:', {
      isAuthenticated: this.authService.isAuthenticated(),
      currentUser: this.authService.currentUser(),
      token: this.authService.getToken() ? 'Present' : 'Missing'
    });
    
    // Check if user is logged in (computed signal will handle this)
    const hostId = this.currentHostId();
    
    if (!hostId) {
      console.error('[ResultComponent] No user logged in - hostId is empty');
      console.error('[ResultComponent] Please check if localStorage has auth_user and auth_token');
      this.snackBar.open('⚠️ Please log in to view your content', 'Close', { duration: 3000 });
      this.router.navigate(['/login']);
      return;
    }
    
    console.log('[ResultComponent] Logged in as:', hostId);
    
    // Load host theme for persistence
    this.themeStore.loadHostTheme(hostId);
    
    // Load all content
    await this.loadQuizzes();
    await this.loadSurveys();
    await this.loadPolls();
    await this.initializeQuizPublishService();
    this.startStatusPolling();
    
    console.log('Loaded data summary:');
    console.log('- Quizzes:', this.hostQuizzes().length);
    console.log('- Surveys:', this.hostSurveys().length); 
    console.log('- Polls:', this.hostPolls().length);
  }

  private startStatusPolling() {
    console.log('[StatusPolling] Starting status check every 10 seconds');
    // Check session statuses every 10 seconds for faster updates
    this.statusCheckInterval = setInterval(async () => {
      await this.checkActiveSessions();
    }, 10000); // 10 seconds
  }

  private async checkActiveSessions() {
    // Skip if no active sessions to check
    if (this.activeSessionIds.size === 0 && this.activePollSessions.size === 0 && this.activeSurveySessions.size === 0) {
      return;
    }

    console.log('[StatusPolling] Checking active sessions:');
    console.log('  - Quizzes:', this.activeSessionIds.size);
    console.log('  - Polls:', this.activePollSessions.size);
    console.log('  - Surveys:', this.activeSurveySessions.size);

    let statusChanged = false;

    // Check quiz sessions
    for (const [quizNumber, sessionId] of this.activeSessionIds.entries()) {
      console.log(`[StatusPolling] Checking session for quiz ${quizNumber} (SessionId: ${sessionId})`);
      try {
        const session = await this.quizPublishService.getQuizSessionByCode(quizNumber);
        
        // Track AutoModeEnabled status for this session
        if (session && 'autoModeEnabled' in session) {
          this.sessionModes.set(quizNumber, session.autoModeEnabled);
          console.log(`[StatusPolling] Quiz ${quizNumber} mode: ${session.autoModeEnabled ? 'AUTO' : 'MANUAL'}`);
        }
        
        // Update the time inputs with session times (for display when Active)
        const quiz = this.hostQuizzes().find(q => q.quizNumber === quizNumber);
        if (quiz && session) {
          // Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
          if (session.startedAt) {
            const startDate = new Date(session.startedAt);
            this.startTimes[quiz.quizId] = this.formatDateTimeLocal(startDate);
          }
          if (session.endedAt) {
            const endDate = new Date(session.endedAt);
            this.endTimes[quiz.quizId] = this.formatDateTimeLocal(endDate);
          }
        }
        
        // Check current quiz status in our list
        const currentQuiz = this.hostQuizzes().find(q => q.quizNumber === quizNumber);
        const currentStatus = currentQuiz?.status?.toLowerCase();
        const newStatus = session?.status?.toLowerCase();

        // If status changed, mark for refresh
        if (newStatus && currentStatus !== newStatus) {
          console.log(`Status changed for ${quizNumber}: ${currentStatus} -> ${newStatus}`);
          statusChanged = true;
        }

        // If status changed to Completed, remove from tracking
        if (session?.status?.toLowerCase() === 'completed') {
          this.activeSessionIds.delete(quizNumber);
          
          this.snackBar.open(
            `🏁 Quiz ${quizNumber} has been automatically completed`,
            'Close',
            { duration: 5000, panelClass: ['info-snackbar'] }
          );
        }
      } catch (error: any) {
        // If 404, session might have been deleted or never created - remove from tracking
        if (error.status === 404) {
          console.log(`Session ${quizNumber} not found (404) - quiz may have been reset to Draft`);
          this.activeSessionIds.delete(quizNumber);
          
          // Sync the quiz status back to Draft in the database
          const quiz = this.hostQuizzes().find(q => q.quizNumber === quizNumber);
          if (quiz) {
            try {
              await this.store.syncQuizStatus(quiz.quizId);
              console.log(`Successfully synced Quiz ${quiz.quizId} back to Draft status`);
              
              // Clear the time inputs for this quiz
              delete this.startTimes[quiz.quizId];
              delete this.endTimes[quiz.quizId];
              
              this.snackBar.open(
                `🔄 Quiz ${quizNumber} reset to Draft - session deleted`,
                'Close',
                { duration: 4000, panelClass: ['info-snackbar'] }
              );
            } catch (syncError) {
              console.error('Error syncing quiz status:', syncError);
            }
          }
          
          statusChanged = true; // Force reload to sync UI with database
        } else {
          console.error(`Error checking status for session ${quizNumber}:`, error);
        }
      }
    }

    // Check poll sessions
    for (const [pollId, sessionId] of this.activePollSessions.entries()) {
      console.log(`[StatusPolling] Checking poll session for poll ${pollId} (SessionId: ${sessionId})`);
      try {
        // Get poll details to check session status
        const poll = this.hostPolls().find(p => p.pollId === pollId);
        if (!poll || !poll.sessionCode) continue;

        // Check if session has ended (timer expired)
        const session = await this.quizPublishService.getQuizSessionByCode(poll.sessionCode);
        
        if (session) {
          // Update poll times
          if (session.startedAt) {
            const startDate = new Date(session.startedAt);
            this.pollStartTimes[pollId] = this.formatDateTimeLocal(startDate);
          }
          if (session.endedAt) {
            const endDate = new Date(session.endedAt);
            this.pollEndTimes[pollId] = this.formatDateTimeLocal(endDate);
            
            // Check if session timer has ended
            const now = new Date();
            if (endDate <= now && poll.pollStatus?.toLowerCase() !== 'completed') {
              console.log(`[StatusPolling] Poll ${pollId} timer ended - calling complete API`);
              
              // Call backend to complete the poll
              try {
                await new Promise((resolve, reject) => {
                  this.pollService.completePoll(pollId).subscribe({
                    next: (result) => {
                      console.log(`[StatusPolling] Poll ${pollId} completed successfully:`, result);
                      resolve(result);
                    },
                    error: (error) => {
                      console.error(`[StatusPolling] Failed to complete poll ${pollId}:`, error);
                      reject(error);
                    }
                  });
                });
                
                // Update poll status locally for immediate UI update
                poll.pollStatus = 'completed';
                this.hostPolls.set([...this.hostPolls()]);
                
                statusChanged = true;
                this.activePollSessions.delete(pollId);
                
                this.snackBar.open(
                  `🏁 Poll "${poll.pollTitle}" has been automatically completed`,
                  'Close',
                  { duration: 5000, panelClass: ['info-snackbar'] }
                );
              } catch (completeError) {
                console.error(`[StatusPolling] Error completing poll ${pollId}:`, completeError);
              }
            }
          }
          
          // Check status from backend
          const currentStatus = poll.pollStatus?.toLowerCase();
          const newStatus = session?.status?.toLowerCase();
          if (newStatus && currentStatus !== newStatus) {
            console.log(`Poll ${pollId} status changed: ${currentStatus} -> ${newStatus}`);
            statusChanged = true;
            if (newStatus === 'completed') {
              this.activePollSessions.delete(pollId);
            }
          }
        }
      } catch (error: any) {
        console.error(`Error checking poll session ${pollId}:`, error);
        if (error.status === 404) {
          this.activePollSessions.delete(pollId);
          statusChanged = true;
        }
      }
    }

    // Check survey sessions
    for (const [surveyId, sessionId] of this.activeSurveySessions.entries()) {
      console.log(`[StatusPolling] Checking survey session for survey ${surveyId} (SessionId: ${sessionId})`);
      try {
        // Get survey details to check session status
        const survey = this.hostSurveys().find(s => s.surveyId === surveyId);
        if (!survey || !survey.sessionCode) continue;

        // Check if session has ended (timer expired)
        const session = await this.quizPublishService.getQuizSessionByCode(survey.sessionCode);
        
        if (session) {
          // Update survey times
          if (session.startedAt) {
            const startDate = new Date(session.startedAt);
            this.surveyStartTimes[surveyId] = this.formatDateTimeLocal(startDate);
          }
          if (session.endedAt) {
            const endDate = new Date(session.endedAt);
            this.surveyEndTimes[surveyId] = this.formatDateTimeLocal(endDate);
            
            // Check if session timer has ended
            const now = new Date();
            if (endDate <= now && survey.status?.toLowerCase() !== 'completed') {
              console.log(`[StatusPolling] Survey ${surveyId} timer ended - calling complete API`);
              
              // Call backend to complete the survey
              try {
                await new Promise((resolve, reject) => {
                  this.surveyService.completeSurvey(surveyId).subscribe({
                    next: (result) => {
                      console.log(`[StatusPolling] Survey ${surveyId} completed successfully:`, result);
                      resolve(result);
                    },
                    error: (error) => {
                      console.error(`[StatusPolling] Failed to complete survey ${surveyId}:`, error);
                      reject(error);
                    }
                  });
                });
                
                // Update survey status locally for immediate UI update
                survey.status = 'completed';
                this.hostSurveys.set([...this.hostSurveys()]);
                
                statusChanged = true;
                this.activeSurveySessions.delete(surveyId);
                
                this.snackBar.open(
                  `🏁 Survey "${survey.title}" has been automatically completed`,
                  'Close',
                  { duration: 5000, panelClass: ['info-snackbar'] }
                );
              } catch (completeError) {
                console.error(`[StatusPolling] Error completing survey ${surveyId}:`, completeError);
              }
            }
          }
          
          // Check status from backend
          const currentStatus = survey.status?.toLowerCase();
          const newStatus = session?.status?.toLowerCase();
          if (newStatus && currentStatus !== newStatus) {
            console.log(`Survey ${surveyId} status changed: ${currentStatus} -> ${newStatus}`);
            statusChanged = true;
            if (newStatus === 'completed') {
              this.activeSurveySessions.delete(surveyId);
            }
          }
        }
      } catch (error: any) {
        console.error(`Error checking survey session ${surveyId}:`, error);
        if (error.status === 404) {
          this.activeSurveySessions.delete(surveyId);
          statusChanged = true;
        }
      }
    }

    // Reload content if any status changed
    if (statusChanged) {
      console.log('Status changed detected - reloading content after delay to ensure backend persistence');
      // Add small delay to ensure backend has persisted the status change
      setTimeout(async () => {
        await this.loadQuizzes();
        await this.loadPolls();
        await this.loadSurveys();
      }, 500);
    }
  }

  private async initializeQuizPublishService() {
    // Initialize SignalR connection for leaderboard settings
    try {
      await this.quizPublishService.initializeConnection(this.currentHostId());
      console.log('[ResultComponent] SignalR connection initialized for leaderboard management');
      
      const connectionSub = this.quizPublishService.connectionState$.subscribe(state => {
        console.log('SignalR Connection State:', state);
      });
      
      const quizPublishedSub = this.quizPublishService.quizPublished$.subscribe(data => {
        if (data) {
          this.snackBar.open(
            `📢 Quiz ${data.quizNumber} is now LIVE!`,
            'Close',
            { duration: 5000 }
          );
        }
      });

      this.subscriptions.push(connectionSub, quizPublishedSub);
    } catch (error) {
      console.warn('[ResultComponent] SignalR connection not available - real-time updates disabled. This is normal if backend is not running.');
      // Continue without SignalR - polling will handle status updates
    }
  }

  async loadQuizzes() {
    try {
      this.loading.set(true);
      
      // Get current host ID from computed signal
      let hostId = this.currentHostId();
      
      // If empty, try multiple fallback approaches
      if (!hostId) {
        console.warn('[ResultComponent] currentHostId() returned empty, trying fallbacks...');
        
        // Try getting user directly from auth service
        const user = this.authService.currentUser();
        if (user?.employeeId) {
          hostId = user.employeeId;
          console.log('[ResultComponent] Got hostId from currentUser():', hostId);
        }
        
        // Try localStorage directly as last resort
        if (!hostId && typeof localStorage !== 'undefined') {
          const userStr = localStorage.getItem('auth_user');
          if (userStr) {
            try {
              const storedUser = JSON.parse(userStr);
              hostId = storedUser?.employeeId || '';
              console.log('[ResultComponent] Got hostId from localStorage:', hostId);
            } catch (e) {
              console.error('[ResultComponent] Failed to parse localStorage user:', e);
            }
          }
        }
      }
      
      if (!hostId) {
        console.error('[ResultComponent] Cannot load quizzes - no host ID available after all fallbacks');
        this.snackBar.open('Unable to load quizzes. Please try logging in again.', 'Close', { duration: 3000 });
        this.loading.set(false);
        return;
      }
      
      console.log('[ResultComponent] Loading quizzes for hostId:', hostId);
      
      const quizzes = await this.store.getHostQuizzes(hostId);
      
      console.log('Loaded quizzes:', quizzes.map(q => ({
        id: q.quizId,
        number: q.quizNumber,
        name: q.quizName,
        status: q.status
      })));
      
      this.hostQuizzes.set(quizzes);
      
      // Load session times for active/completed quizzes and verify session exists
      for (const quiz of quizzes) {
        const status = quiz.status?.toLowerCase();
        
        if (status === 'active' || status === 'completed') {
          try {
            const session = await this.quizPublishService.getQuizSessionByCode(quiz.quizNumber);
            if (session) {
              // Track AutoModeEnabled status
              if ('autoModeEnabled' in session) {
                this.sessionModes.set(quiz.quizNumber, session.autoModeEnabled);
              }
              
              // Store session times in datetime-local format
              if (session.startedAt) {
                const startDate = new Date(session.startedAt);
                this.startTimes[quiz.quizId] = this.formatDateTimeLocal(startDate);
              }
              if (session.endedAt) {
                const endDate = new Date(session.endedAt);
                this.endTimes[quiz.quizId] = this.formatDateTimeLocal(endDate);
              }
              // Track active sessions only
              if (status === 'active' && session.sessionId) {
                this.activeSessionIds.set(quiz.quizNumber, session.sessionId);
              }
            }
          } catch (error: any) {
            // If 404, session was deleted but quiz still marked Active/Completed - sync it back to Draft
            if (error.status === 404) {
              console.log(`Quiz ${quiz.quizNumber} is ${status.toUpperCase()} but no session exists - syncing to Draft`);
              try {
                await this.store.syncQuizStatus(quiz.quizId);
                // Clear time inputs
                delete this.startTimes[quiz.quizId];
                delete this.endTimes[quiz.quizId];
                
                this.snackBar.open(
                  `🔄 Quiz ${quiz.quizNumber} reset to Draft - session was deleted`,
                  'Close',
                  { duration: 4000, panelClass: ['info-snackbar'] }
                );
                
                // Reload to reflect changes
                setTimeout(async () => {
                  await this.loadQuizzes();
                }, 500);
                return; // Exit to avoid further processing
              } catch (syncError) {
                console.error('Error syncing quiz status on load:', syncError);
              }
            } else {
              console.error(`Error loading session for ${status} quiz ${quiz.quizNumber}:`, error);
            }
          }
        }
      }
      
      // Clean up active sessions map - remove completed or draft quizzes
      for (const [quizNumber] of this.activeSessionIds.entries()) {
        const quiz = quizzes.find(q => q.quizNumber === quizNumber);
        if (!quiz || quiz.status?.toLowerCase() !== 'active') {
          console.log(`Removing ${quizNumber} from active tracking (status: ${quiz?.status})`);
          this.activeSessionIds.delete(quizNumber);
        }
      }
      
      // DO NOT auto-add active quizzes - only track sessions we explicitly created
      // This prevents checking for sessions that might not exist in QuizSession table
    } catch (error) {
      this.snackBar.open('Failed to load quizzes', 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async loadSurveys() {
    try {
      const surveys = await new Promise<SurveyOverview[]>((resolve, reject) => {
        this.surveyService.getAllSurveysV2().subscribe({
          next: (data) => resolve(data || []),
          error: (error) => reject(error)
        });
      });
      this.hostSurveys.set(surveys);
      console.log('Loaded surveys:', surveys?.length || 0, 'surveys');
      console.log('Survey session codes:', surveys.map(s => ({ id: s.surveyId, code: s.sessionCode, status: s.status })));
      
      // Load session times and track active surveys
      for (const survey of surveys) {
        const status = survey.status?.toLowerCase();
        
        if (status === 'active' || status === 'published') {
          // Track active/published surveys for status monitoring
          if (survey.sessionId && survey.sessionCode) {
            this.activeSurveySessions.set(survey.surveyId, survey.sessionId);
            
            // Load session times
            try {
              const session = await this.quizPublishService.getQuizSessionByCode(survey.sessionCode);
              if (session) {
                if (session.startedAt) {
                  const startDate = new Date(session.startedAt);
                  this.surveyStartTimes[survey.surveyId] = this.formatDateTimeLocal(startDate);
                }
                if (session.endedAt) {
                  const endDate = new Date(session.endedAt);
                  this.surveyEndTimes[survey.surveyId] = this.formatDateTimeLocal(endDate);
                }
              }
            } catch (error) {
              console.error(`Error loading session for survey ${survey.surveyId}:`, error);
            }
          }
        }
      }
      
      // Clean up tracking for completed/draft surveys
      for (const [surveyId] of this.activeSurveySessions.entries()) {
        const survey = surveys.find(s => s.surveyId === surveyId);
        if (!survey || (survey.status?.toLowerCase() !== 'active' && survey.status?.toLowerCase() !== 'published')) {
          this.activeSurveySessions.delete(surveyId);
        }
      }
    } catch (error) {
      console.error('Failed to load surveys:', error);
      this.hostSurveys.set([]);
    }
  }

  async loadPolls() {
    try {
      const polls = await new Promise<PollOverview[]>((resolve, reject) => {
        this.pollService.getAllPolls().subscribe({
          next: (data) => resolve(data || []),
          error: (error) => reject(error)
        });
      });
      this.hostPolls.set(polls);
      console.log('Loaded polls:', polls?.length || 0, 'polls');
      console.log('Poll session codes:', polls.map(p => ({ id: p.pollId, code: p.sessionCode, status: p.pollStatus })));
      
      // Load session times and track active polls
      for (const poll of polls) {
        const status = poll.pollStatus?.toLowerCase();
        
        if (status === 'active' || status === 'published') {
          // Track active/published polls for status monitoring
          if (poll.sessionId && poll.sessionCode) {
            this.activePollSessions.set(poll.pollId, poll.sessionId);
            
            // Load session times
            try {
              const session = await this.quizPublishService.getQuizSessionByCode(poll.sessionCode);
              if (session) {
                if (session.startedAt) {
                  const startDate = new Date(session.startedAt);
                  this.pollStartTimes[poll.pollId] = this.formatDateTimeLocal(startDate);
                }
                if (session.endedAt) {
                  const endDate = new Date(session.endedAt);
                  this.pollEndTimes[poll.pollId] = this.formatDateTimeLocal(endDate);
                }
              }
            } catch (error) {
              console.error(`Error loading session for poll ${poll.pollId}:`, error);
            }
          }
        }
      }
      
      // Clean up tracking for completed/draft polls
      for (const [pollId] of this.activePollSessions.entries()) {
        const poll = polls.find(p => p.pollId === pollId);
        if (!poll || (poll.pollStatus?.toLowerCase() !== 'active' && poll.pollStatus?.toLowerCase() !== 'published')) {
          this.activePollSessions.delete(pollId);
        }
      }
    } catch (error) {
      console.error('Failed to load polls:', error);
      this.hostPolls.set([]);
    }
  }

  editQuiz(quizId: number) {
    this.router.navigate(['/quiz', quizId, 'edit']);
  }

  async deleteQuiz(quizId: number) {
    const confirmed = confirm('Are you sure you want to delete this quiz?');
    if (confirmed) {
      try {
        await this.store.deleteQuiz(quizId);
        delete this.quizAnalytics[quizId];
        this.snackBar.open('Quiz deleted successfully', 'Close', { duration: 3000 });
      } catch (error) {
        this.snackBar.open('Failed to delete quiz', 'Close', { duration: 3000 });
      }
    }
  }

  private calculateAnalytics(quiz: QuizListItem): Analytics {
    const participants: any[] = (quiz as any).participants || [];
    const totalParticipants = participants.length;
    
    if (totalParticipants === 0) {
      return {
        totalParticipants: 0,
        averageScore: 0,
        completionRate: 0,
        topScore: 0,
        worstScore: 0,
        participantDetails: [],
      };
    }

    const scores = participants.map((p: any) => p.score || 0);
    const averageScore = scores.reduce((a: number, b: number) => a + b, 0) / totalParticipants;
    const topScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const completedCount = participants.filter((p: any) => p.completedAt).length;
    const completionRate = (completedCount / totalParticipants) * 100;

    return {
      totalParticipants,
      averageScore: Math.round(averageScore * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      topScore,
      worstScore,
      participantDetails: participants.map((p: any) => ({
        participantName: p.name,
        score: p.score || 0,
        timeTaken: p.timeTaken || 'N/A',
        completedAt: p.completedAt || new Date(),
      })),
    };
  }

  async publishQuiz(quizNumber: string) {
    // Prevent duplicate calls
    if (this.publishingInProgress.has(quizNumber)) {
      console.log(`[PublishQuiz] Already publishing quiz ${quizNumber}, ignoring duplicate call`);
      return;
    }

    try {
      this.publishingInProgress.add(quizNumber);
      
      const quiz = this.hostQuizzes().find((q: QuizListItem) => q.quizNumber === quizNumber);
      
      if (!quiz) {
        this.snackBar.open('⚠️ Quiz not found', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
        return;
      }

      const startTimeInput = this.startTimes[quiz.quizId];

      // Validate that start time is provided
      if (!startTimeInput) {
        this.snackBar.open('⚠️ Start time is required', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      // Convert datetime-local format to ISO string
      let startTime: string | undefined;

      if (startTimeInput) {
        const startDate = new Date(startTimeInput);
        const now = new Date();
        
        // Validate start time is in the future
        if (startDate <= now) {
          this.snackBar.open('⚠️ Start time must be in the future', 'Close', {
            duration: 4000,
            panelClass: ['warning-snackbar'],
          });
          return;
        }
        
        startTime = startDate.toISOString();
      }

      console.log('Publishing quiz:', {
        quizId: quiz.quizId,
        quizNumber,
        quizName: quiz.quizName,
        currentStatus: quiz.status,
        startTimeInput,
        startTimeISO: startTime,
        currentTime: new Date().toISOString()
      });

      console.log(`[PublishQuiz] Calling createQuizSession for QuizId=${quiz.quizId}, QuizNumber=${quizNumber}`);

      // Create QuizSession with scheduled start time
      const sessionResponse = await this.quizPublishService.createQuizSession(
        quiz.quizId,
        this.currentHostId(),
        quizNumber,
        startTime, // Send scheduled start time
        undefined, // No end time
        'Active'
      );

      console.log(`[PublishQuiz] Session created successfully:`, sessionResponse);

      // Track this session for status monitoring
      this.activeSessionIds.set(quizNumber, sessionResponse.sessionId);
      
      // ✅ Copy host's theme to the session so participants see it
      const hostId = this.currentHostId();
      if (hostId && sessionResponse.sessionCode) {
        console.log(`[PublishQuiz] Copying host theme to session ${sessionResponse.sessionCode}`);
        this.themeStore.copyHostThemeToSession(sessionResponse.sessionCode, hostId);
      }

      // Update Quiz status to 'Active' to stay synchronized
      try {
        await this.store.updateQuizStatus(quiz.quizId, 'Active');
        console.log(`[PublishQuiz] Quiz status updated to Active`);
      } catch (statusError) {
        console.error('[PublishQuiz] Failed to update quiz status:', statusError);
        // Continue anyway since session was created
      }

      // Note: Quiz will auto-start at scheduled time via background service
      // Or host can force start from lobby before scheduled time
      console.log(`[PublishQuiz] Quiz scheduled to start at: ${startTime}`);

      console.log('Session created:', sessionResponse);

      this.snackBar.open(
        `✅ Quiz ${quizNumber} published! Scheduled start: ${new Date(startTime!).toLocaleString()}`,
        'Close',
        {
          duration: 5000,
          panelClass: ['success-snackbar'],
        }
      );

      // Reload quizzes immediately to reflect status change
      await this.loadQuizzes();
    } catch (error: any) {
      console.error('Error publishing quiz:', error);
      
      // Extract backend error message
      let errorMessage = 'Failed to publish quiz';
      if (error.status === 500) {
        errorMessage = error.error?.message || error.error?.title || 'Server error - check backend logs';
      } else if (error.status === 409) {
        errorMessage = 'Quiz already published or session conflict';
      } else if (error.status === 400) {
        errorMessage = error.error?.message || 'Invalid quiz data';
      } else if (error.status === 0) {
        errorMessage = 'Cannot connect to backend server. Please start the backend.';
      }
      
      this.snackBar.open(`⚠️ ${errorMessage}`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.publishingInProgress.delete(quizNumber);
    }
  }

  async republishQuiz(quizNumber: string) {
    // Republish uses the same logic as publish
    await this.publishQuiz(quizNumber);
  }

  private generateSessionCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  onStartTimeChange(id: number, event: Event, type: 'quiz' | 'survey' | 'poll' = 'quiz') {
    const input = event.target as HTMLInputElement;
    this.startTimes![id] = input.value;
    console.log(`Start time for ${type} ${id}:`, input.value);
    
    // Convert to ISO string for backend
    if (input.value) {
      const date = new Date(input.value);
      console.log(`Converted start time:`, date.toISOString(), `Local:`, date.toString());
    }
  }

  onEndTimeChange(quizId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.endTimes[quizId] = input.value;
    console.log(`End time for quiz ${quizId}:`, input.value);
    
    // Convert to ISO string for backend
    if (input.value) {
      const date = new Date(input.value);
      console.log(`Converted end time:`, date.toISOString(), `Local:`, date.toString());
    }
  }

  // Poll time handlers
  onPollStartTimeChange(pollId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.pollStartTimes[pollId] = input.value;
    console.log(`Start time for poll ${pollId}:`, input.value);
  }

  onPollEndTimeChange(pollId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.pollEndTimes[pollId] = input.value;
    console.log(`End time for poll ${pollId}:`, input.value);
  }

  // Survey time handlers
  onSurveyStartTimeChange(surveyId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.surveyStartTimes[surveyId] = input.value;
    console.log(`Start time for survey ${surveyId}:`, input.value);
  }

  onSurveyEndTimeChange(surveyId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.surveyEndTimes[surveyId] = input.value;
    console.log(`End time for survey ${surveyId}:`, input.value);
  }

  /**
   * Format Date object to datetime-local input format (YYYY-MM-DDTHH:mm)
   */
  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Format Date to display format (for UI display)
   */
  formatDateTime(date: Date | string | undefined | null): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
    }, 1000);
  }

  // Tutorial methods
  startTutorial(): void {
    const componentName = this.getComponentContext();
    if (this.tutorialService.shouldAutoStart(componentName)) {
      console.log(`Auto-starting tutorial for ${componentName} component`);
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, componentName);
    } else {
      console.log(`Tutorial already seen for ${componentName} component`);
    }
  }

  resetTutorial(): void {
    const componentName = this.getComponentContext();
    this.tutorialService.resetTutorial(componentName);
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, componentName);
  }

  private getComponentContext(): string {
    // Determine the context based on the current route
    const currentUrl = this.router.url;
    if (currentUrl.includes('/host/manage-content')) {
      return 'manage-content';
    }
    return 'results';
  }

  nextTutorialStep(): void {
    this.tutorialService.nextStep();
  }

  previousTutorialStep(): void {
    this.tutorialService.previousStep();
  }

  skipTutorial(): void {
    this.tutorialService.skipTutorial();
  }

  getCurrentStep(): TutorialStep | null {
    return this.tutorialService.getCurrentStepData();
  }

  getSpotlightPosition(): { top: string; left: string; width: string; height: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: `${rect.top - 5}px`,
      left: `${rect.left - 5}px`,
      width: `${rect.width + 10}px`,
      height: `${rect.height + 10}px`
    };
  }

  getPopupPosition(): { top: string; left: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const popupWidth = 350;
    const popupHeight = 200;

    let top = rect.top;
    let left = rect.left;

    switch (currentStep.position) {
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'top':
        top = rect.top - popupHeight - 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.left - popupWidth - 10;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.right + 10;
        break;
    }

    // Ensure popup stays within viewport
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
    if (top < 10) top = 10;
    if (top + popupHeight > window.innerHeight - 10) top = window.innerHeight - popupHeight - 10;

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  }

  /**
   * Enter Host Lobby - Opens host lobby for quiz, survey, or poll
   */
  async enterLobby(id: number | string, sessionId: number | null | undefined, type: 'quiz' | 'survey' | 'poll' = 'quiz') {
    try {
      if (type === 'quiz') {
        // For quiz, get the session by quiz number
        const session = await this.quizPublishService.getQuizSessionByCode(id.toString());
        
        if (!session || !session.sessionCode) {
          this.snackBar.open('⚠️ No active session found for this quiz', 'Close', {
            duration: 4000,
            panelClass: ['warning-snackbar']
          });
          return;
        }

        // Open host dashboard in new tab with session code and manual control flag
        const url = `/host-lobby?sessionCode=${session.sessionCode}&quizId=${id}&mode=manual`;
        window.open(url, '_blank');
      } else {
        // Validate sessionId
        if (!sessionId || sessionId === 0) {
          this.snackBar.open(`⚠️ No session found. Please publish the ${type} first.`, 'Close', {
            duration: 4000,
            panelClass: ['warning-snackbar']
          });
          return;
        }
        
        // For survey/poll, get session code first
        let sessionCode = '';
        try {
          const sessionResponse = await fetch(`${environment.apiBaseUrl}/Host/QuizSession/${sessionId}`);
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            sessionCode = sessionData.sessionCode || '';
          } else {
            console.error('Failed to fetch session:', sessionResponse.status);
            this.snackBar.open(`⚠️ Failed to load ${type} session. Please publish again.`, 'Close', {
              duration: 4000,
              panelClass: ['error-snackbar']
            });
            return;
          }
        } catch (e) {
          console.error('Failed to fetch session code:', e);
          this.snackBar.open(`⚠️ Failed to load ${type} session.`, 'Close', {
            duration: 4000,
            panelClass: ['error-snackbar']
          });
          return;
        }

        // Store info in localStorage and navigate with session code
        if (type === 'survey') {
          localStorage.setItem('sessionType', 'survey');
          localStorage.setItem('surveyId', id.toString());
          localStorage.setItem('sessionId', sessionId.toString());
        } else {
          localStorage.setItem('sessionType', 'poll');
          localStorage.setItem('pollId', id.toString());
          localStorage.setItem('sessionId', sessionId.toString());
        }
        
        // Navigate with sessionCode if available
        if (sessionCode) {
          this.router.navigate(['/host-lobby'], { 
            queryParams: { sessionCode, mode: 'manual' } 
          });
        } else {
          this.router.navigate(['/host-lobby']);
        }
      }

      this.snackBar.open('🎮 Opening Host Lobby...', 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } catch (error: any) {
      console.error('Error entering lobby:', error);
      this.snackBar.open('⚠️ Failed to enter lobby', 'Close', {
        duration: 4000,
        panelClass: ['error-snackbar']
      });
    }
  }

  /**
   * View Results & Analysis - Navigate to results page
   */
  viewResults(quizNumber: string) {
    this.router.navigate(['/results-analysis'], {
      queryParams: { sessionCode: quizNumber }
    });
  }

  /**
   * Toggle leaderboard settings panel for a quiz
   */
  toggleLeaderboardPanel(quizId: number) {
    this.showLeaderboardPanel[quizId] = !this.showLeaderboardPanel[quizId];
  }

  /**
   * Check if quiz is in AUTO mode (leaderboard settings should only work in AUTO mode)
   */
  isAutoMode(quizNumber: string): boolean {
    return this.sessionModes.get(quizNumber) !== false; // Default to true if unknown
  }

  /**
   * Update leaderboard setting - show after each question (AUTO MODE ONLY)
   */
  async updateShowAfterQuestion(sessionCode: string, enabled: boolean) {
    // Only allow in AUTO mode
    if (!this.isAutoMode(sessionCode)) {
      this.snackBar.open('⚠️ Leaderboard settings only work in AUTO mode. Use lobby controls when host is present.', 'Close', { duration: 4000 });
      return;
    }
    
    try {
      // Update via SignalR
      await this.quizPublishService.setShowLeaderboardAfterQuestion(sessionCode, enabled);
      
      if (!this.leaderboardSettings[sessionCode]) {
        this.leaderboardSettings[sessionCode] = { showAfterQuestion: false, showAtEndOnly: false };
      }
      this.leaderboardSettings[sessionCode].showAfterQuestion = enabled;
      
      const message = enabled 
        ? '✅ Leaderboard will show after each question' 
        : '🔒 Leaderboard will NOT show after questions';
      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to update leaderboard setting:', error);
      this.snackBar.open('⚠️ Failed to update setting', 'Close', { duration: 3000 });
    }
  }

  /**
   * Update leaderboard setting - show at end only (AUTO MODE ONLY)
   */
  async updateShowAtEndOnly(sessionCode: string, enabled: boolean) {
    // Only allow in AUTO mode
    if (!this.isAutoMode(sessionCode)) {
      this.snackBar.open('⚠️ Leaderboard settings only work in AUTO mode. Use lobby controls when host is present.', 'Close', { duration: 4000 });
      return;
    }
    
    try {
      // Update via SignalR
      await this.quizPublishService.setShowLeaderboardAtEndOnly(sessionCode, enabled);
      
      if (!this.leaderboardSettings[sessionCode]) {
        this.leaderboardSettings[sessionCode] = { showAfterQuestion: false, showAtEndOnly: false };
      }
      this.leaderboardSettings[sessionCode].showAtEndOnly = enabled;
      
      const message = enabled 
        ? '✅ Leaderboard will show only at quiz end' 
        : '🔒 End-only mode disabled';
      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to update leaderboard setting:', error);
      this.snackBar.open('⚠️ Failed to update setting', 'Close', { duration: 3000 });
    }
  }

  /**
   * Update leaderboard display timer duration (AUTO MODE ONLY)
   */
  updateLeaderboardTimer(sessionCode: string, duration: number) {
    // Only allow in AUTO mode
    if (!this.isAutoMode(sessionCode)) {
      this.snackBar.open('⚠️ Leaderboard settings only work in AUTO mode. Use lobby controls when host is present.', 'Close', { duration: 4000 });
      return;
    }
    
    if (duration < 1) duration = 1;
    if (duration > 60) duration = 60;
    
    this.leaderboardTimers[sessionCode] = duration;
    
    if (!this.leaderboardSettings[sessionCode]) {
      this.leaderboardSettings[sessionCode] = { showAfterQuestion: false, showAtEndOnly: false };
    }
    this.leaderboardSettings[sessionCode].displayDuration = duration;
    
    console.log(`[ResultComponent] Leaderboard timer set to ${duration}s for session ${sessionCode}`);
    this.snackBar.open(`⏱️ Leaderboard will display for ${duration} seconds`, 'Close', { duration: 2000 });
  }

  /**
   * View current leaderboard for an active session
   */
  async viewLeaderboardForQuiz(quizNumber: string) {
    try {
      const session = await this.quizPublishService.getQuizSessionByCode(quizNumber);
      if (!session || !session.sessionId) {
        this.snackBar.open('⚠️ No active session found', 'Close', { duration: 3000 });
        return;
      }

      // Open leaderboard in new window or navigate
      this.router.navigate(['/host/leaderboard'], {
        queryParams: { sessionId: session.sessionId }
      });
    } catch (error) {
      console.error('Failed to view leaderboard:', error);
      this.snackBar.open('⚠️ Failed to load leaderboard', 'Close', { duration: 3000 });
    }
  }

  /**
   * View survey results
   */
  viewSurveyResults(surveyId: number) {
    try {
      // Store survey ID and navigate to survey results component
      localStorage.setItem('currentSurveyId', surveyId.toString());
      this.router.navigate(['/result-survey'], {
        queryParams: { surveyId: surveyId }
      });
    } catch (error) {
      console.error('Failed to navigate to survey results:', error);
      this.snackBar.open('⚠️ Failed to open survey results', 'Close', { duration: 3000 });
    }
  }

  /**
   * View survey word cloud
   */
  viewSurveyWordCloud(surveyId: number, sessionId: number) {
    try {
      this.router.navigate(['/word-cloud'], {
        queryParams: { surveyId: surveyId, sessionId: sessionId }
      });
    } catch (error) {
      console.error('Failed to navigate to word cloud:', error);
      this.snackBar.open('⚠️ Failed to open word cloud', 'Close', { duration: 3000 });
    }
  }

  /**
   * View poll results
   */
  viewPollResults(pollId: number) {
    try {
      // Store poll ID and navigate to poll results component
      localStorage.setItem('currentPollId', pollId.toString());
      this.router.navigate(['/result-poll'], {
        queryParams: { pollId: pollId }
      });
    } catch (error) {
      console.error('Failed to navigate to poll results:', error);
      this.snackBar.open('⚠️ Failed to open poll results', 'Close', { duration: 3000 });
    }
  }

  /**
   * Publish survey
   */
  async publishSurvey(surveyId: number) {
    try {
      const survey = this.hostSurveys().find(s => s.surveyId === surveyId);
      if (!survey) {
        this.snackBar.open('⚠️ Survey not found', 'Close', { duration: 3000 });
        return;
      }

      const startTimeInput = this.startTimes[surveyId];
      if (!startTimeInput) {
        this.snackBar.open('⚠️ Start time is required', 'Close', { duration: 4000 });
        return;
      }

      // Send datetime as-is (local time) - don't convert to ISO/UTC
      const startTime = startTimeInput;
      const employeeId = this.currentHostId();

      const result = await new Promise<any>((resolve, reject) => {
        this.surveyService.publishSurveyV2(surveyId, { startTime, employeeId }).subscribe({
          next: (data) => resolve(data),
          error: (error) => reject(error)
        });
      });

      this.snackBar.open(
        `✅ Survey published! Session Code: ${result.sessionCode || 'N/A'}`,
        'Close',
        { duration: 5000, panelClass: ['success-snackbar'] }
      );

      // Reload surveys
      await this.loadSurveys();
    } catch (error: any) {
      console.error('Error publishing survey:', error);
      const errorMsg = error.error?.message || 'Failed to publish survey';
      this.snackBar.open(`⚠️ ${errorMsg}`, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
    }
  }

  /**
   * Republish survey (after completion)
   */
  async republishSurvey(surveyId: number) {
    try {
      const survey = this.hostSurveys().find(s => s.surveyId === surveyId);
      if (!survey) {
        this.snackBar.open('⚠️ Survey not found', 'Close', { duration: 3000 });
        return;
      }

      const startTimeInput = this.startTimes[surveyId];
      if (!startTimeInput) {
        this.snackBar.open('⚠️ Start time is required', 'Close', { duration: 4000 });
        return;
      }

      // Send datetime as-is (local time) - don't convert to ISO/UTC
      const startTime = startTimeInput;
      const employeeId = this.currentHostId();

      const result = await new Promise<any>((resolve, reject) => {
        this.surveyService.publishSurveyV2(surveyId, { startTime, employeeId }).subscribe({
          next: (data) => resolve(data),
          error: (error) => reject(error)
        });
      });

      this.snackBar.open(
        `✅ Survey republished! Session Code: ${result.sessionCode || 'N/A'}`,
        'Close',
        { duration: 5000, panelClass: ['success-snackbar'] }
      );

      await this.loadSurveys();
    } catch (error: any) {
      console.error('Error republishing survey:', error);
      const errorMsg = error.error?.message || 'Failed to republish survey';
      this.snackBar.open(`⚠️ ${errorMsg}`, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
    }
  }

  /**
   * View survey details (read-only)
   */
  viewSurvey(surveyId: number) {
    this.router.navigate(['/survey', surveyId, 'view']);
  }

  /**
   * Manually complete a survey
   */
  async completeSurvey(surveyId: number) {
    console.log('[ResultComponent] completeSurvey called with surveyId:', surveyId);
    const confirmed = confirm('Are you sure you want to end this survey? Participants will no longer be able to respond.');
    if (!confirmed) {
      console.log('[ResultComponent] Survey completion cancelled by user');
      return;
    }

    console.log('[ResultComponent] Calling survey service to complete survey:', surveyId);
    try {
      await new Promise<void>((resolve, reject) => {
        this.surveyService.completeSurvey(surveyId).subscribe({
          next: (result) => {
            console.log('[ResultComponent] Survey completed successfully:', result);
            resolve();
          },
          error: (error) => {
            console.error('[ResultComponent] Survey completion error:', error);
            reject(error);
          }
        });
      });

      this.snackBar.open('✅ Survey completed successfully', 'Close', { duration: 3000 });
      
      // Update local status immediately
      const surveys = this.hostSurveys();
      const survey = surveys.find(s => s.surveyId === surveyId);
      if (survey) {
        survey.status = 'completed';
        this.hostSurveys.set([...surveys]);
      }
      
      // Reload after delay
      setTimeout(async () => {
        await this.loadSurveys();
      }, 500);
    } catch (error: any) {
      console.error('Failed to complete survey:', error);
      const errorMsg = error.error?.message || 'Failed to complete survey';
      this.snackBar.open(`⚠️ ${errorMsg}`, 'Close', { duration: 3000 });
    }
  }

  /**
   * Delete survey
   */
  async deleteSurvey(surveyId: number) {
    const confirmed = confirm('Are you sure you want to delete this survey?');
    if (confirmed) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.surveyService.deleteSurveyV2(surveyId).subscribe({
            next: () => resolve(),
            error: (error) => reject(error)
          });
        });

        this.snackBar.open('✅ Survey deleted successfully', 'Close', { duration: 3000 });
        await this.loadSurveys();
      } catch (error) {
        console.error('Failed to delete survey:', error);
        this.snackBar.open('⚠️ Failed to delete survey', 'Close', { duration: 3000 });
      }
    }
  }

  /**
   * Publish poll
   */
  async publishPoll(pollId: number) {
    try {
      const poll = this.hostPolls().find(p => p.pollId === pollId);
      if (!poll) {
        this.snackBar.open('⚠️ Poll not found', 'Close', { duration: 3000 });
        return;
      }

      const startTimeInput = this.startTimes[pollId];
      if (!startTimeInput) {
        this.snackBar.open('⚠️ Start time is required', 'Close', { duration: 4000 });
        return;
      }

      // Send datetime as-is (local time) - don't convert to ISO/UTC
      const startTime = startTimeInput;
      const employeeId = this.currentHostId();

      const result = await new Promise<any>((resolve, reject) => {
        this.pollService.publishPoll(pollId, { startTime, employeeId }).subscribe({
          next: (data) => resolve(data),
          error: (error) => reject(error)
        });
      });

      this.snackBar.open(
        `✅ Poll published! Session Code: ${result.sessionCode || 'N/A'}`,
        'Close',
        { duration: 5000, panelClass: ['success-snackbar'] }
      );

      await this.loadPolls();
    } catch (error: any) {
      console.error('Error publishing poll:', error);
      const errorMsg = error.error?.message || error.error?.error || 'Failed to publish poll';
      this.snackBar.open(`⚠️ ${errorMsg}`, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
    }
  }

  /**
   * Republish poll
   */
  async republishPoll(pollId: number) {
    try {
      const poll = this.hostPolls().find(p => p.pollId === pollId);
      if (!poll) {
        this.snackBar.open('⚠️ Poll not found', 'Close', { duration: 3000 });
        return;
      }

      const startTimeInput = this.startTimes[pollId];
      if (!startTimeInput) {
        this.snackBar.open('⚠️ Start time is required', 'Close', { duration: 4000 });
        return;
      }

      // Send datetime as-is (local time) - don't convert to ISO/UTC
      const startTime = startTimeInput;
      const employeeId = this.currentHostId();

      const result = await new Promise<any>((resolve, reject) => {
        this.pollService.publishPoll(pollId, { startTime, employeeId }).subscribe({
          next: (data) => resolve(data),
          error: (error) => reject(error)
        });
      });

      this.snackBar.open(
        `✅ Poll republished! Session Code: ${result.sessionCode || 'N/A'}`,
        'Close',
        { duration: 5000, panelClass: ['success-snackbar'] }
      );

      await this.loadPolls();
    } catch (error: any) {
      console.error('Error republishing poll:', error);
      const errorMsg = error.error?.message || error.error?.error || 'Failed to republish poll';
      this.snackBar.open(`⚠️ ${errorMsg}`, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
    }
  }

  /**
   * View poll details (read-only)
   */
  viewPoll(pollId: number) {
    this.router.navigate(['/poll', pollId, 'view']);
  }

  /**
   * Manually complete a poll
   */
  async completePoll(pollId: number) {
    console.log('[ResultComponent] completePoll called with pollId:', pollId);
    const confirmed = confirm('Are you sure you want to end this poll? Participants will no longer be able to vote.');
    if (!confirmed) {
      console.log('[ResultComponent] Poll completion cancelled by user');
      return;
    }

    console.log('[ResultComponent] Calling poll service to complete poll:', pollId);
    try {
      await new Promise<void>((resolve, reject) => {
        this.pollService.completePoll(pollId).subscribe({
          next: (result) => {
            console.log('[ResultComponent] Poll completed successfully:', result);
            resolve();
          },
          error: (error) => {
            console.error('[ResultComponent] Poll completion error:', error);
            reject(error);
          }
        });
      });

      this.snackBar.open('✅ Poll completed successfully', 'Close', { duration: 3000 });
      
      // Update local status immediately
      const polls = this.hostPolls();
      const poll = polls.find(p => p.pollId === pollId);
      if (poll) {
        poll.pollStatus = 'completed';
        this.hostPolls.set([...polls]);
      }
      
      // Reload after delay
      setTimeout(async () => {
        await this.loadPolls();
      }, 500);
    } catch (error: any) {
      console.error('Failed to complete poll:', error);
      const errorMsg = error.error?.message || 'Failed to complete poll';
      this.snackBar.open(`⚠️ ${errorMsg}`, 'Close', { duration: 3000 });
    }
  }

  /**
   * Delete poll
   */
  async deletePoll(pollId: number) {
    const confirmed = confirm('Are you sure you want to delete this poll?');
    if (confirmed) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.pollService.deletePoll(pollId).subscribe({
            next: () => resolve(),
            error: (error: any) => reject(error)
          });
        });

        this.snackBar.open('✅ Poll deleted successfully', 'Close', { duration: 3000 });
        await this.loadPolls();
      } catch (error) {
        console.error('Failed to delete poll:', error);
        this.snackBar.open('⚠️ Failed to delete poll', 'Close', { duration: 3000 });
      }
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.quizPublishService.disconnect();
    
    // Clear status polling interval
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  }
}

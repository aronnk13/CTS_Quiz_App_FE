import { Component, OnInit, OnDestroy, HostListener, inject, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ParticipantService } from '../../services/participant.service';
import { QuestionDetail, SubmitAnswerRequest } from '../../models/participant.models';
import { environment } from '../../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../services/auth.service';
import { ResultPollComponent } from '../result-poll/result-poll.component';
import { ResultSurveyComponent } from '../result-survey/result-survey.component';
import { OptionBargraphComponent } from '../option-bargraph/option-bargraph.component';
import { MyRankComponent } from '../my-rank/my-rank.component';
import { LeaderboardTopnComponent } from '../leaderboard-topn/leaderboard-topn.component';
import { LeaderboardPodiumComponent } from '../leaderboard-podium/leaderboard-podium.component';
import { LeaderboardProgressiveComponent } from '../leaderboard-progressive/leaderboard-progressive.component';
import { LeaderboardCategoryComponent } from '../leaderboard-category/leaderboard-category.component';

type Question = { 
  id: string; 
  text: string; 
  options: string[]; 
  answer: string; 
  timerSeconds: number;
  minSelect?: number;
  maxSelect?: number;
  maxLength?: number;
  placeholder?: string;
};

@Component({
  selector: 'app-quiz-page',
  standalone: true,
  imports: [
    NgIf, NgFor, FormsModule, MatSnackBarModule, ResultPollComponent, ResultSurveyComponent,
    OptionBargraphComponent, MyRankComponent, LeaderboardTopnComponent, LeaderboardPodiumComponent,
    LeaderboardProgressiveComponent, LeaderboardCategoryComponent
  ],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizPageComponent implements OnInit, OnDestroy {
  questions: Question[] = [];
  questionDetails: QuestionDetail[] = [];
  
  currentIndex = 0;
  score = 0;
  selected: string | null = null;
  selectedMultiple: Set<string> = new Set(); // For multiple choice questions
  rankingOrder: string[] = []; // For ranking questions
  selectedRanking: string[] = []; // For checkbox-based ranking UI
  ratingValue: number = 0; // For rating questions
  textAnswer: string = ''; // For text questions
  finished = false;
  loading = true; 
  submitting = false; // Separate flag for answer submission
  waitingForNext = false;
  answerStates: { [key: number]: 'answered' | 'missed' } = {}; // Track answer states for progress bar

  participantId: number = 0;
  sessionId: number = 0;
  quizTitle: string = '';
  sessionCode: string = '';
  participantName: string = '';
  sessionType: 'quiz' | 'survey' | 'poll' = 'quiz'; // quiz, survey, or poll
  questionType: string = 'single_choice'; // For current question type
  currentPollId: number | null = null; // For displaying result-poll component
  currentSurveyId: number | null = null; // For displaying result-survey component

  // Signal properties for child components
  questionIdSignal = signal<number>(0);
  sessionIdSignal = signal<number>(0);
  participantIdSignal = signal<string | number>('');
  participantIdStringSignal = signal<string | null>(null); // For leaderboard components that need string | null
  topNSignal = signal<number>(3); // For top-N count
  topNOverlaySignal = signal<number>(5); // For top-N overlay display

  // Leaderboard display properties
  showLeaderboardOverlay: boolean = false;
  leaderboardType: 'top3' | 'podium' | 'topn' | 'progressive' | 'category' | 'full' = 'top3'; // Type of leaderboard to show
  leaderboardCountdown: number = 0;
  private leaderboardTimer: any;
  showLeaderboardAfterQuestion: boolean = false; // Track if leaderboard should show after each question
  
  // Track specific leaderboard types enabled by host
  hostEnabledLeaderboardType: 'option-bar' | 'topn' | 'podium' | 'progressive' | 'category' | 'full' | null = null;

  // Overlay display properties (converted to signals for better reactivity)
  showOptionBarGraphOverlay = signal<boolean>(false);
  showPersonalRankOverlay = signal<boolean>(false);
  optionBarGraphData = signal<any>(null);
  personalRankData = signal<any>(null);
  
  // Interactive leaderboard overlay signals
  showTopNLeaderboardOverlay = signal<boolean>(false);
  showProgressiveLeaderboardOverlay = signal<boolean>(false);
  showCategoryLeaderboardOverlay = signal<boolean>(false);
  topNLeaderboardData = signal<any>(null);
  progressiveLeaderboardData = signal<any>(null);
  categoryLeaderboardData = signal<any>(null);
  
  private autoDisplayTimer: any;

  // Question-wise result display for polls/surveys
  showQuestionResult: boolean = false;
  questionResultCountdown: number = 0;
  private questionResultTimer: any;
  nextQuestionCountdown: number = 0;
  private nextQuestionTimer: any;

  // Timer properties
  timeRemaining: number = 30;
  // Remove syncInterval - we'll use SignalR timer sync instead
  serverTimeOffsetMs: number = 0;
  startedAtMs: number = 0;
  currentQuestionStartMs: number = 0;
  currentQuestionEndMs: number = 0;
  submittedIndex: number | null = null;
  private lastBackWarnAt = 0;
  private timerSyncEnabled: boolean = false; // Track if we're using host's timer
  private localTimerInterval: any; // Local timer for surveys/polls
  private isHostPresent: boolean = false; // Track if host is in lobby (MANUAL mode)
  
  // State Machine: Ensures only one UI state is active at a time
  private currentUIState: 'question' | 'waiting' | 'leaderboard' | 'result' | 'podium' = 'question';

  private hubConnection?: signalR.HubConnection;

  private snackBar = inject(MatSnackBar);
  private authService = inject(AuthService);
  private participantService = inject(ParticipantService);
  router = inject(Router);

  async ngOnInit() {
    // Get participant and session data from localStorage
    const participantIdStr = localStorage.getItem('participantId');
    const sessionIdStr = localStorage.getItem('sessionId');
    const quizTitleStr = localStorage.getItem('quizTitle');
    const sessionCodeStr = localStorage.getItem('sessionCode');
    const participantNameStr = localStorage.getItem('participantName') || localStorage.getItem('userName');
    const sessionTypeStr = localStorage.getItem('sessionType');

    if (!participantIdStr || !sessionIdStr) {
      this.snackBar.open('No session found. Please join a quiz first.', 'Close', { duration: 3000 });
      this.router.navigate(['/participant']);
      return;
    }

    this.participantId = parseInt(participantIdStr, 10);
    this.sessionId = parseInt(sessionIdStr, 10);
    this.quizTitle = quizTitleStr || 'Quiz';
    this.sessionCode = sessionCodeStr || '';
    this.participantName = participantNameStr || '';
    this.sessionType = (sessionTypeStr as any) || 'quiz';

    // Initialize signal properties
    this.sessionIdSignal.set(this.sessionId);
    this.participantIdSignal.set(this.participantId);
    this.participantIdStringSignal.set(this.participantId.toString());

    // Load poll or survey ID for result component display
    if (this.sessionType === 'poll') {
      const pollIdStr = localStorage.getItem('currentPollId') || localStorage.getItem('pollId');
      if (pollIdStr) {
        this.currentPollId = parseInt(pollIdStr, 10);
      }
    } else if (this.sessionType === 'survey') {
      const surveyIdStr = localStorage.getItem('currentSurveyId') || localStorage.getItem('surveyId');
      if (surveyIdStr) {
        this.currentSurveyId = parseInt(surveyIdStr, 10);
      }
    }

    // Restore answerStates from localStorage
    const savedAnswerStates = localStorage.getItem('answerStates');
    if (savedAnswerStates) {
      try {
        this.answerStates = JSON.parse(savedAnswerStates);
        console.log('[QuizPage] Restored answerStates from localStorage:', this.answerStates);
      } catch (e) {
        console.error('[QuizPage] Failed to parse answerStates:', e);
        this.answerStates = {};
      }
    }

    this.blockBackNavigation();

    // Check if session has started before loading questions
    try {
      const sessionData = await this.checkSessionStarted();
      if (!sessionData.hasStarted) {
        console.log('[QuizPage] Session has not started yet, redirecting to countdown');
        const queryParams: any = { code: this.sessionCode };
        if (this.sessionType === 'survey') {
          queryParams.surveyId = localStorage.getItem('currentSurveyId') || localStorage.getItem('surveyId');
        } else if (this.sessionType === 'poll') {
          queryParams.pollId = localStorage.getItem('currentPollId') || localStorage.getItem('pollId');
        } else {
          queryParams.quizId = localStorage.getItem('currentQuizId') || localStorage.getItem('quizId');
        }
        queryParams.sessionType = this.sessionType;
        queryParams.participantId = this.participantId;
        this.router.navigate(['/countdown'], { queryParams });
        return;
      }
      console.log('[QuizPage] Session has started, loading questions');
    } catch (error) {
      console.error('[QuizPage] Error checking session start:', error);
      // For surveys and polls, redirect to countdown on error to be safe
      if (this.sessionType === 'survey' || this.sessionType === 'poll') {
        const queryParams: any = { 
          code: this.sessionCode,
          sessionType: this.sessionType,
          participantId: this.participantId
        };
        if (this.sessionType === 'survey') {
          queryParams.surveyId = localStorage.getItem('currentSurveyId') || localStorage.getItem('surveyId');
        } else if (this.sessionType === 'poll') {
          queryParams.pollId = localStorage.getItem('currentPollId') || localStorage.getItem('pollId');
        }
        this.router.navigate(['/countdown'], { queryParams });
        return;
      }
      // Continue anyway for quizzes if check fails
    }

    await this.loadQuestions();
  }

  // Check if session has started
  private async checkSessionStarted(): Promise<{ hasStarted: boolean, startTime?: Date }> {
    try {
      const questions = await this.participantService.getSessionQuestions(this.sessionId);
      if (questions.startedAt) {
        const startTime = new Date(questions.startedAt);
        const now = new Date();
        const hasStarted = startTime.getTime() <= now.getTime() + 5000; // 5 second buffer
        return { hasStarted, startTime };
      }
      // If no startedAt, assume it hasn't started yet
      return { hasStarted: false };
    } catch (error) {
      console.error('[QuizPage] Failed to check session start time:', error);
      // If we can't check, assume it has started to avoid blocking users
      return { hasStarted: true };
    }
  }

  @HostListener('window:popstate')
  onPopState(): void {
    this.blockBackNavigation();
    void this.refreshSessionSync();

    const now = Date.now();
    if (now - this.lastBackWarnAt > 2000) {
      this.lastBackWarnAt = now;
      this.snackBar.open('Back navigation is disabled during the quiz.', 'Close', { duration: 2000 });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    event.preventDefault();
    event.returnValue = '';
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.refreshSessionSync();
    }
  }

  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
      void this.refreshSessionSync();
    }
  }

  private async refreshSessionSync(): Promise<void> {
    try {
      if (!this.sessionId) return;
      const response = await this.participantService.getSessionQuestions(this.sessionId);

      if (this.questions.length === 0 && response.questions?.length) {
        this.questionDetails = response.questions;
        this.questions = response.questions.map((q, index) => ({
          id: (index + 1).toString(),
          text: q.questionText,
          options: q.options.map(o => o.optionText),
          answer: '',
          timerSeconds: q.timerSeconds || 30
        }));
      }

      // ✅ Correct time offset calculation from server time (if present)
      if (response.serverTime) {
        const serverTimeMs = new Date(response.serverTime).getTime();
        this.serverTimeOffsetMs = serverTimeMs - Date.now();
      }
      this.startedAtMs = response.startedAt ? new Date(response.startedAt).getTime() : (Date.now() + this.serverTimeOffsetMs);
      
      // Sync with current question if quiz is in progress
      if (response.currentQuestionId && response.currentQuestionStartTime) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === response.currentQuestionId);
        if (targetIndex !== -1 && targetIndex !== this.currentIndex) {
          this.currentIndex = targetIndex;
          
          // Calculate remaining time from session data
          const now = response.serverTime ? new Date(response.serverTime).getTime() : Date.now();
          const startTime = new Date(response.currentQuestionStartTime).getTime();
          const elapsed = (now - startTime) / 1000;
          const remaining = Math.max(0, Math.floor((response.timerDurationSeconds || 30) - elapsed));
          
          this.timeRemaining = remaining;
          this.currentQuestionStartMs = startTime;
          this.currentQuestionEndMs = startTime + ((response.timerDurationSeconds || 30) * 1000);
          console.log(`[QuizPage] Refreshed to Q${targetIndex + 1} with ${remaining}s remaining`);
        }
      }
      
      console.log('[QuizPage] Session synced - waiting for SignalR updates');
    } catch (error) {
      console.error('[QuizPage] Failed to refresh session sync:', error);
    }
  }

  private blockBackNavigation(): void {
    const currentUrl = window.location.href;
    window.history.pushState(null, '', currentUrl);
    window.history.pushState(null, '', currentUrl);
  }

  async loadQuestions() {
    try {
      this.loading = true;
      
      // For polls, use the poll-specific endpoint
      if (this.sessionType === 'poll') {
        await this.loadPollQuestions();
        return;
      }
      
      // For surveys, use the survey-specific endpoint
      if (this.sessionType === 'survey') {
        await this.loadSurveyQuestions();
        return;
      }
      
      // For quizzes, use the standard questions endpoint
      const response = await this.participantService.getSessionQuestions(this.sessionId);
      
      this.questionDetails = response.questions;
      this.quizTitle = response.quizTitle;

      // Convert to the format expected by the existing components
      this.questions = response.questions.map((q, index) => ({
        id: (index + 1).toString(),
        text: q.questionText,
        options: q.options.map(o => o.optionText),
        answer: '', // We don't show the answer to participants
        timerSeconds: q.timerSeconds || 30
      }));

      const serverTimeMs = response.serverTime ? new Date(response.serverTime).getTime() : Date.now();
      this.serverTimeOffsetMs = serverTimeMs - Date.now();
      this.startedAtMs = response.startedAt ? new Date(response.startedAt).getTime() : serverTimeMs;
      
      // ✅ Always initialize timer from first question as default
      if (this.questions.length > 0) {
        const firstQuestion = this.questions[0];
        this.timeRemaining = firstQuestion?.timerSeconds || 30;
        console.log(`[QuizPage] Default timer initialized: ${this.timeRemaining}s`);
      }
      
      // Sync with current question if quiz is in progress
      if (response.currentQuestionId && response.currentQuestionStartTime) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === response.currentQuestionId);
        if (targetIndex !== -1) {
          this.currentIndex = targetIndex;
          
          // Calculate remaining time from session data
          const now = response.serverTime ? new Date(response.serverTime).getTime() : Date.now();
          const startTime = new Date(response.currentQuestionStartTime).getTime();
          const elapsed = (now - startTime) / 1000;
          const remaining = Math.max(0, Math.floor((response.timerDurationSeconds || 30) - elapsed));
          
          // Use the calculated remaining time if quiz is active
          if (remaining > 0) {
            this.timeRemaining = remaining;
            console.log(`[QuizPage] Synced to Q${targetIndex + 1} with ${remaining}s remaining`);
          } else {
            // If time expired, use question's full timer
            const currentQuestion = this.questions[targetIndex];
            this.timeRemaining = currentQuestion?.timerSeconds || 30;
            console.log(`[QuizPage] Timer expired, reset to ${this.timeRemaining}s for Q${targetIndex + 1}`);
          }
          
          this.currentQuestionStartMs = startTime;
          this.currentQuestionEndMs = startTime + ((response.timerDurationSeconds || 30) * 1000);
          
          // ✅ Enable timer sync for quizzes when we have valid timer data
          this.timerSyncEnabled = true;
        }
      }
      
      this.loading = false;
      this.currentQuestionStartMs = this.getServerNowMs();

      // Initialize SignalR live sync (for quizzes, SignalR will sync timer updates)
      this.initializeSignalR();
      
      // ✅ Start local timer for all session types
      // For quizzes: provides smooth UI countdown, synced with SignalR updates
      // For polls/surveys: fully manages the timer
      console.log('[QuizPage] 🔍 About to start timer - timeRemaining:', this.timeRemaining, 'sessionType:', this.sessionType);
      if (this.timeRemaining > 0) {
        console.log('[QuizPage] ✅ Starting local timer for', this.sessionType, 'with', this.timeRemaining, 'seconds');
        this.startLocalTimer();
      } else {
        console.warn('[QuizPage] ⚠️ NOT starting timer - timeRemaining is', this.timeRemaining);
      }
      
      // Initialize ranking if the first question is a ranking question
      if (this.isRankingQuestion()) {
        this.initializeRanking();
        console.log('[QuizPage] ✅ Initialized ranking order for first question');
      }

      console.log(`[QuizPage] Loaded ${this.questions.length} questions for session ${this.sessionId}`);
    } catch (error: any) {
      console.error('[QuizPage] Failed to load questions:', error);
      this.snackBar.open('Failed to load quiz questions. Please try again.', 'Close', { duration: 3000 });
      this.loading = false;
      this.router.navigate(['/participant']);
    }
  }

  /**
   * Load poll questions from poll-specific endpoint
   */
  async loadPollQuestions() {
    try {
      console.log('[QuizPage] Loading poll questions for session:', this.sessionId);
      const response = await this.participantService.getPollBySession(this.sessionId);
      
      this.quizTitle = response.pollTitle || 'Poll';
      
      // Convert poll to question format
      this.questions = [{
        id: '1',
        text: response.pollQuestion || '',
        options: response.options?.map((o: any) => o.optionLabel || o.OptionLabel) || [],
        answer: '',
        timerSeconds: 30
      }];
      
      this.questionDetails = [{
        questionId: response.pollId,
        questionText: response.pollQuestion || '',
        questionType: 'single_choice',
        timerSeconds: 30,
        options: response.options?.map((o: any) => ({
          optionId: o.optionId || o.OptionId,
          optionText: o.optionLabel || o.OptionLabel
        })) || []
      }];
      
      this.loading = false;
      this.currentQuestionStartMs = Date.now();
      
      // Start local timer for polls
      this.timeRemaining = 30;
      console.log('[QuizPage] Starting local timer for poll with 30 seconds');
      this.startLocalTimer();
      
      console.log(`[QuizPage] Loaded poll with ${this.questions.length} question`);
    } catch (error: any) {
      console.error('[QuizPage] Failed to load poll:', error);
      this.snackBar.open('Failed to load poll. Please try again.', 'Close', { duration: 3000 });
      this.loading = false;
      this.router.navigate(['/participant']);
    }
  }

  /**
   * Load survey questions from survey-specific endpoint
   */
  async loadSurveyQuestions() {
    try {
      console.log('[QuizPage] Loading survey questions for session:', this.sessionId);
      const response = await this.participantService.getSurveyBySession(this.sessionId);
      
      this.quizTitle = response.surveyTitle || 'Survey';
      
      // Convert survey to questions format
      this.questions = response.questions?.map((q: any, index: number) => ({
        id: (index + 1).toString(),
        text: q.questionText || q.QuestionText || '',
        options: q.options?.map((o: any) => o.optionText || o.OptionText) || [],
        answer: '',
        timerSeconds: 30
      })) || [];
      
      this.questionDetails = response.questions?.map((q: any) => ({
        questionId: q.surveyQuestionId || q.SurveyQuestionId,
        questionText: q.questionText || q.QuestionText || '',
        questionType: q.questionType || q.QuestionType || 'single_choice',
        timerSeconds: 30,
        options: q.options?.map((o: any) => ({
          optionId: o.optionId || o.OptionId,
          optionText: o.optionText || o.OptionText
        })) || []
      })) || [];
      
      this.loading = false;
      this.currentQuestionStartMs = Date.now();
      
      // Start local timer for surveys
      const firstQuestion = this.questions[0];
      this.timeRemaining = firstQuestion?.timerSeconds || 30;
      console.log('[QuizPage] Starting local timer for survey with', this.timeRemaining, 'seconds');
      this.startLocalTimer();
      
      // Initialize ranking if the first question is a ranking question
      if (this.isRankingQuestion()) {
        this.initializeRanking();
        console.log('[QuizPage] ✅ Initialized ranking order for first survey question');
      }
      
      console.log(`[QuizPage] Loaded ${this.questions.length} survey questions`);
    } catch (error: any) {
      console.error('[QuizPage] Failed to load survey:', error);
      this.snackBar.open('Failed to load survey. Please try again.', 'Close', { duration: 3000 });
      this.loading = false;
      this.router.navigate(['/participant']);
    }
  }

  get currentQuestion(): Question | null {
    return this.questions[this.currentIndex] ?? null;
  }

  onSelectedChange(value: string) {
    console.log('[QuizPage] onSelectedChange:', value);
    this.selected = value; // enables submit button
  }

  /**
   * Handle rating selection (for survey rating questions)
   */
  onRatingChange(value: number) {
    console.log('[QuizPage] onRatingChange:', value);
    this.ratingValue = value;
    this.selected = value.toString(); // Enable submit button
  }

  /**
   * Set rating value (can be called from keyboard or click)
   */
  setRating(value: number): void {
    this.onRatingChange(value);
  }

  /**
   * Handle text input (for survey text questions)
   */
  onTextChange(value: string) {
    console.log('[QuizPage] onTextChange:', value);
    this.textAnswer = value.trim();
    this.selected = value.trim() ? 'text_answer' : null; // Enable submit if has text
  }

  /**
   * Toggle selection for multiple choice questions
   */
  onMultipleChoiceToggle(option: string) {
    if (this.selectedMultiple.has(option)) {
      this.selectedMultiple.delete(option);
    } else {
      this.selectedMultiple.add(option);
    }
    // Enable submit if at least one option selected
    this.selected = this.selectedMultiple.size > 0 ? 'multiple_selected' : null;
  }

  /**
   * Check if option is selected in multiple choice
   */
  isMultipleChoiceSelected(option: string): boolean {
    return this.selectedMultiple.has(option);
  }

  /**
   * Move option up in ranking
   */
  moveRankUp(index: number) {
    if (index > 0) {
      const temp = this.rankingOrder[index];
      this.rankingOrder[index] = this.rankingOrder[index - 1];
      this.rankingOrder[index - 1] = temp;
      this.selected = this.rankingOrder.length > 0 ? 'ranking_set' : null;
    }
  }

  /**
   * Move option down in ranking
   */
  moveRankDown(index: number) {
    if (index < this.rankingOrder.length - 1) {
      const temp = this.rankingOrder[index];
      this.rankingOrder[index] = this.rankingOrder[index + 1];
      this.rankingOrder[index + 1] = temp;
      this.selected = this.rankingOrder.length > 0 ? 'ranking_set' : null;
    }
  }

  /**
   * Initialize ranking order with all options
   */
  initializeRanking() {
    if (this.currentQuestion && this.currentQuestion.options) {
      this.rankingOrder = [...this.currentQuestion.options];
      this.selected = 'ranking_set'; // Enable submit
    }
  }

  /**
   * Check if an option is selected in ranking (checkbox UI)
   */
  isRankSelected(option: string): boolean {
    return this.selectedRanking.includes(option);
  }

  /**
   * Toggle ranking checkbox selection
   */
  onRankCheckboxToggle(option: string, checked: boolean): void {
    if (checked) {
      // Add to selected ranking
      this.selectedRanking.push(option);
    } else {
      // Remove from selected ranking
      const index = this.selectedRanking.indexOf(option);
      if (index > -1) {
        this.selectedRanking.splice(index, 1);
      }
    }
    this.selected = this.selectedRanking.length > 0 ? 'ranking_set' : null;
  }

  /**
   * Get rank (1-based) of an option
   */
  getRankOf(option: string): number {
    const index = this.selectedRanking.indexOf(option);
    return index === -1 ? 0 : index + 1;
  }

  /**
   * Bump rank up (decrease rank number, move earlier)
   */
  bumpRankUp(option: string): void {
    const index = this.selectedRanking.indexOf(option);
    if (index > 0) {
      const temp = this.selectedRanking[index];
      this.selectedRanking[index] = this.selectedRanking[index - 1];
      this.selectedRanking[index - 1] = temp;
    }
  }

  /**
   * Bump rank down (increase rank number, move later)
   */
  bumpRankDown(option: string): void {
    const index = this.selectedRanking.indexOf(option);
    if (index > -1 && index < this.selectedRanking.length - 1) {
      const temp = this.selectedRanking[index];
      this.selectedRanking[index] = this.selectedRanking[index + 1];
      this.selectedRanking[index + 1] = temp;
    }
  }

  /**
   * Clear all ranking selections
   */
  clearRanking(): void {
    this.selectedRanking = [];
    this.selected = null;
  }

  /**
   * Get current question type
   */
  getCurrentQuestionType(): string {
    const currentQuestionDetail = this.questionDetails[this.currentIndex];
    if (!currentQuestionDetail) return 'single_choice';
    
    // Map question type based on session type and question structure
    if (this.sessionType === 'survey') {
      return currentQuestionDetail.questionType || 'single_choice';
    } else if (this.sessionType === 'poll') {
      return 'poll';
    }
    return 'single_choice'; // Default for quiz
  }

  /**
   * Check if current question is rating type
   */
  isRatingQuestion(): boolean {
    return this.getCurrentQuestionType() === 'rating';
  }

  /**
   * Check if current question is text type
   */
  isTextQuestion(): boolean {
    const type = this.getCurrentQuestionType();
    return type === 'text' || type === 'short_text';
  }

  /**
   * Check if current question is multiple choice
   */
  isMultipleChoiceQuestion(): boolean {
    const type = this.getCurrentQuestionType();
    return type === 'multiple_choice' || type === 'Multiple Choice';
  }

  /**
   * Check if current question is ranking
   */
  isRankingQuestion(): boolean {
    const type = this.getCurrentQuestionType();
    return type === 'ranking' || type === 'Ranking';
  }

  /**
   * Check if current question is poll
   */
  isPollQuestion(): boolean {
    return this.sessionType === 'poll';
  }

  /**
   * Get word count from text answer
   */
  getWordCount(): number {
    if (!this.textAnswer || this.textAnswer.trim().length === 0) {
      return 0;
    }
    return this.textAnswer.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Clear text answer
   */
  clearTextAnswer(): void {
    this.textAnswer = '';
    this.selected = null;
  }

  /**
   * Handle keydown event for rating stars
   */
  onRatingKeydown(event: KeyboardEvent, star: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.setRating(star);
    }
  }

  /**
   * Check if submit button should be enabled
   */
  canSubmit(): boolean {
    if (this.submitting || this.waitingForNext || this.submittedIndex === this.currentIndex) {
      return false;
    }

    const questionType = this.getCurrentQuestionType();
    
    if (questionType === 'rating') {
      return this.ratingValue > 0;
    } else if (questionType === 'text' || questionType === 'short_text') {
      return this.textAnswer.trim().length > 0;
    } else if (questionType === 'multiple_choice' || questionType === 'Multiple Choice') {
      return this.selectedMultiple.size > 0;
    } else if (questionType === 'ranking' || questionType === 'Ranking') {
      return this.selectedRanking.length > 0;
    } else {
      return this.selected !== null;
    }
  }

  private getServerNowMs(): number {
    return Date.now() + this.serverTimeOffsetMs;
  }

  private calculateQuestionState(serverNowMs: number): {
    index: number;
    remainingSeconds: number;
    questionStartMs: number;
    questionEndMs: number;
    finished: boolean;
  } {
    if (this.questions.length === 0) {
      return {
        index: 0,
        remainingSeconds: 0,
        questionStartMs: serverNowMs,
        questionEndMs: serverNowMs,
        finished: true
      };
    }

    const effectiveStartMs = this.startedAtMs || serverNowMs;
    const normalizedNowMs = Math.max(serverNowMs, effectiveStartMs);
    const elapsedSeconds = Math.max(0, Math.floor((normalizedNowMs - effectiveStartMs) / 1000));

    let cumulativeSeconds = 0;
    for (let i = 0; i < this.questions.length; i++) {
      const duration = this.questions[i]?.timerSeconds || 30;
      const questionStartMs = effectiveStartMs + cumulativeSeconds * 1000;
      const questionEndMs = questionStartMs + duration * 1000;

      if (elapsedSeconds < cumulativeSeconds + duration) {
        const remainingSeconds = Math.max(0, Math.ceil((questionEndMs - normalizedNowMs) / 1000));
        return {
          index: i,
          remainingSeconds,
          questionStartMs,
          questionEndMs,
          finished: false
        };
      }

      cumulativeSeconds += duration;
    }

    return {
      index: this.questions.length - 1,
      remainingSeconds: 0,
      questionStartMs: effectiveStartMs + cumulativeSeconds * 1000,
      questionEndMs: effectiveStartMs + cumulativeSeconds * 1000,
      finished: true
    };
  }

  private initializeSignalR(): void {
    if (!this.sessionCode || this.hubConnection) return;

    console.log('🔧 [DEBUG PARTICIPANT] Initializing SignalR connection...');
    console.log('   - Session code:', this.sessionCode);
    console.log('   - Session ID:', this.sessionId);
    console.log('   - Participant ID:', this.participantId);

    // ✅ FIX: Get JWT token from AuthService
    const token = this.authService.getToken();
    console.log('🔐 [DEBUG PARTICIPANT] JWT Token Status:', token ? '✅ Present' : '⚠️ Missing (Anonymous mode)');
    console.log('   - Token length:', token?.length || 0, 'characters');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.signalRUrl, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
        // ✅ FIXED: Pass JWT token via accessTokenFactory
        accessTokenFactory: () => {
          const currentToken = this.authService.getToken();
          if (currentToken) {
            console.log('📡 [DEBUG PARTICIPANT] Sending JWT token with SignalR connection');
          } else {
            console.warn('⚠️ [DEBUG PARTICIPANT] No JWT token available - connecting anonymously');
          }
          return currentToken || '';
        }
      })
      .withAutomaticReconnect()
      .build();

    // Add reconnection event handlers
    this.hubConnection.onreconnecting((error) => {
      console.warn('⚠️ [DEBUG PARTICIPANT] SignalR reconnecting...');
      console.warn('   - Error:', error);
      console.warn('   - Session code:', this.sessionCode);
      this.snackBar.open('⚠️ Reconnecting...', 'Close', { duration: 2000 });
    });

    this.hubConnection.onreconnected(async (connectionId) => {
      console.log('✅ [DEBUG PARTICIPANT] SignalR reconnected!');
      console.log('   - Connection ID:', connectionId);
      console.log('   - Session code:', this.sessionCode);
      
      // Rejoin session after reconnection
      try {
        console.log('📡 [DEBUG PARTICIPANT] Rejoining session...');
        await this.hubConnection!.invoke('JoinSession', this.sessionCode);
        console.log('✅ [DEBUG PARTICIPANT] Rejoined session successfully');
        this.snackBar.open('✅ Reconnected', 'Close', { duration: 2000 });
      } catch (error) {
        console.error('❌ [DEBUG PARTICIPANT] Failed to rejoin after reconnection:', error);
      }
    });

    this.hubConnection.onclose((error) => {
      console.error('❌ [DEBUG PARTICIPANT] SignalR connection closed!');
      console.error('   - Error:', error);
      console.error('   - Session code:', this.sessionCode);
      console.error('   - Was connected: true');
      this.snackBar.open('⚠️ Connection lost - Please refresh the page', 'Close', { duration: 5000 });
    });

    this.hubConnection.on('SessionSync', (payload: any) => {
      console.log('[QuizPage] ===== SESSION SYNC RECEIVED =====', payload);
      
      const serverTime = payload?.ServerTime ?? payload?.serverTime;
      const startedAt = payload?.StartedAt ?? payload?.startedAt;
      const currentQuestionId = payload?.CurrentQuestionId ?? payload?.currentQuestionId;
      const remainingSeconds = payload?.RemainingSeconds ?? payload?.remainingSeconds;
      const timerDurationSeconds = payload?.TimerDurationSeconds ?? payload?.timerDurationSeconds;

      if (serverTime) {
        const serverTimeMs = new Date(serverTime).getTime();
        this.serverTimeOffsetMs = serverTimeMs - Date.now();
      }

      if (startedAt) {
        this.startedAtMs = new Date(startedAt).getTime();
      }

      // Sync to current question if quiz is in progress
      if (currentQuestionId && remainingSeconds !== undefined) {
        console.log('[QuizPage] Syncing to current question:', {
          questionId: currentQuestionId,
          remainingSeconds,
          timerDurationSeconds
        });
        
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === currentQuestionId);
        if (targetIndex !== -1) {
          this.currentIndex = targetIndex;
          this.timeRemaining = remainingSeconds;
          this.timerSyncEnabled = true;
          
          const now = this.getServerNowMs();
          this.currentQuestionStartMs = now - ((timerDurationSeconds - remainingSeconds) * 1000);
          this.currentQuestionEndMs = now + (remainingSeconds * 1000);
          
          console.log('[QuizPage] ✅ Synced to question', targetIndex + 1, 'with', remainingSeconds, 's remaining');
        }
      }

      console.log('[QuizPage] Timer sync enabled:', this.timerSyncEnabled);
    });

    // Host forces navigation to specific question - FULL SYNC
    this.hubConnection.on('ForceNavigateToQuestion', (data: any) => {
      console.log('[QuizPage] ===== STATE TRANSITION: → QUESTION (Host Navigation) =====', data);
      
      // STEP 1: Clear ALL timers and overlays using state machine
      this.clearAllTimers();
      this.clearAllOverlays();
      
      // STEP 2: Reset all UI states
      this.currentUIState = 'question';
      this.showLeaderboardOverlay = false;
      this.showQuestionResult = false;
      this.waitingForNext = false;
      this.submitting = false;
      
      console.log('[QuizPage] ✅ All overlays and timers cleared via state machine');
      
      const questionId = data?.QuestionId ?? data?.questionId;
      const timerSeconds = data?.TimerSeconds ?? data?.timerSeconds;
      
      if (questionId) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === questionId);
        if (targetIndex !== -1) {
          // Enable timer sync mode
          this.timerSyncEnabled = true;
          
          // Get question details before updating state
          const currentQ = this.questionDetails[targetIndex];
          
          // Update index immediately
          this.currentIndex = targetIndex;
          this.selected = null;
          this.ratingValue = 0;
          this.textAnswer = '';
          this.selectedMultiple.clear();
          this.rankingOrder = [];
          this.submittedIndex = null;
          
          // Set question start time for timeSpent calculation
          const now = this.getServerNowMs();
          this.currentQuestionStartMs = now;
          
          // Reset timer to question's duration (use backend value if provided, otherwise question default)
          const questionTimer = timerSeconds ?? currentQ?.timerSeconds ?? 30;
          this.timeRemaining = questionTimer;
          this.currentQuestionEndMs = now + (questionTimer * 1000);
          
          console.log('[QuizPage] ✅ ForceNavigateToQuestion - navigated to Q', targetIndex + 1, 'with timer:', this.timeRemaining, 's');
          
          // ✅ CRITICAL FIX: Restart the timer for the new question
          this.startLocalTimer();
          
          // Initialize ranking if the question is a ranking question
          if (this.isRankingQuestion()) {
            this.initializeRanking();
          }
          
          this.snackBar.open(`📝 Question ${targetIndex + 1}`, 'Close', { duration: 1500 });
        } else {
          console.error('[QuizPage] ❌ Question not found with ID:', questionId);
        }
      } else {
        console.error('[QuizPage] ❌ No questionId in data');
      }
    });

    // Timer sync from host - MASTER TIMER
    this.hubConnection.on('TimerSync', (data: any) => {
      const questionId = data?.QuestionId ?? data?.questionId;
      const remainingSeconds = data?.RemainingSeconds ?? data?.remainingSeconds;
      
      if (this.timerSyncEnabled && questionId !== undefined && remainingSeconds !== undefined) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === questionId);
        if (targetIndex === this.currentIndex && targetIndex !== -1) {
          const previousTime = this.timeRemaining;
          this.timeRemaining = Math.max(0, remainingSeconds);
          
          if (remainingSeconds % 10 === 0 || remainingSeconds <= 5) {
            console.log('[QuizPage] ⏱️ Timer synced:', this.timeRemaining, 's for Q', targetIndex + 1);
          }
          
          // If timer just reached 0, trigger expiry handler
          if (previousTime > 0 && this.timeRemaining === 0) {
            console.log('[QuizPage] ⏰ Timer expired via SignalR TimerSync - triggering expiry handler');
            this.handleTimerExpired();
          }
        } else if (targetIndex !== this.currentIndex) {
          console.log('[QuizPage] ⚠️ Timer sync for different question. Current:', this.currentIndex + 1, 'Timer for:', targetIndex + 1);
        }
      } else if (!this.timerSyncEnabled) {
        console.log('[QuizPage] ⚠️ Timer sync received but sync not enabled yet');
      }
    });

    // Listen to LiveTimerUpdate from background service
    this.hubConnection.on('LiveTimerUpdate', (data: any) => {
      const questionId = data?.QuestionId ?? data?.questionId;
      const remainingSeconds = data?.RemainingSeconds ?? data?.remainingSeconds;
      
      console.log('[QuizPage] 🔔 LiveTimerUpdate received:', {
        questionId,
        remainingSeconds,
        timerSyncEnabled: this.timerSyncEnabled,
        currentIndex: this.currentIndex,
        sessionType: this.sessionType
      });
      
      if (this.timerSyncEnabled && questionId !== undefined && remainingSeconds !== undefined) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === questionId);
        if (targetIndex === this.currentIndex && targetIndex !== -1) {
          const previousTime = this.timeRemaining;
          this.timeRemaining = Math.max(0, remainingSeconds);
          
          if (remainingSeconds % 10 === 0 || remainingSeconds <= 5) {
            console.log('[QuizPage] ⏱️ Live timer update:', this.timeRemaining, 's for Q', targetIndex + 1);
          }
          
          // If timer just reached 0, trigger expiry handler
          if (previousTime > 0 && this.timeRemaining === 0) {
            console.log('[QuizPage] ⏰ Timer expired via SignalR sync - triggering expiry handler');
            this.handleTimerExpired();
          }
        }
      }
    });

    // Question started event with timer
    this.hubConnection.on('QuestionStarted', (data: any) => {
      console.log('[QuizPage] Question started:', data);
      
      // Close all interactive overlays when new question starts
      console.log('[QuizPage] Closing all interactive overlays - new question starting');
      this.showOptionBarGraphOverlay.set(false);
      this.showPersonalRankOverlay.set(false);
      this.showTopNLeaderboardOverlay.set(false);
      this.showProgressiveLeaderboardOverlay.set(false);
      this.showCategoryLeaderboardOverlay.set(false);
      
      const questionId = data?.QuestionId ?? data?.questionId;
      const timerSeconds = data?.TimerSeconds ?? data?.timerSeconds ?? 30;
      
      console.log('[QuizPage] 🎯 QuestionStarted event:', {
        questionId,
        timerSeconds,
        timerSyncEnabled: this.timerSyncEnabled,
        currentIndex: this.currentIndex,
        sessionType: this.sessionType
      });
      
      if (questionId) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === questionId);
        if (targetIndex !== -1) {
          this.currentIndex = targetIndex;
          this.timeRemaining = timerSeconds;
          this.selected = null;
          this.ratingValue = 0;
          this.textAnswer = '';
          this.selectedMultiple.clear();
          this.rankingOrder = [];
          this.submittedIndex = null;
          this.waitingForNext = false;
          
          // ✅ Enable timer sync when question starts via SignalR
          this.timerSyncEnabled = true;
          
          console.log('[QuizPage] ✅ Question initialized:', {
            index: targetIndex + 1,
            timeRemaining: this.timeRemaining,
            questionId,
            timerSyncEnabled: this.timerSyncEnabled
          });
          
          // Set question start time for timeSpent calculation
          const now = this.getServerNowMs();
          this.currentQuestionStartMs = now;
          this.currentQuestionEndMs = now + (timerSeconds * 1000);
          
          // ✅ CRITICAL FIX: Start the timer when question starts
          this.startLocalTimer();
          
          // Initialize ranking if the question is a ranking question
          if (this.isRankingQuestion()) {
            this.initializeRanking();
            console.log('[QuizPage] ✅ Initialized ranking order for QuestionStarted event');
          }
        }
      }
    });

    // Host toggles leaderboard visibility
    this.hubConnection.on('LeaderboardVisibilityToggled', (data: any) => {
      const isVisible = data?.IsVisible ?? data?.isVisible;
      if (isVisible) {
        this.snackBar.open('📊 Leaderboard is now visible', 'Close', { duration: 2000 });
      } else {
        this.snackBar.open('📊 Leaderboard is now hidden', 'Close', { duration: 2000 });
      }
    });

    // Host changes leaderboard settings mid-quiz
    this.hubConnection.on('LeaderboardSettingUpdated', (data: any) => {
      const showAfterQuestion = data?.ShowAfterQuestion ?? data?.showAfterQuestion ?? false;
      const showAtEndOnly = data?.ShowAtEndOnly ?? data?.showAtEndOnly ?? false;
      
      // Store the setting locally
      this.showLeaderboardAfterQuestion = showAfterQuestion;
      
      console.log('[QuizPage] Leaderboard settings updated - AfterQuestion:', showAfterQuestion, 'EndOnly:', showAtEndOnly);
      
      if (showAfterQuestion) {
        this.snackBar.open('📊 Leaderboard will now show after each question', 'Close', { duration: 3000 });
      } else if (showAtEndOnly) {
        this.snackBar.open('📊 Leaderboard will only show at quiz end', 'Close', { duration: 3000 });
      } else {
        this.snackBar.open('📊 Leaderboard display disabled', 'Close', { duration: 3000 });
      }
    });

    // Show leaderboard after question
    this.hubConnection.on('ShowLeaderboardAfterQuestion', (data: any) => {
      console.log('[QuizPage] ===== ShowLeaderboardAfterQuestion EVENT RECEIVED =====');
      console.log('[QuizPage] Data received:', data);
      console.log('[QuizPage] Current state BEFORE transition:', {
        waitingForNext: this.waitingForNext,
        showLeaderboardOverlay: this.showLeaderboardOverlay,
        currentUIState: this.currentUIState,
        submitting: this.submitting
      });
      
      const displayDuration = data?.DisplayDurationSeconds ?? data?.displayDurationSeconds ?? 5;
      console.log('[QuizPage] Display duration from host:', displayDuration, 'seconds');
      
      // Store that full leaderboard is the enabled type
      this.hostEnabledLeaderboardType = 'full';
      
      // Use the shared display method
      this.displayLeaderboardAfterQuestion(displayDuration);
      
      console.log('[QuizPage] Current state AFTER transition:', {
        waitingForNext: this.waitingForNext,
        showLeaderboardOverlay: this.showLeaderboardOverlay,
        currentUIState: this.currentUIState
      });
      console.log('[QuizPage] ==================================================');
    });

    // Show leaderboard at quiz end
    this.hubConnection.on('ShowLeaderboardAtEnd', (data: any) => {
      console.log('[QuizPage] ===== STATE TRANSITION: → PODIUM (Quiz Complete) =====');
      
      // STEP 1: Clear all state using state machine
      this.clearAllTimers();
      this.clearAllOverlays();
      
      // STEP 2: Set UI state to podium (final state)
      this.currentUIState = 'podium';
      this.waitingForNext = false;
      this.showQuestionResult = false;
      this.submitting = false;
      
      // STEP 3: Show final podium leaderboard
      this.snackBar.open('🏁 Quiz completed! Viewing final leaderboard...', 'Close', { duration: 3000 });
      this.leaderboardType = 'podium'; // Show podium view at quiz end
      this.showLeaderboardOverlay = true;
      this.leaderboardCountdown = 0; // No auto-close for podium
      this.finished = true;
      
      console.log('[QuizPage] ✅ FINAL STATE: PODIUM | Quiz session complete');
    });

    // ==================== LEADERBOARD OVERLAY EVENTS (REMOVED) ====================
    // Old leaderboard events removed - now using interactive overlay system via viewKahootLeaderboard

    // Listen for Option Bar Graph broadcast
    this.hubConnection.on('OptionCountsUpdate', (payload: any) => {
      console.log('[QuizPage] 📊 Option Counts Update received:', payload);
      
      // Extract data and mode from payload
      const data = payload.data || payload; // Backwards compatibility
      const isManualMode = payload.isManualMode || false;
      
      this.hostEnabledLeaderboardType = 'option-bar'; // Track that Option Bar is enabled
      // Store the data for overlay display
      this.optionBarGraphData.set(data);
      
      // Update questionId signal
      if (data.questionId) {
        this.questionIdSignal.set(data.questionId);
      }
      
      // AUTO-DISPLAY FLOW: Show overlays with conditional auto-hide
      this.startAutoDisplayFlow(data.questionId, isManualMode);
    });

    // Listen for Personal Rank broadcast (new event name)
    this.hubConnection.on('PersonalRankUpdate', (data: any) => {
      console.log('[QuizPage] 🏅 Personal Rank Update received:', data);
      
      // Only store if this is for the current participant
      if (data.participantId === this.participantId || data.participantId === this.participantId.toString()) {
        console.log('[QuizPage] ✅ Personal rank matches current participant, storing for overlay...');
        this.personalRankData.set(data);
      } else {
        console.log('[QuizPage] ⏭️ Personal rank for different participant, skipping');
      }
    });

    // Listen for old event name for backward compatibility
    this.hubConnection.on('LeaderboardUpdatePersonalRank', (data: any) => {
      console.log('[QuizPage] 🏅 Personal Rank Update received (legacy event):', data);
      
      // Only store if this is for the current participant
      if (data.participantId === this.participantId || data.participantId === this.participantId.toString()) {
        console.log('[QuizPage] ✅ Personal rank matches current participant, storing for overlay...');
        this.personalRankData.set(data);
      }
    });

    // Listen for Interactive Leaderboard broadcasts
    this.hubConnection.on('LeaderboardUpdateTopN', (payload: any) => {
      console.log('[QuizPage] 🎮 Top-N Leaderboard Update received:', payload);
      
      const data = payload.data || payload; // Backwards compatibility
      const isManualMode = payload.isManualMode || false;
      
      this.hostEnabledLeaderboardType = 'topn'; // Track that Top-N is enabled
      this.topNLeaderboardData.set(data);
      this.showTopNLeaderboardOverlay.set(true);
      
      // Only auto-hide in AUTO mode
      if (!isManualMode) {
        setTimeout(() => {
          this.showTopNLeaderboardOverlay.set(false);
        }, 8000);
      } else {
        console.log('[QuizPage] MANUAL mode - keeping Top-N visible until next question');
      }
    });

    this.hubConnection.on('LeaderboardUpdateProgressive', (payload: any) => {
      console.log('[QuizPage] 🔥 Progressive Leaderboard Update received:', payload);
      
      const data = payload.data || payload; // Backwards compatibility
      const isManualMode = payload.isManualMode || false;
      
      this.hostEnabledLeaderboardType = 'progressive'; // Track that Progressive is enabled
      this.progressiveLeaderboardData.set(data);
      this.showProgressiveLeaderboardOverlay.set(true);
      
      // Only auto-hide in AUTO mode
      if (!isManualMode) {
        setTimeout(() => {
          this.showProgressiveLeaderboardOverlay.set(false);
        }, 8000);
      } else {
        console.log('[QuizPage] MANUAL mode - keeping Progressive visible until next question');
      }
    });

    this.hubConnection.on('LeaderboardUpdateCategory', (payload: any) => {
      console.log('[QuizPage] 📊 Category Leaderboard Update received:', payload);
      
      const data = payload.data || payload; // Backwards compatibility
      const isManualMode = payload.isManualMode || false;
      
      this.hostEnabledLeaderboardType = 'category'; // Track that Category is enabled
      this.categoryLeaderboardData.set(data);
      this.showCategoryLeaderboardOverlay.set(true);
      
      // Only auto-hide in AUTO mode
      if (!isManualMode) {
        setTimeout(() => {
          this.showCategoryLeaderboardOverlay.set(false);
        }, 8000);
      } else {
        console.log('[QuizPage] MANUAL mode - keeping Category visible until next question');
      }
    });

    // ==================== END NEW EVENTS ====================

    // Host manually ended the quiz
    this.hubConnection.on('QuizEnded', (data: any) => {
      console.log('[QuizPage] ===== QUIZ ENDED BY HOST =====');
      this.finished = true;
      this.timerSyncEnabled = false;
      this.snackBar.open('🏁 Quiz has been ended by the host', 'Close', { duration: 3000 });
      
      // Save final state
      localStorage.setItem('finalScore', this.score.toString());
      localStorage.setItem('totalQuestions', this.questions.length.toString());
      
      // Don't auto-navigate - let user view podium and click "Go to Feedback" button
      console.log('[QuizPage] Podium will stay visible until user clicks "Go to Feedback"');
    });

    // Quiz started event
    this.hubConnection.on('QuizStarted', (sessionCode: string) => {
      console.log('[QuizPage] ===== QUIZ STARTED =====', sessionCode);
      this.timerSyncEnabled = true;
      console.log('[QuizPage] 🔄 Timer sync enabled (QuizStarted)');
      
      // Initialize question start time for first question
      const now = this.getServerNowMs();
      this.currentQuestionStartMs = now;
      const firstQuestionTimer = this.questionDetails[0]?.timerSeconds || 30;
      this.currentQuestionEndMs = now + (firstQuestionTimer * 1000);
      
      this.snackBar.open('🚀 Quiz has started!', 'Close', { duration: 2000 });
    });

    // Host joined session - Switch to MANUAL mode
    this.hubConnection.on('HostJoinedSession', (data: any) => {
      console.log('[QuizPage] ===== HOST JOINED SESSION - MANUAL MODE =====', data);
      this.isHostPresent = true;
      this.snackBar.open('👨‍💼 Host has joined - Manual mode', 'Close', { duration: 2000 });
    });

    // Host left session - Switch to AUTO mode
    this.hubConnection.on('HostLeftSession', (data: any) => {
      console.log('[QuizPage] ===== HOST LEFT SESSION - AUTO MODE =====', data);
      this.isHostPresent = false;
      this.snackBar.open('🤖 Switched to Auto mode', 'Close', { duration: 2000 });
    });

    console.log('📡 [DEBUG PARTICIPANT] Starting SignalR connection...');
    this.hubConnection.start()
      .then(() => {
        console.log('✅ [DEBUG PARTICIPANT] SignalR connected successfully!');
        this.timerSyncEnabled = true; // Enable timer sync on connection
        console.log('[QuizPage] 🔄 Timer sync enabled (SignalR connected)');
        console.log('[QuizPage] Current state:', {
          sessionCode: this.sessionCode,
          sessionType: this.sessionType,
          currentIndex: this.currentIndex,
          timeRemaining: this.timeRemaining,
          questionDetails: this.questionDetails.length
        });
        return this.hubConnection?.invoke('JoinSession', this.sessionCode);
      })
      .then(() => {
        console.log('✅ [DEBUG PARTICIPANT] Successfully joined session group!');
        
        // ✅ Request current session state in case quiz already started
        return this.hubConnection?.invoke('RequestSessionState', this.sessionCode);
      })
      .then(() => {
        console.log('✅ [DEBUG PARTICIPANT] Requested session state');
      })
      .catch((err: unknown) => {
        console.error('❌ [DEBUG PARTICIPANT] SignalR error:', err);
        this.snackBar.open('⚠️ Connection error. Please refresh the page.', 'Close', { duration: 5000 });
      });
  }

  private updateQuestionState(): void {
    // Skip if using SignalR timer sync - let host control everything
    if (this.timerSyncEnabled) {
      console.log('[QuizPage] Skipping updateQuestionState - using SignalR sync');
      return;
    }
    
    const serverNowMs = this.getServerNowMs();
    const state = this.calculateQuestionState(serverNowMs);

    if (state.finished) {
      if (!this.finished) {
        // Mark any remaining unanswered questions as missed before finishing
        for (let i = 0; i < this.questions.length; i++) {
          if (!this.answerStates[i]) {
            this.answerStates[i] = 'missed';
            console.log(`[QuizPage] Question ${i + 1} marked as missed (quiz finished, no answer)`);
          }
        }
        // Save answerStates to localStorage
        localStorage.setItem('answerStates', JSON.stringify(this.answerStates));

        this.finished = true;
        this.timerSyncEnabled = false; // Disable timer sync when quiz finishes
        localStorage.setItem('finalScore', this.score.toString());
        localStorage.setItem('totalQuestions', this.questions.length.toString());
      }
      return;
    }

    this.currentQuestionStartMs = state.questionStartMs;
    this.currentQuestionEndMs = state.questionEndMs;
    this.timeRemaining = state.remainingSeconds;

    if (this.currentIndex !== state.index) {
      // Mark previous question as missed if it wasn't answered
      const previousIndex = this.currentIndex;
      if (previousIndex >= 0 && previousIndex < this.questions.length) {
        if (!this.answerStates[previousIndex]) {
          this.answerStates[previousIndex] = 'missed';
          localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
        }
      }

      this.currentIndex = state.index;
      this.selected = null;
      this.submittedIndex = null;
      this.waitingForNext = false;
      this.ratingValue = 0;
      this.textAnswer = '';
      this.selectedMultiple.clear();
      this.rankingOrder = [];
      
      if (this.isRankingQuestion()) {
        this.initializeRanking();
      }
    }

    if (this.submittedIndex === this.currentIndex) {
      this.waitingForNext = true;
    }
  }

  async submitAnswer(isAutoSubmit: boolean = false) {
    console.log('[QuizPage] submitAnswer called. selected =', this.selected, 'isAutoSubmit =', isAutoSubmit);
    if (!this.currentQuestion || this.submitting) return;

    try {
      const currentQuestionDetail = this.questionDetails[this.currentIndex];
      const questionType = this.getCurrentQuestionType();
      
      // SURVEY / POLL: handle native types first
      if (this.sessionType === 'survey' || this.sessionType === 'poll') {
        // Rating
        if (questionType === 'rating') {
          if (this.ratingValue === 0) {
            if (!isAutoSubmit) {
              this.snackBar.open('⚠️ Please select a rating', 'Close', { duration: 2000 });
            } else {
              // Auto-submit with no selection => mark missed
              this.answerStates[this.currentIndex] = 'missed';
              localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
              this.submittedIndex = this.currentIndex;
              this.waitingForNext = true;
            }
            return;
          }
          
          const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));
          this.submitting = true;
          
          if (this.sessionType === 'survey') {
            await this.participantService.submitSurveyAnswer(
              currentQuestionDetail.questionId,
              this.participantId,
              this.sessionId,
              this.ratingValue, // selectedOptionId
              `Rating: ${this.ratingValue}/5`, // responseText
              this.ratingValue // responseNumber
            );
          } else {
            // Polls rarely use rating; still support generic endpoint
            const request: SubmitAnswerRequest = {
              participantId: this.participantId,
              questionId: currentQuestionDetail.questionId,
              selectedOptionId: this.ratingValue,
              timeSpentSeconds: timeSpent,
              textResponse: `Rating: ${this.ratingValue}/5`
            };
            await this.participantService.submitParticipantAnswer(request);
          }
          
          this.submitting = false;
          this.answerStates[this.currentIndex] = 'answered';
          localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
          if (!isAutoSubmit) this.snackBar.open('✅ Rating submitted successfully!', 'Close', { duration: 1500 });

          this.submittedIndex = this.currentIndex;
          this.waitingForNext = true; // Wait for timer to expire
          this.ratingValue = 0;
          return;
        }
        
        // Multiple choice (checkbox - survey)
        if (questionType === 'multiple_choice' || questionType === 'Multiple Choice') {
          if (this.selectedMultiple.size === 0) {
            if (!isAutoSubmit) {
              this.snackBar.open('⚠️ Please select at least one option', 'Close', { duration: 2000 });
            } else {
              // Auto-submit with no selection => missed
              this.answerStates[this.currentIndex] = 'missed';
              localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
              this.submittedIndex = this.currentIndex;
              this.waitingForNext = true;
            }
            return;
          }
          
          const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));
          this.submitting = true;
          
          if (this.sessionType === 'survey') {
            for (const optionText of this.selectedMultiple) {
              const selectedOption = currentQuestionDetail.options.find(o => o.optionText === optionText);
              if (selectedOption) {
                await this.participantService.submitSurveyAnswer(
                  currentQuestionDetail.questionId,
                  this.participantId,
                  this.sessionId,
                  selectedOption.optionId,
                  optionText,
                  undefined
                );
              }
            }
          }
          
          this.submitting = false;
          this.answerStates[this.currentIndex] = 'answered';
          localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
          if (!isAutoSubmit) this.snackBar.open('✅ Answers submitted successfully!', 'Close', { duration: 1500 });

          this.submittedIndex = this.currentIndex;
          this.waitingForNext = true; 
          this.selectedMultiple.clear();
          return;
        }
        
        // Ranking
        if (questionType === 'ranking' || questionType === 'Ranking') {
          if (this.selectedRanking.length === 0) {
            if (!isAutoSubmit) {
              this.snackBar.open('⚠️ Please arrange the options', 'Close', { duration: 2000 });
            } else {
              this.answerStates[this.currentIndex] = 'missed';
              localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
              this.submittedIndex = this.currentIndex;
              this.waitingForNext = true;
            }
            return;
          }
          
          const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));
          this.submitting = true;
          
          if (this.sessionType === 'survey') {
            for (let rank = 0; rank < this.selectedRanking.length; rank++) {
              const optionText = this.selectedRanking[rank];
              const selectedOption = currentQuestionDetail.options.find(o => o.optionText === optionText);
              if (selectedOption) {
                await this.participantService.submitSurveyAnswer(
                  currentQuestionDetail.questionId,
                  this.participantId,
                  this.sessionId,
                  selectedOption.optionId,
                  `Rank ${rank + 1}: ${optionText}`,
                  rank + 1
                );
              }
            }
          }
          
          this.submitting = false;
          this.answerStates[this.currentIndex] = 'answered';
          localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
          if (!isAutoSubmit) this.snackBar.open('✅ Ranking submitted successfully!', 'Close', { duration: 1500 });

          this.submittedIndex = this.currentIndex;
          this.waitingForNext = true;
          this.selectedRanking = [];
          return;
        }
        
        // Text
        if (questionType === 'text' || questionType === 'short_text') {
          if (!this.textAnswer.trim()) {
            if (!isAutoSubmit) {
              this.snackBar.open('⚠️ Please enter your answer', 'Close', { duration: 2000 });
            } else {
              this.answerStates[this.currentIndex] = 'missed';
              localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
              this.submittedIndex = this.currentIndex;
              this.waitingForNext = true;
            }
            return;
          }
          
          const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));
          this.submitting = true;
          
          if (this.sessionType === 'survey') {
            await this.participantService.submitSurveyAnswer(
              currentQuestionDetail.questionId,
              this.participantId,
              this.sessionId,
              undefined,
              this.textAnswer.trim()
            );
          } else {
            const request: SubmitAnswerRequest = {
              participantId: this.participantId,
              questionId: currentQuestionDetail.questionId,
              selectedOptionId: 0,
              timeSpentSeconds: timeSpent,
              textResponse: this.textAnswer.trim()
            };
            await this.participantService.submitParticipantAnswer(request);
          }
          
          this.submitting = false;
          this.answerStates[this.currentIndex] = 'answered';
          localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
          if (!isAutoSubmit) this.snackBar.open('✅ Answer submitted successfully!', 'Close', { duration: 1500 });

          this.submittedIndex = this.currentIndex;
          this.waitingForNext = true; 
          this.textAnswer = '';
          return;
        }
      }
      
      // QUIZ (single choice) and generic unanswered path
      if (!this.selected) {
        console.log('[QuizPage] No answer selected - submitting as unanswered');
        const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));
        
        const request: SubmitAnswerRequest = {
          participantId: this.participantId,
          questionId: currentQuestionDetail.questionId,
          selectedOptionId: 0, // 0 indicates unanswered
          timeSpentSeconds: timeSpent
        };

        this.submitting = true;
        await this.participantService.submitParticipantAnswer(request);
        this.submitting = false;

        // Mark as missed in progress bar
        this.answerStates[this.currentIndex] = 'missed';
        localStorage.setItem('answerStates', JSON.stringify(this.answerStates));

        if (isAutoSubmit) {
          this.snackBar.open("⏰ Time's up! Question marked as unanswered.", 'Close', { duration: 2000 });
        }

        this.submittedIndex = this.currentIndex;
        this.waitingForNext = true;
        
        // For quizzes, host advances; for surveys/polls, our local timer handles it
        return;
      }
      
      const selectedOption = currentQuestionDetail.options.find(o => o.optionText === this.selected);
      if (!selectedOption) {
        console.error('[QuizPage] Selected option not found. Selected text:', this.selected);
        console.error('[QuizPage] Available options:', currentQuestionDetail.options);
        return;
      }

      const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));
      let quizResponse: any = null;

      this.submitting = true;
      
      if (this.sessionType === 'poll') {
        // Poll-specific endpoint
        await this.participantService.submitPollAnswer(
          currentQuestionDetail.questionId, // pollId
          selectedOption.optionId,
          this.participantId,
          this.sessionId
        );
      } else if (this.sessionType === 'survey') {
        await this.participantService.submitSurveyAnswer(
          currentQuestionDetail.questionId, // surveyQuestionId
          this.participantId,
          this.sessionId,
          selectedOption.optionId
        );
      } else {
        // Quiz endpoint
        const request: SubmitAnswerRequest = {
          participantId: this.participantId,
          questionId: currentQuestionDetail.questionId,
          selectedOptionId: selectedOption.optionId,
          timeSpentSeconds: timeSpent
        };
        quizResponse = await this.participantService.submitParticipantAnswer(request);
      }
      
      this.submitting = false;

      // Mark as answered
      this.answerStates[this.currentIndex] = 'answered';
      localStorage.setItem('answerStates', JSON.stringify(this.answerStates));

      if (!isAutoSubmit) {
        this.snackBar.open('✅ Answer submitted successfully!', 'Close', { duration: 1500 });
      }

      // Update score silently (quiz only)
      if (this.sessionType === 'quiz' && quizResponse && quizResponse.isCorrect) {
        this.score += 1;
      }

      this.submittedIndex = this.currentIndex;
      this.waitingForNext = true; // wait for timer/host to move next
      console.log('[QuizPage] Answer submitted for', this.sessionType, '- waiting for timer/host');

    } catch (error: any) {
      this.submitting = false;
      console.error('[QuizPage] Error submitting answer:', error);
      this.snackBar.open('Failed to submit answer. Please try again.', 'Close', { duration: 3000 });
    }
  }

  async moveToNextQuestion() {
    // Reset per-question state
    this.selected = null;
    this.ratingValue = 0;
    this.textAnswer = '';
    this.selectedMultiple.clear();
    this.rankingOrder = [];
    this.selectedRanking = [];
    this.waitingForNext = false;

    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.currentQuestionStartMs = this.getServerNowMs();
      
      // Reset timer for surveys/polls
      if (this.sessionType === 'survey' || this.sessionType === 'poll') {
        const currentQuestion = this.questions[this.currentIndex];
        this.timeRemaining = currentQuestion?.timerSeconds || 30;
        this.startLocalTimer(); // Restart timer for new question
        console.log('[QuizPage] Moved to question', this.currentIndex + 1, 'with timer:', this.timeRemaining);
      }
      
      // Initialize ranking if the next question is a ranking question
      if (this.isRankingQuestion()) {
        this.initializeRanking();
      }
      console.log('[QuizPage] advanced to index', this.currentIndex);
    } else {
      // End of content
      this.finished = true;
      console.log('[QuizPage] finished with score:', this.score);
      
      // Store final score
      localStorage.setItem('finalScore', this.score.toString());
      localStorage.setItem('totalQuestions', this.questions.length.toString());

      // Stop local timers if any
      this.stopLocalTimer();
      if (this.questionResultTimer) clearInterval(this.questionResultTimer);
      if (this.nextQuestionTimer) clearInterval(this.nextQuestionTimer);
    }
  }

  /**
   * Start local timer countdown - runs for all session types
   * For quizzes: provides smooth UI updates, synced with SignalR
   * For polls/surveys: fully manages the countdown
   */
  private startLocalTimer(): void {
    // Clear any existing timer
    this.stopLocalTimer();
    
    console.log('[QuizPage] ⏱️ startLocalTimer called - Initial timeRemaining:', this.timeRemaining);
    console.log('[QuizPage] Timer sync enabled:', this.timerSyncEnabled);
    console.log('[QuizPage] Session type:', this.sessionType);
    
    let tickCount = 0;
    this.localTimerInterval = setInterval(() => {
      tickCount++;
      if (tickCount <= 3) {
        console.log('[QuizPage] 🔔 Timer tick', tickCount, '- timeRemaining:', this.timeRemaining, 'finished:', this.finished);
      }
      
      if (this.timeRemaining > 0 && !this.finished) {
        // ✅ IMPORTANT: When timerSyncEnabled, DO NOT decrement locally
        // Only SignalR TimerSync events from host should update timeRemaining
        // Local timer only checks for expiration, doesn't modify the value
        if (!this.timerSyncEnabled) {
          // For polls/surveys without host: local timer fully manages countdown
          this.timeRemaining--;
          
          if (this.timeRemaining % 10 === 0 || this.timeRemaining <= 5) {
            console.log('[QuizPage] Local timer:', this.timeRemaining, 'seconds remaining');
          }
        } else {
          // For quizzes with host: just monitor the timer, don't decrement
          if (this.timeRemaining % 10 === 0 || this.timeRemaining <= 5) {
            console.log('[QuizPage] Monitoring synced timer:', this.timeRemaining, 'seconds remaining');
          }
        }
        
        // When timer expires, auto-submit and move to next question/results
        if (this.timeRemaining === 0) {
          console.log('[QuizPage] Timer expired! Auto-submitting and moving to next question/results');
          this.handleTimerExpired();
        }
      }
    }, 1000);
    
    console.log('[QuizPage] ✅ Timer interval created, ID:', this.localTimerInterval);
  }

  private stopLocalTimer(): void {
    if (this.localTimerInterval) {
      clearInterval(this.localTimerInterval);
      this.localTimerInterval = null;
    }
  }

  /**
   * Handle timer expiration - auto-submit and move to next question
   */
  private async handleTimerExpired(): Promise<void> {
    console.log('[QuizPage] Timer expired - handleTimerExpired called');
    console.log('[QuizPage] Waiting state:', this.waitingForNext, 'Submitted:', this.submittedIndex === this.currentIndex);
    
    // Stop the timer
    this.stopLocalTimer();

    // If not submitted, mark missed and submit as unanswered (where applicable)
    if (this.submittedIndex !== this.currentIndex) {
      this.answerStates[this.currentIndex] = 'missed';
      localStorage.setItem('answerStates', JSON.stringify(this.answerStates));
      
      // Auto-submit with no selection (will set waiting overlay as needed)
      await this.submitAnswer(true);
      // For surveys/polls, still show results view after "auto submit" if needed
      if (this.sessionType === 'poll' || this.sessionType === 'survey') {
        this.showQuestionWiseResults();
      }
      return;
    }

    // Already submitted - check if in waiting state
    // If in waiting state and leaderboard is enabled, show the specific type that host enabled
    if (this.waitingForNext && this.showLeaderboardAfterQuestion && this.sessionType === 'quiz') {
      console.log('[QuizPage] 🎯 Waiting timer expired - Auto-showing option bar first, then leaderboard');
      console.log('[QuizPage] Host enabled leaderboard type:', this.hostEnabledLeaderboardType);
      
      // ALWAYS show Option Bar Graph first for 10 seconds
      console.log('[QuizPage] Step 1: Showing Option Bar Graph for 10 seconds');
      this.showOptionBarGraphOverlay.set(true);
      
      // After 10 seconds, hide option bar and show the selected leaderboard type
      setTimeout(() => {
        console.log('[QuizPage] Step 2: Hiding Option Bar, showing leaderboard type');
        this.showOptionBarGraphOverlay.set(false);
        
        // Show the specific leaderboard type that the host toggled
        if (this.hostEnabledLeaderboardType === 'topn') {
          console.log('[QuizPage] Showing Top-N leaderboard');
          this.showTopNLeaderboardOverlay.set(true);
        } else if (this.hostEnabledLeaderboardType === 'progressive') {
          console.log('[QuizPage] Showing Progressive leaderboard');
          this.showProgressiveLeaderboardOverlay.set(true);
        } else if (this.hostEnabledLeaderboardType === 'category') {
          console.log('[QuizPage] Showing Category leaderboard');
          this.showCategoryLeaderboardOverlay.set(true);
        } else {
          // Default: show full leaderboard
          console.log('[QuizPage] Showing default full leaderboard');
          this.displayLeaderboardAfterQuestion(0); // 0 = Manual mode, wait for host to click Next
        }
      }, 10000); // 10 seconds delay
      
      return;
    }

    // Not in waiting state - initial timer expired
    if (this.sessionType === 'poll' || this.sessionType === 'survey') {
      console.log('[QuizPage] Showing question-wise results for', this.sessionType);
      this.showQuestionWiseResults();
    } else {
      // Quiz: In MANUAL mode (host present), DON'T show leaderboard here
      // Host will control when to show it via ShowLeaderboardAfterQuestion event
      // In AUTO mode (no host), show leaderboard automatically
      console.log('[QuizPage] Quiz timer expired');
      console.log('[QuizPage] Host present (MANUAL mode):', this.isHostPresent);
      console.log('[QuizPage] showLeaderboardAfterQuestion:', this.showLeaderboardAfterQuestion);
      
      if (this.isHostPresent) {
        // MANUAL mode: Host controls flow, just wait
        console.log('[QuizPage] MANUAL mode - waiting for host to show leaderboard/navigate');
        this.waitingForNext = true;
      } else {
        // AUTO mode: Show leaderboard automatically if enabled
        if (this.showLeaderboardAfterQuestion) {
          console.log('[QuizPage] AUTO mode - showing leaderboard automatically on timer expiry');
          this.displayLeaderboardAfterQuestion(10); // 10 seconds in AUTO mode
        } else {
          console.log('[QuizPage] Leaderboard disabled, waiting for navigation');
          this.waitingForNext = true;
        }
      }
    }
  }

  /**
   * STATE MACHINE: Transition to Leaderboard State
   * This ensures ONLY the leaderboard is visible, clearing all other UI states
   */
  private displayLeaderboardAfterQuestion(duration: number = 5): void {
    console.log('[QuizPage] ===== STATE TRANSITION: QUESTION → LEADERBOARD =====');
    console.log('[QuizPage] Display duration:', duration, 'seconds (0 = Manual Mode - no auto-close)');
    
    // STEP 1: Clear all existing state and timers
    this.clearAllTimers();
    this.clearAllOverlays();
    
    // STEP 2: Set UI state to leaderboard
    this.currentUIState = 'leaderboard';
    this.waitingForNext = false;
    this.showQuestionResult = false;
    this.submitting = false;
    this.finished = false; // Not finished yet, just showing intermediate leaderboard
    
    // STEP 3: Show leaderboard overlay
    this.leaderboardType = 'full'; // Show full leaderboard (not podium)
    this.showLeaderboardOverlay = true;
    
    console.log('[QuizPage] ✅ UI State: LEADERBOARD | All other overlays cleared');
    
    // STEP 4: Handle duration (Manual vs Auto mode)
    if (duration === 0) {
      // MANUAL MODE: Leaderboard stays until host sends NextQuestion signal
      console.log('[QuizPage] 🎮 MANUAL MODE: Waiting for Host to click Next Question');
      this.leaderboardCountdown = 0;
      return;
    }
    
    // AUTO MODE: Leaderboard auto-closes after duration
    console.log('[QuizPage] ⚡ AUTO MODE: Leaderboard will auto-close in', duration, 'seconds');
    this.leaderboardCountdown = duration;
    
    this.leaderboardTimer = setInterval(() => {
      this.leaderboardCountdown--;
      
      if (this.leaderboardCountdown <= 0) {
        console.log('[QuizPage] ⏰ Auto-close timer expired');
        this.clearAllTimers();
        this.transitionToWaitingState();
      }
    }, 1000);
  }
  
  /**
   * STATE MACHINE: Transition to Waiting State
   */
  private transitionToWaitingState(): void {
    console.log('[QuizPage] ===== STATE TRANSITION → WAITING =====');
    this.currentUIState = 'waiting';
    this.showLeaderboardOverlay = false;
    this.showQuestionResult = false;
    this.waitingForNext = true;
    this.clearAllOverlays();
  }
  
  /**
   * STATE MACHINE: Clear all timers to prevent conflicts
   */
  private clearAllTimers(): void {
    if (this.leaderboardTimer) {
      clearInterval(this.leaderboardTimer);
      this.leaderboardTimer = null;
    }
    if (this.questionResultTimer) {
      clearInterval(this.questionResultTimer);
      this.questionResultTimer = null;
    }
    if (this.nextQuestionTimer) {
      clearInterval(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
    if (this.autoDisplayTimer) {
      clearTimeout(this.autoDisplayTimer);
      this.autoDisplayTimer = null;
    }
  }
  
  /**
   * STATE MACHINE: Clear all overlay signals to prevent z-index conflicts
   */
  private clearAllOverlays(): void {
    this.showOptionBarGraphOverlay.set(false);
    this.showPersonalRankOverlay.set(false);
    this.showTopNLeaderboardOverlay.set(false);
    this.showProgressiveLeaderboardOverlay.set(false);
    this.showCategoryLeaderboardOverlay.set(false);
  }

  /**
   * Show question-wise results for polls/surveys with countdown and auto-advance
   */
  private showQuestionWiseResults(): void {
    console.log('[QuizPage] Displaying question-wise results');
    
    // Show the result overlay
    this.showQuestionResult = true;
    this.waitingForNext = false;
    
    // Set countdown duration (10 seconds to view results)
    this.questionResultCountdown = 10;
    this.nextQuestionCountdown = 10;
    
    // Clear any existing timers
    if (this.questionResultTimer) {
      clearInterval(this.questionResultTimer);
    }
    if (this.nextQuestionTimer) {
      clearInterval(this.nextQuestionTimer);
    }
    
    // Start countdown timer
    this.questionResultTimer = setInterval(() => {
      this.questionResultCountdown--;
      this.nextQuestionCountdown--;
      
      if (this.questionResultCountdown <= 0) {
        // Stop the timer
        clearInterval(this.questionResultTimer);
        if (this.nextQuestionTimer) {
          clearInterval(this.nextQuestionTimer);
        }
        
        // Hide results and move to next question
        this.showQuestionResult = false;
        this.moveToNextQuestion();
      }
    }, 1000);
  }

  /**
   * Close question results manually (if user wants to skip waiting)
   */
  closeQuestionResults(): void {
    console.log('[QuizPage] Closing question results manually');
    
    // Clear timers
    if (this.questionResultTimer) {
      clearInterval(this.questionResultTimer);
    }
    if (this.nextQuestionTimer) {
      clearInterval(this.nextQuestionTimer);
    }
    
    // Hide results and move to next question
    this.showQuestionResult = false;
    this.moveToNextQuestion();
  }

  /**
   * AUTO-DISPLAY FLOW: OptionBarGraph → MyRank (as overlays)
   * Called when OptionCountsUpdate is received from host
   */
  private startAutoDisplayFlow(questionId: number, isManualMode: boolean = false) {
    console.log(`[QuizPage] 🎬 Starting auto-display flow for question: ${questionId}, Mode: ${isManualMode ? 'MANUAL' : 'AUTO'}`);
    
    const OPTION_BAR_DURATION = 5000; // 5 seconds for option bar graph
    const MY_RANK_DURATION = 5000; // 5 seconds for personal rank
    
    // Clear any existing auto-display timer
    if (this.autoDisplayTimer) {
      clearTimeout(this.autoDisplayTimer);
    }
    
    // Step 1: Show OptionBarGraph overlay
    console.log('[QuizPage] 📊 Showing OptionBarGraph overlay');
    this.showOptionBarGraphOverlay.set(true);
    this.showPersonalRankOverlay.set(false);
    
    // In MANUAL mode, keep overlays visible until next question
    if (isManualMode) {
      console.log('[QuizPage] MANUAL mode - keeping Option Bar Graph visible until next question');
      return; // Don't set auto-hide timers
    }
    
    // AUTO mode: Set auto-hide timers
    // Step 2: After duration, show MyRank overlay
    this.autoDisplayTimer = setTimeout(() => {
      console.log('[QuizPage] 🏅 Showing MyRank overlay');
      this.showOptionBarGraphOverlay.set(false);
      this.showPersonalRankOverlay.set(true);
      
      // Step 3: After MyRank duration, hide all overlays
      this.autoDisplayTimer = setTimeout(() => {
        console.log('[QuizPage] ↩️ Hiding overlays, returning to quiz view');
        this.showPersonalRankOverlay.set(false);
      }, MY_RANK_DURATION);
      
    }, OPTION_BAR_DURATION);
  }

  ngOnDestroy() {
    // Clean up on component destroy
    this.timerSyncEnabled = false;

    // Clear leaderboard timer
    if (this.leaderboardTimer) {
      clearInterval(this.leaderboardTimer);
    }

    // Clear question result timers
    if (this.questionResultTimer) {
      clearInterval(this.questionResultTimer);
    }
    if (this.nextQuestionTimer) {
      clearInterval(this.nextQuestionTimer);
    }

    // Clear auto-display timer
    if (this.autoDisplayTimer) {
      clearTimeout(this.autoDisplayTimer);
      this.autoDisplayTimer = null;
      console.log('[QuizPage] Auto-display timer cleared on destroy');
    }

    // Clear local timer
    this.stopLocalTimer();

    if (this.hubConnection) {
      if (this.sessionCode) {
        this.hubConnection.invoke('LeaveSession', this.sessionCode);
      }
      this.hubConnection.stop();
      this.hubConnection = undefined;
    }
  }

  /**
   * Close leaderboard overlay manually
   */
  closeLeaderboard() {
    console.log('🔍 [DEBUG PARTICIPANT] Manually closing leaderboard');
    this.showLeaderboardOverlay = false;
    if (this.leaderboardTimer) {
      clearInterval(this.leaderboardTimer);
    }
  }

  getScorePercentage(): number {
    if (this.questions.length === 0) return 0;
    return Math.round((this.score / this.questions.length) * 100);
  }

  returnToParticipant() {
    // Save quiz and participant info for feedback
    const quizId = localStorage.getItem('currentQuizId');
    const participantId = localStorage.getItem('participantId');
    
    // Navigate to quiz feedback page
    this.router.navigate(['/feedback'], {
      queryParams: {
        quizId: quizId,
        participantId: participantId
      }
    });
  }

  /**
   * Return to home/landing page after poll/survey submission
   */
  returnToHome() {
    // Clear session data
    localStorage.removeItem('sessionCode');
    localStorage.removeItem('participantId');
    localStorage.removeItem('currentQuizId');
    localStorage.removeItem('currentSurveyId');
    localStorage.removeItem('currentPollId');
    
    // Navigate to landing page
    this.router.navigate(['/']);
  }

  republish() {
    // Navigate back to host/result page to republish poll/survey
    this.router.navigate(['/host/manage-content'], {
      queryParams: {
        sessionCode: this.sessionCode,
        action: 'republish',
        sessionType: this.sessionType
      }
    });
  }

  restart() {
    this.currentIndex = 0;
    this.score = 0;
    this.selected = null;
    this.finished = false;
    this.timerSyncEnabled = false; // Reset timer sync on restart
    console.log('[QuizPage] restart');
  }
}
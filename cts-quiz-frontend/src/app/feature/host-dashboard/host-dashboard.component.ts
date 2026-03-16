import { Component, OnInit, OnDestroy, signal, inject, computed, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AddQuestionService } from '../../services/add-question.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { QuizCreationService } from '../../services/quiz-creation.service';
import { CalendarService } from '../../services/calendar.service';
import { AuthService } from '../../services/auth.service';
import { PollService } from '../../services/poll.service';
import { SurveyService } from '../../services/survey.service';
import { ActivityService, ActivityItem, RecentActivityResponse, ActivityStats } from '../../shared/services/activity.service';
import { QuizListItem } from '../../models/quiz.models';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';
import { TemplateService } from '../../services/template.service';
import { PublishNotificationService } from '../../services/publish-notification.service';
import { TemplateComponent } from '../template/template.component';
import { AiChatbotComponent } from '../ai-chatbot/ai-chatbot.component';
import { ThemeStore } from '../../services/theme-store.service';
import { environment } from '../../../environments/environment.development';

interface DashboardStats {
  totalQuizzes: number;
  draftQuizzes: number;
  publishedQuizzes: number;
  totalSurveys: number;
  totalPolls: number;
  totalQuestions: number;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  params?: any;
  color: string;
  gradient: string;
}

interface CalendarDate {
  day: number;
  currentMonth: boolean;
  isToday: boolean;
  hasQuiz: boolean;
  quizCount: number;
  date: Date;
  isWeekend: boolean;
}

interface CalendarQuiz {
  id: string;
  name: string;
  category: string;
  hostName: string;
  time: string;
  status: string;
  participantCount: number;
  date: Date;
  sessionCode?: string;
  sessionId?: number;
  quizStatus?: string;
}

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AiChatbotComponent],
  templateUrl: './host-dashboard.component.html',
  styleUrl: './host-dashboard.component.css'
})
export class HostDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private quizService = inject(AddQuestionService);
  private quizCreationService = inject(QuizCreationService);
  private calendarService = inject(CalendarService);
  private pollService = inject(PollService);
  private surveyService = inject(SurveyService);
  private dashboardStatsService = inject(DashboardStatsService);
  private activityService = inject(ActivityService);
  private tutorialService = inject(TutorialService);
  private templateService = inject(TemplateService);
  private publishNotificationService = inject(PublishNotificationService);
  private themeStore = inject(ThemeStore);
  private cdr = inject(ChangeDetectorRef);

  // Use shared stats service
  stats = this.dashboardStatsService.stats;

  loading = signal(false);
  welcomeMessage = signal('');
  hostQuizzes = signal<QuizListItem[]>([]);
  
  // Get current user info from auth service
  currentUser = this.authService.currentUser;
  currentHostId = this.currentUser()?.employeeId || '';
  hostName = signal(this.currentUser() ? `${this.currentUser()?.firstName} ${this.currentUser()?.lastName}` : 'Host User');
  
  currentDateTime = signal('Loading...');

  // Calendar-related signals
  showCalendar = signal(false);
  showUserDropdown = signal(false);
  currentCalendarDate = signal(new Date());
  selectedDate = signal<Date | null>(null);
  selectedDateQuizzes = signal<CalendarQuiz[]>([]);
  tooltipQuiz = signal<CalendarQuiz | null>(null);
  showTooltip = signal(false);
  tooltipPosition = signal({ top: '0px', left: '0px' });
  
  // Tooltip timeout for better UX
  private tooltipTimeout: any = null;

  // Template Modal signals
  showTemplateModal = signal(false);
  templateName = signal('');
  selectedCategory = signal('');
  templateConfig = signal('');
  templateCategories = ['Java', 'JavaScript', 'Python', 'React', 'Angular', 'Node.js', 'Spring Boot', 'Database', 'DevOps', 'General'];
  isSubmitting = signal(false);
  
  // Question selection signals
  availableQuestions = signal<any[]>([]);
  selectedQuestions = signal<Set<number>>(new Set());
  loadingQuestions = signal(false);
  
  // Current template being viewed/edited
  currentTemplate = signal<any | null>(null);
  displayedQuestions = signal<any[]>([]);
  isEditingTemplate = signal(false);
  
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Activity-related signals
  recentActivities = signal<ActivityItem[]>([]);
  activityStats = signal<ActivityStats | null>(null);
  loadingActivities = signal(false);

  // Mock quiz data for calendar - TODO: Replace with real data
  calendarQuizzes = signal<CalendarQuiz[]>([]);
  calendarVisible = signal(false);
  currentDay = signal('Today');

  // Tutorial properties
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'welcome',
      title: '👋 Welcome to Host Dashboard',
      description: 'This is your main control panel where you can create quizzes, surveys, polls and track analytics.',
      targetElement: '.welcome-section',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'stats-overview',
      title: '📊 Statistics Overview',
      description: 'View your content statistics including quizzes, surveys, polls and questions count.',
      targetElement: '.stats-section',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'quick-actions',
      title: '⚡ Quick Actions',
      description: 'Use these buttons to quickly create new content or manage existing ones.',
      targetElement: '.actions-grid',
      position: 'top',
      skipable: true
    },
    {
      id: 'calendar',
      title: '📅 Calendar View',
      description: 'Click here to view your scheduled quizzes and sessions in calendar format.',
      targetElement: '.header-actions button',
      position: 'bottom',
      skipable: true
    }
  ];

  quickActions: QuickAction[] = [
    {
      id: 'create-quiz',
      title: 'Create Quiz',
      description: 'Build interactive assessments with multiple question types',
      icon: 'fas fa-brain',
      route: '/host/create-question',
      color: '#0066CC',
      gradient: 'linear-gradient(135deg, #0066CC 0%, #004999 100%)'
    },
    {
      id: 'create-survey',
      title: 'Create Survey',
      description: 'Gather feedback and insights from your audience',
      icon: 'fas fa-clipboard-list',
      route: '/host/create-survey',
      color: '#28A745',
      gradient: 'linear-gradient(135deg, #28A745 0%, #1E7E34 100%)'
    },
    {
      id: 'create-poll',
      title: 'Create Poll',
      description: 'Quick polling for real-time audience engagement',
      icon: 'fas fa-poll',
      route: '/host/create-poll',
      color: '#FD7E14',
      gradient: 'linear-gradient(135deg, #FD7E14 0%, #DC6502 100%)'
    },
    {
      id: 'preview',
      title: 'Preview Content',
      description: 'Preview and test your quizzes before publishing',
      icon: 'fas fa-eye',
      route: '/host/preview',
      color: '#17A2B8',
      gradient: 'linear-gradient(135deg, #17A2B8 0%, #138496 100%)'
    },
    {
      id: 'manage-content',
      title: 'Manage Content',
      description: 'Edit, organize and configure your learning materials',
      icon: 'fas fa-cogs',
      route: '/host/manage-content',
      color: '#6F42C1',
      gradient: 'linear-gradient(135deg, #6F42C1 0%, #5A32A3 100%)'
    },
    // {
    //   id: 'leaderboard',
    //   title: 'Leaderboard',
    //   description: 'View real-time participant rankings and scores',
    //   icon: 'fas fa-trophy',
    //   route: '/host/leaderboard',
    //   color: '#FFD700',
    //   gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
    // },
    {
      id: 'templates',
      title: 'Use Templates',
      description: 'Start from a predefined template and customize it',
      icon: 'fas fa-clone',
      route: '/template',
      color: '#0EA5E9',
      gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)'
    },
    {
      id: 'customize-theme',
      title: 'Customize Theme',
      description: 'Personalize the look and feel of your application',
      icon: 'fas fa-palette',
      route: '/host/themes',
      color: '#E83E8C',
      gradient: 'linear-gradient(135deg, #E83E8C 0%, #C2185B 100%)'
    }
  ];

  // Publish modal properties
  showPublishModal = signal(false);
  publishQuizName = signal('');
  selectedTemplateForPublish = signal<any | null>(null);
  isPublishing = signal(false);

  ngOnInit(): void {
    this.updateDateTime(); // Initialize immediately
    this.loadDashboardData();
    this.setWelcomeMessage();
    // Update time every minute
    setInterval(() => this.updateDateTime(), 60000);
    
    // Load host's saved theme from backend
    const user = this.authService.currentUser();
    if (user?.employeeId) {
      console.log('🎨 Loading host theme for:', user.employeeId);
      this.themeStore.loadHostTheme(user.employeeId);
    }
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    this.loadQuizzes();
    this.loadPolls();
    this.loadSurveys();
    this.loadRecentActivity();
    this.loadActivityStats();
  }

  async loadQuizzes() {
    try {
      this.loading.set(true);
      const quizzes = await this.quizCreationService.getHostQuizzes(this.currentHostId);
      this.hostQuizzes.set(quizzes);
      
      // Update shared dashboard stats with real data
      const draftQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'draft').length;
      const publishedQuizzes = quizzes.filter(q => 
        q.status?.toLowerCase() === 'live' || 
        q.status?.toLowerCase() === 'published' ||
        q.status?.toLowerCase() === 'active'
      ).length;
      const totalQuestions = quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0);

      this.dashboardStatsService.updateQuizStats(
        quizzes.length,
        draftQuizzes,
        publishedQuizzes,
        totalQuestions
      );
      
    } catch (error) {
      console.error('Failed to load quizzes:', error);
      // Fallback to questions from AddQuestionService
      const totalQuestions = this.quizService.questions().length;
      const totalQuizzes = totalQuestions > 0 ? 1 : 0;
      
      this.dashboardStatsService.updateQuizStats(
        totalQuizzes,
        totalQuizzes, // Assuming all are drafts for now
        0, // No published quizzes yet
        totalQuestions
      );
    } finally {
      this.loading.set(false);
    }

    // Load calendar data
    this.loadCalendarData();
  }

  async loadPolls() {
    try {
      const polls = await this.pollService.getAllPolls().toPromise();
      this.dashboardStatsService.updatePollStats(polls?.length || 0);
    } catch (error) {
      console.error('Failed to load polls:', error);
      this.dashboardStatsService.updatePollStats(0);
    }
  }

  async loadSurveys() {
    try {
      const surveys = await this.surveyService.getAllSurveysV2().toPromise();
      this.dashboardStatsService.updateSurveyStats(surveys?.length || 0);
    } catch (error) {
      console.error('Failed to load surveys:', error);
      this.dashboardStatsService.updateSurveyStats(0);
    }
  }

  private async loadCalendarData(): Promise<void> {
    try {
      console.log('[Calendar] Loading quiz session data for host:', this.currentHostId);
      
      // Get quiz sessions from QuizSession table joined with Quiz table
      const publishedQuizzes = await this.calendarService.getPublishedQuizzes(this.currentHostId);
      console.log('[Calendar] Quiz sessions from QuizSession table:', publishedQuizzes);
      
      if (publishedQuizzes.length === 0) {
        console.log('[Calendar] No quiz sessions found for host:', this.currentHostId);
        console.log('[Calendar] Note: Only quizzes that have active sessions will appear in the calendar');
      }
      
      // Convert to CalendarQuiz format for display
      const calendarData: CalendarQuiz[] = publishedQuizzes.map(quiz => ({
        id: quiz.quizId.toString(),
        name: quiz.quizTitle || `Quiz ${quiz.quizId}`,
        category: 'General', // TODO: Get category from quiz details if needed
        hostName: quiz.hostName || this.hostName(),
        time: quiz.publishedDate ? new Date(quiz.publishedDate).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        }) : 'N/A',
        status: quiz.status || 'Active',
        participantCount: 0, // TODO: Get from participants table
        date: quiz.publishedDate || new Date(),
        sessionCode: quiz.sessionCode,
        sessionId: quiz.sessionId,
        quizStatus: quiz.quizStatus
      }));
      
      this.calendarQuizzes.set(calendarData);
      console.log('[Calendar] Calendar data set:', calendarData);
      console.log('[Calendar] Calendar display ready with', calendarData.length, 'quiz sessions');
    } catch (error) {
      console.error('[Calendar] Failed to load calendar data:', error);
      console.log('[Calendar] This might be because:');
      console.log('  1. No quiz sessions have been created yet');
      console.log('  2. Backend /Host/publish endpoint is not accessible');
      console.log('  3. Host ID filter is not matching published quiz data');
      this.calendarQuizzes.set([]);
    }
  }

  private loadRecentActivity(): void {
    this.loadingActivities.set(true);
    
    this.activityService.getRecentActivity(10).subscribe({
      next: (response: RecentActivityResponse) => {
        console.log('[Activity] Recent activities loaded:', response);
        this.recentActivities.set(response.activities);
        this.loadingActivities.set(false);
      },
      error: (error) => {
        console.error('[Activity] Failed to load recent activities:', error);
        this.recentActivities.set([]);
        this.loadingActivities.set(false);
      }
    });
  }

  private loadActivityStats(): void {
    this.activityService.getActivityStats().subscribe({
      next: (stats: ActivityStats) => {
        console.log('[Activity] Activity stats loaded:', stats);
        this.activityStats.set(stats);
      },
      error: (error) => {
        console.error('[Activity] Failed to load activity stats:', error);
        this.activityStats.set(null);
      }
    });
  }

  // Activity helper methods
  getActivityIcon(activity: ActivityItem): string {
    return this.activityService.getActivityIcon(activity.activityType, activity.entityType);
  }

  getRelativeTime(date: Date): string {
    return this.activityService.getRelativeTime(date);
  }

  getActivityColor(activityType: string): string {
    return this.activityService.getActivityColor(activityType);
  }

  // Track by function for activity list performance
  trackByActivityId(index: number, activity: ActivityItem): number {
    return activity.id;
  }

  private setWelcomeMessage(): void {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    
    if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
    } else if (hour >= 17) {
      greeting = 'Good evening';
    }
    
    const firstName = this.currentUser()?.firstName || 'Host';
    this.welcomeMessage.set(`${greeting}, ${firstName}! Ready to create something amazing?`);
  }

  private updateDateTime(): void {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    const dayOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long'
    };
    
    this.currentDateTime.set(now.toLocaleString('en-US', options));
    this.currentDay.set(now.toLocaleDateString('en-US', dayOptions));
  }

  navigateToAction(action: QuickAction): void {
    if (action.id === 'quiz-calendar') {
      this.toggleCalendar();
    } else if (action.id === 'create-template') {
      this.openTemplateModal();
    } else if (action.params) {
      this.router.navigate([action.route], { queryParams: action.params });
    } else {
      this.router.navigate([action.route]);
    }
  }

  navigateBack(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToThemes(): void {
    this.router.navigate(['/host/themes']);
  }

  // Calendar methods
  toggleCalendar(): void {
    this.showCalendar.set(!this.showCalendar());
  }

  toggleUserDropdown(): void {
    this.showUserDropdown.update(value => !value);
  }

  getHostInitial(): string {
    const name = this.hostName();
    if (!name) return 'H';
    
    const nameParts = name.trim().split(' ');
    if (nameParts.length > 1) {
      // First letter of first name + first letter of last name
      return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }

  handleDropdownAction(action: string): void {
    this.showUserDropdown.set(false);
    
    switch(action) {
      case 'tutorial':
        this.resetTutorial();
        break;
      case 'themes':
        // Navigate to theme selection
        this.router.navigate(['/host/themes']);
        break;
      case 'logout':
        this.logout();
        break;
    }
  }

  getCurrentMonthYear(): string {
    return this.currentCalendarDate().toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }

  previousMonth(): void {
    const currentDate = this.currentCalendarDate();
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    this.currentCalendarDate.set(newDate);
  }

  nextMonth(): void {
    const currentDate = this.currentCalendarDate();
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    this.currentCalendarDate.set(newDate);
  }

  calendarDates(): CalendarDate[] {
    const currentDate = this.currentCalendarDate();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month  
    const lastDay = new Date(year, month + 1, 0);
    // First day of calendar grid
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const dates: CalendarDate[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayQuizzes = this.calendarQuizzes().filter(quiz => 
        quiz.date.toDateString() === date.toDateString()
      );
      
      dates.push({
        day: date.getDate(),
        currentMonth: date.getMonth() === month,
        isToday: date.toDateString() === today.toDateString(),
        hasQuiz: dayQuizzes.length > 0,
        quizCount: dayQuizzes.length,
        date: new Date(date),
        isWeekend: date.getDay() === 0 || date.getDay() === 6 // Sunday = 0, Saturday = 6
      });
    }
    
    return dates;
  }

  selectDate(date: CalendarDate): void {
    this.selectedDate.set(date.date);
    const quizzes = this.calendarQuizzes().filter((quiz: CalendarQuiz) => 
      quiz.date.toDateString() === date.date.toDateString()
    );
    this.selectedDateQuizzes.set(quizzes);
  }

  formatSelectedDate(): string {
    const date = this.selectedDate();
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  showQuizInfo(date: CalendarDate, event: MouseEvent): void {
    // Clear any existing timeout
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    
    if (!date.hasQuiz) return;
    
    const quizzes = this.calendarQuizzes().filter((quiz: CalendarQuiz) => 
      quiz.date.toDateString() === date.date.toDateString()
    );
    
    if (quizzes.length > 0) {
      this.tooltipQuiz.set(quizzes[0]);
      this.showTooltip.set(true);
      this.updateTooltipPosition(event);
    }
  }

  hideQuizInfo(): void {
    // Add small delay before hiding to prevent flickering
    this.tooltipTimeout = setTimeout(() => {
      this.showTooltip.set(false);
      this.tooltipQuiz.set(null);
    }, 100);
  }

  showQuizTooltip(quiz: CalendarQuiz, event: MouseEvent): void {
    // Clear any existing timeout
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    
    this.tooltipQuiz.set(quiz);
    this.showTooltip.set(true);
    this.updateTooltipPosition(event);
  }

  hideQuizTooltip(): void {
    // Add small delay before hiding to prevent flickering
    this.tooltipTimeout = setTimeout(() => {
      this.showTooltip.set(false);
      this.tooltipQuiz.set(null);
    }, 100);
  }

  updateTooltipPosition(event: MouseEvent): void {
    const offset = 15; // Distance from cursor
    const tooltipWidth = 250; // Approximate tooltip width
    const tooltipHeight = 120; // Approximate tooltip height
    
    let left = event.clientX + offset;
    let top = event.clientY + offset;
    
    // Check if tooltip would go off the right edge of the screen
    if (left + tooltipWidth > window.innerWidth) {
      left = event.clientX - tooltipWidth - offset;
    }
    
    // Check if tooltip would go off the bottom edge of the screen  
    if (top + tooltipHeight > window.innerHeight) {
      top = event.clientY - tooltipHeight - offset;
    }
    
    // Ensure tooltip doesn't go off the left or top edge
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    this.tooltipPosition.set({
      top: `${top}px`,
      left: `${left}px`
    });
  }

  getTooltipPosition(): string {
    const pos = this.tooltipPosition();
    return `position: fixed; top: ${pos.top}; left: ${pos.left}; z-index: 9999;`;
  }

  getQuizStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'published': return 'badge-success';
      case 'draft': return 'badge-warning';
      case 'archived': return 'badge-secondary';
      default: return 'badge-primary';
    }
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
    }, 2000); // Delay for dashboard to load
  }

  // Tutorial methods
  startTutorial(): void {
    if (this.tutorialService.shouldAutoStart('host-dashboard')) {
      console.log('Auto-starting tutorial for host dashboard');
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'host-dashboard');
    } else {
      console.log('Tutorial already seen for host dashboard');
    }
  }

  resetTutorial(): void {
    this.tutorialService.resetTutorial('host-dashboard');
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'host-dashboard');
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
    const position = {
      top: `${rect.top - 5}px`,
      left: `${rect.left - 5}px`,
      width: `${rect.width + 10}px`,
      height: `${rect.height + 10}px`
    };
    
    // Trigger change detection to prevent ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => this.cdr.detectChanges(), 0);
    
    return position;
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

  // Template Modal Methods
  openTemplateModal(): void {
    this.showTemplateModal.set(true);
    this.templateName.set('');
    this.selectedCategory.set('');
    this.templateConfig.set('');
    this.currentTemplate.set(null);
    this.displayedQuestions.set([]);
    this.isEditingTemplate.set(false);
  }

  closeTemplateModal(): void {
    this.showTemplateModal.set(false);
    this.templateName.set('');
    this.selectedCategory.set('');
    this.templateConfig.set('');
    this.selectedQuestions.set(new Set());
    this.availableQuestions.set([]);
    this.currentTemplate.set(null);
    this.displayedQuestions.set([]);
    this.isEditingTemplate.set(false);
  }

  // Load questions for selected category
  onCategoryChange(category: string): void {
    if (!category) return;
    
    this.loadingQuestions.set(true);
    const apiUrl = `${environment.apiBaseUrl}/Host/Question/category/${category}/questions`;
    
    fetch(apiUrl)
      .then(res => res.json())
      .then((data: any) => {
        // API returns array directly
        const questions = Array.isArray(data) ? data : (data.value || []);
        console.log('Questions loaded:', questions);
        this.availableQuestions.set(questions);
        this.selectedQuestions.set(new Set());
        this.loadingQuestions.set(false);
      })
      .catch(error => {
        console.error('Error loading questions:', error);
        alert('Failed to load questions for this category');
        this.availableQuestions.set([]);
        this.loadingQuestions.set(false);
      });
  }

  // Toggle question selection
  toggleQuestion(questionId: number): void {
    const selected = new Set(this.selectedQuestions());
    if (selected.has(questionId)) {
      selected.delete(questionId);
    } else {
      // Limit to 3 selections
      if (selected.size < 3) {
        selected.add(questionId);
      } else {
        alert('You can select maximum 3 questions');
        return;
      }
    }
    this.selectedQuestions.set(selected);
  }

  // Check if question is selected
  isQuestionSelected(questionId: number): boolean {
    return this.selectedQuestions().has(questionId);
  }

  saveTemplate(): void {
    if (!this.templateName() || !this.selectedCategory() || !this.templateConfig()) {
      alert('Please fill in all fields');
      return;
    }

    if (this.selectedQuestions().size === 0) {
      alert('Please select at least 1 question');
      return;
    }

    this.isSubmitting.set(true);

    // Convert selected questions set to comma-separated string
    const selectedIds = Array.from(this.selectedQuestions()).join(',');

    // Create template object
    const template = {
      templateName: this.templateName(),
      templateType: 'CATEGORY',
      categoryType: this.selectedCategory(),
      templateConfig: this.templateConfig(),
      selectedQuestionIds: selectedIds,
      createdBy: Number(this.currentHostId) || 1
    };

    console.log('Publishing template:', template);
    
    this.templateService.createTemplate(template).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        alert('Template created successfully!');
        this.closeTemplateModal();
        console.log('Template created:', response);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        console.error('Error creating template:', error);
        alert('Error creating template: ' + (error?.error?.message || error?.message || 'Unknown error'));
      }
    });
  }

  // Load questions for a template when viewing/editing it
  loadTemplateQuestions(template: any): void {
    if (!template.selectedQuestionIds) {
      console.log('No selected questions for this template');
      this.displayedQuestions.set([]);
      return;
    }

    // Parse the comma-separated question IDs
    const questionIds = template.selectedQuestionIds.split(',').map((id: string) => parseInt(id.trim()));
    console.log('Loading questions for template:', questionIds);

    // Fetch each question
    const apiUrl = `${environment.apiBaseUrl}/Host/Question`;
    
    fetch(apiUrl)
      .then(res => res.json())
      .then((data: any) => {
        const allQuestions = Array.isArray(data) ? data : (data.value || []);
        // Filter questions that match the selected IDs
        const selectedQs = allQuestions.filter((q: any) => questionIds.includes(q.questionId));
        console.log('Selected questions loaded:', selectedQs);
        this.displayedQuestions.set(selectedQs);
      })
      .catch(error => {
        console.error('Error loading template questions:', error);
        this.displayedQuestions.set([]);
      });
  }

  // Open template for viewing/editing
  openTemplateForView(template: any): void {
    this.currentTemplate.set(template);
    this.isEditingTemplate.set(false);
    this.showTemplateModal.set(true);
    this.templateName.set(template.templateName || '');
    this.selectedCategory.set(template.categoryType || '');
    this.templateConfig.set(template.templateConfig || '');
    this.loadTemplateQuestions(template);
  }

  /**
   * Open publish modal to create a quiz from a template
   */
  openPublishModal(template: any): void {
    if (!template?.templateId) {
      console.error('Template ID not found');
      return;
    }
    this.selectedTemplateForPublish.set(template);
    this.publishQuizName.set(`Quiz from ${template.templateName || 'Template'}`);
    this.showPublishModal.set(true);
  }

  /**
   * Close publish modal
   */
  closePublishModal(): void {
    this.showPublishModal.set(false);
    this.publishQuizName.set('');
    this.selectedTemplateForPublish.set(null);
    this.isPublishing.set(false);
  }

  /**
   * Publish template as a quiz
   * Creates a new quiz from template and automatically loads it in preview
   */
  async publishTemplate(): Promise<void> {
    const template = this.selectedTemplateForPublish();
    const quizName = this.publishQuizName();

    if (!template?.templateId) {
      console.error('Template not found');
      return;
    }

    if (!quizName.trim()) {
      alert('Please enter a quiz name');
      return;
    }

    this.isPublishing.set(true);

    try {
      const response = await this.templateService.publishTemplateAsQuiz(
        template.templateId,
        quizName.trim()
      ).toPromise();

      console.log('✅ Template published as quiz:', response);
      alert(`Quiz "${quizName}" created successfully in draft!`);
      this.closePublishModal();
      
      // Reload the host quizzes so the new quiz appears
      this.loadDashboardData();
      
      // Notify preview component of the newly published quiz
      if (response?.quizId) {
        this.publishNotificationService.notifyQuizPublished(response.quizId, quizName.trim());
      }
    } catch (error) {
      console.error('❌ Error publishing template:', error);
      alert('Failed to publish template. Please try again.');
    } finally {
      this.isPublishing.set(false);
    }
  }

  /**
   * Handle publish event from template component
   * Opens the publish modal with the selected template
   */
  onTemplatePublish(template: any): void {
    this.openPublishModal(template);
  }

  /**
   * Helper method to get input value from event
   */
  onQuizNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.publishQuizName.set(input.value);
  }

  ngOnDestroy(): void {
    // Clean up tooltip timeout
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
  }
}
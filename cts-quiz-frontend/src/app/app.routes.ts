import { Routes } from '@angular/router';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/landing', pathMatch: 'full' },
  
  // Auth Routes - Keep these loaded immediately for fast access
  { 
    path: 'login', 
    redirectTo: '/landing',
    pathMatch: 'full'
  },
  { 
    path: 'landing', 
    loadComponent: () => import('./feature/landing-page/landing-page.component').then(c => c.LandingPageComponent)
  },
  
  // Admin Routes - Lazy loaded (Role ID: 1)
  { 
    path: 'admin/dashboard', 
    loadComponent: () => import('./feature/admin-dashboard/admin-dashboard.component').then(c => c.AdminDashboardComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  
  // Host Routes - Lazy loaded (Role ID: 2)
  { 
    path: 'host/dashboard', 
    loadComponent: () => import('./feature/host-dashboard/host-dashboard.component').then(c => c.HostDashboardComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-question', 
    loadComponent: () => import('./feature/add-question/add-question.component').then(c => c.AddQuestionComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-survey', 
    loadComponent: () => import('./feature/create-survey/create-survey.component').then(c => c.CreateSurveyComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'survey/:id/view', 
    loadComponent: () => import('./feature/create-survey/create-survey.component').then(c => c.CreateSurveyComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-poll', 
    loadComponent: () => import('./feature/create-poll/create-poll.component').then(c => c.CreatePollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'poll/:id/view', 
    loadComponent: () => import('./feature/create-poll/create-poll.component').then(c => c.CreatePollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/preview', 
    loadComponent: () => import('./feature/preview/preview.component').then(c => c.PreviewComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/manage-content', 
    loadComponent: () => import('./feature/result/result.component').then(c => c.ResultComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host-lobby', 
    loadComponent: () => import('./feature/host-lobby/host-lobby.component').then(c => c.HostLobbyComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'results-analysis', 
    loadComponent: () => import('./feature/results-analysis/results-analysis.component').then(c => c.ResultsAnalysisComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'word-cloud', 
    loadComponent: () => import('./feature/word-cloud/word-cloud.component').then(c => c.WordCloudComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  // { 
  //   path: 'host/leaderboard', 
  //   loadComponent: () => import('./feature/leaderboard/leaderboard.component').then(c => c.LeaderboardComponent),
  //   canActivate: [roleGuard],
  //   data: { roles: ['Host'], roleIds: [2] }
  // },
  // Interactive Leaderboard Routes (Participant routes)
  { 
    path: 'leaderboard/dynamic/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-topn/leaderboard-topn.component').then(c => c.LeaderboardTopnComponent)
  },
  { 
    path: 'leaderboard/podium/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-podium/leaderboard-podium.component').then(c => c.LeaderboardPodiumComponent)
  },
  { 
    path: 'leaderboard/progressive/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-progressive/leaderboard-progressive.component').then(c => c.LeaderboardProgressiveComponent)
  },
  { 
    path: 'leaderboard/category/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-category/leaderboard-category.component').then(c => c.LeaderboardCategoryComponent)
  },
  // Host-specific Interactive Leaderboard Routes
  { 
    path: 'host/leaderboard/dynamic/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-topn/leaderboard-topn.component').then(c => c.LeaderboardTopnComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/leaderboard/podium/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-podium/leaderboard-podium.component').then(c => c.LeaderboardPodiumComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/leaderboard/progressive/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-progressive/leaderboard-progressive.component').then(c => c.LeaderboardProgressiveComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/leaderboard/category/:sessionId', 
    loadComponent: () => import('./feature/leaderboard-category/leaderboard-category.component').then(c => c.LeaderboardCategoryComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'my-rank', 
    loadComponent: () => import('./feature/my-rank/my-rank.component').then(c => c.MyRankComponent)
  },
  { 
    path: 'quiz/options/:questionId', 
    loadComponent: () => import('./feature/option-bargraph/option-bargraph.component').then(c => c.OptionBargraphComponent)
  },
  { 
    path: 'quiz/my-rank/:participantId', 
    loadComponent: () => import('./feature/my-rank/my-rank.component').then(c => c.MyRankComponent)
  },
  { 
    path: 'host/options/:questionId', 
    loadComponent: () => import('./feature/option-bargraph/option-bargraph.component').then(c => c.OptionBargraphComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-quiz', 
    redirectTo: '/host/create-question',
    pathMatch: 'full'
  },
  { 
    path: 'host/themes', 
    loadComponent: () => import('./feature/theme-selection/theme-selection.component').then(c => c.ThemeSelectionComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/themes/customize', 
    loadComponent: () => import('./feature/theme-customize/theme-customize.component').then(c => c.ThemeCustomizeComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  
  // User/Participant Routes - Lazy loaded (Role ID: 3)
  { 
    path: 'user/dashboard', 
    loadComponent: () => import('./feature/participantpage/participantpage.component').then(c => c.ParticipantPageComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'template', 
    loadComponent: () => import('./feature/template/template.component').then(c => c.TemplateComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host', 'Admin'], roleIds: [1, 2] }
  },
  { 
    path: 'host/polls', 
    loadComponent: () => import('./feature/create-poll/create-poll.component').then(c => c.CreatePollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'participant', 
    loadComponent: () => import('./feature/participantpage/participantpage.component').then(c => c.ParticipantPageComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'countdown', 
    loadComponent: () => import('./feature/countdown/countdown.component').then(c => c.CountdownComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  // { 
  //   path: 'poll-countdown', 
  //   loadComponent: () => import('./feature/poll-countdown/poll-countdown.component').then(c => c.PollCountdownComponent),
  //   canActivate: [roleGuard],
  //   data: { roles: ['User'], roleIds: [3] }
  // },
  // { 
  //   path: 'survey-countdown', 
  //   loadComponent: () => import('./feature/survey-countdown/survey-countdown.component').then(c => c.SurveyCountdownComponent),
  //   canActivate: [roleGuard],
  //   data: { roles: ['User'], roleIds: [3] }
  // },
  { 
    path: 'quiz', 
    loadComponent: () => import('./feature/quiz/quiz.component').then(c => c.QuizPageComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'lobby', 
    loadComponent: () => import('./feature/quiz-username/quiz-username.component').then(c => c.QuizUsernameComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'feedback', 
    loadComponent: () => import('./feature/feedback/feedback.component').then(c => c.FeedbackFormComponent)
    // No guard needed - allow anyone who completed a quiz to give feedback
  },
  { 
    path: 'survey-results', 
    loadComponent: () => import('./feature/survey-results/survey-results.component').then(c => c.SurveyResultsComponent)
    // No guard needed - allow participants to see their survey completion
  },
  { 
    path: 'poll-results', 
    loadComponent: () => import('./feature/poll-results/poll-results.component').then(c => c.PollResultsComponent)
    // No guard needed - allow participants to see their poll completion
  },
  { 
    path: 'host/calendar', 
    loadComponent: () => import('./feature/quiz-calendar/quiz-calendar.component').then(c => c.QuizCalendarComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'admin/calendar', 
    loadComponent: () => import('./feature/quiz-calendar/quiz-calendar.component').then(c => c.QuizCalendarComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  { 
    path: 'host/analytics', 
    loadComponent: () => import('./feature/analytics/analytics.component').then(c => c.AnalyticsComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'admin/analytics', 
    loadComponent: () => import('./feature/analytics/analytics.component').then(c => c.AnalyticsComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  { 
    path: 'host/poll-analytics', 
    loadComponent: () => import('./feature/result-poll/result-poll.component').then(c => c.ResultPollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'admin/poll-analytics', 
    loadComponent: () => import('./feature/result-poll/result-poll.component').then(c => c.ResultPollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  { 
    path: 'result-poll', 
    loadComponent: () => import('./feature/result-poll/result-poll.component').then(c => c.ResultPollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host', 'Admin'], roleIds: [2, 1] }
  },
  { 
    path: 'host/survey-analytics', 
    loadComponent: () => import('./feature/result-survey/result-survey.component').then(c => c.ResultSurveyComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'admin/survey-analytics', 
    loadComponent: () => import('./feature/result-survey/result-survey.component').then(c => c.ResultSurveyComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  { 
    path: 'result-survey', 
    loadComponent: () => import('./feature/result-survey/result-survey.component').then(c => c.ResultSurveyComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host', 'Admin'], roleIds: [2, 1] }
  },
  { 
    path: 'admin/user-management', 
    loadComponent: () => import('./feature/user-management/user-management.component').then(c => c.UserManagementComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  
  // Survey Participation Routes

  
  // Participant Responses Route - View submitted responses
  // { 
  //   path: 'participant/responses', 
  //   loadComponent: () => import('./feature/participant-responses/participant-responses.component').then(c => c.ParticipantResponsesComponent),
  //   canActivate: [roleGuard],
  //   data: { roles: ['User'], roleIds: [3] }
  // },
  
  // Catch all
  { path: '**', redirectTo: '' },
];
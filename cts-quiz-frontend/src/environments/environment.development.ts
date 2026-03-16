export const environment = {
  production: false,
    apiUrl: 'http://localhost:5195/api',
  apiBaseUrl: 'http://localhost:5195/api',
  signalRUrl: 'http://localhost:5195/quizSessionHub',
  themeHubUrl: 'http://localhost:5195/themeHub',
  enableLogging: true,
  demoMode: true, // For interview demo
  retryAttempts: 3,
  requestTimeout: 10000,
  apiEndpoints: {
    template: '/admin/template', // Admin area: api/template (doesn't follow area pattern)
    questions: '/host/question', // Host area: api/host/question
    dashboard: '/admin', // Admin area: api/admin
    users: '/admin/userManagement', // Admin area: api/admin/userManagement (doesn't follow area pattern)
    metrics: '/admin/metrics', // Admin area: api/admin/metrics
    quiz: '/host/quiz', // Host area: api/host/quiz
    publish: '/host/publish', // Host area: api/host/publish
    session: '/participate/session', // Participate area: api/participate/session
    participate: '/participate/quiz', // Participate area: api/participate/quiz
    ai: '/ai' // AI chatbot endpoint
  },
  features: {
    realTimeUpdates: true,
    analytics: true,
    collaboration: true
  },
  storage: {
    prefix: 'cts-quiz-',
    encryption: false
  }
};

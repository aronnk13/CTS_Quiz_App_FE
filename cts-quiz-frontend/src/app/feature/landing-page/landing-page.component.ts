import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
  animations: [
    trigger('fadeInUp', [
      state('in', style({ opacity: 1, transform: 'translateY(0)' })),
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(50px)' }),
        animate('800ms ease-out')
      ])
    ]),
    trigger('slideIn', [
      state('in', style({ transform: 'translateX(0)' })),
      transition('void => *', [
        style({ transform: 'translateX(-100%)' }),
        animate('600ms ease-out')
      ])
    ]),
    trigger('pulse', [
      state('in', style({ transform: 'scale(1)' })),
      transition('* => *', [
        animate('1s ease-in-out', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(1.05)', offset: 0.5 }),
          style({ transform: 'scale(1)', offset: 1 })
        ]))
      ])
    ])
  ]
})
export class LandingPageComponent implements OnInit, OnDestroy {
  public router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  
  // Authentication state
  isAuthenticated = signal(false);
  userRole = signal<string | null>(null);
  showLoginForm = signal(false);
  showRegistrationForm = signal(false);
  
  // Login form data
  loginData = {
    employeeId: '',
    password: ''
  };
  
  // Registration form data
  registrationData = {
    employeeId: '',
    email: '',
    firstName: '',
    lastName: '',
    password: ''
  };
  
  // Signals for animations
  showHero = signal(false);
  showFeatures = signal(false);
  showStats = signal(false);
  
  // UI state
  showHostOptions = false;
  isLoading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false); // Password visibility toggle for registration
  showLoginPassword = signal(false); // Password visibility toggle for login
  
  // Fancy popup for validation messages
  popup = signal<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Quiz statistics
  stats = {
    totalQuizzes: 1250,
    activeUsers: 50000,
    questionsCreated: 25000,
    companiesUsing: 500
  };
  
  // Impact statistics for Cognizant branding
  impactStats = [
    {
      icon: 'fas fa-building',
      value: '500+',
      label: 'Enterprise Clients',
      trend: '+25% YoY'
    },
    {
      icon: 'fas fa-users',
      value: '2.5M+',
      label: 'Active Learners',
      trend: '+40% Growth'
    },
    {
      icon: 'fas fa-brain',
      value: '85%',
      label: 'Skill Improvement',
      trend: 'Proven Results'
    },
    {
      icon: 'fas fa-globe',
      value: '50+',
      label: 'Countries',
      trend: 'Global Reach'
    }
  ];
  // Features data - Cognizant enterprise focus
  features = [
    {
      icon: 'fas fa-chart-line',
      title: 'AI-Powered Analytics',
      description: 'Advanced machine learning insights to identify skill gaps and optimize learning paths with predictive analytics.'
    },
    {
      icon: 'fas fa-shield-alt',
      title: 'Enterprise Security',
      description: 'SOC 2 Type II compliance, end-to-end encryption, and enterprise-grade security protocols for global organizations.'
    },
    {
      icon: 'fas fa-cloud-upload-alt',
      title: 'Cloud-Native Platform',
      description: 'Scalable microservices architecture with 99.9% uptime, auto-scaling, and global CDN distribution.'
    },
    {
      icon: 'fas fa-brain',
      title: 'Adaptive Learning',
      description: 'Personalized learning experiences with AI-driven assessments, interactive quizzes, and comprehensive surveys to adapt content based on performance.'
    },
    {
      icon: 'fas fa-poll-h',
      title: 'Smart Assessment Suite',
      description: 'Create dynamic quizzes and interactive surveys with real-time analytics, automatic scoring, and seamless conversion between formats.'
    },
    {
      icon: 'fas fa-globe',
      title: 'Global Deployment',
      description: 'Multi-region deployment with localization support for 50+ countries and compliance with local regulations.'
    },
    {
      icon: 'fas fa-plug',
      title: 'Enterprise Integration',
      description: 'Seamless integration with HRIS, LMS, and existing enterprise systems through comprehensive API gateway.'
    }
  ];
  
  ngOnInit() {
    // Initialize component with error handling
    try {
      // Check if user is already authenticated and redirect them
      if (this.authService.isAuthenticated()) {
        this.authService.navigateToDashboard();
        return;
      }
      
      this.initializeAnimations();
      this.loadInitialData();
    } catch (error) {
      this.handleError(error, 'component initialization');
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize animations with error handling
   */
  private initializeAnimations(): void {
    try {
      // Staggered animation triggers
      setTimeout(() => this.showHero.set(true), 300);
      setTimeout(() => this.showFeatures.set(true), 800);
      setTimeout(() => this.showStats.set(true), 1200);
    } catch (error) {
      console.warn('Animation initialization error:', error);
      // Set all animations to show immediately if there's an error
      this.showHero.set(true);
      this.showFeatures.set(true);
      this.showStats.set(true);
    }
  }

  /**
   * Load initial data with error handling
   */
  private loadInitialData(): void {
    this.isLoading.set(true);
    this.clearError();

    // Simulate loading process with error handling
    of(null).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error, 'loading initial data');
        return of(null);
      })
    ).subscribe({
      next: () => {
        // Data loaded successfully
        this.isLoading.set(false);
      },
      error: (error) => {
        this.handleError(error, 'loading initial data');
      }
    });
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Handle errors with user-friendly messages
   */
  private handleError(error: any, operation: string): void {
    console.error(`Error in ${operation}:`, error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    this.error.set(errorMessage);
    this.isLoading.set(false);
  }
  
  navigateToQuizCreation() {
    try {
      this.clearError();
      this.router.navigate(['/host/dashboard']).catch(error => {
        this.handleError(error, 'navigation to host dashboard');
      });
      this.showHostOptions = false;
    } catch (error) {
      this.handleError(error, 'navigateToQuizCreation');
    }
  }

  navigateToSurveyCreation() {
    try {
      this.clearError();
      this.router.navigate(['/host/dashboard']).catch(error => {
        this.handleError(error, 'navigation to host dashboard');
      });
      this.showHostOptions = false;
    } catch (error) {
      this.handleError(error, 'navigateToSurveyCreation');
    }
  }

  navigateToPollCreation() {
    try {
      this.clearError();
      this.router.navigate(['/host/dashboard']).catch(error => {
        this.handleError(error, 'navigation to host dashboard');
      });
      this.showHostOptions = false;
    } catch (error) {
      this.handleError(error, 'navigateToPollCreation');
    }
  }
  
  navigateToHost() {
    try {
      // Legacy method - redirect to quiz creation
      this.navigateToQuizCreation();
    } catch (error) {
      this.handleError(error, 'navigateToHost');
    }
  }
  
  // Authentication methods
  toggleLoginForm() {
    this.showLoginForm.set(!this.showLoginForm());
    this.showRegistrationForm.set(false);
  }
  
  toggleRegistrationForm() {
    this.showRegistrationForm.set(!this.showRegistrationForm());
    this.showLoginForm.set(false);
  }
  
  // Enhanced login method with employee ID pre-validation to show specific error messages
  async onLogin() {
    if (!this.loginData.employeeId || !this.loginData.password) {
      this.showPopup('Please fill in all required fields', 'warning');
      return;
    }
    
    try {
      this.isLoading.set(true);
      
      // Pre-check if employee ID exists in database
      const employeeExists = await this.authService.checkEmployeeExists(this.loginData.employeeId);
      
      // If employee ID doesn't exist, show specific error message
      if (!employeeExists) {
        this.showPopup('Employee ID does not exist.', 'error');
        this.isLoading.set(false);
        return;
      }
      
      // Employee ID exists, now attempt login
      const response = await this.authService.login({
        employeeId: this.loginData.employeeId,
        password: this.loginData.password
      });
      
      if (response.success && response.user) {
        this.isAuthenticated.set(true);
        this.userRole.set(response.user.role.toString());
        this.showLoginForm.set(false);
        
        this.showPopup(`Welcome back! Redirecting to ${response.user.role} dashboard...`, 'success');
        
        // Let the AuthService handle the navigation since it already has redirect logic
        // Remove the duplicate setTimeout redirect to prevent double redirects
      } else {
        // If employee ID exists but login failed, it must be wrong password
        this.showPopup('Incorrect Password.', 'error');
      }
      
    } catch (error: any) {
      // If employee ID exists but login failed with error, it must be wrong password
      const errorMessage = error?.error?.message || error?.message || 'Login failed. Please check your credentials.';
      
      if (errorMessage.toLowerCase().includes('invalid credentials') || errorMessage.toLowerCase().includes('password')) {
        this.showPopup('Incorrect Password.', 'error');
      } else {
        this.showPopup('Incorrect Password.', 'error');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
  
  async onRegister() {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.registrationData.email || !emailRegex.test(this.registrationData.email)) {
      this.showPopup('Invalid Email ID.', 'error');
      return;
    }

    // Validate password length
    if (this.registrationData.password && this.registrationData.password.length < 8) {
      this.showPopup('Invalid password. Password must be at least 8 characters long.', 'error');
      return;
    }

    // Validate password contains at least one uppercase letter and one special character
    const hasUpperCase = /[A-Z]/.test(this.registrationData.password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.registrationData.password);
    
    if (!hasUpperCase || !hasSpecialChar) {
      this.showPopup('Password must contain at least one uppercase letter and one special character.', 'error');
      return;
    }
    
    try {
      this.isLoading.set(true);
      console.log('Attempting registration with:', this.registrationData);
      const result = await this.authService.register(this.registrationData);
      console.log('Registration result:', result);
      this.showRegistrationForm.set(false);
      this.showPopup('Registration successful! Please login with your credentials.', 'success');
      this.toggleLoginForm();
    } catch (error: any) {
      console.error('Registration failed:', error);
      console.error('Error details:', {
        status: error?.status,
        statusText: error?.statusText,
        errorMessage: error?.error?.message,
        errorDetails: error?.error?.details,
        fullError: error?.error
      });
      
      const errorMsg = error?.error?.message || error?.message || 'Registration failed. Please try again.';
      
      // Check for specific errors
      if (errorMsg.toLowerCase().includes('employee') && errorMsg.toLowerCase().includes('exist')) {
        this.showPopup('Employee ID already exists.', 'error');
      } else if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('exist')) {
        this.showPopup('Email ID already exists.', 'error');
      } else if (errorMsg.toLowerCase().includes('employee') && errorMsg.toLowerCase().includes('email')) {
        // Both exist
        this.showPopup('Employee ID already exists.', 'error');
      } else if (error?.error?.details) {
        // Show detailed error for debugging
        this.showPopup(`Registration failed: ${error.error.details}`, 'error');
      } else {
        this.showPopup(errorMsg, 'error');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
  
  logout() {
    this.authService.logout();
    this.isAuthenticated.set(false);
    this.userRole.set(null);
    this.snackBar.open('Logged out successfully', 'Close', { duration: 3000 });
  }
  
  // Role-based navigation methods
  canAccessAdmin(): boolean {
    return this.isAuthenticated() && this.userRole() === 'Admin';
  }
  
  canAccessHost(): boolean {
    return this.isAuthenticated() && (this.userRole() === 'Host' || this.userRole() === 'Admin');
  }
  
  navigateToParticipant() {
    try {
      this.clearError();
      // Navigate to participant join flow
      this.router.navigate(['/participant']).catch(error => {
        this.handleError(error, 'navigation to participant page');
      });
    } catch (error) {
      this.handleError(error, 'navigateToParticipant');
    }
  }
  
  showAccessAlert(type: 'admin' | 'survey' | 'poll') {
    this.showHostOptions = false;
    
    // Handle survey navigation directly
    if (type === 'survey') {
      this.navigateToSurveyCreation();
      return;
    }
    
    // Handle poll navigation directly
    if (type === 'poll') {
      this.navigateToPollCreation();
      return;
    }
    
    // Only handle admin type now since survey and poll are handled above
    if (type === 'admin') {
      const config = {
        title: '🔒 Administrator Access',
        message: 'Administrative features are currently under development.\n\nThis section will include:\n• User management\n• System settings\n• Analytics dashboard\n• Security controls\n\nComing soon!'
      };
      
      this.snackBar.open(`${config.title}\n\n${config.message}`, 'Close', {
        duration: 12000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }
  
  navigateToAdmin() {
    // Legacy method
    this.showAccessAlert('admin');
  }
  
  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  }
  
  // Method to show fancy popup with auto-hide
  private showPopup(message: string, type: 'success' | 'error' | 'warning'): void {
    this.popup.set({ message, type });
    setTimeout(() => this.popup.set(null), 4000);
  }
  
  // Method to manually close popup
  closePopup(): void {
    this.popup.set(null);
  }

  // Toggle password visibility for registration
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  // Toggle password visibility for login
  toggleLoginPasswordVisibility(): void {
    this.showLoginPassword.set(!this.showLoginPassword());
  }
}

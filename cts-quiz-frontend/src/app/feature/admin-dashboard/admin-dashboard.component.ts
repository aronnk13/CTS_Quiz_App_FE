import { Component, OnInit, OnDestroy, inject, signal, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { ThemeService, ThemeType } from '../../services/theme.service';
import { User } from '../../models/auth.models';
import { AdminService, AdminUser, Role, AdminStats } from '../../services/admin.service';
import { TemplateService, Template } from '../../services/template.service';
import { AnalyticsComponent } from '../analytics/analytics.component';
import { TemplateComponent } from '../template/template.component';

// Bootstrap 5 Admin Dashboard - Enhanced Component with Dark/Light Theme Support

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AnalyticsComponent, TemplateComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private templateService = inject(TemplateService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private themeService = inject(ThemeService);
  
  // Theme management
  currentTheme = signal<ThemeType>('light');
  isDarkMode = signal(false);
  
  currentUser = signal<User | null>(null);
  users = signal<AdminUser[]>([]);
  roles = signal<Role[]>([]);
  templates = signal<Template[]>([]);
  quizzes = signal<any[]>([]);
  surveys = signal<any[]>([]);
  polls = signal<any[]>([]);
  quizManagementData = signal<any>({});
  recentActivity = signal<any[]>([]);
  stats = signal<AdminStats>({
    totalUsers: 0,
    activeHosts: 0,
    totalQuizzes: 0,
    activeSessions: 0,
    templatesCount: 0,
    lastUpdated: new Date()
  });
  
  // Animated counter signals
  displayedStats = signal<AdminStats>({
    totalUsers: 0,
    activeHosts: 0,
    totalQuizzes: 0,
    activeSessions: 0,
    templatesCount: 0,
    lastUpdated: new Date()
  });
  
  // Search & Filter signals
  searchTerm = signal('');
  selectedRoleFilter = signal<number | null>(null);
  selectedStatusFilter = signal<string>('all'); // all, active, inactive
  filteredUsers = signal<AdminUser[]>([]);
  filteredQuizzes = signal<any[]>([]);
  filteredSurveys = signal<any[]>([]);
  filteredPolls = signal<any[]>([]);
  
  // Search subject for debouncing
  private searchSubject = new Subject<string>();
  
  isLoading = signal(false);
  selectedTab = signal('overview');
  sidebarCollapsed = signal(false);
  
  // Role management
  selectedUserId = signal<string | null>(null);
  selectedRoleId = signal<number | null>(null);
  showRoleModal = signal(false);
  
  // Template management
  selectedTemplate = signal<Template | null>(null);
  showTemplateModal = signal(false);
  templateFormData = signal({ name: '', type: 'PDF', config: '' });

  // Quiz management
  selectedQuizTab = signal('quizzes'); // quizzes, surveys, polls

  ngOnInit() {
    this.loadCurrentUser();
    this.loadAdminData();
    this.setupSearchDebounce();
    this.setupCounterAnimation();
    this.setupTheme();
  }
  
  /**
   * Initialize and setup theme
   */
  private setupTheme(): void {
    // Set initial theme
    const initialTheme = this.themeService.getCurrentTheme();
    this.currentTheme.set(initialTheme);
    this.isDarkMode.set(initialTheme === 'dark');

    // Subscribe to theme changes
    this.themeService.theme$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((theme: ThemeType) => {
        this.currentTheme.set(theme);
        this.isDarkMode.set(theme === 'dark');
      });
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Get theme icon class for UI
   */
  getThemeIcon(): string {
    return this.isDarkMode() ? 'fas fa-sun' : 'fas fa-moon';
  }

  /**
   * Get theme button title
   */
  getThemeButtonTitle(): string {
    return this.isDarkMode() ? 'Switch to Light Theme' : 'Switch to Dark Theme';
  }
  
  private setupSearchDebounce() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyFilters();
      });
  }
  
  private setupCounterAnimation() {
    effect(() => {
      const currentStats = this.stats();
      this.animateCounters(currentStats);
    });
  }
  
  private animateCounters(newStats: AdminStats) {
    const duration = 800; // ms
    const steps = 30;
    const stepDuration = duration / steps;
    
    const startStats = this.displayedStats();
    const animateValue = (start: number, end: number, currentStep: number): number => {
      return Math.floor(start + (end - start) * (currentStep / steps));
    };
    
    for (let step = 0; step <= steps; step++) {
      setTimeout(() => {
        this.displayedStats.set({
          totalUsers: animateValue(startStats.totalUsers, newStats.totalUsers, step),
          activeHosts: animateValue(startStats.activeHosts, newStats.activeHosts, step),
          totalQuizzes: animateValue(startStats.totalQuizzes, newStats.totalQuizzes, step),
          activeSessions: animateValue(startStats.activeSessions, newStats.activeSessions, step),
          templatesCount: animateValue(startStats.templatesCount, newStats.templatesCount, step),
          lastUpdated: newStats.lastUpdated
        });
      }, stepDuration * step);
    }
  }

  private async loadAdminData() {
    this.isLoading.set(true);
    try {
      // Load all admin data in parallel
      await Promise.all([
        this.loadUsers(),
        this.loadRoles(),
        this.loadTemplates(),
        this.loadQuizzes(),
        this.loadSurveys(),
        this.loadPolls(),
        this.loadQuizManagementDashboard(),
        this.loadStats(),
        this.loadRecentActivity()
      ]);
      // Apply initial filters
      this.applyFilters();
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private loadCurrentUser() {
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);
  }

  private loadUsers(): Promise<void> {
    return this.adminService.getUsers().toPromise().then(
      (users) => {
        console.log('[Admin] Users loaded:', users);
        this.users.set(users || []);
      },
      (error) => {
        console.error('[Admin] Error loading users:', error);
        this.users.set([]);
      }
    );
  }

  private loadRoles(): Promise<void> {
    return this.adminService.getRoles().toPromise().then(
      (roles) => {
        console.log('[Admin] Roles loaded:', roles);
        this.roles.set(roles || []);
      },
      (error) => {
        console.error('[Admin] Error loading roles:', error);
        this.roles.set([]);
      }
    );
  }

  private loadTemplates(): Promise<void> {
    return this.templateService.getAllTemplates().toPromise().then(
      (templates) => {
        console.log('[Admin] Templates loaded:', templates);
        this.templates.set((templates as any[]) || []);
      },
      (error) => {
        console.error('[Admin] Error loading templates:', error);
        this.templates.set([]);
      }
    );
  }

  private loadQuizzes(): Promise<void> {
    return this.adminService.getQuizzes().toPromise().then(
      (quizzes) => {
        console.log('[Admin] Quizzes loaded:', quizzes);
        this.quizzes.set(quizzes || []);
      },
      (error) => {
        console.error('[Admin] Error loading quizzes:', error);
        this.quizzes.set([]);
      }
    );
  }

  private loadSurveys(): Promise<void> {
    return this.adminService.getSurveys().toPromise().then(
      (surveys) => {
        console.log('[Admin] Surveys loaded:', surveys);
        this.surveys.set(surveys || []);
      },
      (error) => {
        console.error('[Admin] Error loading surveys:', error);
        this.surveys.set([]);
      }
    );
  }

  private loadPolls(): Promise<void> {
    return this.adminService.getPolls().toPromise().then(
      (polls) => {
        console.log('[Admin] Polls loaded:', polls);
        this.polls.set(polls || []);
      },
      (error) => {
        console.error('[Admin] Error loading polls:', error);
        this.polls.set([]);
      }
    );
  }

  private loadQuizManagementDashboard(): Promise<void> {
    return this.adminService.getQuizManagementDashboard().toPromise().then(
      (data) => {
        console.log('[Admin] Quiz management dashboard loaded:', data);
        this.quizManagementData.set(data || {});
      },
      (error) => {
        console.error('[Admin] Error loading quiz management dashboard:', error);
        this.quizManagementData.set({});
      }
    );
  }

  private loadRecentActivity(): Promise<void> {
    return this.adminService.getRecentActivity().toPromise().then(
      (activity) => {
        console.log('[Admin] Recent activity loaded:', activity);
        this.recentActivity.set(activity || []);
      },
      (error) => {
        console.error('[Admin] Error loading recent activity:', error);
        this.recentActivity.set([]);
      }
    );
  }

  private loadStats(): Promise<void> {
    return this.adminService.getAdminStats().toPromise().then(
      (stats) => {
        console.log('[Admin] Stats loaded from backend:', stats);
        const formattedStats = {
          totalUsers: stats?.totalUsers || 0,
          activeHosts: stats?.activeHosts || 0,
          totalQuizzes: stats?.totalQuizzes || 0,
          activeSessions: stats?.activeSessions || 0,
          templatesCount: stats?.templatesCount || 0,
          lastUpdated: new Date(stats?.lastUpdated || new Date())
        };
        this.stats.set(formattedStats);
        // Initialize displayed stats for animation
        this.displayedStats.set(formattedStats);
      },
      (error) => {
        console.error('[Admin] Error loading stats from backend:', error);
        // Calculate fallback stats from available data
        this.calculateFallbackStats();
      }
    );
  }

  private calculateFallbackStats(): void {
    try {
      const users = this.users();
      const templates = this.templates();
      
      const totalUsers = users.length;
      const activeHosts = users.filter(u => 
        u.employeeRoles?.some(r => r.roleName?.toLowerCase() === 'host') && u.isActive
      ).length;
      
      const fallbackStats = {
        totalUsers,
        activeHosts,
        totalQuizzes: 0, // Will be updated when quiz data is available
        activeSessions: 0, // Will be updated when session data is available
        templatesCount: templates.length,
        lastUpdated: new Date()
      };
      
      console.log('[Admin] Using fallback stats calculation');
      this.stats.set(fallbackStats);
      this.displayedStats.set(fallbackStats);
    } catch (error) {
      console.error('[Admin] Error calculating fallback stats:', error);
      // Set default values if everything fails
      const defaultStats = {
        totalUsers: 0,
        activeHosts: 0,
        totalQuizzes: 0,
        activeSessions: 0,
        templatesCount: 0,
        lastUpdated: new Date()
      };
      this.stats.set(defaultStats);
      this.displayedStats.set(defaultStats);
    }
  }

  selectTab(tab: string) {
    this.selectedTab.set(tab);
  }

  toggleSidebar() {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }

  selectQuizTab(tab: string) {
    this.selectedQuizTab.set(tab);
  }

  async updateUserRole(userId: string, newRole: string) {
    try {
      // TODO: Implement role update
      console.log(`Updating user ${userId} role to ${newRole}`);
      await this.loadUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  }

  // ============= ROLE MANAGEMENT METHODS =============
  
  openRoleAssignModal(userId: string) {
    this.selectedUserId.set(userId);
    // Pre-select current role
    const user = this.users().find(u => u.id === userId);
    if (user && user.employeeRoles && user.employeeRoles.length > 0) {
      this.selectedRoleId.set(user.employeeRoles[0].roleId);
    }
    this.showRoleModal.set(true);
  }

  closeRoleModal() {
    this.selectedUserId.set(null);
    this.selectedRoleId.set(null);
    this.showRoleModal.set(false);
  }

  async assignRole() {
    const userId = this.selectedUserId();
    const roleId = this.selectedRoleId();
    
    if (!userId || !roleId) {
      alert('Please select a role');
      return;
    }

    try {
      const user = this.users().find(u => u.id === userId);
      if (!user) return;

      // Use changeUserRole to replace current role with new one
      await this.adminService.changeUserRole(user.employeeId, roleId).toPromise();
      console.log(`[Admin] User ${userId} role changed to ${roleId}`);
      await this.loadUsers(); // Refresh users
      this.closeRoleModal();
      alert('User role changed successfully!');
    } catch (error) {
      console.error('[Admin] Error changing user role:', error);
      alert('Failed to change user role. Please try again.');
    }
  }

  async removeRole(userId: string, roleId: number) {
    if (!confirm('Are you sure you want to remove this role?')) return;
    
    try {
      await this.adminService.removeRole(userId, roleId).toPromise();
      console.log(`[Admin] Role ${roleId} removed from user ${userId}`);
      await this.loadUsers(); // Refresh users
    } catch (error) {
      console.error('[Admin] Error removing role:', error);
      alert('Failed to remove role. Please try again.');
    }
  }

  // ============= TEMPLATE MANAGEMENT METHODS =============

  openCreateTemplateModal() {
    this.selectedTemplate.set(null);
    this.templateFormData.set({ name: '', type: 'PDF', config: '' });
    this.showTemplateModal.set(true);
  }

  openEditTemplateModal(template: Template) {
    this.selectedTemplate.set(template);
    this.templateFormData.set({
      name: template.templateName,
      type: template.templateType,
      config: JSON.stringify(template.templateConfig || {}, null, 2)
    });
    this.showTemplateModal.set(true);
  }

  closeTemplateModal() {
    this.selectedTemplate.set(null);
    this.templateFormData.set({ name: '', type: 'PDF', config: '' });
    this.showTemplateModal.set(false);
  }

  async saveTemplate() {
    const formData = this.templateFormData();
    const template = this.selectedTemplate();
    
    if (!formData.name.trim()) {
      alert('Template name is required');
      return;
    }

    try {
      let config;
      try {
        config = formData.config ? JSON.parse(formData.config) : {};
      } catch (e) {
        alert('Invalid JSON configuration');
        return;
      }

      const templateData = {
        templateName: formData.name.trim(),
        templateType: formData.type,
        templateConfig: config,
        createdBy: this.currentUser()?.employeeId || 'admin'
      };

      if (template) {
        // Update existing template
        await this.templateService.updateTemplate(template.templateId!, templateData as any).toPromise();
        console.log(`[Admin] Template ${template.templateId} updated`);
      } else {
        // Create new template
        await this.templateService.createTemplate(templateData as any).toPromise();
        console.log(`[Admin] New template created`);
      }

      await this.loadTemplates(); // Refresh templates
      this.closeTemplateModal();
    } catch (error) {
      console.error('[Admin] Error saving template:', error);
      alert('Failed to save template. Please try again.');
    }
  }

  async deleteTemplate(template: Template) {
    if (!confirm(`Are you sure you want to delete "${template.templateName}"?`)) return;
    
    try {
      await this.templateService.deleteTemplate(template.templateId!).toPromise();
      console.log(`[Admin] Template ${template.templateId} deleted`);
      await this.loadTemplates(); // Refresh templates
    } catch (error) {
      console.error('[Admin] Error deleting template:', error);
      alert('Failed to delete template. Please try again.');
    }
  }

  getTabTitle(): string {
    switch (this.selectedTab()) {
      case 'overview': return 'Dashboard Overview';
      case 'users': return 'User Management';
      case 'quizzes': return 'Quiz Management';
      case 'analytics': return 'Analytics & Insights';
      case 'settings': return 'System Settings';
      default: return 'Admin Dashboard';
    }
  }

  getTabSubtitle(): string {
    switch (this.selectedTab()) {
      case 'overview': return 'Monitor system activity and key metrics';
      case 'users': return 'Manage user accounts, roles, and permissions';
      case 'quizzes': return 'Oversee all quizzes, surveys, and polls';
      case 'analytics': return 'View detailed analytics and insights';
      case 'settings': return 'Configure system preferences and settings';
      default: return 'Welcome to the admin control panel';
    }
  }

  getCurrentDateTime(): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());
  }

  getRoleIcon(role: string): string {
    return this.adminService.getRoleIcon(role);
  }

  getRoleClass(role: string): string {
    return this.adminService.getRoleClass(role);
  }

  formatDate(date: Date | string | undefined): string {
    return this.adminService.formatDate(date);
  }

  formatUserName(user: AdminUser): string {
    return this.adminService.formatUserName(user.firstName, user.lastName);
  }

  getUserRoles(user: AdminUser): string {
    return user.employeeRoles.map(r => r.roleName).join(', ') || 'No Role';
  }

  getUserMainRole(user: AdminUser): string {
    const roles = user.employeeRoles;
    if (roles.length === 0) return 'User';
    
    // Prioritize Admin > Host > Participant
    const priority = ['admin', 'host', 'participant', 'viewer'];
    const sortedRoles = roles.sort((a, b) => {
      const aIndex = priority.indexOf(a.roleName.toLowerCase());
      const bIndex = priority.indexOf(b.roleName.toLowerCase());
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    return sortedRoles[0].roleName;
  }

  async toggleUserStatus(userId: string) {
    try {
      const user = this.users().find(u => u.id === userId);
      if (!user) return;
      
      const action = user.isActive ? 'deactivate' : 'activate';
      const confirmMessage = `Are you sure you want to ${action} ${user.firstName} ${user.lastName}?`;
      
      if (!confirm(confirmMessage)) return;

      await this.adminService.updateUserStatus(user.employeeId, !user.isActive).toPromise();
      console.log(`[Admin] User ${userId} status toggled to ${!user.isActive}`);
      await this.loadUsers(); // Refresh users
      
      const statusMessage = user.isActive ? 'deactivated' : 'activated';
      alert(`User ${user.firstName} ${user.lastName} has been ${statusMessage} successfully!`);
    } catch (error) {
      console.error('[Admin] Error toggling user status:', error);
      alert('Failed to update user status. Please try again.');
    }
  }

  getStatusClass(isActive: boolean): string {
    return isActive ? 'status-active' : 'status-inactive';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  formatTimeAgo(timestamp: string | Date): string {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return time.toLocaleDateString();
  }

  refreshData() {
    this.loadAdminData();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/landing']);
  }
  
  // ============= SEARCH & FILTER METHODS =============
  
  onSearchChange(searchValue: string) {
    this.searchTerm.set(searchValue);
    this.searchSubject.next(searchValue);
  }
  
  onRoleFilterChange(value: string) {
    const roleId = value ? parseInt(value, 10) : null;
    this.selectedRoleFilter.set(roleId);
    this.applyFilters();
  }
  
  onStatusFilterChange(status: string) {
    this.selectedStatusFilter.set(status);
    this.applyFilters();
  }
  
  private applyFilters() {
    const search = this.searchTerm().toLowerCase();
    const roleFilter = this.selectedRoleFilter();
    const statusFilter = this.selectedStatusFilter();
    
    // Filter Users
    let filteredUsers = this.users();
    
    if (search) {
      filteredUsers = filteredUsers.filter(user =>
        user.firstName.toLowerCase().includes(search) ||
        user.lastName.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.employeeId.toLowerCase().includes(search)
      );
    }
    
    if (roleFilter) {
      filteredUsers = filteredUsers.filter(user =>
        user.employeeRoles?.some(r => r.roleId === roleFilter)
      );
    }
    
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filteredUsers = filteredUsers.filter(user => user.isActive === isActive);
    }
    
    this.filteredUsers.set(filteredUsers);
    
    // Filter Quizzes
    let filteredQuizzes = this.quizzes();
    if (search) {
      filteredQuizzes = filteredQuizzes.filter(quiz =>
        quiz.quizNumber?.toLowerCase().includes(search) ||
        quiz.createdBy?.toLowerCase().includes(search) ||
        quiz.status?.toLowerCase().includes(search)
      );
    }
    this.filteredQuizzes.set(filteredQuizzes);
    
    // Filter Surveys
    let filteredSurveys = this.surveys();
    if (search) {
      filteredSurveys = filteredSurveys.filter(survey =>
        survey.title?.toLowerCase().includes(search) ||
        survey.description?.toLowerCase().includes(search) ||
        survey.status?.toLowerCase().includes(search)
      );
    }
    this.filteredSurveys.set(filteredSurveys);
    
    // Filter Polls
    let filteredPolls = this.polls();
    if (search) {
      filteredPolls = filteredPolls.filter(poll =>
        poll.pollTitle?.toLowerCase().includes(search) ||
        poll.pollQuestion?.toLowerCase().includes(search) ||
        poll.pollStatus?.toLowerCase().includes(search)
      );
    }
    this.filteredPolls.set(filteredPolls);
  }
  
  clearFilters() {
    this.searchTerm.set('');
    this.selectedRoleFilter.set(null);
    this.selectedStatusFilter.set('all');
    this.applyFilters();
  }
  
  isFiltersActive(): boolean {
    return this.searchTerm() !== '' || 
           this.selectedRoleFilter() !== null || 
           this.selectedStatusFilter() !== 'all';
  }

  // ===== Template Management Methods =====
  
  navigateToTemplates(): void {
    this.router.navigate(['/template']);
  }

  selectTemplate(template: Template): void {
    // Navigate to template editor
    this.router.navigate(['/template']);
  }

  getTemplateCategory(template: Template): string {
    if (!template || !template.templateConfig) return 'General';
    try {
      const config = typeof template.templateConfig === 'string' 
        ? JSON.parse(template.templateConfig) 
        : template.templateConfig;
      return config.category || 'General';
    } catch {
      return 'General';
    }
  }

  getTemplateQuestionCount(template: Template): number | null {
    if (!template || !template.templateConfig) return null;
    try {
      const config = typeof template.templateConfig === 'string' 
        ? JSON.parse(template.templateConfig) 
        : template.templateConfig;
      return config.questionCount || null;
    } catch {
      return null;
    }
  }

  ngOnDestroy() {
    // Cleanup handled by takeUntilDestroyed
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAtUtc: Date;
  updatedAtUtc: Date;
  employeeRoles: EmployeeRole[];
  department?: string;
  lastLogin?: Date;
}

export interface EmployeeRole {
  roleId: number;
  roleName: string;
}

export interface Role {
  roleId: number;
  roleName: string;
  description?: string;
}

export interface Template {
  id: number;
  templateName: string;
  templateType: string;
  templateConfig?: any;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface AssignRoleRequest {
  employeeId: string;
  roleId: number;
}

export interface AdminStats {
  totalUsers: number;
  activeHosts: number;
  totalQuizzes: number;
  activeSessions: number;
  templatesCount: number;
  lastUpdated: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;
  private adminApiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // ============= USER MANAGEMENT =============

  /**
   * Get all users in the system
   */
  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.apiUrl}/UserManagement`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching users:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.apiUrl}/UserManagement/${id}`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching user:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Update user status (activate/deactivate)
   */
  updateUserStatus(employeeId: string, isActive: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/UserManagement/${employeeId}/status`, { isActive })
      .pipe(
        catchError(error => {
          console.error('AdminService: Error updating user status:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Assign role to user
   */
  assignRole(request: AssignRoleRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/UserManagement/assign-role`, request)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error assigning role:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Remove role from user
   */
  removeRole(employeeId: string, roleId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/UserManagement/${employeeId}/roles/${roleId}`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error removing role:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Change user's primary role (remove all roles and assign new one)
   */
  changeUserRole(employeeId: string, newRoleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/UserManagement/${employeeId}/change-role`, { roleId: newRoleId })
      .pipe(
        catchError(error => {
          console.error('AdminService: Error changing user role:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= ROLE MANAGEMENT =============

  /**
   * Get all available roles
   */
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/UserManagement/roles`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching roles:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= TEMPLATE MANAGEMENT =============
  // NOTE: Template CRUD operations have been consolidated in TemplateService
  // Use TemplateService for all template-related operations (getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate)
  // This admin service is kept for admin-specific template queries and aggregations only

  // ============= ADMIN STATISTICS =============

  /**
   * Get admin dashboard statistics
   */
  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.apiUrl}/Metrics`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching admin stats:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get recent system activity
   */
  getRecentActivity(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/Metrics/recent-activity`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching recent activity:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= HELPER METHODS =============

  /**
   * Get role display name with proper formatting
   */
  getRoleDisplayName(role: string): string {
    const roleMap: { [key: string]: string } = {
      'admin': 'Administrator',
      'host': 'Quiz Host',
      'participant': 'Participant',
      'viewer': 'Viewer'
    };

    return roleMap[role.toLowerCase()] || role;
  }

  /**
   * Get role icon class
   */
  getRoleIcon(role: string): string {
    const iconMap: { [key: string]: string } = {
      'admin': 'fas fa-crown',
      'host': 'fas fa-user-tie',
      'participant': 'fas fa-user',
      'viewer': 'fas fa-eye'
    };

    return iconMap[role.toLowerCase()] || 'fas fa-user';
  }

  /**
   * Get role CSS class
   */
  getRoleClass(role: string): string {
    const classMap: { [key: string]: string } = {
      'admin': 'badge-admin',
      'host': 'badge-host',
      'participant': 'badge-participant',
      'viewer': 'badge-viewer'
    };

    return classMap[role.toLowerCase()] || 'badge-default';
  }

  /**
   * Format user name for display
   */
  formatUserName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim();
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string | undefined): string {
    if (!date) return 'Never';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  }

  // ============= QUIZ MANAGEMENT =============

  /**
   * Get all quizzes in the system
   */
  /**
   * Get all quizzes in the system (optionally filtered by host)
   */
  getQuizzes(hostId?: string): Observable<any[]> {
    const url = hostId 
      ? `${this.apiUrl}/QuizManagement/quizzes/by-host/${encodeURIComponent(hostId)}`
      : `${this.apiUrl}/QuizManagement/quizzes`;
    return this.http.get<any[]>(url)
      .pipe(
        catchError(error => {
          if (error.status === 404) {
            console.warn('AdminService: Quizzes endpoint returned 404, returning empty array');
            return of([]);
          }
          console.error('AdminService: Error fetching quizzes:', error);
          return of([]);
        })
      );
  }

  /**
   * Get all surveys in the system (optionally filtered by host)
   */
  getSurveys(hostId?: string): Observable<any[]> {
    const url = hostId
      ? `${this.apiUrl}/QuizManagement/surveys/by-host/${encodeURIComponent(hostId)}`
      : `${this.apiUrl}/QuizManagement/surveys`;
    return this.http.get<any[]>(url)
      .pipe(
        catchError(error => {
          if (error.status === 404) {
            console.warn('AdminService: Surveys endpoint returned 404, returning empty array');
            return of([]);
          }
          console.error('AdminService: Error fetching surveys:', error);
          return of([]);
        })
      );
  }

  /**
   * Get all polls in the system (optionally filtered by host)
   */
  getPolls(hostId?: string): Observable<any[]> {
    const url = hostId
      ? `${this.apiUrl}/QuizManagement/polls/by-host/${encodeURIComponent(hostId)}`
      : `${this.apiUrl}/QuizManagement/polls`;
    return this.http.get<any[]>(url)
      .pipe(
        catchError(error => {
          if (error.status === 404) {
            console.warn('AdminService: Polls endpoint returned 404, returning empty array');
            return of([]);
          }
          console.error('AdminService: Error fetching polls:', error);
          return of([]);
        })
      );
  }

  /**
   * Get quiz management dashboard data
   */
  getQuizManagementDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/QuizManagement/dashboard`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching quiz management dashboard:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= REPORTS ANALYTICS =============
  // NOTE: Feedback analytics have been consolidated in AnalyticsService
  // Use ServiceAnalyticsService for all analytics queries (getAnalyticsByQuiz, getFeedbackAnalyticsByHostAndQuiz, etc.)
}
import { Injectable, signal, inject, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  User, 
  LoginRequest, 
  LoginResponse, 
  AuthState, 
  UserRole,
  CreateUserRequest,
  PasswordChangeRequest,
  UserActivity
} from '../models/auth.models';

// Legacy interfaces for backward compatibility
export interface RegisterRequest {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

// Updated login request type
export type LegacyLoginRequest =
  | { employeeId: string; password: string }
  | { email: string; password: string };

export interface LegacyLoginResponse {
  employeeId: string;
  name: string;
  role: string[];   // array of roles from backend
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  
  private apiUrl = `${environment.apiUrl}/auth`;
  private legacyBase = `${environment.apiUrl}/admin/auth`; // Updated to use admin auth endpoint
  
  // Auth state management
  private authState = signal<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false
  });

  // Legacy token keys
  private tokenKey = 'auth_token';
  private rolesKey = 'auth_roles'; // JSON-encoded array

  // Public readonly access to auth state
  readonly isAuthenticated = () => this.authState().isAuthenticated;
  readonly currentUser = () => this.authState().user;
  readonly isLoading = () => this.authState().loading;
  readonly userRole = () => this.authState().user?.role;

  // Session timeout (40 minutes)
  private readonly SESSION_TIMEOUT = 40 * 60 * 1000;
  private sessionTimer?: NodeJS.Timeout;

  constructor() {
    this.initializeFromStorage();
    this.startSessionMonitoring();
  }

  /**
   * Check if employee ID exists in the database
   * This is used to differentiate between "Employee ID does not exist" and "Invalid password" errors
   */
  async checkEmployeeExists(employeeId: string): Promise<boolean> {
    try {
      // Try to get user information to verify employee ID exists
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/users`)
      );
      
      // Check if employee ID exists in the users list
      const users = response?.users || response || [];
      return users.some((user: any) => user.employeeId === employeeId);
    } catch (error) {
      console.error('Error checking employee ID:', error);
      return false;
    }
  }

  /**
   * Enhanced login with employee ID and password
   * Pre-validates employee ID existence to provide specific error messages
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    this.setLoading(true);
    
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/login`, credentials)
      );

      if (response.token && response.employeeId) {
        // Map backend response to frontend User model
        const user: User = {
          userId: response.employeeId,
          employeeId: response.employeeId,
          firstName: response.firstName || '',
          lastName: response.lastName || '',
          email: response.email || '',
          department: '', // Not provided by backend
          role: this.mapRolesToUserRole(response.roles || []),
          isActive: true,
          createdAt: new Date(),
          lastLogin: new Date()
        };

        this.setAuthenticatedUser(user, response.token);
        await this.logActivity('LOGIN', `User logged in successfully`);
        
        // Get redirect URL based on role
        const redirectUrl = this.getRedirectUrl(user.role);

        return {
          success: true,
          user,
          token: response.token,
          redirectUrl,
          message: 'Login successful'
        };
      } else {
        return {
          success: false,
          message: 'Invalid response from server'
        };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Enhanced error handling for specific login scenarios
      // NOTE: Backend needs to return specific error messages for proper error handling:
      // - "Employee ID not found" or "Employee does not exist" for wrong employee ID
      // - "Incorrect password" or "Wrong password" for wrong password
      // - "Invalid credentials" for both wrong (generic fallback)
      let errorMessage = 'Login failed. Please try again.';
      
      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.error && typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Map HTTP status codes and error messages to specific user-friendly messages
      if (error?.status === 401) {
        // Check the actual error message from backend to determine the specific error
        const backendMessage = error?.error?.message?.toLowerCase() || '';
        
        // Check for password-related errors
        if (backendMessage.includes('password') || backendMessage.includes('incorrect password') || backendMessage.includes('wrong password')) {
          errorMessage = 'Incorrect password.';
        } 
        // Check for employee ID not found errors
        else if (backendMessage.includes('employee id not found') || backendMessage.includes('employee not found') || backendMessage.includes('employee does not exist') || backendMessage.includes('user not found')) {
          errorMessage = 'Employee ID does not exist.';
        } 
        // Generic invalid credentials - when backend can't specify which field is wrong
        else if (backendMessage.includes('invalid credentials') || backendMessage.includes('authentication failed')) {
          errorMessage = 'User does not exist.';
        } 
        // Default for other 401 errors
        else {
          errorMessage = 'User does not exist.';
        }
      } else if (error?.status === 404) {
        // Not found - employee ID doesn't exist
        errorMessage = 'Employee ID does not exist.';
      }
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Legacy login method for backward compatibility
   */
  legacyLogin(payload: LegacyLoginRequest) {
    return this.http.post<LegacyLoginResponse>(`${this.legacyBase}/login`, payload);
  }

  /**
   * Register new user
   */
  async register(payload: RegisterRequest): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/register`, payload)
      );
      console.log('Registration successful:', response);
      return response;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    const currentUser = this.authState().user;
    
    try {
      if (currentUser) {
        // Log activity before clearing session
        await this.logActivity('LOGOUT', 'User logged out');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  /**
   * Create new user (Admin only)
   */
  async createUser(userRequest: CreateUserRequest): Promise<{ success: boolean; message: string }> {
    if (!this.hasRole('Admin')) {
      return { success: false, message: 'Unauthorized access' };
    }

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(
          `${this.apiUrl}/create-user`, 
          userRequest
        )
      );

      if (response.success) {
        await this.logActivity('CREATE_USER', `Created user: ${userRequest.employeeId}`);
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error?.error?.message || 'Failed to create user'
      };
    }
  }

  /**
   * Get all users (Admin only)
   */
  async getAllUsers(): Promise<User[]> {
    if (!this.hasRole('Admin')) {
      throw new Error('Unauthorized access');
    }

    try {
      return await firstValueFrom(
        this.http.get<User[]>(`${this.apiUrl}/users`)
      );
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  /**
   * Update user role (Admin only)
   */
  async updateUserRole(employeeId: string, newRole: UserRole): Promise<boolean> {
    if (!this.hasRole('Admin')) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.put<{ success: boolean }>(
          `${this.apiUrl}/update-role`, 
          { employeeId, role: newRole }
        )
      );

      if (response.success) {
        await this.logActivity('UPDATE_ROLE', `Updated role for ${employeeId} to ${newRole}`);
      }

      return response.success;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  }

  /**
   * Change password
   */
  async changePassword(request: PasswordChangeRequest): Promise<{ success: boolean; message: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(
          `${this.apiUrl}/change-password`,
          request
        )
      );

      if (response.success) {
        await this.logActivity('PASSWORD_CHANGE', 'Password changed successfully');
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error?.error?.message || 'Failed to change password'
      };
    }
  }

  /**
   * Get user activity logs (Admin only)
   */
  async getUserActivity(employeeId?: string): Promise<UserActivity[]> {
    if (!this.hasRole('Admin')) {
      return [];
    }

    try {
      const url = employeeId 
        ? `${this.apiUrl}/activity/${employeeId}`
        : `${this.apiUrl}/activity`;
      
      return await firstValueFrom(
        this.http.get<UserActivity[]>(url)
      );
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }
  }

  /**
   * Role-based access control
   */
  hasRole(role: UserRole): boolean {
    return this.authState().user?.role === role;
  }

  canAccess(requiredRole: UserRole): boolean {
    const userRole = this.authState().user?.role;
    if (!userRole) return false;

    const roleHierarchy = { 'User': 1, 'Host': 2, 'Admin': 3 };
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Get current employee ID for database operations
   */
  getCurrentEmployeeId(): string {
    return this.authState().user?.employeeId || 'GUEST';
  }

  /**
   * Navigate to appropriate dashboard based on user role
   * Role mapping: 1=Admin, 2=Host, 3=Participant
   */
  navigateToDashboard(): void {
    const user = this.authState().user;
    if (!user) {
      this.router.navigate(['/']);
      return;
    }

    const redirectUrl = this.getRedirectUrl(user.role);
    this.router.navigate([redirectUrl]);
  }

  /**
   * Check if user role matches numeric ID
   * @param roleId - Numeric role ID (1=Admin, 2=Host, 3=Participant)
   */
  hasRoleId(roleId: number): boolean {
    const user = this.authState().user;
    if (!user) return false;

    switch (roleId) {
      case 1: return user.role === 'Admin';
      case 2: return user.role === 'Host';
      case 3: return user.role === 'User';
      default: return false;
    }
  }

  /**
   * Check if user session is valid (client-side validation using token expiry)
   */
  async validateSession(): Promise<boolean> {
    const token = this.getToken();
    if (!token) {
      console.log('🔍 validateSession: No token found');
      return false;
    }

    // Check if token is expired (client-side validation)
    if (this.isTokenExpired()) {
      console.warn('⚠️ Token has expired');
      this.clearSession();
      return false;
    }

    // Token is valid and not expired
    console.log('✅ Session validation successful (token valid)');
    return true;

    // NOTE: Backend does not have /validate-session endpoint
    // We're doing client-side validation using token expiry check
    // If you need server-side validation, implement the backend endpoint first
  }

  // Legacy token helpers (maintained for backward compatibility)
  saveToken(token: string) { 
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.tokenKey, token);
    }
  }
  
  getToken(): string | null { 
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.tokenKey);
    }
    return null;
  }
  
  /**
   * Check if the JWT token is expired
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    
    try {
      // Decode JWT token (format: header.payload.signature)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp;
      
      if (!expiry) return false; // No expiration set
      
      // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
      const isExpired = Date.now() >= expiry * 1000;
      
      if (isExpired) {
        console.warn('⚠️ Token has expired');
      }
      
      return isExpired;
    } catch (error) {
      console.error('Error decoding token:', error);
      return true; // If we can't decode, assume expired
    }
  }
  
  clearToken() { 
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.tokenKey); 
      localStorage.removeItem(this.rolesKey);
    }
  }

  // // Legacy roles helpers  
  // saveRoles(roles: string[]) { 
  //   localStorage.setItem(this.rolesKey, JSON.stringify(roles)); 
  // }
  
  // getRoles(): string[] { 
  //   const r = localStorage.getItem(this.rolesKey); 
  //   return r ? JSON.parse(r) : []; 
  // }

  // Private helper methods
  private setAuthenticatedUser(user: User, token: string): void {
    this.authState.set({
      isAuthenticated: true,
      user,
      token,
      loading: false
    });

    // Store in localStorage for persistence
    this.saveToken(token);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
    
    this.resetSessionTimer();
  }

  private clearSession(): void {
    this.authState.set({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false
    });

    this.clearToken();
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_user');
    }
    
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
  }

  private initializeFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return; // Skip initialization during SSR
    }
    
    const token = this.getToken();
    const userStr = localStorage.getItem('auth_user');

    console.log('[AuthService] Initializing from storage:', { 
      hasToken: !!token, 
      hasUserStr: !!userStr,
      userStr: userStr?.substring(0, 100) 
    });

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('[AuthService] Restored user from storage:', user);
        this.setAuthenticatedUser(user, token);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        this.clearSession();
      }
    } else {
      console.warn('[AuthService] No stored auth data found - user needs to login');
    }
  }

  private setLoading(loading: boolean): void {
    this.authState.update(state => ({ ...state, loading }));
  }

  private getRedirectUrl(role: UserRole): string {
    switch (role) {
      case 'Admin': return '/admin/dashboard';
      case 'Host': return '/host/dashboard';
      case 'User': return '/user/dashboard';
      default: return '/';
    }
  }

  private mapRolesToUserRole(roles: string[]): UserRole {
    // Handle numeric role IDs: 1=Admin, 2=Host, 3=Participant
    if (roles.includes('Admin') || roles.includes('1')) return 'Admin';
    if (roles.includes('Host') || roles.includes('2')) return 'Host';
    if (roles.includes('Participant') || roles.includes('3') || roles.includes('User')) return 'User';
    
    // Handle role names as fallback
    if (roles.some(role => role.toLowerCase().includes('admin'))) return 'Admin';
    if (roles.some(role => role.toLowerCase().includes('host'))) return 'Host';
    if (roles.some(role => role.toLowerCase().includes('participant'))) return 'User';
    
    return 'User'; // default
  }

  private startSessionMonitoring(): void {
    // Only start monitoring in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    
    // Check session validity every 15 minutes (increased to reduce auto-logout issues)
    setInterval(() => {
      if (this.isAuthenticated()) {
        console.log('🔍 Performing periodic session validation...');
        this.validateSession().catch(err => {
          console.warn('⚠️ Session validation check failed, but not logging out:', err);
          // Don't auto-logout on validation errors - let the user continue working
          // Only logout on explicit 401 from actual API calls
        });
      }
    }, 15 * 60 * 1000);
  }

  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      console.log('Session expired due to inactivity');
      this.logout();
    }, this.SESSION_TIMEOUT);
  }

  private async logActivity(action: string, details: string): Promise<void> {
    try {
      const user = this.authState().user;
      if (!user) return;

      await firstValueFrom(
        this.http.post(`${this.apiUrl}/log-activity`, {
          userId: user.userId,
          employeeId: user.employeeId,
          action,
          details,
          timestamp: new Date()
        })
      );
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // Legacy methods for backward compatibility
  saveRoles(roles: string[]) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.rolesKey, JSON.stringify(roles ?? []));
    }
  }

  getRoles(): string[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }
    try { 
      return JSON.parse(localStorage.getItem(this.rolesKey) || '[]'); 
    } catch { 
      return []; 
    }
  }

  getPrimaryRole(): string {
    const roles = this.getRoles();
    const precedence = ['Admin', 'Host', 'User'];
    return precedence.find(r => roles.includes(r)) ?? 'User';
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  // Get current logged-in user for components
  getCurrentUser(): User | null {
    return this.currentUser();
  }
}

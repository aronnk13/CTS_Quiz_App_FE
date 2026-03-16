// Authentication Models

export interface User {
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  redirectUrl?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
}

export type UserRole = 'Admin' | 'Host' | 'User';

export interface DashboardAccess {
  admin: boolean;
  host: boolean;
  user: boolean;
}

export interface CreateUserRequest {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  password: string;
  role: UserRole;
}

export interface PasswordChangeRequest {
  employeeId: string;
  currentPassword: string;
  newPassword: string;
}

// Session management
export interface UserSession {
  sessionId: string;
  userId: string;
  employeeId: string;
  role: UserRole;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

// Audit logging
export interface UserActivity {
  activityId: string;
  userId: string;
  employeeId: string;
  action: string;
  details: string;
  timestamp: Date;
  ipAddress?: string;
}
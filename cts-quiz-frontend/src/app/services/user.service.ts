import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../environments/environment';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}${environment.apiEndpoints.users}`;
  private adminUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) { }

  // Get all users with role information
  getUsers(): Observable<User[]> {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    return this.http.get<any[]>(`${this.apiUrl}?_=${timestamp}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).pipe(
      map(employees => {
        console.log('📥 Received employees from backend:', employees.length);
        return employees.map(emp => this.mapEmployeeToUser(emp));
      })
    );
  }

  // Get user by ID
  getUserById(id: string): Observable<User> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(emp => this.mapEmployeeToUser(emp))
    );
  }

  // Create new user
  createUser(user: User): Observable<User> {
    const payload = {
      employeeEmail: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive
    };
    return this.http.post<any>(this.apiUrl, payload).pipe(
      map(emp => this.mapEmployeeToUser(emp))
    );
  }

  // Update existing user
  updateUser(id: string, user: User): Observable<User> {
    const payload = {
      employeeId: id,
      employeeEmail: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.isActive
    };
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload).pipe(
      map(emp => this.mapEmployeeToUser(emp))
    );
  }

  // Update user role
  updateUserRole(employeeId: string, roleId: number): Observable<any> {
    return this.http.post(`${this.adminUrl}/assign-role`, { employeeId, roleId }, { responseType: 'text' });
  }

  // Delete user
  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Helper method to map backend Employee to frontend User
  private mapEmployeeToUser(emp: any): User {
    console.log('🔄 Mapping employee:', emp.employeeId, 'Roles:', emp.employeeRoles);
    const mappedRole = this.getEmployeeRole(emp.employeeRoles);
    console.log('✅ Mapped role for', emp.employeeId, ':', mappedRole);
    
    return {
      id: emp.id,
      employeeId: emp.employeeId,
      email: emp.email,
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      isActive: emp.isActive,
      role: mappedRole,
      roles: emp.employeeRoles,
      createdAt: emp.createdAtUtc,
      updatedAt: emp.updatedAtUtc
    };
  }

  // Extract role from employeeRoles array
  private getEmployeeRole(employeeRoles: any[]): string {
    if (!employeeRoles || employeeRoles.length === 0) {
      console.log('⚠️ No roles found, defaulting to Participant');
      return 'Participant';
    }
    
    console.log('📋 Employee Roles from backend:', JSON.stringify(employeeRoles, null, 2));
    
    // Extract role names - check both possible structures
    const roles = employeeRoles.map((er: any) => {
      // Try direct property first (EmployeeRoleDto structure)
      if (er.roleName) return er.roleName;
      // Fall back to nested structure
      if (er.role?.roleName) return er.role.roleName;
      return null;
    }).filter(Boolean);
    
    console.log('✅ Extracted roles:', roles);
    
    // Priority: Admin > Host > Participant
    if (roles.includes('Admin')) return 'Admin';
    if (roles.includes('Host')) return 'Host';
    if (roles.includes('Participant')) return 'Participant';
    
    console.log('⚠️ No recognized role found, defaulting to Participant');
    return 'Participant';
  }
}
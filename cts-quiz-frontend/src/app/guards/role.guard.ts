import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.models';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  const allowedRoles: UserRole[] = route.data?.['roles'] ?? [];
  const currentUser = auth.currentUser();
  const userRole = currentUser?.role;

  console.log('🔒 Role Guard Check:');
  console.log('   Requested Route:', route.routeConfig?.path);
  console.log('   Allowed Roles:', allowedRoles);
  console.log('   User Role:', userRole);
  console.log('   Is Authenticated:', auth.isAuthenticated());

  // Check if user is authenticated
  if (!auth.isAuthenticated() || !currentUser) {
    console.log('   ❌ Not authenticated - Redirecting to login');
    router.navigate(['/']);
    return false;
  }

  // If no specific roles required, allow access for authenticated users
  if (allowedRoles.length === 0) {
    console.log('   ✅ No role restriction - Access granted');
    return true;
  }
  
  // Check if user role matches any allowed role
  if (userRole && allowedRoles.includes(userRole)) {
    console.log('   ✅ Role matched - Access granted');
    return true;
  }

  // Check numeric role IDs (1=Admin, 2=Host, 3=Participant)
  const roleIds = route.data?.['roleIds'] as number[];
  if (roleIds && roleIds.length > 0) {
    for (const roleId of roleIds) {
      if (auth.hasRoleId(roleId)) {
        console.log('   ✅ Role ID matched - Access granted');
        return true;
      }
    }
  }

  console.log('   ❌ Role check failed - Redirecting to appropriate dashboard');
  // Redirect to user's appropriate dashboard instead of forbidden
  auth.navigateToDashboard();
  return false;
};
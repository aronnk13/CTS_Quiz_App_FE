
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  // optionally skip for auth endpoints
  const isAuthCall = /\/api\/jwt\/(login|register)$/i.test(req.url);
  if (!token || isAuthCall) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });
  
  return next(authReq).pipe(
    catchError((error) => {
      // 🔒 If 401 Unauthorized, check if it's a token expiration or authentication issue
      if (error.status === 401) {
        // Check if the error message indicates token expiration or invalid token
        const errorMessage = error.error?.message || error.error || '';
        const isTokenExpired = errorMessage.toLowerCase().includes('token') || 
                              errorMessage.toLowerCase().includes('expired') ||
                              errorMessage.toLowerCase().includes('invalid');
        
        console.log('🔍 401 Error Details:', {
          url: error.url,
          message: errorMessage,
          isTokenExpired,
          errorObject: error.error
        });
        
        // Only logout if it's EXPLICITLY a token expiration/invalid issue
        // Don't logout for temporary server errors or other 401 issues
        if (isTokenExpired && error.error?.error === 'Unauthorized') {
          console.warn('🔐 Token expired or invalid - logging out');
          auth.logout();
          router.navigate(['/login'], { 
            queryParams: { 
              reason: 'session_expired',
              message: 'Your session has expired. Please login again.' 
            } 
          });
        } else {
          // For other 401 errors, just log but don't auto-logout
          // This prevents logout on temporary backend issues
          console.warn('⚠️ 401 error received but NOT auto-logging out. Check if backend is down or having issues.');
          console.warn('⚠️ Error details:', error);
        }
      }
      return throwError(() => error);
    })
  );
};

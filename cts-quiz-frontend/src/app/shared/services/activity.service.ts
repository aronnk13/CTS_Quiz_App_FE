import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ActivityItem {
  id: number;
  activityType: string;
  entityType: string;
  entityName: string;
  userName: string;
  createdAt: Date;
  description: string;
  metadata?: { [key: string]: any };
}

export interface RecentActivityResponse {
  activities: ActivityItem[];
  totalCount: number;
  lastUpdated: Date;
}

export interface ActivityStats {
  totalQuizzesCreated: number;
  totalQuizzesPublished: number;
  quizzesThisMonth: number;
  lastActivityDate: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private apiUrl = `${environment.apiUrl}/host/Activity`;

  constructor(private http: HttpClient) {}

  /**
   * Fetch recent activity for the current host
   */
  getRecentActivity(limit: number = 10): Observable<RecentActivityResponse> {
    console.log('ActivityService: Fetching recent activity...');
    
    return this.http.get<RecentActivityResponse>(`${this.apiUrl}/recent?limit=${limit}`)
      .pipe(
        catchError(error => {
          console.error('ActivityService: Error fetching recent activity:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get activity statistics for the current host
   */
  getActivityStats(): Observable<ActivityStats> {
    console.log('ActivityService: Fetching activity stats...');
    
    return this.http.get<ActivityStats>(`${this.apiUrl}/stats`)
      .pipe(
        catchError(error => {
          console.error('ActivityService: Error fetching activity stats:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get icon for activity type
   */
  getActivityIcon(activityType: string, entityType: string): string {
    const key = `${activityType.toLowerCase()}_${entityType.toLowerCase()}`;
    
    const iconMap: { [key: string]: string } = {
      'created_quiz': 'fas fa-plus-circle text-success',
      'updated_quiz': 'fas fa-edit text-warning', 
      'published_quiz': 'fas fa-share text-primary',
      'deleted_quiz': 'fas fa-trash text-danger',
      'created_question': 'fas fa-question-circle text-info',
      'updated_question': 'fas fa-edit text-warning',
      'created_template': 'fas fa-file-alt text-secondary'
    };

    return iconMap[key] || 'fas fa-info-circle text-muted';
  }

  /**
   * Format relative time for activity items
   */
  getRelativeTime(date: Date): string {
    const now = new Date();
    const activityDate = new Date(date);
    const diffInMs = now.getTime() - activityDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    } else {
      return activityDate.toLocaleDateString();
    }
  }

  /**
   * Get color class for activity type
   */
  getActivityColor(activityType: string): string {
    const colorMap: { [key: string]: string } = {
      'Created': 'success',
      'Updated': 'warning', 
      'Published': 'primary',
      'Deleted': 'danger'
    };

    return colorMap[activityType] || 'secondary';
  }
}
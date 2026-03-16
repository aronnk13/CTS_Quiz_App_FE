import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CalendarResponse, QuizCalendar } from '../models/calendar.models';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private baseUrl = `${environment.apiUrl}/Host/QuizSession`;

  constructor(private http: HttpClient) {}

  getCalendarData(hostId?: string): Observable<CalendarResponse> {
    const url = hostId 
      ? `${this.baseUrl}/calendar?hostId=${hostId}` 
      : `${this.baseUrl}/calendar`;
    return this.http.get<CalendarResponse>(url);
  }

  /**
   * Get quiz sessions for calendar display from QuizSession table joined with Quiz
   */
  async getPublishedQuizzes(hostId?: string): Promise<QuizCalendar[]> {
    try {
      const url = hostId 
        ? `${this.baseUrl}/calendar?hostId=${hostId}` 
        : `${this.baseUrl}/calendar`;
      console.log('[CalendarService] Fetching quiz sessions from:', url);
      console.log('[CalendarService] Filtering for hostId:', hostId);
      
      const sessionData: any[] = await firstValueFrom(this.http.get<any[]>(url));
      console.log('[CalendarService] Session data received:', sessionData);
      
      // Map QuizSession data to QuizCalendar format
      return sessionData.map(session => ({
        quizId: session.quizId || session.QuizId,
        quizTitle: session.quizName || session.QuizName || `Quiz ${session.quizId || session.QuizId}`,
        publishedDate: new Date(session.startedAt || session.StartedAt || session.createdAt || session.CreatedAt),
        publishedBy: session.hostId || session.HostId,
        hostName: session.hostId || session.HostId,
        isCurrentHost: (session.hostId || session.HostId) === hostId,
        sessionCode: session.sessionCode || session.SessionCode,
        sessionId: session.sessionId || session.SessionId,
        status: session.status || session.Status,
        quizStatus: session.quizStatus || session.QuizStatus
      }));
    } catch (error) {
      console.error('[CalendarService] Error fetching quiz sessions:', error);
      console.error('[CalendarService] Make sure backend is running and /Host/QuizSession/calendar endpoint is accessible');
      return [];
    }
  }
}

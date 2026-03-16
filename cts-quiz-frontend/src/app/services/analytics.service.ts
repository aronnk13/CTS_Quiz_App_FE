import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EmojiSummary {
  emojiReaction: string;
  totalCount: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
}

export interface AnalyticsByQuiz {
  quizId: number;
  averageRating: number;
  totalResponses: number;
  emojiBreakdown: EmojiSummary[];
}

export interface HostDto {
  hostId: string;
  hostName: string;
}

export interface HostQuizDto {
  quizId: number;
  quizName: string;
  createdAt?: Date;
}

export interface HostFeedbackAnalyticsDto {
  hostId: string;
  hostName: string;
  quizId: number;
  quizName: string;
  averageRating: number;
  totalResponses: number;
  emojiBreakdown: EmojiSummary[];
  ratingDistribution: RatingDistribution[];
}

@Injectable({
  providedIn: 'root'
})
export class ServiceAnalyticsService {
  private baseUrl = `${environment.apiUrl}/admin/Feedback`;

  constructor(private http: HttpClient) {}

  /**
   * Get emoji summary across all quizzes
   */
  getEmojiSummary(): Observable<EmojiSummary[]> {
    return this.http.get<EmojiSummary[]>(`${this.baseUrl}/emoji-summary`);
  }

  /**
   * Get rating distribution across all quizzes
   */
  getRatingDistribution(): Observable<RatingDistribution[]> {
    return this.http.get<RatingDistribution[]>(`${this.baseUrl}/rating-distribution`);
  }

  /**
   * Get analytics for a specific quiz
   */
  getAnalyticsByQuiz(quizId: number): Observable<AnalyticsByQuiz> {
    return this.http.get<AnalyticsByQuiz>(`${this.baseUrl}/analytics/${quizId}`);
  }

  /**
   * Get all feedback for a specific quiz
   */
  getFeedbackByQuiz(quizId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${quizId}`);
  }

  /**
   * Get word cloud data for a specific quiz
   */
  getWordCloud(quizId: number): Observable<Array<{ text: string; weight: number }>> {
    return this.http.get<Array<{ text: string; weight: number }>>(`${this.baseUrl}/wordcloud/${quizId}`);
  }

  /**
   * Get all hosts who have conducted quizzes
   */
  getAllHosts(): Observable<HostDto[]> {
    return this.http.get<HostDto[]>(`${this.baseUrl}/hosts/all`);
  }

  /**
   * Get all quizzes conducted by a specific host
   */
  getQuizzesByHost(hostId: string): Observable<HostQuizDto[]> {
    return this.http.get<HostQuizDto[]>(`${this.baseUrl}/host/${hostId}/quizzes`);
  }

  /**
   * Get feedback analytics for a specific quiz conducted by a host
   */
  getFeedbackAnalyticsByHostAndQuiz(hostId: string, quizId: number): Observable<HostFeedbackAnalyticsDto> {
    return this.http.get<HostFeedbackAnalyticsDto>(`${this.baseUrl}/host/${hostId}/quiz/${quizId}/analytics`);
  }
}

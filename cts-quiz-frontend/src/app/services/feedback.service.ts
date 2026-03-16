import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QuizFeedback {
  id: number;
  quizId: number;
  participantId: number;
  rating: number;
  comments?: string;       // <-- must be `comments`
  emojiReaction?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private baseUrl = `${environment.apiUrl}/admin/Feedback`;

  constructor(private http: HttpClient) {}

  /**
   * Submit feedback for a quiz
   */
  submitFeedback(payload: Partial<QuizFeedback>): Observable<any> {
    return this.http.post<any>(this.baseUrl, payload);
  }

  /**
   * NOTE: For all analytics queries, use ServiceAnalyticsService:
   * - getAnalyticsByQuiz(quizId)
   * - getFeedbackByQuiz(quizId)
   * - getWordCloud(quizId)
   * - getAllHosts()
   * - getQuizzesByHost(hostId)
   * - getFeedbackAnalyticsByHostAndQuiz(hostId, quizId)
   * - getEmojiSummary()
   * - getRatingDistribution()
   */
}

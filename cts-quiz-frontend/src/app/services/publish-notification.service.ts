import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface PublishedQuizEvent {
  quizId: number;
  quizName: string;
}

/**
 * Service to notify preview component when a template is published as a quiz
 */
@Injectable({
  providedIn: 'root'
})
export class PublishNotificationService {
  private publishedQuizSubject = new Subject<PublishedQuizEvent>();
  
  // Observable to subscribe to published quiz events
  publishedQuiz$: Observable<PublishedQuizEvent> = this.publishedQuizSubject.asObservable();

  /**
   * Notify that a quiz has been published
   */
  notifyQuizPublished(quizId: number, quizName: string): void {
    this.publishedQuizSubject.next({ quizId, quizName });
  }
}

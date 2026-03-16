import { Injectable, signal } from '@angular/core';

export interface DashboardStats {
  totalQuizzes: number;
  draftQuizzes: number;
  publishedQuizzes: number;
  totalSurveys: number;
  totalPolls: number;
  totalQuestions: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardStatsService {
  private _stats = signal<DashboardStats>({
    totalQuizzes: 0,
    draftQuizzes: 0,
    publishedQuizzes: 0,
    totalSurveys: 0,
    totalPolls: 0,
    totalQuestions: 0
  });

  // Expose as readonly signal
  stats = this._stats.asReadonly();

  updateStats(newStats: Partial<DashboardStats>) {
    this._stats.update(current => ({
      ...current,
      ...newStats
    }));
  }

  updateQuizStats(totalQuizzes: number, draftQuizzes: number, publishedQuizzes: number, totalQuestions: number) {
    this._stats.update(current => ({
      ...current,
      totalQuizzes,
      draftQuizzes,
      publishedQuizzes,
      totalQuestions
    }));
  }

  updateSurveyStats(totalSurveys: number) {
    this._stats.update(current => ({
      ...current,
      totalSurveys
    }));
  }

  updatePollStats(totalPolls: number) {
    this._stats.update(current => ({
      ...current,
      totalPolls
    }));
  }

  incrementQuizCount() {
    this._stats.update(current => ({
      ...current,
      totalQuizzes: current.totalQuizzes + 1,
      draftQuizzes: current.draftQuizzes + 1
    }));
  }

  incrementQuestionCount() {
    this._stats.update(current => ({
      ...current,
      totalQuestions: current.totalQuestions + 1
    }));
  }

  incrementSurveyCount() {
    this._stats.update(current => ({
      ...current,
      totalSurveys: current.totalSurveys + 1
    }));
  }

  incrementPollCount() {
    this._stats.update(current => ({
      ...current,
      totalPolls: current.totalPolls + 1
    }));
  }
}
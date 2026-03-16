/**
 * Models for Host Lobby Component
 */

export interface ParticipantProgress {
  totalParticipants: number;
  submittedCount: number;
  percentage: number;
}

export interface QuestionTimer {
  questionId: number;
  remainingSeconds: number;
  totalSeconds: number;
}

export interface SessionData {
  sessionId: number;
  sessionCode: string;
  quizName: string;
  startedAt?: string;
  endedAt?: string;
  status: string;
  totalQuestions: number;
}

export interface QuestionData {
  questionId: number;
  questionText: string;
  timerSeconds: number;
  questionNumber: number;
}

export interface ParticipantDetail {
  participantId: number;
  nickname: string;
  totalScore: number;
  hasSubmittedCurrentQuestion: boolean;
  totalAnswered: number;
  correctAnswers: number;
  joinedAt?: string;
}

export type SessionType = 'quiz' | 'poll' | 'survey';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type Mode = 'manual' | 'auto';
export type LeaderboardMode = 'dynamic' | 'podium' | 'progressive' | 'category' | null;
export type InteractiveOverlayType = 'topn' | 'podium' | 'progressive' | 'category' | 'option-bar' | null;

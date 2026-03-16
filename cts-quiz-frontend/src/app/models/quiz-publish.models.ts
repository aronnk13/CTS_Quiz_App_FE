// Type definitions for Quiz Publishing

// Request payload for publishing a quiz
export interface QuizPublishRequest {
  quizId: number;
  quizNumber: string;
  publishedBy: string;
  startTime?: string;
  endTime?: string;
}

// Response from backend after publishing
export interface QuizPublishResponse {
  publishId: number;
  sessionId: number;
  quizId: number;
  quizNumber: string;
  publishedBy: string;
  publishedAt: string;
  sessionCode: string; // Same as quizNumber
  status: 'LIVE' | 'COMPLETED' | 'DRAFT';
}

export interface QuizPublishData {
  quizId: number;
  quizNumber: string;
  quizName: string;
  hostId: string;
  status: 'LIVE' | 'COMPLETED' | 'DRAFT';
  scheduledTime?: string;
  publishedAt: string;
}

export interface QuizStatusUpdate {
  quizId: number;
  quizNumber: string;
  status: 'LIVE' | 'COMPLETED' | 'DRAFT';
  timestamp: string;
}

export interface ParticipantJoinedData {
  quizNumber: string;
  participantId: string;
  participantName: string;
  joinedAt: string;
}

export interface QuizSessionData {
  quizNumber: string;
  sessionCode: string; // Same as quizNumber
  activeParticipants: number;
  startedAt: string;
}

export interface QuizSessionEndData {
  quizNumber: string;
  endedAt: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// Request payload for creating a QuizSession from result component
export interface CreateQuizSessionRequest {
  quizId: number | null;  // ✅ FIXED: Made nullable to support surveys
  hostId: string;
  sessionCode: string; // This will be the quizNumber
  startedAt?: string;
  endedAt?: string;
  status?: string;
}

// Response from backend after creating QuizSession
export interface CreateQuizSessionResponse {
  sessionId: number;
  quizId: number;
  hostId: string;
  sessionCode: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  autoModeEnabled: boolean;
  currentQuestionId?: number;
  currentQuestionStartTime?: string;
  timerDurationSeconds?: number;
}


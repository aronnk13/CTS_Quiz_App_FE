/**
 * Real-time answer event from quiz participants
 */
export interface AnswerEvent {
  playerId: string;
  questionId: string;
  isCorrect: boolean;
  responseTimeMs: number; // Time taken to answer (0 to maxAllowedTimeMs)
  timestamp: number;
}

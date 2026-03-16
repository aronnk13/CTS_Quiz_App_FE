/**
 * Player model representing a quiz participant
 */
export interface Player {
  playerId: string;
  nickname: string;
  avatarUrl?: string;
  color?: string; // For visual distinction
}

/**
 * Player statistics tracked during the game
 */
export interface PlayerStats {
  playerId: string;
  totalScore: number;
  totalCorrect: number;
  totalAnswered: number;
  accuracyPercent: number;
  cumulativeSpeedMs: number; // Sum of all response times
  averageSpeedMs: number;
  streakCorrect: number; // Consecutive correct answers
  lastAnswerWasCorrect: boolean;
  lastDeltaRank: number; // Change in rank from previous (-3 means moved up 3 places)
  lastScoreDelta: number; // Points gained/lost in last update
  currentRank: number;
  previousRank: number;
}

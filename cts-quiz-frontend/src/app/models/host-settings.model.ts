/**
 * Host control settings for leaderboard visibility
 */
export type VisibilityMode = 'OFF' | 'ON' | 'END_ONLY';

export interface HostSettings {
  visibilityMode: VisibilityMode;
  gameEnded: boolean;
}

/**
 * Configuration constants for scoring and gameplay
 */
export interface GameConfig {
  // Scoring
  basePointsCorrect: number;
  speedBonusMax: number;
  wrongAnswerPenalty: number;
  maxAnswerTimeMs: number;

  // Streaks
  streakThreshold: number; // Minimum streak to show flame icon

  // Speed badges
  fastThresholdMs: number; // Below this = fast
  slowThresholdMs: number; // Above this = slow

  // Animations
  highlightDurationMs: number;
  deltaLabelDurationMs: number;
  countUpDurationMs: number;
  cinematicStaggerDelayMs: number;

  // Effects
  confettiIntensity: number; // 0-100
  rankJumpThreshold: number; // Trigger celebration for jumps >= this
}

/**
 * Default game configuration
 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  basePointsCorrect: 100,
  speedBonusMax: 60,
  wrongAnswerPenalty: 10,
  maxAnswerTimeMs: 30000, // 30 seconds

  streakThreshold: 3,

  fastThresholdMs: 5000,
  slowThresholdMs: 15000,

  highlightDurationMs: 2000,
  deltaLabelDurationMs: 2000,
  countUpDurationMs: 800,
  cinematicStaggerDelayMs: 150,

  confettiIntensity: 50,
  rankJumpThreshold: 3,
};

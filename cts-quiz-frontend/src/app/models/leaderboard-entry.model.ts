import { Player } from './player.model';
import { PlayerStats } from './player.model';

/**
 * Combined entry for leaderboard display
 */
export interface LeaderboardEntry {
  player: Player;
  stats: PlayerStats;
  // Animation tracking
  isHighlighted: boolean;
  highlightType?: 'rank-up' | 'rank-down' | 'top3-enter' | 'champion';
  showDeltaLabel: boolean;
  justEntered?: boolean; // For END_ONLY cinematic reveal
}

/**
 * Rank change event for triggering effects
 */
export interface RankChangeEvent {
  playerId: string;
  nickname: string;
  oldRank: number;
  newRank: number;
  rankDelta: number; // Positive = moved up
  scoreDelta: number;
  becameChampion: boolean;
  enteredTop3: boolean;
}

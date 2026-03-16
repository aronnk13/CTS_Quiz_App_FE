export interface SubmitPollAnswerDto {
  pollId: number;
  sessionId: number;
  participantId: number;
  optionIds: number[];
}

export interface SubmitPollAnswerResponseDto {
  success: boolean;
  message: string;
  pollResponseId?: number;
  timestamp?: Date;
}

export interface PollSessionSummaryDto {
  sessionCode: string;
  pollId: number;
  pollName: string;
  totalParticipants: number;
  totalVotes: number;
  status: string;
  createdAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface PollResultDto {
  optionId: number;
  optionText: string;
  voteCount: number;
  percentage: number;
  votePercentageBar?: string;
}

export interface PollOverallResultDto {
  pollId: number;
  pollName: string;
  totalVotes: number;
  participationPercentage: number;
  options: PollResultDto[];
  pollStatus: string;
  timestamp?: Date;
}

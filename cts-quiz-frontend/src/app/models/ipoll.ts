// Poll Models
export interface Poll {
  poll_id?: number;
  session_id: number;
  poll_title: string;
  poll_question: string;
  poll_anonymous: boolean;
  poll_status: string;
  selection_type: string;
  created_at?: string;
  options?: PollOption[];
}

export interface PollOption {
  option_id?: number;
  poll_id?: number;
  option_label: string;
  option_order?: number;
}

export interface PollVote {
  vote_id?: number;
  poll_id: number;
  option_id: number;
  participant_id: number;
  interaction_value: number;
  voted_at?: string;
}

export interface PollVoteSubmission {
  pollId: number;
  participantId: number;
  optionId: number;
  interactionValue: number;
}

export interface CreatePollRequest {
  session_id: number | null; // null for draft polls without a session
  poll_title: string;
  poll_question: string;
  poll_anonymous: boolean;
  poll_status?: string;
  selection_type: string;
  options: CreatePollOptionRequest[];
}

export interface CreatePollOptionRequest {
  option_label: string;
  option_order: number; // Required: position of option
}

// v2 API payloads (camelCase)
export interface CreatePollApiRequest {
  sessionId?: number | null; // null for draft polls without a session
  pollTitle: string;
  pollQuestion: string;
  pollAnonymous: boolean;
  pollStatus?: string; // 'draft' when creating without publishing
  selectionType: string; // 'single' or 'multiple'
  options: CreatePollOptionApiRequest[];
}

export interface CreatePollOptionApiRequest {
  pollOptionId?: number; // For updates
  optionLabel: string;
  optionOrder: number; // Required: position of option
}

// v2 API responses (camelCase)
export interface PollOverview {
  pollId: number;
  pollQuestionId?: number; // For tracking the question ID during edits
  sessionId: number;
  sessionCode?: string | null;
  pollTitle: string;
  pollQuestion: string;
  pollAnonymous: boolean;
  pollStatus: string;
  selectionType: string;
  category?: string;
  createdAt?: Date | string;
  startTime?: string | null;
  endTime?: string | null;
  options: PollOptionOverview[];
}

export interface PollOptionOverview {
  pollOptionId?: number; // For tracking option ID during edits
  optionId: number;
  optionLabel: string;
  optionOrder?: number;
}

export interface CreatePollResponse {
  pollId: number;
  message: string;
  status: string;
}

export interface PollListResponse {
  count: number;
  polls: Poll[];
}

export interface PollResult {
  pollId: number;
  title: string;
  question: string;
  totalVotes: number;
  options: PollOptionResult[];
}

export interface PollOptionResult {
  optionId: number;
  optionLabel: string;
  voteCount: number;
  percentage: number;
}

export interface ClosePollResponse {
  message: string;
  pollId: number;
  finalResults: {
    totalVotes: number;
    winner: string;
  };
}

export interface PollVoteSubmission {
  pollId: number;
  participantId: number;
  selectedOptionIds: number[];
  interactionValue: number;
}

export interface PollVoteResponse {
  success: boolean;
  message: string;
  pollId: number;
  votedOptions: number[];
}

export interface PollResult {
  pollId: number;
  pollTitle: string;
  pollQuestion: string;
  totalVotes: number;
  options: {
    optionId: number;
    optionLabel: string;
    voteCount: number;
    percentage: number;
  }[];
}

// Republish and Schedule Models
export interface RepublishPollRequest {
  pollId: number;
  hostId?: string;
  startedAt?: string;
  endedAt?: string;
  countdownDurationSeconds?: number;
}

export interface RepublishPollResponse {
  pollId: number;
  newSessionId: number;
  oldSessionId: number;
  newSessionCode: string;
  qrCodeBase64: string;
  pollStatus: string;
  countdownDurationSeconds: number;
}

export interface SchedulePollRequest {
  pollId: number;
  hostId?: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  countdownDurationSeconds?: number;
}

export interface SchedulePollResponse {
  pollId: number;
  sessionId: number;
  sessionCode: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  status: string;
}

// Extended Poll Overview with new fields
export interface PollOverviewExtended extends PollOverview {
  newSessionCode?: string;
  qrCodeUrl?: string;
  qrCodeBase64?: string;
  countdownDuration?: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
}

// Participant Poll Response interface
export interface PollResponse {
  pollResponseId?: number;
  pollId: number;
  participantId: number;
  sessionId: number;
  selectedOptionId?: number;
  selectedOptionIds?: string; // comma-separated values for multi-select
  optionRank?: number; // rank order for ranking questions
  responseText?: string;
  responseNumber?: number;
  submittedAt?: string;
  pollQuestion?: string;
  pollTitle?: string;
  optionLabel?: string; // Label of selected option
}


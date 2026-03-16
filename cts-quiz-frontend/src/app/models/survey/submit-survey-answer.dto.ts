export interface SubmitSurveyAnswerDto {
  surveyId: number;
  sessionId: number;
  participantId: number;
  surveyQuestionId: number;
  selectedOptionId?: number;
  textAnswer?: string;
  numericAnswer?: number;
  selectedOptionIds?: number[];
  optionRank?: number;
  timeSpentSeconds?: number;
}

export interface SubmitSurveyAnswerResponseDto {
  success: boolean;
  message: string;
  surveyResponseId?: number;
  timestamp?: Date;
}

export interface SurveySessionSummaryDto {
  sessionCode: string;
  surveyId: number;
  surveyName: string;
  totalParticipants: number;
  completedParticipants: number;
  status: string;
  createdAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface SurveyResultDto {
  surveyResponseId: number;
  participantId: number;
  participantName: string;
  completionPercentage: number;
  answers: SurveyAnswerDetail[];
  completedAt?: Date;
}

export interface SurveyAnswerDetail {
  surveyQuestionId: number;
  questionText: string;
  questionType: string;
  answer: string;
  timeSpent?: number;
}

export interface SurveyQuestionResultDto {
  surveyQuestionId: number;
  questionText: string;
  questionType: string;
  totalResponses: number;
  responseDetails: SurveyResponseDetail[];
}

export interface SurveyResponseDetail {
  optionId?: number;
  optionText?: string;
  textResponse?: string;
  numericResponse?: number;
  rankPosition?: number;
  respondentCount: number;
  percentage: number;
}

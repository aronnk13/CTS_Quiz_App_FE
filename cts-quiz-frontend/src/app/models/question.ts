export interface Question {
  questionId?: number;
  quizId?: number;
  templateId?: number;
  questionText: string;
  questionType?: string;
  isRequired?: boolean;
  timerSeconds?: number;
  order?: number;
  category?: string;
  difficultyLevel?: string;
  tags?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
  options?: Option[];
  minSelect?: number;
  maxSelect?: number;
  maxLength?: number;
  placeholder?: string;
}

export interface Option {
  optionId?: number;
  questionId?: number;
  optionText: string;
  isCorrect?: boolean;
  order?: number;
}

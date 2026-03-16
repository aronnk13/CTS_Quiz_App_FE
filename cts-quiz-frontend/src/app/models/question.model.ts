export interface Question {
  id?: string;
  questionId?: number;
  text?: string;
  questionText?: string;
  options?: QuestionOption[];
  answer?: string; // correct option text
  isCorrect?: boolean;
  category?: string;
  difficulty?: string;
  difficultyLevel?: string;
  tags?: string;
  minSelect?: number; // Minimum selections required for ranking questions
  maxSelect?: number; // Maximum selections allowed for ranking questions
  maxLength?: number; // Maximum character length for text answers
  placeholder?: string; // Placeholder text for text input fields
}

export interface QuestionOption {
  optionId?: number;
  id?: number;
  text?: string;
  optionText?: string;
  isCorrect?: boolean;
  questionId?: number;
}


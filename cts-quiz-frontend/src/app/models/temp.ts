

export interface temp {
  templateId?: number;
  templateName: string;
  templateType: string;
  templateConfig: string | null;
  categoryType?: string;
  selectedQuestionIds?: string;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  status?: string; // Draft or Published
}


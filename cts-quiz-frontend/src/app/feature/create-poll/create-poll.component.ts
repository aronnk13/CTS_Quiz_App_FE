import { Component, OnInit, Output, EventEmitter, AfterViewInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { PollService } from '../../services/poll.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { Poll, CreatePollRequest, CreatePollApiRequest } from '../../models/ipoll';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';

@Component({
  selector: 'app-create-poll',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, QRCodeComponent],
  templateUrl: './create-poll.component.html',
  styleUrls: ['./create-poll.component.css']
})
export class CreatePollComponent implements OnInit, AfterViewInit {
  pollForm!: FormGroup;
  submitted = false;
  loading = false;
  successMessage = '';
  errorMessage = '';
  sessionId: number | null = null;
  
  // QR Code properties
  showQrCode = false;
  pollUrl = '';
  qrCodeValue = '';
  createdPollId: number | null = null;

  // Header properties
  hostName = 'Poll Host'; // You can make this dynamic later
  currentDateTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  @Output() switchToQuestionsTab = new EventEmitter<void>();

  // Tutorial properties
  private tutorialService = inject(TutorialService);
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'poll-title',
      title: '📊 Poll Title',
      description: 'Enter a clear and engaging title for your poll to attract participants.',
      targetElement: 'input[formControlName="pollTitle"]',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'poll-question',
      title: '❓ Poll Question',
      description: 'Write your poll question clearly. This is what participants will see and respond to. Each poll supports one question with multiple options.',
      targetElement: 'textarea[formControlName="questionText"]',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'question-types',
      title: '🔄 Question Types',
      description: 'Choose from predefined options like True/False, Yes/No, Agree/Disagree, or create custom options.',
      targetElement: '.question-type-selector',
      position: 'left',
      skipable: true
    },
    {
      id: 'publish-poll',
      title: '🚀 Publish Poll',
      description: 'When you\'re ready, publish your poll to make it available for participants!',
      targetElement: '.btn-success',
      position: 'top',
      skipable: true
    }
  ];

  questionTypes: { value: string; label: string; option1: string; option2: string }[] = [
    { value: 'true_false', label: 'True/False', option1: 'True', option2: 'False' },
    { value: 'yes_no', label: 'Yes/No', option1: 'Yes', option2: 'No' },
    { value: 'agree_disagree', label: 'Agree/Disagree', option1: 'Agree', option2: 'Disagree' },
    { value: 'custom', label: 'Custom', option1: '', option2: '' }
  ];
  authService: any;

  constructor(
    private formBuilder: FormBuilder,
    private pollService: PollService,
    private router: Router,
    private route: ActivatedRoute,
    private dashboardStatsService: DashboardStatsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.sessionId = params['sessionId'] ? parseInt(params['sessionId']) : null;
    });

    this.pollForm = this.formBuilder.group({
      pollTitle: ['', Validators.required],
      pollAnonymous: [false],
      questions: this.formBuilder.array([]) // Changed from individual question/options to questions array
    });

    // Add initial question with two options
    this.addPollQuestion();
  }

  get f() {
    return this.pollForm.controls;
  }

  get questions(): FormArray {
    return this.pollForm.get('questions') as FormArray;
  }

  getOptions(questionIndex: number): FormArray {
    return this.questions.at(questionIndex).get('options') as FormArray;
  }

  addPollQuestion(): void {
    const questionGroup = this.formBuilder.group({
      questionText: ['', Validators.required],
      questionType: ['custom', Validators.required],
      options: this.formBuilder.array([
        this.formBuilder.group({ optionLabel: ['', Validators.required] }),
        this.formBuilder.group({ optionLabel: ['', Validators.required] })
      ])
    });
    this.questions.push(questionGroup);
  }

  removePollQuestion(index: number): void {
    if (this.questions.length > 1) {
      this.questions.removeAt(index);
    } else {
      alert('A poll must have at least one question. You cannot remove the only question.');
    }
  }

  addOption(questionIndex: number): void {
    const questionGroup = this.questions.at(questionIndex);
    const questionType = questionGroup.get('questionType')?.value;
    
    if (questionType !== 'custom') {
      return;
    }
    
    const options = this.getOptions(questionIndex);
    options.push(this.formBuilder.group({ optionLabel: ['', Validators.required] }));
  }

  removeOption(questionIndex: number, optionIndex: number): void {
    const options = this.getOptions(questionIndex);
    if (options.length > 2) {
      options.removeAt(optionIndex);
    }
  }

  onQuestionTypeChange(questionIndex: number): void {
    const questionGroup = this.questions.at(questionIndex);
    const questionType = questionGroup.get('questionType')?.value;
    const typeInfo = this.questionTypes.find(t => t.value === questionType);
    const options = this.getOptions(questionIndex);

    while (options.length < 2) {
      options.push(this.formBuilder.group({ optionLabel: ['', Validators.required] }));
    }

    if (questionType !== 'custom') {
      while (options.length > 2) {
        options.removeAt(options.length - 1);
      }

      if (typeInfo) {
        options.at(0).patchValue({ optionLabel: typeInfo.option1 });
        options.at(1).patchValue({ optionLabel: typeInfo.option2 });
      }

      options.controls.forEach((control) => control.disable({ emitEvent: false }));
      options.at(0).enable({ emitEvent: false });
      options.at(1).enable({ emitEvent: false });
    } else {
      options.controls.forEach((control) => control.enable({ emitEvent: false }));
    }
  }

  isCustomType(questionIndex: number): boolean {
    const questionGroup = this.questions.at(questionIndex);
    return questionGroup.get('questionType')?.value === 'custom';
  }

  getQuestionTypeLabel(typeValue: string): string {
    const type = this.questionTypes.find(t => t.value === typeValue);
    return type ? type.label : 'Custom';
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Check if form is valid
    if (this.pollForm.invalid) {
      this.errorMessage = 'Please fill in all required fields correctly.';
      return;
    }

    const formValue = this.pollForm.value;
    

    // Strict validation for backend schema
    if (!formValue.pollTitle || formValue.pollTitle.trim().length < 3 || formValue.pollTitle.trim().length > 200) {
      this.errorMessage = 'Poll title is required and must be between 3 and 200 characters.';
      return;
    }
    if (!formValue.questions || formValue.questions.length === 0) {
      this.errorMessage = 'Poll must have at least one question.';
      return;
    }
    if (formValue.questions.length > 1) {
      this.errorMessage = 'Polls can only have one question. Please remove extra questions or create separate polls.';
      return;
    }
    const question = formValue.questions[0];
    if (!question.questionText || question.questionText.trim().length < 5 || question.questionText.trim().length > 500) {
      this.errorMessage = 'Poll question is required and must be between 5 and 500 characters.';
      return;
    }
    if (!question.options || question.options.length < 2) {
      this.errorMessage = 'Poll question must have at least two options.';
      return;
    }
    const validOptions = question.options.every((opt: any) => opt.optionLabel && opt.optionLabel.trim().length > 0);
    if (!validOptions) {
      this.errorMessage = 'All poll options must have a label.';
      return;
    }
    if (formValue.pollAnonymous === undefined || formValue.pollAnonymous === null) {
      this.errorMessage = 'Poll anonymity must be specified.';
      return;
    }

    this.loading = true;

    // Build the payload - For now, we'll create a poll with the first question
    // Note: Not creating a session yet - just saving the poll as draft
    const firstQuestion = formValue.questions[0];
    
    // Use PascalCase to match backend DTO exactly
    const payload: any = {
      SessionId: null, // No session yet - will be created when published
      PollTitle: formValue.pollTitle.trim(),
      PollQuestion: firstQuestion.questionText.trim(),
      PollAnonymous: formValue.pollAnonymous || false,
      PollStatus: 'draft',
      SelectionType: 'single',
      Options: firstQuestion.options
        .filter((opt: any) => opt.optionLabel && opt.optionLabel.trim().length > 0)
        .map((opt: any, index: number) => ({
          OptionLabel: opt.optionLabel.trim(),
          OptionOrder: index + 1
        }))
    };

    // Validate payload before sending
    if (!payload.PollTitle || payload.PollTitle.length === 0) {
      this.errorMessage = 'Poll title cannot be empty';
      this.loading = false;
      return;
    }

    if (!payload.PollQuestion || payload.PollQuestion.length === 0) {
      this.errorMessage = 'Poll question cannot be empty';
      this.loading = false;
      return;
    }

    if (!payload.Options || payload.Options.length === 0) {
      this.errorMessage = 'Poll must have at least one option';
      this.loading = false;
      return;
    }

    console.log('✅ Poll Payload (saving as draft - PascalCase format):', JSON.stringify(payload, null, 2));
    console.log('📝 Total Questions:', formValue.questions.length);
    console.log('🔍 First Question Options:', firstQuestion.options);
    console.log('🔍 Payload properties check:', {
      hasSessionId: payload.hasOwnProperty('SessionId'),
      hasPollTitle: payload.hasOwnProperty('PollTitle'),
      hasPollQuestion: payload.hasOwnProperty('PollQuestion'),
      hasPollAnonymous: payload.hasOwnProperty('PollAnonymous'),
      hasPollStatus: payload.hasOwnProperty('PollStatus'),
      hasSelectionType: payload.hasOwnProperty('SelectionType'),
      hasOptions: payload.hasOwnProperty('Options'),
      optionsLength: payload.Options?.length,
      firstOptionSample: payload.Options?.[0]
    });

    this.pollService.createPoll(payload).subscribe({
      next: (response) => {
        this.successMessage = '🎉 Poll Created Successfully!';
        this.loading = false;
        this.createdPollId = response.pollId;
        
        // Update dashboard stats
        this.dashboardStatsService.incrementPollCount();
        
        // Show success message
        alert('🎉 Poll Created Successfully!\\n\\nYour poll has been saved as a draft. Go to Manage Content to publish it with a session.');
        
        // Reset form
        this.pollForm.reset();
        this.addPollQuestion();
        this.submitted = false;
      },
      error: (error: any) => {
        console.error('Error creating poll:', error);
        
        // Extract detailed error information
        const errorDetails = {
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message,
          errorBody: error?.error,
          url: error?.url
        };
        
        console.error('📋 Detailed Error Info:', errorDetails);
        
        // Determine error message to show user
        let userMessage = 'Failed to create poll. Please check your API connection.';
        
        if (error?.status === 400) {
          userMessage = `Validation Error: ${error?.error?.message || 'Invalid poll data'}`;
        } else if (error?.status === 401 || error?.status === 403) {
          userMessage = 'You are not authorized to create polls.';
        } else if (error?.status === 500) {
          userMessage = 'Server error. Please contact support.';
        } else if (!error?.status) {
          userMessage = 'Network error. Please check your connection.';
        }
        
        this.errorMessage = userMessage;
        this.loading = false;
      }
    });
  }

  getSelectedTypeLabel(): string {
    return `${this.questions.length} Question${this.questions.length !== 1 ? 's' : ''}`;
  }

  generateQrCode(): void {
    if (this.createdPollId) {
      // Generate participation URL
      const baseUrl = window.location.origin;
      this.pollUrl = `${baseUrl}/participate/poll/${this.createdPollId}`;
      this.qrCodeValue = this.pollUrl;
      this.showQrCode = true;
    }
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.pollUrl).then(() => {
      this.successMessage = 'Poll URL copied to clipboard!';
      setTimeout(() => this.successMessage = '', 3000);
    });
  }

  goBackToHost(): void {
    this.router.navigate(['/host']);
  }

  convertToQuiz(): void {
    if (this.pollForm.valid) {
      // Convert poll to quiz format logic
      alert('Poll converted to quiz format! Switching to Questions tab.');
      this.switchToQuestionsTab.emit();
    } else {
      alert('Please fill in all required fields before converting.');
    }
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
      // Manually trigger change detection to prevent ExpressionChangedAfterItHasBeenCheckedError
      this.cdr.detectChanges();
    }, 1000);
  }

  // Tutorial methods
  startTutorial(): void {
    if (this.tutorialService.shouldAutoStart('polls')) {
      console.log('Auto-starting tutorial for polls component');
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'polls');
    } else {
      console.log('Tutorial already seen for polls component');
    }
  }

  resetTutorial(): void {
    this.tutorialService.resetTutorial('polls');
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'polls');
  }

  nextTutorialStep(): void {
    this.tutorialService.nextStep();
  }

  previousTutorialStep(): void {
    this.tutorialService.previousStep();
  }

  skipTutorial(): void {
    this.tutorialService.skipTutorial();
  }

  getCurrentStep(): TutorialStep | null {
    return this.tutorialService.getCurrentStepData();
  }

  getSpotlightPosition(): { top: string; left: string; width: string; height: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: `${rect.top - 5}px`,
      left: `${rect.left - 5}px`,
      width: `${rect.width + 10}px`,
      height: `${rect.height + 10}px`
    };
  }

  getPopupPosition(): { top: string; left: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const popupWidth = 350;
    const popupHeight = 200;

    let top = rect.top;
    let left = rect.left;

    switch (currentStep.position) {
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'top':
        top = rect.top - popupHeight - 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.left - popupWidth - 10;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.right + 10;
        break;
    }

    // Ensure popup stays within viewport
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
    if (top < 10) top = 10;
    if (top + popupHeight > window.innerHeight - 10) top = window.innerHeight - popupHeight - 10;

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  }
}

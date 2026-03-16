import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FeedbackService } from '../../services/feedback.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-feedback-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './feedback.component.html',
  styleUrls: ['./feedback.component.css']
})
export class FeedbackFormComponent implements OnInit {
  feedbackForm: FormGroup;
  showPicker = false;
  showWordCloud = false;
  selectedWords: string[] = [];
  feedbackSubmitted = false;

  emojiList = ['😄','😀','🙂','☹️','😞'];

  commentWords = [
    'excellent', 'great', 'amazing', 'wonderful', 'good', 'nice', 'helpful', 'interesting',
    'fun', 'engaging', 'creative', 'interactive', 'challenging', 'educational', 'informative',
    'clear', 'easy', 'difficult', 'confusing', 'boring', 'long', 'short', 'perfect',
    'awesome', 'fantastic', 'brilliant', 'outstanding', 'superb', 'impressive', 'enjoyable',
    'useful', 'valuable', 'relevant', 'practical', 'effective', 'comprehensive', 'detailed',
    'well-organized', 'well-designed', 'user-friendly', 'intuitive', 'innovative', 'unique',
    'disappointing', 'poor', 'average', 'okay', 'decent', 'satisfactory', 'acceptable'
  ];

  constructor(
    private fb: FormBuilder,
    private service: FeedbackService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Match backend DTO exactly: no "id" field
    this.feedbackForm = this.fb.group({
      quizId: ['', Validators.required],
      participantId: ['', Validators.required],
      rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      comments: [''],
      emojiReaction: ['']
    });
  }

  ngOnInit() {
    // Load quiz and participant IDs from route or localStorage
    this.route.queryParams.subscribe(params => {
      const quizId = params['quizId'] || localStorage.getItem('currentQuizId');
      const participantId = params['participantId'] || localStorage.getItem('participantId');

      if (quizId) {
        this.feedbackForm.patchValue({ quizId: Number(quizId) });
      }
      if (participantId) {
        this.feedbackForm.patchValue({ participantId: Number(participantId) });
      }
    });
  }

  toggleWord(word: string) {
    const index = this.selectedWords.indexOf(word);
    if (index > -1) {
      this.selectedWords.splice(index, 1);
    } else {
      this.selectedWords.push(word);
    }
    this.feedbackForm.patchValue({ comments: this.selectedWords.join(' ') });
  }

  clearWords() {
    this.selectedWords = [];
    this.feedbackForm.patchValue({ comments: '' });
  }

  selectEmoji(emoji: string) {
    this.feedbackForm.patchValue({ emojiReaction: emoji });
    this.showPicker = false;
  }

  addEmoji(event: any) {
    const emoji = event.detail.unicode;
    this.feedbackForm.patchValue({ emojiReaction: emoji });
    this.showPicker = false;
  }

  submit() {
    console.log('Submit button clicked');
    console.log('Form valid:', this.feedbackForm.valid);
    console.log('Form values:', this.feedbackForm.value);

    if (this.feedbackForm.valid) {
      const raw = this.feedbackForm.value;
      const payload = {
        quizId: Number(raw.quizId),
        participantId: Number(raw.participantId),
        rating: Number(raw.rating),
        comments: raw.comments,
        emojiReaction: raw.emojiReaction
      };

      this.service.submitFeedback(payload).subscribe({
        next: (response) => {
          console.log('Success response:', response);
          this.feedbackSubmitted = true;
          alert('Feedback submitted successfully!');
          this.feedbackForm.reset({ rating: 5 });
          this.selectedWords = [];
        },
        error: (err) => {
          console.error('Backend error:', err);
          alert('Backend is not available. Feedback saved locally!');
          const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
          feedbacks.push({ ...payload, timestamp: new Date().toISOString() });
          localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
          this.feedbackSubmitted = true;
          this.feedbackForm.reset({ rating: 5 });
          this.selectedWords = [];
        }
      });
    } else {
      alert('Please fill in all required fields (Quiz ID and Participant ID)');
    }
  }

  returnToHome() {
    localStorage.removeItem('currentQuizId');
    localStorage.removeItem('participantId');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('participantName');
    localStorage.removeItem('sessionCode');
    localStorage.removeItem('quizTitle');
    localStorage.removeItem('sessionData');
    localStorage.removeItem('finalScore');
    localStorage.removeItem('feedbacks');

    this.router.navigate(['/participant'], { replaceUrl: true }).catch(err => {
      console.error('Navigation error:', err);
      this.router.navigate(['/user/dashboard'], { replaceUrl: true }).catch(err2 => {
        console.error('Fallback navigation error:', err2);
        this.router.navigate(['/landing'], { replaceUrl: true });
      });
    });
  }

  getRatingLabel(stars: number): string {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
    return labels[stars] || 'Rate';
  }

  getRatingMessage(rating: number): string {
    const messages: { [key: number]: string } = {
      0: '👋 Tell us what you think!',
      1: '😢 We\'re sorry to hear that. Help us improve!',
      2: '😐 Thanks for the feedback. We\'ll do better!',
      3: '😊 Glad you enjoyed it!',
      4: '😄 Awesome! We love your enthusiasm!',
      5: '🎉 Excellent! You\'re the best!'
    };
    return messages[rating] || 'Rate your experience';
  }
}

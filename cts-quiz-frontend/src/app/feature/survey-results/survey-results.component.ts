import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-survey-results',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  template: `
    <div class="results-container">
      <div class="results-card">
        <div class="success-icon">✅</div>
        <h1>Survey Completed!</h1>
        <p class="thank-you-message">Thank you for completing the survey.</p>
        
        <div class="stats-section">
          <div class="stat-item">
            <div class="stat-value">{{ questionsAnswered }}</div>
            <div class="stat-label">Questions Answered</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ timeSpent }}</div>
            <div class="stat-label">Time Spent</div>
          </div>
        </div>

        <p class="info-text">
          Your responses have been recorded. The host will analyze the results and share insights.
        </p>

        <div class="action-buttons">
          <button class="btn btn-primary" (click)="goHome()">
            🏠 Return to Home
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .results-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .results-card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }

    .success-icon {
      font-size: 80px;
      margin-bottom: 20px;
      animation: bounceIn 0.6s;
    }

    @keyframes bounceIn {
      0% { transform: scale(0); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 32px;
    }

    .thank-you-message {
      color: #666;
      font-size: 18px;
      margin-bottom: 30px;
    }

    .stats-section {
      display: flex;
      justify-content: space-around;
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }

    .stat-item {
      flex: 1;
    }

    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }

    .stat-label {
      color: #666;
      font-size: 14px;
    }

    .info-text {
      color: #666;
      margin: 20px 0;
      line-height: 1.6;
    }

    .action-buttons {
      margin-top: 30px;
    }

    .btn {
      padding: 15px 40px;
      font-size: 16px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: 600;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    @media (max-width: 768px) {
      .results-card {
        padding: 30px 20px;
      }

      h1 {
        font-size: 24px;
      }

      .stats-section {
        flex-direction: column;
        gap: 20px;
      }
    }
  `]
})
export class SurveyResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  surveyId: string = '';
  participantId: string = '';
  questionsAnswered: number = 0;
  timeSpent: string = '0m';

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.surveyId = params['surveyId'] || '';
      this.participantId = params['participantId'] || '';
    });

    // Get stats from localStorage
    const totalQuestions = localStorage.getItem('totalQuestions');
    const answerStates = localStorage.getItem('answerStates');

    if (totalQuestions) {
      this.questionsAnswered = parseInt(totalQuestions);
    }

    if (answerStates) {
      try {
        const states = JSON.parse(answerStates);
        this.questionsAnswered = Object.keys(states).filter(k => states[k] === 'answered').length;
      } catch (e) {
        console.error('Failed to parse answer states:', e);
      }
    }

    // Calculate time spent (mock for now)
    this.timeSpent = '5m';
  }

  goHome(): void {
    // Clear session data
    localStorage.removeItem('sessionData');
    localStorage.removeItem('sessionType');
    localStorage.removeItem('currentSurveyId');
    localStorage.removeItem('participantId');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('answerStates');
    
    this.router.navigate(['/']);
  }
}

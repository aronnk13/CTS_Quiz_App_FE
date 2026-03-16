import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ParticipantResult {
  participantName: string;
  employeeId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  completedAt: Date;
  timeTaken: string;
}

interface QuestionAnalysis {
  questionId: number;
  questionText: string;
  correctCount: number;
  incorrectCount: number;
  totalResponses: number;
  correctPercentage: number;
}

interface SessionSummary {
  sessionCode: string;
  quizName: string;
  totalParticipants: number;
  averageScore: number;
  completionRate: number;
  topScore: number;
  lowestScore: number;
  startedAt: Date;
  endedAt: Date;
}

@Component({
  selector: 'app-results-analysis',
  templateUrl: './results-analysis.component.html',
  styleUrls: ['./results-analysis.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ResultsAnalysisComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  
  private readonly apiBase = `${environment.apiUrl}/Host/QuizSession`;
  
  // Make Math available in template
  Math = Math;
  
  // Component state
  sessionCode = signal<string>('');
  loading = signal<boolean>(true);
  sessionSummary = signal<SessionSummary | null>(null);
  participantResults = signal<ParticipantResult[]>([]);
  questionAnalysis = signal<QuestionAnalysis[]>([]);
  
  // Pagination for question analysis
  currentPage = signal<number>(1);
  itemsPerPage = signal<number>(10);
  
  // Computed properties
  hasData = computed(() => this.participantResults().length > 0);
  
  // Paginated question analysis
  paginatedQuestions = computed(() => {
    const questions = this.questionAnalysis();
    const page = this.currentPage();
    const perPage = this.itemsPerPage();
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return questions.slice(startIndex, endIndex);
  });
  
  totalPages = computed(() => {
    const total = this.questionAnalysis().length;
    const perPage = this.itemsPerPage();
    return Math.ceil(total / perPage);
  });
  
  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      // Show all pages if 7 or less
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (current > 3) {
        pages.push(-1); // Ellipsis
      }
      
      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (current < total - 2) {
        pages.push(-1); // Ellipsis
      }
      
      // Always show last page
      pages.push(total);
    }
    
    return pages;
  });
  
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const code = params['sessionCode'];
      if (code) {
        this.sessionCode.set(code);
        this.loadResults();
      } else {
        this.snackBar.open('⚠️ No session code provided', 'Close', { duration: 4000 });
        this.router.navigate(['/host/manage-content']);
      }
    });
  }

  /**
   * Load results and analytics from backend
   */
  private async loadResults() {
    try {
      this.loading.set(true);
      
      // Fetch session summary
      const summaryUrl = `${this.apiBase}/${this.sessionCode()}/summary`;
      const summary = await firstValueFrom(this.http.get<SessionSummary>(summaryUrl));
      this.sessionSummary.set(summary);
      
      // Fetch participant results
      const resultsUrl = `${this.apiBase}/${this.sessionCode()}/results`;
      const results = await firstValueFrom(this.http.get<ParticipantResult[]>(resultsUrl));
      this.participantResults.set(results);
      
      // Fetch question-wise analysis
      const analysisUrl = `${this.apiBase}/${this.sessionCode()}/question-analysis`;
      const analysis = await firstValueFrom(this.http.get<QuestionAnalysis[]>(analysisUrl));
      this.questionAnalysis.set(analysis);
      
      this.loading.set(false);
      console.log('[ResultsAnalysis] Data loaded successfully');
    } catch (error: any) {
      console.error('[ResultsAnalysis] Failed to load results:', error);
      this.loading.set(false);
      this.snackBar.open('⚠️ Failed to load quiz results', 'Close', { duration: 4000 });
    }
  }

  /**
   * Navigate back to content management
   */
  goBack() {
    this.router.navigate(['/host/manage-content']);
  }

  /**
   * Export results as CSV
   */
  exportAsCSV() {
    const results = this.participantResults();
    if (results.length === 0) {
      this.snackBar.open('⚠️ No results to export', 'Close', { duration: 3000 });
      return;
    }

    // Generate CSV content
    const headers = ['Participant Name', 'Employee ID', 'Score', 'Correct Answers', 'Total Questions', 'Completed At', 'Time Taken'];
    const rows = results.map(r => [
      r.participantName,
      r.employeeId,
      r.score.toString(),
      r.correctAnswers.toString(),
      r.totalQuestions.toString(),
      new Date(r.completedAt).toLocaleString(),
      r.timeTaken
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `quiz_results_${this.sessionCode()}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.snackBar.open('✅ Results exported successfully', 'Close', { duration: 3000 });
  }

  /**
   * Get bar width percentage for question analysis chart
   */
  getBarWidth(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }
  
  /**
   * Navigate to specific page
   */
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      // Scroll to question analysis section
      const element = document.querySelector('.analysis-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
  
  /**
   * Go to previous page
   */
  previousPage() {
    const current = this.currentPage();
    if (current > 1) {
      this.goToPage(current - 1);
    }
  }
  
  /**
   * Go to next page
   */
  nextPage() {
    const current = this.currentPage();
    if (current < this.totalPages()) {
      this.goToPage(current + 1);
    }
  }
}

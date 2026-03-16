import {
  Component, OnInit, OnDestroy, signal, computed, AfterViewInit,
  ViewChildren, QueryList, ElementRef, Input, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SurveyService } from '../../services/survey.service';
import { SurveyOverview, SurveyQuestionOverview } from '../../models/isurvey';

Chart.register(...registerables);

interface QuestionAnalytics {
  questionId: number;
  questionText: string;
  questionType: string;
  responses: { label: string; count: number }[];
  totalResponses: number;
  rankingData?: { option: string; averageRank: number; rank1Count: number; rank2Count: number; rank3Count: number }[];
  ratingData?: { rating: number; count: number; percentage: number }[];
  averageRating?: number;
  textResponses?: string[];
  wordFrequency?: { [word: string]: number };
}

@Component({
  selector: 'app-result-survey',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './result-survey.component.html',
  styleUrl: './result-survey.component.css'
})
export class ResultSurveyComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChildren('wordcloudCanvas') wordcloudCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  @Input() set surveyId(value: number) { if (value) this._surveyId.set(value); }
  @Input() set sessionCode(value: string) { if (value) this._sessionCode = value; }
  @Input() isQuestionWise: boolean = false;
  @Input() questionId?: number; // current question from overlay

  private _surveyId = signal<number>(0);
  private _sessionCode: string = '';
  loading = signal<boolean>(true);

  surveyData = signal<SurveyOverview | null>(null);
  questions = signal<SurveyQuestionOverview[]>([]);
  activeQuestionId = signal<number | null>(null);

  // search (standalone)
  searchQuery = signal<string>('');
  filteredQuestions = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.questions();
    return this.questions().filter(q => q.questionText.toLowerCase().includes(query));
  });

  // analytics
  totalQuestions = computed(() => this.questions().length);
  totalParticipants = signal<number>(0);
  publishedDate = signal<string>('N/A');
  totalVotes = signal<number>(0);

  selectedChartTypes: { [questionId: number]: string } = {};
  activeCharts: { [questionId: number]: Chart } = {};
  questionAnalytics: { [questionId: number]: QuestionAnalytics } = {};

  constructor(
    private route: ActivatedRoute,
    private surveyService: SurveyService
  ) {
    effect(() => { const id = this._surveyId(); if (id > 0) this.loadSurveyData(); });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const id = params['surveyId'];
      if (id && this._surveyId() === 0) this._surveyId.set(+id);
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void { Object.values(this.activeCharts).forEach(c => c?.destroy()); }

  async loadSurveyData(): Promise<void> {
    try {
      this.loading.set(true);
      this.surveyService.getSurveyById(this._surveyId()).subscribe({
        next: (survey: any) => {
          const mapped: SurveyOverview = {
            surveyId: survey.surveyId || survey.SurveyId,
            sessionId: survey.sessionId || survey.SessionId,
            sessionCode: survey.sessionCode || survey.SessionCode,
            title: survey.title || survey.Title,
            description: survey.description || survey.Description,
            isAnonymous: survey.isAnonymous || survey.IsAnonymous,
            status: survey.status || survey.Status,
            startTime: survey.startTime || survey.StartTime,
            endTime: survey.endTime || survey.EndTime,
            questions: (survey.questions || survey.Questions || []).map((q: any) => ({
              surveyQuestionId: q.surveyQuestionId || q.SurveyQuestionId,
              sessionId: q.sessionId || q.SessionId,
              questionText: q.questionText || q.QuestionText,
              questionType: q.questionType || q.QuestionType,
              questionOrder: q.questionOrder || q.QuestionOrder,
              isRequired: q.isRequired || q.IsRequired,
              scaleMin: q.scaleMin || q.ScaleMin,
              scaleMax: q.scaleMax || q.ScaleMax,
              options: (q.options || q.Options || []).map((opt: any) => ({
                optionId: opt.optionId || opt.OptionId,
                optionText: opt.optionText || opt.OptionText,
                displayOrder: opt.displayOrder || opt.DisplayOrder,
                scoreValue: opt.scoreValue || opt.ScoreValue
              }))
            }))
          };
          this.surveyData.set(mapped);
          this.questions.set(mapped.questions || []);

          // default chart by type
          this.questions().forEach(q => {
            const t = (q.questionType || 'single_choice').toLowerCase();
            this.selectedChartTypes[q.surveyQuestionId] =
              (t === 'ranking' || t === 'rating' || t === 'text' || t === 'short_text') ? 'bar' : 'pie';
          });

          if (mapped.startTime) this.publishedDate.set(new Date(mapped.startTime).toLocaleDateString());
          this.loadAnalyticsData(mapped.sessionId ?? undefined);
        },
        error: (err) => { console.error('[ResultSurvey] getSurveyById error:', err); this.loading.set(false); }
      });
    } catch (e) { console.error('[ResultSurvey] loadSurveyData exception:', e); this.loading.set(false); }
  }

  async loadAnalyticsData(sessionId?: number): Promise<void> {
    try {
      const idToUse = sessionId || this._surveyId();
      this.surveyService.getSurveyResults(idToUse).subscribe({
        next: (results: any) => {
          const totalResponses = results.totalResponses || results.TotalResponses || 0;
          const questionResults = results.questionResults || results.QuestionResults || [];
          this.totalParticipants.set(totalResponses);

          let totalVoteCount = 0;

          questionResults.forEach((qr: any) => {
            const questionId = qr.questionId || qr.QuestionId;
            const questionText = qr.questionText || qr.QuestionText;
            const questionType = (qr.questionType || qr.QuestionType || 'single_choice').toLowerCase();
            const options = qr.options || qr.Options;
            const textResponses = qr.textResponses || qr.TextResponses;
            const rankingData = qr.rankingData || qr.RankingData;
            const ratingData = qr.ratingData || qr.RatingData;

            const qa: QuestionAnalytics = {
              questionId, questionText, questionType, responses: [], totalResponses: 0
            };

            if (questionType === 'ranking') {
              if (rankingData?.length) {
                qa.rankingData = rankingData.map((rd: any) => ({
                  option: rd.optionText || rd.OptionText,
                  averageRank: rd.averageRank || rd.AverageRank || 0,
                  rank1Count: rd.rank1Count || rd.Rank1Count || 0,
                  rank2Count: rd.rank2Count || rd.Rank2Count || 0,
                  rank3Count: rd.rank3Count || rd.Rank3Count || 0
                }));
                qa.totalResponses = rankingData[0]?.totalResponses || rankingData[0]?.TotalResponses || 0;
              } else if (options?.length) {
                qa.responses = options.map((opt: any) => ({ label: opt.optionText || opt.OptionText, count: opt.count || opt.Count }));
                qa.totalResponses = options.reduce((s: number, o: any) => s + (o.count || o.Count), 0);
              }
              totalVoteCount += qa.totalResponses;
            } else if (questionType === 'rating') {
              if (ratingData?.length) {
                qa.ratingData = ratingData.map((rd: any) => ({
                  rating: rd.rating || rd.Rating,
                  count: rd.count || rd.Count,
                  percentage: rd.percentage || rd.Percentage || 0
                }));
                qa.averageRating = ratingData[0]?.averageRating || ratingData[0]?.AverageRating || 0;
                qa.totalResponses = ratingData.reduce((s: number, rd: any) => s + (rd.count || rd.Count), 0);
              }
              totalVoteCount += qa.totalResponses;
            } else if (questionType === 'text' || questionType === 'short_text') {
              if (textResponses?.length) {
                qa.textResponses = textResponses;
                const wordFreq = this.calculateWordFrequency(textResponses);
                qa.wordFrequency = wordFreq;
                qa.responses = Object.entries(wordFreq)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 20)
                  .map(([w, c]) => ({ label: w, count: c as number }));
                qa.totalResponses = textResponses.length;
                totalVoteCount += qa.totalResponses;
              }
            } else {
              if (options?.length) {
                qa.responses = options.map((opt: any) => ({ label: opt.optionText || opt.OptionText, count: opt.count || opt.Count }));
                qa.totalResponses = options.reduce((s: number, o: any) => s + (o.count || o.Count), 0);
                totalVoteCount += qa.totalResponses;
              }
            }

            this.questionAnalytics[questionId] = qa;
          });

          this.totalVotes.set(totalVoteCount);
          this.loading.set(false);

          // compact overlay (render just current question)
          if (this.isQuestionWise && this.questionId) {
            this.activeQuestionId.set(this.questionId);
            this.selectedChartTypes[this.questionId] = this.selectedChartTypes[this.questionId] || this.defaultChartType(this.questionId);
            setTimeout(() => this.renderChart(this.questionId!), 0);
          }
        },
        error: (err) => { console.error('[ResultSurvey] getSurveyResults error:', err); this.loading.set(false); }
      });
    } catch (e) { console.error('[ResultSurvey] loadAnalyticsData exception:', e); this.loading.set(false); }
  }

  private defaultChartType(qid: number): string {
    const qa = this.questionAnalytics[qid];
    if (!qa) return 'pie';
    const t = qa.questionType.toLowerCase();
    return (t === 'rating' || t === 'ranking' || t === 'text' || t === 'short_text') ? 'bar' : 'pie';
  }

  private calculateWordFrequency(texts: string[]): { [word: string]: number } {
    const freq: Record<string, number> = {};
    const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','was','are','were']);
    texts.forEach(r => {
      r.toLowerCase().split(/\s+/).forEach(w => {
        const word = w.replace(/[^\w]/g, '');
        if (word.length > 2 && !stop.has(word)) freq[word] = (freq[word] || 0) + 1;
      });
    });
    return freq;
  }

  // ===== Standalone page controls =====
  toggleChartView(questionId: number): void {
    if (this.activeQuestionId() === questionId) {
      this.activeQuestionId.set(null);
      if (this.activeCharts[questionId]) { this.activeCharts[questionId].destroy(); delete this.activeCharts[questionId]; }
    } else {
      this.activeQuestionId.set(questionId);
      setTimeout(() => this.renderChart(questionId), 100);
    }
  }

  onChartTypeChange(questionId: number): void {
    if (this.activeQuestionId() === questionId) {
      setTimeout(() => this.renderChart(questionId), 100);
    }
  }

  // ===== Rendering (compact canvas preferred) =====
  private canvasFor(questionId: number, word = false): HTMLCanvasElement | null {
    const compactId = word ? `compact-wordcloud-${questionId}` : `compact-chart-${questionId}`;
    const pageId    = word ? `wordcloud-${questionId}`        : `chart-${questionId}`;
    return (document.getElementById(compactId) as HTMLCanvasElement) ||
           (document.getElementById(pageId) as HTMLCanvasElement) || null;
  }

  renderChart(questionId: number): void {
    const qa = this.questionAnalytics[questionId]; if (!qa) return;
    const t = qa.questionType.toLowerCase();
    const type = this.selectedChartTypes[questionId] || 'pie';

    if (this.activeCharts[questionId]) this.activeCharts[questionId].destroy();

    if (t === 'ranking') return this.renderRankingChart(questionId, qa);
    if (t === 'rating')  return this.renderRatingChart(questionId, qa);
    if (t === 'text' || t === 'short_text') {
      if (type === 'wordcloud') return this.renderWordCloud(questionId, qa);
      return this.renderTextResponses(questionId, qa);
    }
    return this.renderRegularChart(questionId, type, qa);
  }

  private renderRegularChart(questionId: number, chartType: string, qa: QuestionAnalytics): void {
    const canvas = this.canvasFor(questionId);
    if (!canvas) { console.error('Canvas not found:', questionId); return; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const labels = qa.responses.map(r => r.label);
    const data = qa.responses.map(r => r.count);

    const cfg: ChartConfiguration = {
      type: chartType === 'doughnut' ? 'doughnut' : chartType === 'line' ? 'line' : 'pie',
      data: { labels, datasets: [{ label: 'Response Count', data, backgroundColor: this.colors(data.length), borderColor: '#fff', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, padding: 15 } },
          title: { display: true, text: qa.questionText, font: { size: 16, weight: 'bold' } }
        }
      }
    };
    this.activeCharts[questionId] = new Chart(ctx, cfg);
  }

  private renderRankingChart(questionId: number, qa: QuestionAnalytics): void {
    const canvas = this.canvasFor(questionId);
    if (!canvas) { console.error('Canvas not found:', questionId); return; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const rows = qa.rankingData || [];
    if (!rows.length) { console.warn('No ranking data'); return; }

    const sorted = [...rows].sort((a, b) => a.averageRank - b.averageRank);
    const labels = sorted.map(r => r.option);
    const r1 = sorted.map(r => r.rank1Count);
    const r2 = sorted.map(r => r.rank2Count);
    const r3 = sorted.map(r => r.rank3Count);
    const avg = sorted.map(r => r.averageRank);

    const cfg: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '#1 Rank Count', data: r1, backgroundColor: '#FFD700', borderColor: '#FFA500', borderWidth: 2 },
          { label: '#2 Rank Count', data: r2, backgroundColor: '#C0C0C0', borderColor: '#A9A9A9', borderWidth: 2 },
          { label: '#3 Rank Count', data: r3, backgroundColor: '#CD7F32', borderColor: '#8B4513', borderWidth: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: true, indexAxis: 'y',
        plugins: {
          legend: { position: 'top', labels: { font: { size: 12 }, padding: 15 } },
          title: { display: true, text: `${qa.questionText} (Ranking Distribution)`, font: { size: 16, weight: 'bold' } },
          tooltip: { callbacks: { afterLabel: (ctx: any) => `Average Rank: ${avg[ctx.dataIndex].toFixed(2)}` } }
        },
        scales: { x: { stacked: true, title: { display: true, text: 'Number of Votes' } }, y: { stacked: true } }
      }
    };
    this.activeCharts[questionId] = new Chart(ctx, cfg);
  }

  private renderRatingChart(questionId: number, qa: QuestionAnalytics): void {
    const canvas = this.canvasFor(questionId);
    if (!canvas) { console.error('Canvas not found:', questionId); return; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const rows = qa.ratingData || [];
    if (!rows.length) { console.warn('No rating data'); return; }

    const sorted = [...rows].sort((a, b) => a.rating - b.rating);
    const labels = sorted.map(r => `${r.rating} ⭐`);
    const counts = sorted.map(r => r.count);
    const percentages = sorted.map(r => r.percentage);

    const cfg: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Response Count', data: counts, backgroundColor: ['#EF4444','#F97316','#F59E0B','#84CC16','#10B981'], borderColor: '#fff', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `${qa.questionText} (Avg: ${qa.averageRating?.toFixed(1) || 'N/A'} ⭐)`, font: { size: 16, weight: 'bold' } },
          tooltip: { callbacks: { label: (ctx: any) => `Count: ${counts[ctx.dataIndex]} (${percentages[ctx.dataIndex].toFixed(1)}%)` } }
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Responses' } }, x: { title: { display: true, text: 'Rating' } } }
      }
    };
    this.activeCharts[questionId] = new Chart(ctx, cfg);
  }

  private renderTextResponses(questionId: number, qa: QuestionAnalytics): void {
    const canvas = this.canvasFor(questionId);
    if (!canvas) { console.error('Canvas not found:', questionId); return; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const labels = qa.responses.map(r => r.label);
    const data = qa.responses.map(r => r.count);

    const cfg: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Word Frequency', data, backgroundColor: this.colors(data.length), borderColor: '#fff', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: true, indexAxis: 'y',
        plugins: { legend: { display: false }, title: { display: true, text: `${qa.questionText} (Top Words)`, font: { size: 16, weight: 'bold' } } },
        scales: { x: { beginAtZero: true, title: { display: true, text: 'Frequency' } } }
      }
    };
    this.activeCharts[questionId] = new Chart(ctx, cfg);
  }

  private renderWordCloud(questionId: number, qa: QuestionAnalytics): void {
    const canvas = this.canvasFor(questionId, true);
    if (!canvas) { console.error('Canvas not found:', questionId); return; }
    console.warn('WordCloud library not installed.');
  }

  private colors(n: number): string[] {
    const c = ['#0066CC','#00A7C7','#10B981','#F59E0B','#8B5CF6','#EC4899','#EF4444','#06B6D4','#84CC16','#F97316'];
    return Array.from({ length: n }, (_, i) => c[i % c.length]);
  }

  // Standalone helpers
  searchQuestions(): void { this.filteredQuestions(); }
  downloadChart(questionId: number): void {
    const compact = document.getElementById(`compact-chart-${questionId}`) as HTMLCanvasElement | null;
    if (compact) { const a = document.createElement('a'); a.download = `survey-chart-q${questionId}.png`; a.href = compact.toDataURL('image/png'); a.click(); return; }
    const chart = this.activeCharts[questionId];
    if (chart) { const a = document.createElement('a'); a.download = `survey-chart-q${questionId}.png`; a.href = chart.toBase64Image(); a.click(); }
  }
  exportAnalytics(): void { alert('Export functionality is not yet implemented.'); }
}
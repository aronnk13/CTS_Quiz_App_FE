import { Component, OnInit, OnDestroy, signal, computed, AfterViewInit, ViewChildren, QueryList, ElementRef, Input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { PollService } from '../../services/poll.service';
import { PollOverview } from '../../models/ipoll';

Chart.register(...registerables);

interface PollAnalytics {
  pollId: number;
  pollQuestion: string;
  responses: { label: string; count: number }[];
  totalResponses: number;
}

@Component({
  selector: 'app-result-poll',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './result-poll.component.html',
  styleUrl: './result-poll.component.css'
})
export class ResultPollComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChildren('wordcloudCanvas') wordcloudCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  // Inputs used by overlay
  @Input() set pollId(value: number) { if (value) this._pollId.set(value); }
  @Input() set sessionCode(value: string) { if (value) this._sessionCode = value; }
  @Input() isQuestionWise: boolean = false;
  @Input() questionId?: number; // parity with survey (for future multi-question polls)

  private _pollId = signal<number>(0);
  private _sessionCode: string = '';
  loading = signal<boolean>(true);

  // data
  pollData = signal<PollOverview | null>(null);
  polls = signal<PollOverview[]>([]);
  activePollId = signal<number | null>(null);

  // analytics
  totalQuestions = computed(() => this.polls().length);
  totalParticipants = signal<number>(0);
  publishedDate = signal<string>('N/A');
  totalVotes = signal<number>(0);

  // charts
  selectedChartTypes: { [key: number]: string } = {};
  activeCharts: { [key: number]: Chart } = {};
  pollAnalytics: { [key: number]: PollAnalytics } = {};

  constructor(
    private route: ActivatedRoute,
    private pollService: PollService
  ) {
    effect(() => {
      const id = this._pollId();
      if (id > 0) this.loadPollData();
    });
  }

  ngOnInit(): void {
    // fallback to query param in standalone route
    this.route.queryParams.subscribe(params => {
      const id = params['pollId'];
      if (id && this._pollId() === 0) this._pollId.set(+id);
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    Object.values(this.activeCharts).forEach(c => c?.destroy());
  }

  async loadPollData(): Promise<void> {
    try {
      this.loading.set(true);
      this.pollService.getPollById(this._pollId()).subscribe({
        next: (poll: PollOverview) => {
          this.pollData.set(poll);
          this.polls.set([poll]); // page view uses array
          this.selectedChartTypes[poll.pollId] = this.selectedChartTypes[poll.pollId] || 'pie';
          this.publishedDate.set(new Date().toLocaleDateString());
          this.loadAnalyticsData();
        },
        error: (err) => {
          console.error('[ResultPoll] getPollById error:', err);
          this.loading.set(false);
        }
      });
    } catch (e) {
      console.error('[ResultPoll] loadPollData exception:', e);
      this.loading.set(false);
    }
  }

  async loadAnalyticsData(): Promise<void> {
    try {
      this.pollService.getPollResults(this._pollId()).subscribe({
        next: (results: any) => {
          const pollId = results.pollId || results.PollId || this._pollId();
          const pollQuestion = results.pollQuestion || results.PollQuestion || this.pollData()?.pollQuestion || '';
          const totalVotes = results.totalVotes || results.TotalVotes || 0;
          const items = results.results || results.Results || [];

          this.totalParticipants.set(totalVotes);
          this.totalVotes.set(totalVotes);

          this.pollAnalytics[pollId] = {
            pollId,
            pollQuestion,
            responses: (items || []).map((opt: any) => ({
              label: opt.optionLabel || opt.OptionLabel,
              count: opt.voteCount || opt.VoteCount || 0
            })),
            totalResponses: totalVotes
          };

          this.loading.set(false);

          // compact overlay: render single chart automatically
          if (this.isQuestionWise) {
            this.activePollId.set(pollId);
            this.selectedChartTypes[pollId] = this.selectedChartTypes[pollId] || 'pie';
            setTimeout(() => this.renderChart(pollId), 0);
          }
        },
        error: (err) => {
          console.error('[ResultPoll] getPollResults error:', err);
          this.loading.set(false);
        }
      });
    } catch (e) {
      console.error('[ResultPoll] loadAnalyticsData exception:', e);
      this.loading.set(false);
    }
  }

  // ===== Page controls (standalone) =====
  toggleChartView(pollId: number): void {
    if (this.activePollId() === pollId) {
      this.activePollId.set(null);
      if (this.activeCharts[pollId]) { this.activeCharts[pollId].destroy(); delete this.activeCharts[pollId]; }
    } else {
      this.activePollId.set(pollId);
      setTimeout(() => this.renderChart(pollId), 100);
    }
  }

  onChartTypeChange(pollId: number): void {
    if (this.activePollId() === pollId) {
      setTimeout(() => this.renderChart(pollId), 100);
    }
  }

  // ===== Rendering =====
  private getCanvas(pollId: number, isWordCloud = false): HTMLCanvasElement | null {
    const compactId = isWordCloud ? `compact-wordcloud-${pollId}` : `compact-chart-${pollId}`;
    const pageId    = isWordCloud ? `wordcloud-${pollId}`        : `chart-${pollId}`;
    return (document.getElementById(compactId) as HTMLCanvasElement) ||
           (document.getElementById(pageId) as HTMLCanvasElement) || null;
  }

  renderChart(pollId: number): void {
    const chartType = this.selectedChartTypes[pollId] || 'pie';
    const analytics = this.pollAnalytics[pollId];
    if (!analytics) return;

    if (this.activeCharts[pollId]) this.activeCharts[pollId].destroy();

    const canvas = this.getCanvas(pollId);
    if (!canvas) { console.error('Canvas not found for', pollId); return; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const labels = analytics.responses.map(r => r.label);
    const data = analytics.responses.map(r => r.count);

    const config: ChartConfiguration = {
      type: chartType === 'doughnut' ? 'doughnut' : chartType === 'line' ? 'line' : 'pie',
      data: { labels, datasets: [{ label: 'Vote Count', data, backgroundColor: this.colors(data.length), borderColor: '#fff', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, padding: 15 } },
          title: { display: true, text: analytics.pollQuestion, font: { size: 16, weight: 'bold' } }
        }
      }
    };
    this.activeCharts[pollId] = new Chart(ctx, config);
  }

  private colors(n: number): string[] {
    const c = ['#0066CC', '#00A7C7', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#06B6D4', '#84CC16', '#F97316'];
    return Array.from({ length: n }, (_, i) => c[i % c.length]);
  }

  downloadChart(pollId: number): void {
    const compact = document.getElementById(`compact-chart-${pollId}`) as HTMLCanvasElement | null;
    if (compact) {
      const a = document.createElement('a');
      a.download = `poll-chart-${pollId}.png`;
      a.href = compact.toDataURL('image/png');
      a.click();
      return;
    }
    const chart = this.activeCharts[pollId];
    if (chart) {
      const a = document.createElement('a');
      a.download = `poll-chart-${pollId}.png`;
      a.href = chart.toBase64Image();
      a.click();
    }
  }
  onExportClick(): void {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert('Export not implemented');
  }
}
}
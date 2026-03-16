import { Component, OnInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SurveyService } from '../../services/survey.service';
import { WordCloudResponse, WordCloudItem } from '../../models/isurvey';
import Sentiment from 'sentiment';

@Component({
  selector: 'app-word-cloud',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.css']
})
export class WordCloudComponent implements OnInit {
  @ViewChild('wordCloudCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private route = inject(ActivatedRoute);
  private surveyService = inject(SurveyService);
  private snackBar = inject(MatSnackBar);
  private sentiment = new Sentiment();

  surveyId: number = 0;
  sessionId: number = 0;
  wordCloudData = signal<WordCloudResponse | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.surveyId = +params['surveyId'] || 0;
      this.sessionId = +params['sessionId'] || 0;

      if (this.surveyId && this.sessionId) {
        this.loadWordCloud();
      } else {
        this.snackBar.open('⚠️ Missing survey or session ID', 'Close', { duration: 3000 });
      }
    });
  }

  loadWordCloud(): void {
    this.surveyService.getWordCloud(this.surveyId, this.sessionId).subscribe({
      next: (data) => {
        this.wordCloudData.set(data);
        setTimeout(() => this.renderWordCloud(), 100);
      },
      error: (error) => {
        console.error('Failed to load word cloud:', error);
        this.snackBar.open('❌ Failed to load word cloud', 'Close', { duration: 3000 });
      }
    });
  }

  refreshWordCloud(): void {
    this.loadWordCloud();
    this.snackBar.open('🔄 Refreshing word cloud...', 'Close', { duration: 2000 });
  }

  renderWordCloud(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.wordCloudData()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1000;
    canvas.height = 600;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stop words to exclude
    const stopWords = ["the","and","is","of","to","in","a","for","with","on","at","by","an","be","this","that","it","as","we","you","i"];

    // Filter words: remove stop words and keep only expressive ones
    let words = this.wordCloudData()!.words.filter(w => {
      const lower = w.word.toLowerCase();
      if (stopWords.includes(lower)) return false;

      const result = this.sentiment.analyze(lower);
      return result.score !== 0; // keep only words with sentiment
    });

    if (words.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No expressive responses yet', canvas.width / 2, canvas.height / 2);
      return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

    words.forEach((word, index) => {
      // Scale font size by sentiment strength + weight
      const result = this.sentiment.analyze(word.word);
      const sentimentBoost = Math.abs(result.score) * 5; // stronger sentiment → bigger font
      const fontSize = 16 + Math.floor(word.weight * 48) + sentimentBoost;
      ctx.font = `bold ${fontSize}px Arial`;

      // Color by sentiment
      let color = '#333';
      if (result.score > 0) {
        color = 'hsl(140, 70%, 40%)'; // positive → green
      } else if (result.score < 0) {
        color = 'hsl(0, 70%, 50%)';   // negative → red
      } else {
        color = 'hsl(0, 0%, 50%)';    // neutral → gray
      }
      ctx.fillStyle = color;

      const angle = index * 0.5;
      const radius = (index / words.length) * maxRadius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word.word, x, y);
    });
  }

  exportAsPNG(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `wordcloud-survey-${this.surveyId}-${Date.now()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        this.snackBar.open('✅ Word cloud exported as PNG', 'Close', { duration: 3000 });
      }
    });
  }

  exportAsJSON(): void {
    const data = this.wordCloudData();
    if (!data) return;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `wordcloud-data-survey-${this.surveyId}-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    this.snackBar.open('✅ Word cloud data exported as JSON', 'Close', { duration: 3000 });
  }

  get generatedTime(): string {
    const data = this.wordCloudData();
    if (!data) return 'N/A';
    return new Date(data.generatedAt).toLocaleTimeString();
  }

  getTopWords(count: number): WordCloudItem[] {
    return this.wordCloudData()?.words.slice(0, count) || [];
  }
}

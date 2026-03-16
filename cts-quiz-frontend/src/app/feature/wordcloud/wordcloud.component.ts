import { Component, OnInit, ElementRef, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedbackService } from '../services/feedback.service';
import * as d3 from 'd3';
import cloud from 'd3-cloud';

@Component({
  selector: 'app-wordcloud',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './wordcloud.component.html',
  styleUrls: ['./wordcloud.component.css']
})
export class WordcloudComponent implements OnInit {
  @ViewChild('wordcloud', { static: true }) wordcloudElement!: ElementRef;
  
  constructor(private feedbackService: FeedbackService) {}

  ngOnInit() {
    this.loadWordCloud();
  }

  loadWordCloud() {
    // Fetch feedback data
    this.feedbackService.getFeedbackByQuiz(1).subscribe({
      next: (feedbacks: any[]) => {
        const comments = feedbacks
          .map(f => f.comment)
          .filter(c => c && c.trim() !== '')
          .join(' ');
        
        this.generateWordCloud(comments);
      },
      error: () => {
        // Generate sample word cloud if API fails
        const sampleText = 'great excellent amazing wonderful good nice helpful interesting fun engaging creative interactive challenging educational informative';
        this.generateWordCloud(sampleText);
      }
    });
  }

  generateWordCloud(text: string) {
    // Process text into word frequency
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3); // Filter out small words

    const wordCounts: { [key: string]: number } = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    const wordData = Object.keys(wordCounts).map(key => ({
      text: key,
      size: 10 + wordCounts[key] * 10
    }));

    // Create word cloud
    const width = 800;
    const height = 400;

    const layout = cloud()
      .size([width, height])
      .words(wordData)
      .padding(5)
      .rotate(() => ~~(Math.random() * 2) * 90)
      .font('Impact')
      .fontSize((d: any) => d.size)
      .on('end', (words: any[]) => this.draw(words, width, height));

    layout.start();
  }

  draw(words: any[], width: number, height: number) {
    const element = this.wordcloudElement.nativeElement;
    d3.select(element).selectAll('*').remove();

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    svg.selectAll('text')
      .data(words)
      .enter()
      .append('text')
      .style('font-size', (d: any) => `${d.size}px`)
      .style('font-family', 'Impact')
      .style('fill', () => d3.schemeCategory10[Math.floor(Math.random() * 10)])
      .style('cursor', 'pointer')
      .attr('text-anchor', 'middle')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
      .text((d: any) => d.text)
      .on('click', (event: any, d: any) => {
        alert(`You selected: "${d.text}"\nAppears ${(d.size - 10) / 10} times in comments`);
      })
      .on('mouseover', function(this: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 0.7)
          .attr('transform', function(d: any) {
            return `translate(${d.x},${d.y})rotate(${d.rotate})scale(1.2)`;
          });
      })
      .on('mouseout', function(this: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 1)
          .attr('transform', function(d: any) {
            return `translate(${d.x},${d.y})rotate(${d.rotate})scale(1)`;
          });
      });
  }
}

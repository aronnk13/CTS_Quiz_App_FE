import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loader-container" [ngClass]="containerClass">
      @switch (type) {
        @case ('spinner') {
          <div class="spinner" [style.width.px]="size" [style.height.px]="size"></div>
        }
        @case ('dots') {
          <div class="dots-loader">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
        }
        @case ('pulse') {
          <div class="pulse-loader">
            <div class="pulse-ring"></div>
            <div class="pulse-ring"></div>
            <div class="pulse-ring"></div>
          </div>
        }
        @case ('cognizant') {
          <div class="cognizant-loader">
            <div class="cognizant-ring"></div>
            <div class="cognizant-text">CTS</div>
          </div>
        }
        @default {
          <div class="spinner" [style.width.px]="size" [style.height.px]="size"></div>
        }
      }
      @if (text) {
        <div class="loader-text">{{ text }}</div>
      }
    </div>
  `,
  styles: [`
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
    }
    
    .loader-container.fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(8px);
      z-index: 9999;
    }
    
    .loader-container.inline {
      padding: var(--space-6);
    }
    
    /* Spinner Loader */
    .spinner {
      border: 3px solid var(--gray-200);
      border-top: 3px solid var(--cognizant-blue);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Dots Loader */
    .dots-loader {
      display: flex;
      gap: var(--space-2);
    }
    
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--cognizant-blue);
      animation: dots-bounce 1.4s infinite both;
    }
    
    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }
    .dot:nth-child(3) { animation-delay: 0s; }
    
    @keyframes dots-bounce {
      0%, 80%, 100% {
        transform: scale(0.8);
        opacity: 0.5;
      }
      40% {
        transform: scale(1.2);
        opacity: 1;
      }
    }
    
    /* Pulse Loader */
    .pulse-loader {
      position: relative;
      width: 60px;
      height: 60px;
    }
    
    .pulse-ring {
      position: absolute;
      border: 2px solid var(--cognizant-blue);
      border-radius: 50%;
      animation: pulse-ring 2s ease-out infinite;
    }
    
    .pulse-ring:nth-child(1) {
      animation-delay: 0s;
    }
    .pulse-ring:nth-child(2) {
      animation-delay: 0.7s;
    }
    .pulse-ring:nth-child(3) {
      animation-delay: 1.4s;
    }
    
    @keyframes pulse-ring {
      0% {
        width: 30px;
        height: 30px;
        top: 15px;
        left: 15px;
        opacity: 1;
      }
      100% {
        width: 60px;
        height: 60px;
        top: 0px;
        left: 0px;
        opacity: 0;
      }
    }
    
    /* Cognizant Loader */
    .cognizant-loader {
      position: relative;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .cognizant-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 3px solid transparent;
      border-top: 3px solid var(--cognizant-blue);
      border-right: 3px solid var(--cognizant-cyan);
      border-radius: 50%;
      animation: cognizant-spin 1.5s linear infinite;
    }
    
    .cognizant-text {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--cognizant-navy);
      animation: pulse 2s infinite;
    }
    
    @keyframes cognizant-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loader-text {
      font-size: var(--font-size-sm);
      color: var(--gray-600);
      font-weight: 500;
      text-align: center;
      animation: pulse 2s infinite;
    }
  `]
})
export class LoaderComponent {
  @Input() type: 'spinner' | 'dots' | 'pulse' | 'cognizant' = 'spinner';
  @Input() size: number = 40;
  @Input() text?: string;
  @Input() containerClass?: string;
}
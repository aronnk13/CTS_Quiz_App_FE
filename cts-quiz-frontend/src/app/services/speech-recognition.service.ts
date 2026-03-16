import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: any;
  private isListening = new BehaviorSubject<boolean>(false);
  public isListening$ = this.isListening.asObservable();

  private recognizedText = new BehaviorSubject<string>('');
  public recognizedText$ = this.recognizedText.asObservable();

  private isSupported = new BehaviorSubject<boolean>(false);
  public isSupported$ = this.isSupported.asObservable();

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition(): void {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      this.isSupported.next(true);
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening.next(true);
        console.log('Speech recognition started');
      };

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          this.recognizedText.next(finalTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.isListening.next(false);
        
        // Handle specific errors
        switch (event.error) {
          case 'no-speech':
            this.recognizedText.next('No speech detected. Please try again.');
            break;
          case 'network':
            this.recognizedText.next('Network error. Please check your connection.');
            break;
          case 'not-allowed':
            this.recognizedText.next('Microphone access denied. Please enable microphone permissions.');
            break;
          default:
            this.recognizedText.next('Speech recognition error. Please try again.');
        }
      };

      this.recognition.onend = () => {
        this.isListening.next(false);
        console.log('Speech recognition ended');
      };

    } else {
      this.isSupported.next(false);
      console.warn('Speech recognition not supported in this browser');
    }
  }

  startListening(): void {
    if (this.recognition && this.isSupported.value && !this.isListening.value) {
      try {
        this.recognizedText.next(''); // Clear previous text
        this.recognition.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        this.isListening.next(false);
      }
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening.value) {
      this.recognition.stop();
    }
  }

  toggleListening(): void {
    if (this.isListening.value) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  clearRecognizedText(): void {
    this.recognizedText.next('');
  }

  // Text to speech functionality
  speak(text: string, lang: string = 'en-US'): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      // Cancel any previous speech
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } else {
      console.warn('Text-to-speech not supported in this browser');
    }
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }
}
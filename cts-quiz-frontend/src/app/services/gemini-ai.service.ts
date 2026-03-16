import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
}

export interface QuizGenerationRequest {
  topic: string;
  numberOfQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timer?: number;
  category?: string;
}

export interface GeneratedQuiz {
  title: string;
  description: string;
  category: string;
  timer: number;
  questions: GeneratedQuestion[];
}

export interface GeneratedQuestion {
  questionText: string;
  questionType: 'multiple-choice' | 'true-false';
  options: string[];
  correctAnswer: string;
  explanation?: string;
  points: number;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiAiService {
  private readonly GEMINI_API_KEY = 'AIzaSyAmOKabSsL74i2MuE8-YXjpyai_0Vmm2PM';
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  
  private chatMessages = new BehaviorSubject<ChatMessage[]>([]);
  public chatMessages$ = this.chatMessages.asObservable();

  private isDarkMode = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.isDarkMode.asObservable();

  private authService = inject(AuthService);

  constructor(private http: HttpClient) {
    this.initializeDarkMode();
  }

  private initializeDarkMode(): void {
    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode.next(savedTheme === 'dark');
    this.applyTheme(savedTheme === 'dark');
  }

  toggleDarkMode(): void {
    const newMode = !this.isDarkMode.value;
    this.isDarkMode.next(newMode);
    this.applyTheme(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  }

  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        content: message,
        sender: 'user',
        timestamp: new Date()
      };

      const currentMessages = this.chatMessages.value;
      this.chatMessages.next([...currentMessages, userMessage]);

      // Add typing indicator
      const typingMessage: ChatMessage = {
        id: 'typing',
        content: 'AI is thinking...',
        sender: 'assistant',
        timestamp: new Date(),
        isTyping: true
      };
      this.chatMessages.next([...this.chatMessages.value, typingMessage]);

      const response = await this.callGeminiAPI(message);
      
      // Remove typing indicator and add real response
      const messagesWithoutTyping = this.chatMessages.value.filter(m => m.id !== 'typing');
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'assistant',
        timestamp: new Date()
      };

      this.chatMessages.next([...messagesWithoutTyping, assistantMessage]);
      return response;

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      
      // Remove typing indicator and add error message
      const messagesWithoutTyping = this.chatMessages.value.filter(m => m.id !== 'typing');
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: errorMessage,
        sender: 'assistant',
        timestamp: new Date()
      };

      this.chatMessages.next([...messagesWithoutTyping, errorMsg]);
      return errorMessage;
    }
  }

  private async callGeminiAPI(message: string): Promise<string> {
    // Use backend AI endpoint instead of direct Gemini API call
    const requestBody = {
      message: message
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getAuthToken()}`
    });

    try {
      const response = await this.http.post<any>(`${environment.apiUrl}${environment.apiEndpoints.ai}/chat`, requestBody, { headers }).toPromise();
      console.log('Backend AI Response:', response);
      return response.message || 'No response received';
    } catch (error) {
      console.error('Backend AI Error:', error);
      // Fallback to direct API call if backend fails
      return this.callDirectGeminiAPI(message);
    }
  }

  private getAuthToken(): string {
    return this.authService.getToken() || '';
  }

  private async callDirectGeminiAPI(message: string): Promise<string> {
    const systemPrompt = `You are an AI assistant for a Quiz Management System. You help hosts create quizzes, manage questions, and provide system guidance. You can:

1. **Create Quiz**: Generate quizzes on any topic with questions, options, correct answers, and timers
2. **Theme Control**: Switch between light and dark themes
3. **System Help**: Guide users through the quiz platform features
4. **Quiz Management**: Help with quiz creation, editing, and publishing

Available Commands:
- "create quiz about [topic]" - Generate a complete quiz
- "dark mode" or "light mode" - Change theme
- "help" - Show available features
- General questions about quiz management

Please provide helpful, concise responses. If the user wants to create a quiz, ask for:
- Topic/Subject
- Number of questions (default: 10)
- Difficulty level (easy/medium/hard)
- Timer per question (default: 30 seconds)

Current user message: "${message}"`;

    const requestBody = {
      contents: [{
        parts: [{
          text: systemPrompt
        }]
      }]
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-goog-api-key': this.GEMINI_API_KEY
    });

    const url = this.GEMINI_API_URL;

    console.log('Direct Gemini API Request:', { url: this.GEMINI_API_URL, hasKey: !!this.GEMINI_API_KEY });

    try {
      const response = await this.http.post<any>(url, requestBody, { headers }).toPromise();
      console.log('Direct Gemini API Response:', response);
      return response.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Direct Gemini API Error:', error);
      throw error;
    }
  }

  async generateQuiz(request: QuizGenerationRequest): Promise<GeneratedQuiz> {
    const prompt = `Create a complete quiz with the following specifications:
    
Topic: ${request.topic}
Number of Questions: ${request.numberOfQuestions}
Difficulty: ${request.difficulty}
Timer per Question: ${request.timer || 30} seconds
Category: ${request.category || 'General'}

Please generate a JSON response with this exact structure:
{
  "title": "Quiz title",
  "description": "Quiz description",
  "category": "${request.category || 'General'}",
  "timer": ${request.timer || 30},
  "questions": [
    {
      "questionText": "Question text here?",
      "questionType": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Correct option text",
      "explanation": "Brief explanation of the correct answer",
      "points": 10
    }
  ]
}

Make sure all questions are well-formed with exactly 4 options for multiple-choice questions. The correctAnswer should match exactly one of the options.`;

    try {
      const response = await this.callGeminiAPI(prompt);
      // Extract JSON from the response
      const jsonMatch = response.match(/```json\n(.*?)\n```/s) || response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonString);
      } else {
        // Fallback parsing
        const cleanedResponse = response.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanedResponse);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      throw new Error('Failed to generate quiz. Please try again.');
    }
  }

  clearChat(): void {
    this.chatMessages.next([]);
  }

  addWelcomeMessage(hostName: string): void {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      content: `Welcome, ${hostName}! 👋 I'm your AI assistant. I can help you:

🎯 Create quizzes on any topic
🎨 Change and customize themes
🌓 Switch between dark/light mode
📚 Manage your quiz content
❓ Answer questions about the platform

**Theme Commands:**
• "List themes" - See all available themes
• "Change theme to [name]" - Apply a specific theme
• "Open themes page" - Go to theme customization

**Quick Actions:**
• "Create a quiz about JavaScript"
• "Switch to dark mode"
• "Show available themes"

What can I help you with today?`,
      sender: 'assistant',
      timestamp: new Date()
    };

    this.chatMessages.next([welcomeMessage]);
  }
}
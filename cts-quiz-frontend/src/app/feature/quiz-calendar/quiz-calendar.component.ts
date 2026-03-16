import { Component, OnInit, signal, inject, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarService } from '../../services/calendar.service';
import { AuthService } from '../../services/auth.service';
import { CalendarDate, QuizCalendar } from '../../models/calendar.models';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, format, addMonths, subMonths } from 'date-fns';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasQuizzes: boolean;
  currentHostQuizCount: number;
  otherHostsQuizCount: number;
  quizzes: QuizCalendar[];
}

@Component({
  selector: 'app-quiz-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-calendar.component.html',
  styleUrls: ['./quiz-calendar.component.css']
})
export class QuizCalendarComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  
  private calendarService = inject(CalendarService);
  private authService = inject(AuthService);
  
  currentMonth = signal<Date>(new Date());
  calendarDays = signal<CalendarDay[]>([]);
  selectedDate = signal<Date | null>(null);
  selectedDateQuizzes = signal<QuizCalendar[]>([]);
  loading = signal(false);
  
  // Get current user info
  currentUser = this.authService.currentUser;
  currentHostId = computed(() => {
    const user = this.currentUser();
    if (!user?.employeeId) {
      console.error('[QuizCalendar] No user logged in');
      return '';
    }
    return user.employeeId;
  });
  
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  ngOnInit(): void {
    this.loadCalendarData();
  }
  
  async loadCalendarData(): Promise<void> {
    this.loading.set(true);
    try {
      console.log('[QuizCalendar] Loading published quiz data for host:', this.currentHostId());
      
      // Get published quizzes from the Publish table
      const publishedQuizzes = await this.calendarService.getPublishedQuizzes(this.currentHostId());
      console.log('[QuizCalendar] Published quizzes:', publishedQuizzes);
      
      // Generate calendar dates based on current month
      this.generateCalendarFromQuizzes(publishedQuizzes);
      this.loading.set(false);
    } catch (error) {
      console.error('[QuizCalendar] Error loading calendar data:', error);
      this.generateCalendarFromQuizzes([]);
      this.loading.set(false);
    }
  }
  
  generateCalendarFromQuizzes(quizzes: QuizCalendar[]): void {
    const month = this.currentMonth();
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days: CalendarDay[] = [];
    let currentDate = startDate;
    
    while (currentDate <= endDate) {
      const dateQuizzes = quizzes.filter(q => 
        q.publishedDate && isSameDay(new Date(q.publishedDate), currentDate)
      );
      
      const currentHostQuizzes = dateQuizzes.filter(q => q.isCurrentHost);
      const otherHostQuizzes = dateQuizzes.filter(q => !q.isCurrentHost);
      
      days.push({
        date: new Date(currentDate),
        isCurrentMonth: isSameMonth(currentDate, month),
        isToday: isSameDay(currentDate, new Date()),
        hasQuizzes: dateQuizzes.length > 0,
        currentHostQuizCount: currentHostQuizzes.length,
        otherHostsQuizCount: otherHostQuizzes.length,
        quizzes: dateQuizzes
      });
      
      currentDate = addDays(currentDate, 1);
    }
    
    console.log('[QuizCalendar] Generated calendar days:', days);
    this.calendarDays.set(days);
  }
  
  previousMonth(): void {
    this.currentMonth.set(subMonths(this.currentMonth(), 1));
    this.loadCalendarData();
  }
  
  nextMonth(): void {
    this.currentMonth.set(addMonths(this.currentMonth(), 1));
    this.loadCalendarData();
  }
  
  selectDate(day: CalendarDay): void {
    if (day.hasQuizzes) {
      this.selectedDate.set(day.date);
      this.selectedDateQuizzes.set(day.quizzes);
    }
  }
  
  closeDetails(): void {
    this.selectedDate.set(null);
    this.selectedDateQuizzes.set([]);
  }
  
  closeCalendar(): void {
    this.close.emit();
  }
  
  getMonthYear(): string {
    return format(this.currentMonth(), 'MMMM yyyy');
  }
  
  getDayNumber(day: CalendarDay): number {
    return day.date.getDate();
  }
  
  isSameDay(date1: Date, date2: Date): boolean {
    return isSameDay(date1, date2);
  }
}

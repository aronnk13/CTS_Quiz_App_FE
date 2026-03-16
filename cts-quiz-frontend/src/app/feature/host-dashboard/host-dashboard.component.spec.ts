import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HostDashboardComponent } from './host-dashboard.component';
import { AddQuestionService } from '../../services/add-question.service';

describe('HostDashboardComponent', () => {
  let component: HostDashboardComponent;
  let fixture: ComponentFixture<HostDashboardComponent>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockQuizService: jasmine.SpyObj<AddQuestionService>;

  beforeEach(async () => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const quizServiceSpy = jasmine.createSpyObj('AddQuestionService', ['getQuestionsSignal']);

    await TestBed.configureTestingModule({
      imports: [HostDashboardComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AddQuestionService, useValue: quizServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HostDashboardComponent);
    component = fixture.componentInstance;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockQuizService = TestBed.inject(AddQuestionService) as jasmine.SpyObj<AddQuestionService>;
    
    // Mock the signal
    mockQuizService.questions.and.returnValue([]);
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load dashboard data on init', () => {
    expect(component.stats()).toBeDefined();
  });

  it('should navigate to action', () => {
    const action = {
      id: 'create-quiz',
      title: 'Create Quiz',
      description: 'Test',
      icon: 'fas fa-brain',
      route: '/host/addquestion',
      params: { tab: 'questions' },
      color: '#0066CC',
      gradient: 'linear-gradient(135deg, #0066CC 0%, #004999 100%)'
    };

    component.navigateToAction(action);
    expect(mockRouter.navigate).toHaveBeenCalledWith([action.route], { queryParams: action.params });
  });

  it('should navigate back', () => {
    component.navigateBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });
});
import { TestBed } from '@angular/core/testing';
import { QuizPublishService } from './quiz-publish.service';

describe('QuizPublishService', () => {
  let service: QuizPublishService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuizPublishService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

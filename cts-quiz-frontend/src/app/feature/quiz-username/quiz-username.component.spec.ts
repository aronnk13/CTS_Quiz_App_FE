import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizUsernameComponent } from './quiz-username.component';

describe('QuizUsernameComponent', () => {
  let component: QuizUsernameComponent;
  let fixture: ComponentFixture<QuizUsernameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizUsernameComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizUsernameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultPollComponent } from './result-poll.component';

describe('ResultPollComponent', () => {
  let component: ResultPollComponent;
  let fixture: ComponentFixture<ResultPollComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultPollComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultPollComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

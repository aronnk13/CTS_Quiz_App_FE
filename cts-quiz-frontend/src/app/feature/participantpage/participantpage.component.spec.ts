import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParticipantpageComponent } from './participantpage.component';

describe('ParticipantpageComponent', () => {
  let component: ParticipantpageComponent;
  let fixture: ComponentFixture<ParticipantpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticipantpageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParticipantpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

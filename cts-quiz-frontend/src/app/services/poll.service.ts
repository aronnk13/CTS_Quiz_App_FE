import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Poll, PollResult, CreatePollRequest, PollVoteSubmission, ClosePollResponse, PollVoteResponse, CreatePollApiRequest, PollOverview } from '../models/ipoll';

@Injectable({
  providedIn: 'root'
})
export class PollService {
  private baseUrl = `${environment.apiUrl}/Host/Poll`;
  private apiBaseV2 = `${environment.apiUrl}/Host/Poll`;

  constructor(private http: HttpClient) {}

  // Create poll - accepts payload in PascalCase format
  createPoll(poll: any): Observable<PollOverview> {
    // Validate required fields (checking PascalCase properties)
    if (!poll.PollTitle || poll.PollTitle.trim().length === 0) {
      return throwError(() => new Error('Poll title is required.'));
    }
    
    if (!poll.PollQuestion || poll.PollQuestion.trim().length === 0) {
      return throwError(() => new Error('Poll question is required.'));
    }
    
    if (!poll.Options || poll.Options.length === 0) {
      return throwError(() => new Error('Poll must have at least one option.'));
    }

    // Validate each option has a label
    for (let i = 0; i < poll.Options.length; i++) {
      if (!poll.Options[i].OptionLabel || poll.Options[i].OptionLabel.trim().length === 0) {
        return throwError(() => new Error(`Option ${i + 1}: Label is required.`));
      }
    }
    
    if (!poll.SelectionType || poll.SelectionType.trim().length === 0) {
      return throwError(() => new Error('Selection type is required.'));
    }
    
    // Payload is already in PascalCase format from component, just pass it through
    const payload: any = {
      SessionId: poll.SessionId,
      PollTitle: poll.PollTitle.trim(),
      PollQuestion: poll.PollQuestion.trim(),
      PollAnonymous: poll.PollAnonymous || false,
      PollStatus: poll.PollStatus || 'draft',
      SelectionType: poll.SelectionType,
      Options: poll.Options
    };

    console.log('📤 Sending Create Poll payload to backend:', JSON.stringify(payload, null, 2));
    console.log('📤 Payload type check:', {
      SessionId: typeof payload.SessionId,
      PollTitle: typeof payload.PollTitle,
      PollQuestion: typeof payload.PollQuestion,
      PollAnonymous: typeof payload.PollAnonymous,
      PollStatus: typeof payload.PollStatus,
      SelectionType: typeof payload.SelectionType,
      Options: Array.isArray(payload.Options) ? 'array' : typeof payload.Options,
      optionsCount: payload.Options?.length
    });
    return this.createPollV2(payload);
  }

  // Create poll (v2 backend)
  createPollV2(poll: CreatePollApiRequest): Observable<PollOverview> {
    return this.http.post<any>(this.apiBaseV2, poll).pipe(
      map((response) => {
        console.log('✅ Poll created successfully:', response);
        return this.mapPollOverview(response);
      }),
      // Use catchError to provide better error messages
      catchError((error) => {
        console.error('❌ Poll creation failed:', {
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message,
          error: error?.error,
          url: error?.url
        });
        throw error;
      })
    );
  }

  // Get all polls
  getAllPolls(): Observable<PollOverview[]> {
    return this.getAllPollsV2();
  }

  // Get poll by ID
  getPollById(pollId: number): Observable<PollOverview> {
    return this.http.get<any>(`${this.apiBaseV2}/${pollId}`).pipe(
      map((response) => this.mapPollOverview(response))
    );
  }

  // Get all polls (v2 backend)
  getAllPollsV2(): Observable<PollOverview[]> {
    return this.http.get<any[]>(this.apiBaseV2).pipe(
      map((items) => (items || []).map((item) => this.mapPollOverview(item)))
    );
  }

  private mapPollOverview(source: any): PollOverview {
    return {
      pollId: source?.pollId ?? source?.PollId,
      sessionId: source?.sessionId ?? source?.SessionId,
      sessionCode: source?.sessionCode ?? source?.SessionCode ?? null,
      pollTitle: source?.pollTitle ?? source?.PollTitle ?? '',
      pollQuestion: source?.pollQuestion ?? source?.PollQuestion ?? '',
      pollAnonymous: source?.pollAnonymous ?? source?.PollAnonymous ?? false,
      pollStatus: source?.pollStatus ?? source?.PollStatus ?? 'draft',
      selectionType: source?.selectionType ?? source?.SelectionType ?? 'single',
      options: (source?.options ?? source?.Options ?? []).map((opt: any) => ({
        optionId: opt?.optionId ?? opt?.OptionId,
        optionLabel: opt?.optionLabel ?? opt?.OptionLabel ?? '',
        optionOrder: opt?.optionOrder ?? opt?.OptionOrder ?? 0
      }))
    };
  }

  // Get polls by session
  getPollsBySession(sessionId: number): Observable<PollOverview> {
    return this.getParticipantPollBySession(sessionId);
  }

  // Get poll results
  getPollResults(pollId: number): Observable<PollResult> {
    return this.http.get<PollResult>(`${environment.apiUrl}/Participate/Poll/poll/${pollId}/results`);
  }

  // Close poll
  closePoll(pollId: number): Observable<ClosePollResponse> {
    return this.http.post<ClosePollResponse>(`${this.baseUrl}/close/${pollId}`, {});
  }

  // Submit poll vote (participant) - uses unified submit-answer endpoint
  submitPollAnswer(request: { participantId: number, questionId: number, selectedOptionId: number, timeSpentSeconds: number }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/Participate/Session/submit-answer`, request);
  }

  // Legacy method - kept for backward compatibility
  submitPollVote(vote: PollVoteSubmission): Observable<PollVoteResponse> {
    return this.http.post<PollVoteResponse>(`${environment.apiUrl}/Participate/Poll/vote`, vote);
  }

  // Participant: get poll by session
  getParticipantPollBySession(sessionId: number): Observable<PollOverview> {
    return this.http.get<any>(`${environment.apiUrl}/Participate/Poll/session/${sessionId}`).pipe(
      map((response) => this.mapPollOverview(response))
    );
  }

  // Participant: get poll responses for a participant
  getPollResponsesByParticipant(participantId: number, pollId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/Participate/Poll/responses/participant/${participantId}/poll/${pollId}`);
  }

  // Publish a poll (wrapper for backend POST /{id}/publish)
  publishPoll(pollId: number, payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiBaseV2}/${pollId}/publish`, payload);
  }

  // Schedule a poll (alias to publish with scheduling fields)
  schedulePoll(pollId: number, scheduledStart: Date, scheduledEnd: Date | null, countdownSeconds: number): Observable<any> {
    const body = {
      scheduledStartTime: scheduledStart.toISOString(),
      scheduledEndTime: scheduledEnd ? scheduledEnd.toISOString() : undefined,
      countdownDurationSeconds: countdownSeconds
    };
    return this.http.post<any>(`${this.apiBaseV2}/${pollId}/publish`, body);
  }

  // Complete poll (mark as completed)
  completePoll(pollId: number): Observable<any> {
    return this.http.post<any>(`${this.apiBaseV2}/${pollId}/complete`, {});
  }

  // Update poll
  updatePoll(pollId: number, poll: CreatePollApiRequest): Observable<PollOverview> {
    console.log('📤 Updating poll with ID:', pollId, 'Payload:', JSON.stringify(poll, null, 2));
    return this.http.put<any>(`${this.apiBaseV2}/${pollId}`, poll).pipe(
      map((response) => {
        console.log('✅ Poll updated successfully:', response);
        return this.mapPollOverview(response);
      }),
      catchError((error) => {
        console.error('❌ Poll update failed:', error);
        throw error;
      })
    );
  }

  // Delete poll
  deletePoll(pollId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiBaseV2}/${pollId}`);
  }
}

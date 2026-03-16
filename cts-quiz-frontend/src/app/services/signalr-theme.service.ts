// import { Injectable } from '@angular/core';

// @Injectable({
//   providedIn: 'root'
// })
// export class SignalrThemeService {

//   constructor() { }
// }


import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { ThemeModel } from '../models/theme.model';

@Injectable({ providedIn: 'root' })
export class SignalrThemeService {
  private connection?: signalR.HubConnection;

  async connect(): Promise<void> {
    if (this.connection) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.signalRUrl)
      .withAutomaticReconnect()
      .build();

    await this.connection.start();
  }

  async joinRoom(roomId: string): Promise<void> {
    if (!this.connection) await this.connect();
    // Must match backend Hub method
    await this.connection!.invoke('JoinRoom', roomId);
  }

  // ===== SESSION-BASED METHODS =====
  
  async joinSession(sessionCode: string): Promise<void> {
    if (!this.connection) await this.connect();
    console.log('🔗 SignalR: Joining session', sessionCode);
    await this.connection!.invoke('JoinSession', sessionCode);
  }

  async leaveSession(sessionCode: string): Promise<void> {
    if (!this.connection) await this.connect();
    console.log('🔗 SignalR: Leaving session', sessionCode);
    await this.connection!.invoke('LeaveSession', sessionCode);
  }

  onThemeChanged(handler: (theme: ThemeModel) => void) {
    // Must match backend event name
    this.connection?.on('ThemeChanged', (theme: ThemeModel) => handler(theme));
  }

  offThemeChanged() {
    this.connection?.off('ThemeChanged');
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;
    await this.connection.stop();
    this.connection = undefined;
  }
}

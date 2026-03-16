import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private sidebarCollapsed = new BehaviorSubject<boolean>(false);
  public sidebarCollapsed$ = this.sidebarCollapsed.asObservable();

  toggleSidebar(): void {
    this.sidebarCollapsed.next(!this.sidebarCollapsed.value);
  }

  getSidebarState(): boolean {
    return this.sidebarCollapsed.value;
  }
}

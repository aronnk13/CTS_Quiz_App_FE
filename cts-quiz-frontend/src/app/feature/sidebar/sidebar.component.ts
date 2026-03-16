import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  userName: string = 'User';
  userEmail: string = '';
  userRole: string = '';
  isCollapsed: boolean = false;
  
  constructor(
    private router: Router,
    private authService: AuthService,
    private sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
    this.sidebarService.sidebarCollapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
    });
  }

  loadUserInfo(): void {
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.userName = payload.name || payload.unique_name || 'User';
        this.userEmail = payload.email || '';
        const roles = this.authService.getRoles();
        this.userRole = roles[0] || 'User';
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
  }

  onTemplateClick() {
    console.log('Template link clicked');
    console.log('Current URL:', this.router.url);
    console.log('Navigating to /template');
  }
}

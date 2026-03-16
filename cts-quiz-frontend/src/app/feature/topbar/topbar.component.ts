import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';


@Component({
  selector: 'app-topbar',
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css'
})
export class TopbarComponent implements OnInit {
  showProfileDropdown = false;
  userName: string = 'User';
  userInitial: string = 'U';
  userProfilePhoto: string | null = null;
 
  constructor(
    private authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
  }

  loadUserInfo(): void {
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.userName = payload.name || payload.unique_name || 'User';
        this.userInitial = this.userName.charAt(0).toUpperCase();
        
        // Check if user has uploaded a profile photo
        const employeeId = this.authService.getCurrentEmployeeId();
        const storedPhoto = localStorage.getItem(`profile_photo_${employeeId}`);
        this.userProfilePhoto = storedPhoto;
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
  }

  toggleProfileDropdown() {
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  handleLogout(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    console.log('🚪 Logout button clicked');
    this.closeDropdown();
    this.logout();
  }

  logout() {
    console.log('🔓 Logout function called');
    const confirmation = confirm('Are you sure you want to logout?');
    console.log('✅ User confirmation:', confirmation);
    
    if (confirmation) {
      try {
        console.log('🗑️ Clearing authentication data...');
        
        // Clear auth service data
        this.authService.logout();
        
        // Additional cleanup - clear all storage
        localStorage.clear();
        sessionStorage.clear();
        
        console.log('✅ Auth data cleared successfully');
        console.log('🔄 Redirecting to login page...');
        
        // Navigate to login and replace history to prevent back button
        this.router.navigate(['/login'], { replaceUrl: true }).then(() => {
          // Clear browser history without reload
          window.history.replaceState(null, '', '/login');
        });
      } catch (error) {
        console.error('❌ Error during logout:', error);
        // Force redirect even if there's an error
        window.location.href = '/login';
      }
    } else {
      console.log('❌ Logout cancelled by user');
    }
  }

  // Close dropdown when clicking outside
  closeDropdown() {
    this.showProfileDropdown = false;
  }
}

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css'
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = []; // Initialize as empty array
  showForm = false;
  isEditing = false;
  selectedUser: User | null = null;
  showDetails = false;
  roles = ['Admin', 'Host', 'Participant'];
  selectedRoleFilter: string = 'All'; // Default: show all roles
  roleMap: { [key: string]: number } = {
    'Admin': 1,
    'Host': 2,
    'Participant': 3
  };

  newUser: User = {
    employeeId: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'Participant',
    isActive: true
  };

  currentEmployeeId: string | null = null;
  profilePhotoPreview: string | null = null;
  selectedPhotoFile: File | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.currentEmployeeId = this.authService.getCurrentEmployeeId();
    console.log('Current logged-in admin:', this.currentEmployeeId);
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        console.log('Users loaded:', this.users);
        console.log('Users count:', this.users.length);
        
        // Ensure filtered users is set with all users on initial load
        this.selectedRoleFilter = 'All';
        
        // Use setTimeout to ensure change detection happens after async operation
        setTimeout(() => {
          this.applyRoleFilter();
          this.cdr.detectChanges();
          console.log('Filtered users after apply:', this.filteredUsers);
          console.log('Filtered users count:', this.filteredUsers.length);
        }, 0);
      },
      error: (err) => {
        console.error('Error loading users:', err);
        alert('Failed to load users');
      }
    });
  }

  /**
   * Filter users by selected role
   */
  applyRoleFilter(): void {
    console.log('Applying filter. selectedRoleFilter:', this.selectedRoleFilter);
    console.log('Total users:', this.users.length);
    
    if (this.selectedRoleFilter === 'All') {
      // Create a copy of users array to ensure change detection
      this.filteredUsers = this.users && this.users.length > 0 ? [...this.users] : [];
      console.log('Filter is All - showing all users:', this.filteredUsers.length);
    } else {
      this.filteredUsers = this.users && this.users.length > 0 
        ? this.users.filter(user => user.role === this.selectedRoleFilter)
        : [];
      console.log('Filter is', this.selectedRoleFilter, '- showing', this.filteredUsers.length, 'users');
    }
    
    console.log('Filtered users result:', this.filteredUsers);
    console.log('Selected filter:', this.selectedRoleFilter);
    // Trigger change detection
    this.cdr.markForCheck();
  }

  /**
   * Called when role filter is changed
   */
  onRoleFilterChange(): void {
    this.applyRoleFilter();
  }

  openAddForm(): void {
    this.showForm = true;
    this.isEditing = false;
    this.newUser = {
      employeeId: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'Participant',
      isActive: true
    };
  }

  openEditForm(user: User): void {
    this.showForm = true;
    this.isEditing = true;
    this.newUser = { ...user };
    
    // Load existing profile photo if editing own profile
    if (user.employeeId === this.currentEmployeeId) {
      const storedPhoto = localStorage.getItem(`profile_photo_${user.employeeId}`);
      this.profilePhotoPreview = storedPhoto;
    } else {
      this.profilePhotoPreview = null;
    }
    this.selectedPhotoFile = null;
  }

  onPhotoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      this.selectedPhotoFile = file;

      // Preview the image
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profilePhotoPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    if (confirm('Are you sure you want to remove your profile photo?')) {
      this.profilePhotoPreview = null;
      this.selectedPhotoFile = null;
      
      // Remove from localStorage
      if (this.currentEmployeeId) {
        localStorage.removeItem(`profile_photo_${this.currentEmployeeId}`);
      }
    }
  }

  saveUser(): void {
    if (!this.newUser.email || !this.newUser.firstName || !this.newUser.lastName) {
      alert('Please fill in all required fields');
      return;
    }

    if (this.isEditing) {
      const oldUser = this.users.find(u => u.employeeId === this.newUser.employeeId);
      
      // 🔒 Check if trying to deactivate self
      if (this.newUser.employeeId === this.currentEmployeeId && this.newUser.isActive === false) {
        alert('⚠️ You cannot deactivate your own account while logged in.\n\nPlease ask another administrator to deactivate your account.');
        return;
      }

      // 🔒 Check if trying to deactivate last active admin
      if (oldUser?.role === 'Admin' && oldUser.isActive === true && this.newUser.isActive === false) {
        const activeAdmins = this.users.filter(u => 
          u.role === 'Admin' && u.isActive === true && u.employeeId !== this.newUser.employeeId
        );
        
        if (activeAdmins.length === 0) {
          alert('⚠️ Cannot deactivate the last active administrator.\n\nThe system must always have at least one active admin account.');
          return;
        }
      }

      // 🔒 Warn if deactivating admin
      if (oldUser?.role === 'Admin' && this.newUser.isActive === false) {
        if (!confirm('⚠️ WARNING: You are about to DEACTIVATE an admin account.\n\nThis user will be immediately logged out and cannot login until reactivated.\n\nContinue?')) {
          return;
        }
      }

      this.userService.updateUser(this.newUser.employeeId, this.newUser).subscribe({
        next: (updated) => {
          // Save profile photo if uploaded and editing own profile
          if (this.selectedPhotoFile && this.newUser.employeeId === this.currentEmployeeId && this.profilePhotoPreview) {
            localStorage.setItem(`profile_photo_${this.newUser.employeeId}`, this.profilePhotoPreview);
            console.log('✅ Profile photo saved for user:', this.newUser.employeeId);
          }
          
          // Check if role changed and update it
          if (oldUser && oldUser.role !== this.newUser.role && this.newUser.role) {
            // Update role and reload
            this.updateRole(this.newUser.employeeId, this.newUser.role);
          } else {
            // Just reload to get fresh data
            this.loadUsers();
          }
          
          this.closeForm();
          alert('User updated successfully');
          
          // Reload page if user updated their own profile photo to reflect in topbar
          if (this.selectedPhotoFile && this.newUser.employeeId === this.currentEmployeeId) {
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        },
        error: (err) => {
          console.error('Error updating user:', err);
          alert('Failed to update user');
        }
      });
    } else {
      this.userService.createUser(this.newUser).subscribe({
        next: (created) => {
          // Assign the selected role after creation
          this.updateRole(created.employeeId, this.newUser.role || 'Participant');
          this.closeForm();
          alert('User created successfully');
        },
        error: (err) => {
          console.error('Error creating user:', err);
          alert('Failed to create user');
        }
      });
    }
  }

  deleteUser(id: string): void {
    // 🔒 Prevent self-deletion
    if (id === this.currentEmployeeId) {
      alert('⚠️ You cannot delete your own account while logged in.\n\nPlease ask another administrator to remove your account.');
      return;
    }

    const userToDelete = this.users.find(u => u.employeeId === id);
    if (!userToDelete) return;

    // 🔒 Check if this is the last active admin
    const isAdmin = userToDelete.role === 'Admin';
    if (isAdmin) {
      const activeAdmins = this.users.filter(u => 
        u.role === 'Admin' && u.isActive === true && u.employeeId !== id
      );
      
      if (activeAdmins.length === 0) {
        alert('⚠️ Cannot delete the last active administrator.\n\nThe system must always have at least one active admin account.');
        return;
      }
    }

    const confirmMsg = isAdmin 
      ? `⚠️ WARNING: You are about to delete an ADMIN account.\n\nUser: ${userToDelete.firstName} ${userToDelete.lastName}\nEmail: ${userToDelete.email}\n\nThis action cannot be undone. Continue?`
      : `Are you sure you want to delete this user?\n\nUser: ${userToDelete.firstName} ${userToDelete.lastName}\nEmail: ${userToDelete.email}`;

    if (confirm(confirmMsg)) {
      this.userService.deleteUser(id).subscribe({
        next: () => {
          this.users = this.users.filter(u => u.employeeId !== id);
          this.applyRoleFilter(); // Reapply filter after deletion
          alert('User deleted successfully');
        },
        error: (err) => {
          console.error('Error deleting user:', err);
          alert('Failed to delete user');
        }
      });
    }
  }

  updateRole(employeeId: string, newRole: string): void {
    const roleId = this.roleMap[newRole];
    this.userService.updateUserRole(employeeId, roleId).subscribe({
      next: () => {
        console.log(`Role updated to ${newRole} for user ${employeeId}`);
        // Reload users from backend to get fresh data with updated roles
        this.loadUsers();
      },
      error: (err) => {
        console.error('Error updating role:', err);
        alert('Failed to update role');
      }
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.profilePhotoPreview = null;
    this.selectedPhotoFile = null;
  }

  getUserById(id: string): void {
    this.userService.getUserById(id).subscribe({
      next: (data) => {
        this.selectedUser = data;
        this.showDetails = true;
        console.log('User found:', this.selectedUser);
      },
      error: (err) => {
        console.error('Error fetching user:', err);
        alert('User not found');
      }
    });
  }

  viewUser(id: string): void {
    this.getUserById(id);
  }

  closeDetails(): void {
    this.showDetails = false;
    this.selectedUser = null;
  }
}



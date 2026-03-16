export interface User {
    id?: number; // Database ID
    employeeId: string;
    email: string;
    firstName: string;
    lastName: string;
    name?: string; // Concatenated firstName + lastName
    isActive: boolean; // Changed from status: number to match backend
    role?: string; // Primary role name extracted from roles
    roles?: UserRole[]; // Full role information from backend
    createdAt?: string;
    updatedAt?: string;
}

export interface UserRole {
    roleId: number;
    roleName: string;
}


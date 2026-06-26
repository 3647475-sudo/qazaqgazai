export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  department?: string;
  status: 'online' | 'offline';
  blocked: boolean;
  lastLogin?: number;
  createdAt: number;
}

export interface Employee {
  id: string; // firestore document id
  employeeId: string; // HR employee ID e.g., EMP-001
  fullName: string;
  photoUrl: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  role: UserRole;
  salary: number; // Admin-only visible field
  dateOfBirth: string;
  hireDate: string;
  address: string;
  status: 'active' | 'vacation' | 'fired';
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  changeHistory: {
    id: string;
    timestamp: number;
    updatedBy: string;
    updatedByEmail: string;
    changes: string; // Description of changes
  }[];
}

export interface LoginLog {
  id: string;
  uid: string;
  name: string;
  email: string;
  timestamp: number;
  ipAddress: string;
  device: string;
  browser: string;
  type: 'login' | 'register' | 'logout';
}

export interface Department {
  id: string;
  name: string;
  managerUid?: string;
  description?: string;
  budget?: number;
}

export interface ScheduleEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'shift' | 'weekend' | 'vacation' | 'sick_leave';
  startDate: string;
  endDate: string;
  description?: string;
  approvedBy?: string;
  createdAt: number;
}

export interface DocumentFile {
  id: string;
  name: string;
  url: string;
  type: string; // 'pdf', 'image', 'docx', etc.
  uploadedAt: number;
  uploadedBy: string;
  uploadedByEmail: string;
  size?: number;
  employeeId?: string; // Optional connection to employee profile
}

export interface CorporateNotification {
  id: string;
  title: string;
  message: string;
  type: 'new_employee' | 'user_login' | 'document_upload' | 'profile_change';
  timestamp: number;
  createdBy: string;
  createdByEmail: string;
  readBy: string[]; // List of user UIDs who read it
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  explanation?: string;
  intent?: string;
}

export interface Reminder {
  id: string;
  text: string;
  time?: string;
  completed: boolean;
  createdAt: number;
}

export interface Alarm {
  id: string;
  time: string;
  label: string;
  active: boolean;
  ringDays: string[];
}

export interface HabitLog {
  id: string;
  action: string;
  timestamp: number;
  category: 'alarm' | 'reminder' | 'cmd' | 'chat';
  meta?: string;
}

export interface BridgeLog {
  id: string;
  type: string;
  message: string;
  commandLine: string;
  status: 'pending' | 'executing' | 'completed' | 'success' | 'failed';
  exitCode?: number;
  timestamp: number;
}

export type AppLanguage = 'kk-KZ' | 'ru-RU' | 'en-US';

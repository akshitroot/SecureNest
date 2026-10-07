export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  auth_provider: 'email' | 'google';
  role: 'user' | 'admin';
  created_at?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  two_factor_enabled: boolean;
  security_score: number;
  last_login_at?: string;
  avatar_url?: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  is_trashed: boolean;
  created_at: string;
}

export interface StoredFile {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  file_category: 'Documents' | 'Image' | 'Video' | 'Audio' | 'ZIP' | 'Other';
  size_bytes: number;
  storage_path: string;
  checksum_sha256: string;
  is_favorite: boolean;
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorageBreakdownCategory {
  count: number;
  bytes: number;
  gb: number;
}

export interface DashboardStats {
  storage: {
    usedBytes: number;
    quotaBytes: number;
    usedGB: number;
    quotaGB: number;
    usagePercent: number;
  };
  fileCount: number;
  folderCount: number;
  breakdown: {
    Documents: StorageBreakdownCategory;
    Image: StorageBreakdownCategory;
    Video: StorageBreakdownCategory;
    Audio: StorageBreakdownCategory;
    ZIP: StorageBreakdownCategory;
    Other?: StorageBreakdownCategory;
  };
  recentFiles: StoredFile[];
  profile?: Profile;
}

export interface AuditLog {
  id: string;
  user_id: string;
  event_type: string;
  details: string;
  ip_address: string;
  user_agent: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

export interface SecurityOverview {
  securityScore: number;
  twoFactorEnabled: boolean;
  authProvider: string;
  recentLogins: AuditLog[];
  securityEvents: Array<{
    id: string;
    event_type: string;
    description: string;
    created_at: string;
    resolved: boolean;
  }>;
  activeSessionsCount: number;
}

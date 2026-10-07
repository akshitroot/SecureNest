import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url: string;
  auth_provider: 'email' | 'google';
  google_id?: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  two_factor_enabled: boolean;
  security_score: number;
  last_login_at: string;
  updated_at: string;
  avatar_url?: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  is_trashed: boolean;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
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
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  event_type: 'signup' | 'login' | 'logout' | 'google_login' | 'upload' | 'download' | 'rename' | 'delete' | 'restore' | 'permanent_delete' | 'create_folder' | 'security_update';
  details: string;
  ip_address: string;
  user_agent: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  user_id: string;
  event_type: string;
  description: string;
  ip_address: string;
  user_agent: string;
  resolved: boolean;
  created_at: string;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  token_hash: string;
  device: string;
  ip_address: string;
  last_active: string;
  created_at: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

interface DatabaseSchema {
  users: User[];
  profiles: Profile[];
  folders: Folder[];
  files: StoredFile[];
  audit_logs: AuditLog[];
  security_events: SecurityEvent[];
  active_sessions: ActiveSession[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'securenest.json');
export const VAULT_ROOT = path.resolve(process.cwd(), 'storage', 'vault');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VAULT_ROOT)) {
  fs.mkdirSync(VAULT_ROOT, { recursive: true });
}

let db: DatabaseSchema = {
  users: [],
  profiles: [],
  folders: [],
  files: [],
  audit_logs: [],
  security_events: [],
  active_sessions: []
};

function saveDb() {
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
      // Clean up any historical fake seeded files to guarantee fresh initial state
      if (db.files && db.files.some(f => f.name.includes('Xandar') || f.name.includes('Velocity-song'))) {
        db.files = [];
        db.folders = [];
        db.profiles.forEach(p => p.storage_used_bytes = 0);
        saveDb();
      }
    } catch (err) {
      console.error('Error loading db, seeding fresh schema:', err);
      seedInitialData();
    }
  } else {
    seedInitialData();
  }
}

export function categorizeFile(mimeType: string, filename: string): StoredFile['file_category'] {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (
    mimeType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(ext)
  ) {
    return 'Image';
  }
  if (
    mimeType.startsWith('video/') ||
    ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'].includes(ext)
  ) {
    return 'Video';
  }
  if (
    mimeType.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)
  ) {
    return 'Audio';
  }
  if (
    ['zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz'].includes(ext) ||
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('compressed')
  ) {
    return 'ZIP';
  }
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('presentation') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'fig', 'json'].includes(ext)
  ) {
    return 'Documents';
  }
  return 'Other';
}

function seedInitialData() {
  const passwordHash = hashPassword('SecurePassword123!');

  // Real initial accounts with 0 files, 0 folders, 0 B used
  const userA: User = {
    id: 'user-a-1111',
    email: 'usera@securenest.internal',
    password_hash: passwordHash,
    full_name: 'Alex Rivera',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    auth_provider: 'email',
    role: 'user',
    created_at: new Date('2025-01-10T08:00:00Z').toISOString(),
    updated_at: new Date().toISOString()
  };

  const userB: User = {
    id: 'user-b-2222',
    email: 'userb@securenest.internal',
    password_hash: passwordHash,
    full_name: 'Morgan Vance',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    auth_provider: 'email',
    role: 'user',
    created_at: new Date('2025-02-15T10:00:00Z').toISOString(),
    updated_at: new Date().toISOString()
  };

  const profileA: Profile = {
    id: 'prof-a-1111',
    user_id: userA.id,
    display_name: 'Alex Rivera',
    storage_quota_bytes: 100 * 1024 * 1024 * 1024,
    storage_used_bytes: 0,
    two_factor_enabled: true,
    security_score: 85,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const profileB: Profile = {
    id: 'prof-b-2222',
    user_id: userB.id,
    display_name: 'Morgan Vance',
    storage_quota_bytes: 100 * 1024 * 1024 * 1024,
    storage_used_bytes: 0,
    two_factor_enabled: false,
    security_score: 75,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.users = [userA, userB];
  db.profiles = [profileA, profileB];
  // Absolutely 0 files, 0 folders, 0 activity on fresh initialization
  db.files = [];
  db.folders = [];
  db.audit_logs = [];
  db.security_events = [];
  db.active_sessions = [];

  ensureUserVault(userA.id);
  ensureUserVault(userB.id);

  saveDb();
}

export function ensureUserVault(userId: string): string {
  const userDir = path.join(VAULT_ROOT, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true, mode: 0o700 });
  }
  return userDir;
}

loadDb();

export const dbService = {
  findUserByEmail(email: string): User | undefined {
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  findUserById(userId: string): User | undefined {
    return db.users.find(u => u.id === userId);
  },

  createUser(data: { email: string; password_hash: string; full_name: string; auth_provider: 'email' | 'google'; google_id?: string; avatar_url?: string }): { user: User; profile: Profile } {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newUser: User = {
      id,
      email: data.email.toLowerCase(),
      password_hash: data.password_hash,
      full_name: data.full_name,
      avatar_url: data.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.full_name)}`,
      auth_provider: data.auth_provider,
      google_id: data.google_id,
      role: 'user',
      created_at: now,
      updated_at: now
    };

    const newProfile: Profile = {
      id: crypto.randomUUID(),
      user_id: id,
      display_name: data.full_name,
      storage_quota_bytes: 100 * 1024 * 1024 * 1024,
      storage_used_bytes: 0,
      two_factor_enabled: false,
      security_score: 75,
      last_login_at: now,
      updated_at: now
    };

    db.users.push(newUser);
    db.profiles.push(newProfile);
    ensureUserVault(id);
    saveDb();

    return { user: newUser, profile: newProfile };
  },

  updateUser(userId: string, data: { full_name?: string; avatar_url?: string }): User | null {
    const user = db.users.find(u => u.id === userId);
    if (!user) return null;
    if (data.full_name !== undefined) user.full_name = data.full_name;
    if (data.avatar_url !== undefined) user.avatar_url = data.avatar_url;
    user.updated_at = new Date().toISOString();

    const profile = db.profiles.find(p => p.user_id === userId);
    if (profile) {
      if (data.full_name !== undefined) profile.display_name = data.full_name;
      if (data.avatar_url !== undefined) profile.avatar_url = data.avatar_url;
      profile.updated_at = new Date().toISOString();
    }

    saveDb();
    return user;
  },

  updateUserAvatar(userId: string, avatarUrl: string): { user: User | null; profile: Profile | null } {
    const user = db.users.find(u => u.id === userId);
    const profile = db.profiles.find(p => p.user_id === userId);
    if (user) {
      user.avatar_url = avatarUrl;
      user.updated_at = new Date().toISOString();
    }
    if (profile) {
      profile.avatar_url = avatarUrl;
      profile.updated_at = new Date().toISOString();
    }
    saveDb();
    return { user: user || null, profile: profile || null };
  },

  removeUserAvatar(userId: string): { user: User | null; profile: Profile | null } {
    const user = db.users.find(u => u.id === userId);
    const profile = db.profiles.find(p => p.user_id === userId);
    if (user) {
      user.avatar_url = '';
      user.updated_at = new Date().toISOString();
    }
    if (profile) {
      profile.avatar_url = '';
      profile.updated_at = new Date().toISOString();
    }

    // Also delete any existing avatar file from user's storage vault
    const userVault = path.join(VAULT_ROOT, userId);
    if (fs.existsSync(userVault)) {
      try {
        const files = fs.readdirSync(userVault);
        for (const file of files) {
          if (file.startsWith('avatar.') || file.startsWith('avatar-') || file.startsWith('profile-pic')) {
            fs.unlinkSync(path.join(userVault, file));
          }
        }
      } catch (err) {
        console.error('Error cleaning up avatar files:', err);
      }
    }

    saveDb();
    return { user: user || null, profile: profile || null };
  },

  updateUserPassword(userId: string, newHash: string) {
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.password_hash = newHash;
      user.updated_at = new Date().toISOString();
      saveDb();
    }
  },

  getProfile(userId: string): Profile | undefined {
    return db.profiles.find(p => p.user_id === userId);
  },

  updateProfile(userId: string, updates: Partial<Profile>): Profile | null {
    const profile = db.profiles.find(p => p.user_id === userId);
    if (!profile) return null;
    Object.assign(profile, updates, { updated_at: new Date().toISOString() });
    saveDb();
    return profile;
  },

  getUserFiles(userId: string, options?: { folderId?: string | null; isTrashed?: boolean; isFavorite?: boolean; search?: string; sort?: string }): StoredFile[] {
    let files = db.files.filter(f => f.user_id === userId);

    if (options?.isTrashed !== undefined) {
      files = files.filter(f => f.is_trashed === options.isTrashed);
    } else {
      files = files.filter(f => !f.is_trashed);
    }

    if (options?.folderId !== undefined) {
      files = files.filter(f => f.folder_id === options.folderId);
    }

    if (options?.isFavorite !== undefined) {
      files = files.filter(f => f.is_favorite === options.isFavorite);
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      files = files.filter(f => f.name.toLowerCase().includes(q) || f.original_name.toLowerCase().includes(q));
    }

    const sort = options?.sort || 'date-desc';
    files.sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      if (sort === 'name-desc') return b.name.localeCompare(a.name);
      if (sort === 'size-asc') return a.size_bytes - b.size_bytes;
      if (sort === 'size-desc') return b.size_bytes - a.size_bytes;
      if (sort === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return files;
  },

  getFileById(userId: string, fileId: string): StoredFile | null {
    const file = db.files.find(f => f.id === fileId && f.user_id === userId);
    return file || null;
  },

  createFile(userId: string, data: { name: string; original_name: string; mime_type: string; size_bytes: number; storage_path: string; checksum_sha256: string; folder_id?: string | null }): StoredFile {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const category = categorizeFile(data.mime_type, data.name);

    const newFile: StoredFile = {
      id,
      user_id: userId,
      folder_id: data.folder_id || null,
      name: data.name,
      original_name: data.original_name,
      mime_type: data.mime_type,
      file_category: category,
      size_bytes: data.size_bytes,
      storage_path: data.storage_path,
      checksum_sha256: data.checksum_sha256,
      is_favorite: false,
      is_trashed: false,
      trashed_at: null,
      created_at: now,
      updated_at: now
    };

    db.files.push(newFile);
    this.recomputeStorageUsed(userId);
    saveDb();
    return newFile;
  },

  updateFile(userId: string, fileId: string, updates: Partial<StoredFile>): StoredFile | null {
    const file = this.getFileById(userId, fileId);
    if (!file) return null;

    if (updates.name !== undefined) file.name = updates.name;
    if (updates.is_favorite !== undefined) file.is_favorite = updates.is_favorite;
    if (updates.folder_id !== undefined) file.folder_id = updates.folder_id;
    file.updated_at = new Date().toISOString();

    saveDb();
    return file;
  },

  trashFile(userId: string, fileId: string): StoredFile | null {
    const file = this.getFileById(userId, fileId);
    if (!file) return null;
    file.is_trashed = true;
    file.trashed_at = new Date().toISOString();
    file.updated_at = new Date().toISOString();
    saveDb();
    return file;
  },

  restoreFile(userId: string, fileId: string): StoredFile | null {
    const file = db.files.find(f => f.id === fileId && f.user_id === userId && f.is_trashed);
    if (!file) return null;
    file.is_trashed = false;
    file.trashed_at = null;
    file.updated_at = new Date().toISOString();
    saveDb();
    return file;
  },

  deleteFilePermanently(userId: string, fileId: string): boolean {
    const index = db.files.findIndex(f => f.id === fileId && f.user_id === userId);
    if (index === -1) return false;

    const file = db.files[index];
    const absPath = path.join(VAULT_ROOT, file.storage_path);
    if (absPath.startsWith(VAULT_ROOT) && fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (err) {
        console.error('Error unlinking file:', err);
      }
    }

    db.files.splice(index, 1);
    this.recomputeStorageUsed(userId);
    saveDb();
    return true;
  },

  getUserFolders(userId: string, parentId?: string | null): Folder[] {
    return db.folders.filter(f => f.user_id === userId && !f.is_trashed && (parentId === undefined || f.parent_id === parentId));
  },

  getFolderById(userId: string, folderId: string): Folder | null {
    return db.folders.find(f => f.id === folderId && f.user_id === userId) || null;
  },

  createFolder(userId: string, name: string, parentId?: string | null, color = '#7c3aed'): Folder {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newFolder: Folder = {
      id,
      user_id: userId,
      parent_id: parentId || null,
      name,
      color,
      is_trashed: false,
      trashed_at: null,
      created_at: now,
      updated_at: now
    };
    db.folders.push(newFolder);
    saveDb();
    return newFolder;
  },

  renameFolder(userId: string, folderId: string, name: string): Folder | null {
    const folder = this.getFolderById(userId, folderId);
    if (!folder) return null;
    folder.name = name;
    folder.updated_at = new Date().toISOString();
    saveDb();
    return folder;
  },

  deleteFolder(userId: string, folderId: string): boolean {
    const index = db.folders.findIndex(f => f.id === folderId && f.user_id === userId);
    if (index === -1) return false;
    db.folders.splice(index, 1);
    db.files.forEach(f => {
      if (f.user_id === userId && f.folder_id === folderId) {
        f.folder_id = null;
      }
    });
    saveDb();
    return true;
  },

  logAudit(userId: string, event: AuditLog['event_type'], details: string, ip = '127.0.0.1', ua = 'Browser', severity: AuditLog['severity'] = 'info') {
    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      user_id: userId,
      event_type: event,
      details,
      ip_address: ip,
      user_agent: ua,
      severity,
      created_at: new Date().toISOString()
    };
    db.audit_logs.unshift(newLog);
    if (db.audit_logs.length > 500) {
      db.audit_logs = db.audit_logs.slice(0, 500);
    }
    saveDb();
    return newLog;
  },

  getUserAuditLogs(userId: string, limit = 50): AuditLog[] {
    return db.audit_logs.filter(a => a.user_id === userId).slice(0, limit);
  },

  logSecurityEvent(userId: string, eventType: string, description: string, ip = '127.0.0.1', ua = 'Browser') {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      user_id: userId,
      event_type: eventType,
      description,
      ip_address: ip,
      user_agent: ua,
      resolved: false,
      created_at: new Date().toISOString()
    };
    db.security_events.unshift(event);
    saveDb();
    return event;
  },

  getUserSecurityEvents(userId: string): SecurityEvent[] {
    return db.security_events.filter(e => e.user_id === userId);
  },

  recordSession(userId: string, tokenHash: string, device: string, ip: string) {
    const now = new Date().toISOString();
    const session: ActiveSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      device,
      ip_address: ip,
      last_active: now,
      created_at: now
    };
    db.active_sessions.push(session);
    saveDb();
    return session;
  },

  getUserSessions(userId: string): ActiveSession[] {
    return db.active_sessions.filter(s => s.user_id === userId);
  },

  revokeSession(userId: string, sessionId: string): boolean {
    const idx = db.active_sessions.findIndex(s => s.id === sessionId && s.user_id === userId);
    if (idx !== -1) {
      db.active_sessions.splice(idx, 1);
      saveDb();
      return true;
    }
    return false;
  },

  recomputeStorageUsed(userId: string): number {
    const userFiles = db.files.filter(f => f.user_id === userId && !f.is_trashed);
    const total = userFiles.reduce((acc, f) => acc + f.size_bytes, 0);
    const profile = db.profiles.find(p => p.user_id === userId);
    if (profile) {
      profile.storage_used_bytes = total;
    }
    return total;
  },

  getUserStats(userId: string) {
    const files = db.files.filter(f => f.user_id === userId && !f.is_trashed);
    const folders = db.folders.filter(f => f.user_id === userId && !f.is_trashed);
    const profile = db.profiles.find(p => p.user_id === userId);

    const breakdown: Record<StoredFile['file_category'], { count: number; bytes: number }> = {
      Documents: { count: 0, bytes: 0 },
      Image: { count: 0, bytes: 0 },
      Video: { count: 0, bytes: 0 },
      Audio: { count: 0, bytes: 0 },
      ZIP: { count: 0, bytes: 0 },
      Other: { count: 0, bytes: 0 }
    };

    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size_bytes;
      if (breakdown[file.file_category]) {
        breakdown[file.file_category].count++;
        breakdown[file.file_category].bytes += file.size_bytes;
      } else {
        breakdown.Other.count++;
        breakdown.Other.bytes += file.size_bytes;
      }
    }

    const quotaBytes = profile?.storage_quota_bytes || 100 * 1024 * 1024 * 1024;
    const usagePercent = quotaBytes > 0 ? Math.min(100, (totalBytes / quotaBytes) * 100) : 0;

    return {
      totalBytes,
      quotaBytes,
      usagePercent,
      fileCount: files.length,
      folderCount: folders.length,
      breakdown
    };
  }
};

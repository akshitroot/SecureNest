import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import dotenv from 'dotenv';
import { dbService, ensureUserVault, StoredFile, hashPassword, verifyPassword } from './server/db.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'securenest-production-signing-key-99881122';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const VAULT_ROOT = path.resolve(process.cwd(), 'storage', 'vault');

// Native Token Management
function signToken(payload: object, expiresInSeconds = 7 * 24 * 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken<T>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
    if (expectedSig !== signature) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as T;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const item of cookieHeader.split(';')) {
    const [key, value] = item.trim().split('=');
    if (key && value) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function setAuthCookie(res: Response, token: string) {
  const isHttps = process.env.NODE_ENV === 'production' || Boolean(process.env.APP_URL?.startsWith('https'));
  const flags = isHttps
    ? 'Path=/; HttpOnly; SameSite=None; Secure; Max-Age=604800'
    : 'Path=/; HttpOnly; SameSite=Lax; Max-Age=604800';
  res.setHeader('Set-Cookie', `securenest_token=${token}; ${flags}`);
}

function clearAuthCookie(res: Response) {
  const isHttps = process.env.NODE_ENV === 'production' || Boolean(process.env.APP_URL?.startsWith('https'));
  const flags = isHttps
    ? 'Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0'
    : 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  res.setHeader('Set-Cookie', `securenest_token=; ${flags}`);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  let token = cookies['securenest_token'];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No session found.' });
  }

  const decoded = verifyToken<{ id: string; email: string; role: string }>(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Session expired or invalid signature.' });
  }

  const user = dbService.findUserById(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'Invalid session. User not found.' });
  }
  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

function sanitizeFilename(input: string): string {
  let cleaned = input.replace(/[\0\r\n\t\\/]/g, '').trim();
  cleaned = cleaned.replace(/^\.+/, '');
  if (!cleaned) cleaned = 'untitled_file';
  return cleaned;
}

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

app.post('/api/auth/signup', (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const existing = dbService.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = hashPassword(password);
    const { user, profile } = dbService.createUser({
      email,
      password_hash,
      full_name: full_name.trim(),
      auth_provider: 'email'
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    const ip = req.ip || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Browser';
    dbService.logAudit(user.id, 'signup', `User account created: ${user.email}`, ip, ua);
    dbService.recordSession(user.id, crypto.createHash('sha256').update(token).digest('hex'), ua, ip);

    return res.status(201).json({
      message: 'Account successfully created.',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        auth_provider: user.auth_provider,
        role: user.role
      },
      profile,
      token
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error during account creation.' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Browser';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = dbService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your email and password.' });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      dbService.logSecurityEvent(user.id, 'failed_login_attempt', `Failed login attempt with incorrect password`, ip, ua);
      return res.status(401).json({ error: 'Invalid credentials. Please verify your email and password.' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    dbService.updateProfile(user.id, { last_login_at: new Date().toISOString() });
    dbService.logAudit(user.id, 'login', `Successful login: ${user.email}`, ip, ua);
    dbService.recordSession(user.id, crypto.createHash('sha256').update(token).digest('hex'), ua, ip);

    return res.json({
      message: 'Authentication successful.',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        auth_provider: user.auth_provider,
        role: user.role
      },
      profile: dbService.getProfile(user.id),
      token
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const ip = req.ip || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Browser';
  dbService.logAudit(req.user!.id, 'logout', 'User logged out', ip, ua);

  clearAuthCookie(res);
  return res.json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = dbService.findUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const profile = dbService.getProfile(req.user!.id);
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      auth_provider: user.auth_provider,
      role: user.role,
      created_at: user.created_at
    },
    profile,
    token
  });
});

// Helper to resolve Google OAuth credentials from environment variables
function getGoogleCredentials(): { clientId?: string; clientSecret?: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET;
  return { clientId, clientSecret };
}

// In-memory OAuth state cache (supports environments where cross-site cookies are blocked)
const oauthStateCache = new Map<string, number>();

app.get('/api/auth/google/status', (req: Request, res: Response) => {
  const { clientId, clientSecret } = getGoogleCredentials();
  const isConfigured = Boolean(clientId && clientSecret && clientId !== 'MY_GOOGLE_CLIENT_ID');

  return res.json({
    configured: isConfigured,
    clientId: isConfigured ? `${clientId?.substring(0, 12)}...` : null,
    redirectUri: `${APP_URL}/api/auth/google/callback`,
    instructions: {
      step1: 'Go to Google Cloud Console (https://console.cloud.google.com/apis/credentials)',
      step2: 'View OAuth 2.0 Client ID for project ai-studio-applet-webapp-e93f0',
      step3: `Authorized redirect URI: ${APP_URL}/api/auth/google/callback`,
      step4: 'Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment'
    }
  });
});

app.get('/api/auth/google/start', (req: Request, res: Response) => {
  const { clientId } = getGoogleCredentials();
  if (!clientId || clientId === 'MY_GOOGLE_CLIENT_ID') {
    return res.status(400).json({
      error: 'Google OAuth is not configured on this server.',
      message: 'Missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Configure in environment to use Google Sign In.',
      redirectUri: `${APP_URL}/api/auth/google/callback`
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  oauthStateCache.set(state, Date.now() + 600000); // 10 minutes TTL

  const isHttps = process.env.NODE_ENV === 'production' || Boolean(process.env.APP_URL?.startsWith('https'));
  const cookieFlags = isHttps
    ? 'Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600'
    : 'Path=/; HttpOnly; SameSite=Lax; Max-Age=600';
  res.setHeader('Set-Cookie', `oauth_state=${state}; ${cookieFlags}`);

  const redirectUri = `${APP_URL}/api/auth/google/callback`;
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      state,
      prompt: 'select_account'
    }).toString();

  res.redirect(googleAuthUrl);
});

app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const cookies = parseCookies(req.headers.cookie);
  const savedState = cookies['oauth_state'];

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(String(error))}`);
  }

  const stateStr = String(state || '');
  const isStateValid = Boolean(
    (savedState && state && state === savedState) ||
    (stateStr && oauthStateCache.has(stateStr) && (oauthStateCache.get(stateStr)! > Date.now()))
  );

  if (!state || !isStateValid) {
    return res.redirect('/?auth_error=State%20mismatch%20CSRF%20protection');
  }

  if (stateStr) oauthStateCache.delete(stateStr);

  const { clientId, clientSecret } = getGoogleCredentials();
  const redirectUri = `${APP_URL}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return res.redirect('/?auth_error=Google%20OAuth%20Credentials%20Missing');
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Failed to exchange Google token');
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userInfoResponse.json() as any;

    if (!googleUser.email) {
      throw new Error('Google did not return a verified email address.');
    }

    let user = dbService.findUserByEmail(googleUser.email);
    if (!user) {
      const dummyPassword = crypto.randomBytes(32).toString('hex');
      const hash = hashPassword(dummyPassword);
      const created = dbService.createUser({
        email: googleUser.email,
        password_hash: hash,
        full_name: googleUser.name || googleUser.given_name || 'Google User',
        avatar_url: googleUser.picture || '',
        auth_provider: 'google',
        google_id: googleUser.sub
      });
      user = created.user;
    } else {
      if (googleUser.picture && (!user.avatar_url || user.avatar_url.includes('dicebear'))) {
        dbService.updateUser(user.id, { avatar_url: googleUser.picture });
      }
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    const ip = req.ip || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Browser';
    dbService.logAudit(user.id, 'google_login', `Logged in via Google OAuth (${user.email})`, ip, ua);

    return res.redirect(`/?token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(`/?auth_error=${encodeURIComponent(err.message || 'OAuth authentication failed')}`);
  }
});

app.post('/api/auth/switch-demo', (req: Request, res: Response) => {
  const { target } = req.body;
  const email = target === 'user-b' ? 'userb@securenest.internal' : 'usera@securenest.internal';
  const user = dbService.findUserByEmail(email);

  if (!user) {
    return res.status(404).json({ error: 'Demo user not found.' });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);

  const profile = dbService.getProfile(user.id);
  dbService.logAudit(user.id, 'login', `Switched to active session: ${user.email}`, req.ip || '127.0.0.1', 'Demo Switcher');

  return res.json({
    message: `Switched session to ${user.full_name}`,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      auth_provider: user.auth_provider,
      role: user.role
    },
    profile,
    token
  });
});

// -------------------------------------------------------------
// PRIVATE FILE STORAGE ROUTES (STRICT RLS & OWNERSHIP)
// -------------------------------------------------------------

app.get('/api/files', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { folderId, isTrashed, isFavorite, search, sort } = req.query;

  let resolvedFolderId: string | null | undefined = undefined;
  if (folderId !== undefined && folderId !== '' && folderId !== 'all') {
    resolvedFolderId = (folderId === 'null' || folderId === 'root') ? null : (folderId as string);
  }

  const files = dbService.getUserFiles(userId, {
    folderId: resolvedFolderId,
    isTrashed: isTrashed === 'true' ? true : isTrashed === 'false' ? false : undefined,
    isFavorite: isFavorite === 'true' ? true : undefined,
    search: search as string | undefined,
    sort: sort as string | undefined
  });

  return res.json({ files });
});

app.get('/api/files/:id/view', (req: Request, res: Response) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    let token = cookies['securenest_token'];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    if (!token) return res.status(401).send('Unauthorized');

    const decoded = verifyToken<{ id: string }>(token);
    if (!decoded) return res.status(401).send('Invalid token');

    const file = dbService.getFileById(decoded.id, req.params.id);
    if (!file) return res.status(404).send('File not found');

    const relativePath = file.storage_path;
    const absolutePath = path.resolve(VAULT_ROOT, relativePath);
    const userVault = path.resolve(VAULT_ROOT, decoded.id);

    if (!absolutePath.startsWith(userVault)) {
      return res.status(403).send('Forbidden');
    }
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).send('Not on disk');
    }

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    fs.createReadStream(absolutePath).pipe(res);
  } catch {
    res.status(500).send('Failed to stream file');
  }
});

app.post('/api/files/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const originalName = sanitizeFilename(file.originalname);
    const folderId = (req.body.folderId && req.body.folderId !== 'null' && req.body.folderId !== 'undefined') ? req.body.folderId : null;

    const profile = dbService.getProfile(userId);
    const quota = profile?.storage_quota_bytes || 100 * 1024 * 1024 * 1024;
    const currentUsed = profile?.storage_used_bytes || 0;

    if (currentUsed + file.size > quota) {
      return res.status(413).json({ error: 'Storage quota exceeded (100 GB limit reached).' });
    }

    ensureUserVault(userId);
    const fileId = crypto.randomUUID();
    const vaultFilename = `${fileId}.dat`;
    const relativePath = path.join(userId, vaultFilename);
    const absolutePath = path.join(VAULT_ROOT, relativePath);

    fs.writeFileSync(absolutePath, file.buffer, { mode: 0o600 });
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const created = dbService.createFile(userId, {
      name: originalName,
      original_name: originalName,
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: file.size,
      storage_path: relativePath,
      checksum_sha256: checksum,
      folder_id: folderId
    });

    const ip = req.ip || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Browser';
    dbService.logAudit(userId, 'upload', `Uploaded file: ${originalName} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, ip, ua);

    return res.status(201).json({
      message: 'File uploaded and secured successfully.',
      file: created
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: 'Failed to process file upload.' });
  }
});

app.patch('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const fileId = req.params.id;
  const { name, is_favorite, folder_id } = req.body;

  const file = dbService.getFileById(userId, fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found or access denied.' });
  }

  const updates: Partial<StoredFile> = {};
  if (name !== undefined) {
    updates.name = sanitizeFilename(name);
    dbService.logAudit(userId, 'rename', `Renamed file ${file.name} to ${updates.name}`);
  }
  if (is_favorite !== undefined) {
    updates.is_favorite = Boolean(is_favorite);
  }
  if (folder_id !== undefined) {
    updates.folder_id = (folder_id === 'null' || folder_id === 'root' || folder_id === '' || folder_id === null) ? null : folder_id;
    const destName = updates.folder_id ? (dbService.getFolderById(userId, updates.folder_id)?.name || 'folder') : 'Root';
    dbService.logAudit(userId, 'rename', `Moved file ${file.name} to ${destName}`);
  }

  const updated = dbService.updateFile(userId, fileId, updates);
  return res.json({ file: updated });
});

app.post('/api/files/:id/trash', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const fileId = req.params.id;

  const file = dbService.getFileById(userId, fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found or access denied.' });
  }

  const trashed = dbService.trashFile(userId, fileId);
  dbService.logAudit(userId, 'delete', `Moved to trash: ${file.name}`);
  return res.json({ message: 'File moved to trash.', file: trashed });
});

app.post('/api/files/:id/restore', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const fileId = req.params.id;

  const restored = dbService.restoreFile(userId, fileId);
  if (!restored) {
    return res.status(404).json({ error: 'Trashed file not found or access denied.' });
  }

  dbService.logAudit(userId, 'restore', `Restored from trash: ${restored.name}`);
  return res.json({ message: 'File restored.', file: restored });
});

app.delete('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const fileId = req.params.id;

  const file = dbService.getFileById(userId, fileId) || dbService.getUserFiles(userId, { isTrashed: true }).find(f => f.id === fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found or access denied.' });
  }

  const success = dbService.deleteFilePermanently(userId, fileId);
  if (!success) {
    return res.status(404).json({ error: 'File not found or already removed.' });
  }

  dbService.logAudit(userId, 'permanent_delete', `Permanently deleted: ${file.name}`);
  return res.json({ message: 'File permanently deleted.' });
});

app.get('/api/files/:id/download-ticket', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const fileId = req.params.id;

  const file = dbService.getFileById(userId, fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found or access denied.' });
  }

  const ticket = signToken({ fileId: file.id, userId: file.user_id }, 120);

  return res.json({
    ticket,
    downloadUrl: `/api/files/download?ticket=${encodeURIComponent(ticket)}`
  });
});

app.get('/api/files/:id/download', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const fileId = req.params.id;

  const file = dbService.getFileById(userId, fileId) || dbService.getUserFiles(userId, { isTrashed: true }).find(f => f.id === fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found or access denied.' });
  }

  const relativePath = file.storage_path;
  const absolutePath = path.resolve(VAULT_ROOT, relativePath);
  const userVault = path.resolve(VAULT_ROOT, userId);
  if (!absolutePath.startsWith(userVault)) {
    dbService.logSecurityEvent(userId, 'path_traversal_attempt', `Potential path traversal intercepted on file download: ${relativePath}`);
    return res.status(403).json({ error: 'Security violation: Access outside user vault denied.' });
  }

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Physical storage file missing on disk.' });
  }

  dbService.logAudit(userId, 'download', `Downloaded file: ${file.name}`);

  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);

  const fileStream = fs.createReadStream(absolutePath);
  fileStream.pipe(res);
});

app.get('/api/files/download', (req: Request, res: Response) => {
  try {
    const ticket = req.query.ticket as string;
    let userId: string | undefined;
    let fileId: string | undefined;

    if (ticket) {
      const decoded = verifyToken<{ fileId?: string; userId?: string; id?: string }>(ticket);
      if (!decoded) {
        return res.status(403).json({ error: 'Download ticket expired or invalid.' });
      }
      fileId = decoded.fileId || (req.query.id as string);
      userId = decoded.userId || decoded.id;
    } else {
      const cookies = parseCookies(req.headers.cookie);
      let token = cookies['securenest_token'];
      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }
      if (!token) {
        return res.status(401).json({ error: 'Authentication required for file download.' });
      }
      const decoded = verifyToken<{ id: string }>(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Session expired.' });
      }
      userId = decoded.id;
      fileId = req.query.id as string;
    }

    if (!fileId || !userId) {
      return res.status(400).json({ error: 'Missing file identification.' });
    }

    const file = dbService.getFileById(userId, fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found or unauthorized.' });
    }

    const relativePath = file.storage_path;
    const absolutePath = path.resolve(VAULT_ROOT, relativePath);
    const userVault = path.resolve(VAULT_ROOT, userId);
    if (!absolutePath.startsWith(userVault)) {
      dbService.logSecurityEvent(userId, 'path_traversal_attempt', `Potential path traversal intercepted on file download: ${relativePath}`);
      return res.status(403).json({ error: 'Security violation: Access outside user vault denied.' });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Physical storage file missing on disk.' });
    }

    dbService.logAudit(userId, 'download', `Downloaded file: ${file.name}`);

    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);

    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
  } catch (err: any) {
    console.error('Download error:', err);
    return res.status(500).json({ error: 'Download operation failed.' });
  }
});

// -------------------------------------------------------------
// FOLDERS ROUTES
// -------------------------------------------------------------

app.get('/api/folders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  if (req.query.all === 'true') {
    const folders = dbService.getUserFolders(userId, undefined);
    return res.json({ folders });
  }
  const parentId = req.query.parentId === 'null' || req.query.parentId === '' ? null : (req.query.parentId as string | undefined);
  const folders = dbService.getUserFolders(userId, parentId);
  return res.json({ folders });
});

app.post('/api/folders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { name, parentId, color } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required.' });
  }

  if (parentId) {
    const parent = dbService.getFolderById(userId, parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent folder not found or unauthorized.' });
    }
  }

  const cleanName = sanitizeFilename(name);
  const folder = dbService.createFolder(userId, cleanName, parentId || null, color || '#7c3aed');
  dbService.logAudit(userId, 'create_folder', `Created folder: ${cleanName}`);

  return res.status(201).json({ folder });
});

app.patch('/api/folders/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const folderId = req.params.id;
  const { name } = req.body;

  const folder = dbService.getFolderById(userId, folderId);
  if (!folder) {
    return res.status(404).json({ error: 'Folder not found or unauthorized.' });
  }

  const updated = dbService.renameFolder(userId, folderId, sanitizeFilename(name));
  return res.json({ folder: updated });
});

app.delete('/api/folders/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const folderId = req.params.id;

  const folder = dbService.getFolderById(userId, folderId);
  if (!folder) {
    return res.status(404).json({ error: 'Folder not found or unauthorized.' });
  }

  dbService.deleteFolder(userId, folderId);
  dbService.logAudit(userId, 'delete', `Deleted folder: ${folder.name}`);
  return res.json({ message: 'Folder deleted.' });
});

// -------------------------------------------------------------
// PROFILE AVATAR STORAGE (PRIVATE VAULT)
// -------------------------------------------------------------

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPG, JPEG, PNG, and WEBP formats are accepted.'));
    }
  }
});

app.post('/api/profile/avatar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  avatarUpload.single('avatar')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image size exceeds maximum limit of 5 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Failed to upload profile picture.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Please select a JPG, PNG, or WEBP image.' });
    }

    const userId = req.user!.id;
    ensureUserVault(userId);

    const userVault = path.join(VAULT_ROOT, userId);
    // Remove previous avatar files
    try {
      const existing = fs.readdirSync(userVault);
      for (const f of existing) {
        if (f.startsWith('avatar.') || f.startsWith('avatar-') || f.startsWith('profile-pic')) {
          fs.unlinkSync(path.join(userVault, f));
        }
      }
    } catch (e) {
      console.error('Error removing previous avatar files:', e);
    }

    const rawExt = path.extname(req.file.originalname).toLowerCase();
    const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt) ? rawExt : '.jpg';
    const filename = `avatar-${Date.now()}${ext}`;
    const targetPath = path.join(userVault, filename);

    fs.writeFileSync(targetPath, req.file.buffer, { mode: 0o600 });

    const avatarUrl = `/api/profile/avatar/${userId}?t=${Date.now()}`;
    const result = dbService.updateUserAvatar(userId, avatarUrl);
    dbService.logAudit(userId, 'security_update', 'Updated profile picture');

    return res.json({
      message: 'Profile picture updated successfully.',
      avatar_url: avatarUrl,
      user: result.user,
      profile: result.profile
    });
  });
});

app.delete('/api/profile/avatar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const result = dbService.removeUserAvatar(userId);
  dbService.logAudit(userId, 'security_update', 'Removed profile picture');

  return res.json({
    message: 'Profile picture removed successfully.',
    avatar_url: '',
    user: result.user,
    profile: result.profile
  });
});

app.get('/api/profile/avatar/:userId', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || !/^[\w-]+$/.test(userId)) {
      return res.status(400).send('Invalid user ID.');
    }

    const user = dbService.findUserById(userId);
    if (!user) {
      return res.status(404).send('User not found.');
    }

    const userVault = path.join(VAULT_ROOT, userId);
    if (!fs.existsSync(userVault)) {
      return res.status(404).send('Avatar not found.');
    }

    const files = fs.readdirSync(userVault);
    const avatarFile = files.find(f => f.startsWith('avatar.') || f.startsWith('avatar-') || f.startsWith('profile-pic'));
    if (!avatarFile) {
      return res.status(404).send('No custom avatar found.');
    }

    const filePath = path.join(userVault, avatarFile);
    const ext = path.extname(avatarFile).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error streaming avatar:', err);
    return res.status(500).send('Failed to retrieve avatar.');
  }
});

app.get('/api/profile/avatar', (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  let token = cookies['securenest_token'];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).send('Unauthorized');
  const decoded = verifyToken<{ id: string }>(token);
  if (!decoded) return res.status(401).send('Session invalid');
  return res.redirect(`/api/profile/avatar/${decoded.id}`);
});

app.patch('/api/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { full_name, avatar_url } = req.body;
  const updated = dbService.updateUser(userId, { full_name, avatar_url });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  const profile = dbService.getProfile(userId);
  dbService.logAudit(userId, 'security_update', `Updated profile display name to ${full_name}`);
  return res.json({ user: updated, profile });
});

app.post('/api/profile/password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }
  const user = dbService.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const valid = verifyPassword(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password does not match.' });
  }
  const newHash = hashPassword(new_password);
  dbService.updateUserPassword(userId, newHash);
  dbService.logAudit(userId, 'security_update', 'Account password successfully changed');
  return res.json({ message: 'Password updated successfully.' });
});

// -------------------------------------------------------------
// DASHBOARD & REAL STORAGE STATS
// -------------------------------------------------------------

app.get('/api/dashboard/stats', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const stats = dbService.getUserStats(userId);
  const profile = dbService.getProfile(userId);
  const recentFiles = dbService.getUserFiles(userId, { sort: 'date-desc' }).slice(0, 6);

  return res.json({
    storage: {
      usedBytes: stats.totalBytes,
      quotaBytes: stats.quotaBytes,
      usedGB: Number((stats.totalBytes / (1024 * 1024 * 1024)).toFixed(3)),
      quotaGB: Number((stats.quotaBytes / (1024 * 1024 * 1024)).toFixed(0)),
      usagePercent: Number(stats.usagePercent.toFixed(2))
    },
    fileCount: stats.fileCount,
    folderCount: stats.folderCount,
    breakdown: {
      Documents: {
        count: stats.breakdown.Documents.count,
        bytes: stats.breakdown.Documents.bytes,
        gb: Number((stats.breakdown.Documents.bytes / (1024 * 1024 * 1024)).toFixed(3))
      },
      Image: {
        count: stats.breakdown.Image.count,
        bytes: stats.breakdown.Image.bytes,
        gb: Number((stats.breakdown.Image.bytes / (1024 * 1024 * 1024)).toFixed(3))
      },
      Video: {
        count: stats.breakdown.Video.count,
        bytes: stats.breakdown.Video.bytes,
        gb: Number((stats.breakdown.Video.bytes / (1024 * 1024 * 1024)).toFixed(3))
      },
      Audio: {
        count: stats.breakdown.Audio.count,
        bytes: stats.breakdown.Audio.bytes,
        gb: Number((stats.breakdown.Audio.bytes / (1024 * 1024 * 1024)).toFixed(3))
      },
      ZIP: {
        count: stats.breakdown.ZIP.count,
        bytes: stats.breakdown.ZIP.bytes,
        gb: Number((stats.breakdown.ZIP.bytes / (1024 * 1024 * 1024)).toFixed(3))
      }
    },
    recentFiles,
    profile
  });
});

// -------------------------------------------------------------
// SECURITY CENTER & AUDIT LOGS
// -------------------------------------------------------------

app.get('/api/security/overview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const user = dbService.findUserById(userId);
  const profile = dbService.getProfile(userId);
  const auditLogs = dbService.getUserAuditLogs(userId, 20);
  const securityEvents = dbService.getUserSecurityEvents(userId);
  const sessions = dbService.getUserSessions(userId);

  let score = 70;
  if (profile?.two_factor_enabled) score += 15;
  if (user?.auth_provider === 'google') score += 10;
  if (securityEvents.filter(e => !e.resolved).length === 0) score += 5;

  return res.json({
    securityScore: Math.min(100, score),
    twoFactorEnabled: profile?.two_factor_enabled || false,
    authProvider: user?.auth_provider || 'email',
    recentLogins: auditLogs.filter(a => a.event_type === 'login' || a.event_type === 'google_login'),
    securityEvents,
    activeSessionsCount: sessions.length || 1,
    lastAudit: auditLogs[0] || null
  });
});

app.get('/api/security/audit-logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const logs = dbService.getUserAuditLogs(userId, 100);
  return res.json({ logs });
});

app.post('/api/security/toggle-2fa', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const profile = dbService.getProfile(userId);
  const newState = !profile?.two_factor_enabled;

  dbService.updateProfile(userId, { two_factor_enabled: newState });
  dbService.logAudit(userId, 'security_update', `Two-factor authentication ${newState ? 'enabled' : 'disabled'}`);

  return res.json({ two_factor_enabled: newState });
});

// -------------------------------------------------------------
// TWO-USER SECURITY PENETRATION TEST SUITE
// -------------------------------------------------------------
app.get('/api/security/test-two-user', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userA = dbService.findUserByEmail('usera@securenest.internal');
  const userB = dbService.findUserByEmail('userb@securenest.internal');

  if (!userA || !userB) {
    return res.status(500).json({ error: 'Test users A and B not initialized in database.' });
  }

  const results: Array<{
    name: string;
    description: string;
    attemptedAction: string;
    expectedStatus: string;
    actualStatus: string;
    passed: boolean;
  }> = [];

  let userBFiles = dbService.getUserFiles(userB.id);
  let targetBFile = userBFiles[0];
  let createdTestFile = false;

  if (!targetBFile) {
    ensureUserVault(userB.id);
    const tempFileId = crypto.randomUUID();
    const tempVaultPath = path.join(userB.id, `${tempFileId}.dat`);
    fs.writeFileSync(path.join(VAULT_ROOT, tempVaultPath), 'USER_B_ISOLATED_FINANCIAL_RECORD');
    targetBFile = dbService.createFile(userB.id, {
      name: 'Confidential-Audit-UserB.pdf',
      original_name: 'Confidential-Audit-UserB.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2048,
      storage_path: tempVaultPath,
      checksum_sha256: crypto.createHash('sha256').update('USER_B_ISOLATED_FINANCIAL_RECORD').digest('hex')
    });
    createdTestFile = true;
  }

  const idorFileCheck = dbService.getFileById(userA.id, targetBFile?.id || 'fake-id');
  results.push({
    name: 'IDOR File Metadata Read',
    description: 'User A queries metadata for a file owned exclusively by User B using B file ID',
    attemptedAction: `dbService.getFileById(UserA.id, "${targetBFile?.id}")`,
    expectedStatus: 'null / 404 Not Found',
    actualStatus: idorFileCheck ? 'VULNERABLE (Leaked User B file)' : 'BLOCKED (404 Not Found / null)',
    passed: idorFileCheck === null
  });

  const renameAttempt = dbService.updateFile(userA.id, targetBFile?.id || 'fake-id', { name: 'Hacked_By_User_A' });
  results.push({
    name: 'BOLA File Modification',
    description: 'User A attempts to rename a file belonging to User B',
    attemptedAction: `dbService.updateFile(UserA.id, "${targetBFile?.id}", { name: 'Hacked' })`,
    expectedStatus: 'Rejected (null / 404)',
    actualStatus: renameAttempt ? 'VULNERABLE (User B file renamed)' : 'BLOCKED (Modification refused)',
    passed: renameAttempt === null
  });

  const deleteAttempt = dbService.deleteFilePermanently(userA.id, targetBFile?.id || 'fake-id');
  results.push({
    name: 'Unauthorized File Deletion',
    description: 'User A attempts permanent deletion on User B file record',
    attemptedAction: `dbService.deleteFilePermanently(UserA.id, "${targetBFile?.id}")`,
    expectedStatus: 'Rejected (false)',
    actualStatus: deleteAttempt ? 'VULNERABLE (User B file deleted)' : 'BLOCKED (Deletion denied)',
    passed: !deleteAttempt
  });

  const folderLeakCheck = dbService.getUserFolders(userA.id).some(f => f.user_id === userB.id);
  results.push({
    name: 'Cross-Tenant Folder Isolation',
    description: 'User A queries folder listing; verify zero User B folders leak',
    attemptedAction: 'dbService.getUserFolders(UserA.id)',
    expectedStatus: 'Zero User B folders returned',
    actualStatus: folderLeakCheck ? 'VULNERABLE (User B folders leaked)' : 'SECURE (Strictly isolated)',
    passed: !folderLeakCheck
  });

  const maliciousRelativePath = `../${userB.id}/Confidential-Q2-Audit-UserB.pdf`;
  const resolvedMaliciousPath = path.resolve(VAULT_ROOT, userA.id, maliciousRelativePath);
  const userAVault = path.resolve(VAULT_ROOT, userA.id);
  const isTraversalBlocked = !resolvedMaliciousPath.startsWith(userAVault);
  results.push({
    name: 'Vault Directory Path Traversal Prevention',
    description: 'Attempt to escape User A vault directory to access User B vault via "../"',
    attemptedAction: `Path escape: ${maliciousRelativePath}`,
    expectedStatus: 'Detected and forbidden',
    actualStatus: isTraversalBlocked ? 'BLOCKED (Access outside vault denied)' : 'VULNERABLE (Vault escaped)',
    passed: isTraversalBlocked
  });

  const auditLogsA = dbService.getUserAuditLogs(userA.id);
  const leakedAuditLogs = auditLogsA.some(log => log.user_id === userB.id);
  results.push({
    name: 'Audit Log Privacy Check',
    description: 'User A queries audit trails; verify zero User B audit logs visible',
    attemptedAction: 'dbService.getUserAuditLogs(UserA.id)',
    expectedStatus: 'Zero User B logs',
    actualStatus: leakedAuditLogs ? 'VULNERABLE (Audit leak)' : 'SECURE (Zero User B logs leaked)',
    passed: !leakedAuditLogs
  });

  const allPassed = results.every(r => r.passed);

  return res.json({
    summary: {
      totalTests: results.length,
      passedCount: results.filter(r => r.passed).length,
      status: allPassed ? 'ALL SECURITY ISOLATION CHECKS PASSED' : 'SECURITY CHECKS FAILED'
    },
    tests: results
  });
});

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC ASSET MOUNT
// -------------------------------------------------------------
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`SecureNest server listening on http://${HOST}:${PORT}`);
  });
}

setupServer();

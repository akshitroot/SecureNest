/**
 * SecureNest Avatar Utilities
 * Provides consistent default avatars and user profile picture resolution
 */

export function getDefaultAvatar(name?: string, email?: string): string {
  const seed = (name || email || 'Alex').trim();
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=7c3aed&textColor=ffffff`;
}

export function getUserAvatar(avatarUrl?: string | null, name?: string, email?: string): string {
  if (avatarUrl && avatarUrl.trim() !== '') {
    return avatarUrl;
  }
  return getDefaultAvatar(name, email);
}

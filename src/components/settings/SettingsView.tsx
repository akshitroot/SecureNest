import React, { useState, useRef } from 'react';
import { 
  User, 
  Lock, 
  Shield, 
  Sliders, 
  Key, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  HardDrive, 
  Smartphone,
  Save,
  Loader2,
  Camera,
  Trash2,
  Upload
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authFetch } from '../../services/api';
import { getUserAvatar, getDefaultAvatar } from '../../utils/avatar';

interface SettingsViewProps {
  onOpenGoogleModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenGoogleModal }) => {
  const { user, profile, logout, toggle2FA, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'security' | 'preferences'>('profile');

  // Profile form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Profile Picture state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Preferences state (saved in localStorage)
  const [defaultView, setDefaultView] = useState<'list' | 'grid'>(
    (localStorage.getItem('securenest_default_view') as 'list' | 'grid') || 'list'
  );
  const [autoVerifyChecksum, setAutoVerifyChecksum] = useState(
    localStorage.getItem('securenest_auto_checksum') !== 'false'
  );

  // Handle Profile Picture Selection & Upload
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (JPG, JPEG, PNG, WEBP)
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!allowedMime.includes(file.type) && !allowedExt.includes(ext)) {
      setAvatarMsg({
        text: 'Invalid file format. Please upload a JPG, JPEG, PNG, or WEBP image.',
        error: true
      });
      // Clear file input
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate reasonable file size (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({
        text: 'File size exceeds 5 MB limit. Please select a smaller image.',
        error: true
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploadingAvatar(true);
    setAvatarMsg(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await authFetch('/api/profile/avatar', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload profile picture');
      }

      await refreshUser();
      setAvatarMsg({ text: 'Profile picture updated successfully!' });
      setTimeout(() => setAvatarMsg(null), 3500);
    } catch (err: any) {
      setAvatarMsg({ text: err.message || 'Error uploading profile picture', error: true });
      setPreviewUrl(null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Remove Profile Picture
  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove profile picture and restore default avatar?')) {
      return;
    }

    setRemovingAvatar(true);
    setAvatarMsg(null);
    try {
      const res = await authFetch('/api/profile/avatar', {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove profile picture');
      }

      setPreviewUrl(null);
      await refreshUser();
      setAvatarMsg({ text: 'Profile picture removed. Default avatar restored.' });
      setTimeout(() => setAvatarMsg(null), 3500);
    } catch (err: any) {
      setAvatarMsg({ text: err.message || 'Error removing profile picture', error: true });
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await authFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      await refreshUser();
      setProfileMsg({ text: 'Profile display name updated successfully!' });
      setTimeout(() => setProfileMsg(null), 3500);
    } catch (err: any) {
      setProfileMsg({ text: err.message || 'Error updating profile', error: true });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', error: true });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ text: 'Password must be at least 8 characters.', error: true });
      return;
    }

    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await authFetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ text: 'Password updated successfully!' });
      setTimeout(() => setPasswordMsg(null), 3500);
    } catch (err: any) {
      setPasswordMsg({ text: err.message || 'Error changing password', error: true });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem('securenest_default_view', defaultView);
    localStorage.setItem('securenest_auto_checksum', String(autoVerifyChecksum));
    alert('Preferences saved successfully.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">User Settings</h1>
        <p className="text-xs text-gray-500 mt-1">
          Manage your SecureNest identity, encrypted vault credentials, and security preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <User className="w-4 h-4" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'account'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Key className="w-4 h-4" />
          Account
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'security'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          Security
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'preferences'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Preferences
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-6">
          {/* Profile Picture & Storage Controls */}
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={getUserAvatar(previewUrl || user?.avatar_url, user?.full_name, user?.email)}
                    alt={user?.full_name || 'User avatar'}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getDefaultAvatar(user?.full_name, user?.email);
                    }}
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-300 ring-2 ring-purple-100 shadow-xs"
                  />
                  {uploadingAvatar && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {previewUrl && !uploadingAvatar && (
                    <span className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                      New
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Profile Picture</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Accepts JPG, JPEG, PNG, or WEBP (up to 5 MB)
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-medium text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded">
                    Stored in your private vault
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                  id="avatar-file-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar || removingAvatar}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <span>{uploadingAvatar ? 'Uploading...' : 'Change Profile Picture'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={!user?.avatar_url || uploadingAvatar || removingAvatar}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    user?.avatar_url
                      ? 'bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                  }`}
                  title={user?.avatar_url ? 'Remove your custom profile picture' : 'Default avatar is currently active'}
                >
                  {removingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{removingAvatar ? 'Removing...' : 'Remove Profile Picture'}</span>
                </button>
              </div>
            </div>

            {avatarMsg && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                avatarMsg.error
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {avatarMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{avatarMsg.text}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <img
                src={getUserAvatar(previewUrl || user?.avatar_url, user?.full_name, user?.email)}
                alt={user?.full_name || 'User'}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar(user?.full_name, user?.email);
                }}
                className="w-12 h-12 rounded-full object-cover border border-purple-200"
              />
              <div>
                <h3 className="text-base font-bold text-gray-900">{user?.full_name}</h3>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                  Tenant Vault: {user?.id}
                </span>
              </div>
            </div>

            {profileMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                profileMsg.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {profileMsg.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Full Display Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full max-w-md px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full max-w-md px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Email identity is linked to your tenant key.
              </span>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Account */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-6">
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Change Password</h3>

            {passwordMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                passwordMsg.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {passwordMsg.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                New Password (minimum 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-gray-900">Sign Out of Vault</h4>
              <p className="text-[11px] text-gray-500">Terminate current authenticated session cookie</p>
            </div>
            <button
              onClick={() => logout()}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Security */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <span className="font-semibold text-gray-500">Authentication Method:</span>
              <p className="font-bold text-gray-900 capitalize text-sm">{user?.auth_provider || 'Email / Password'}</p>
              <p className="text-[11px] text-gray-400">Direct tenant password hash via scrypt</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <span className="font-semibold text-gray-500">Two-Factor Authentication:</span>
              <div className="flex items-center justify-between mt-1">
                <span className={`font-bold ${profile?.two_factor_enabled ? 'text-emerald-600' : 'text-gray-600'}`}>
                  {profile?.two_factor_enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  onClick={() => toggle2FA()}
                  className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg font-semibold text-[11px] text-purple-600 hover:bg-purple-50 cursor-pointer"
                >
                  Toggle 2FA
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <span className="font-semibold text-gray-500">Google OAuth SSO:</span>
              <p className="font-bold text-gray-900 text-sm">
                {user?.auth_provider === 'google' ? 'Connected via Google' : 'Configured on Server'}
              </p>
              <p className="text-[11px] text-gray-400">Redirect URI & Client ID Active</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <span className="font-semibold text-gray-500">Storage Protection:</span>
              <p className="font-bold text-emerald-600 text-sm">Private Supabase Storage Engine</p>
              <p className="text-[11px] text-gray-400">Strict RLS, 120s ticket expiry, CSP sandbox</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Preferences */}
      {activeTab === 'preferences' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-5">
          <div className="space-y-4 max-w-md text-xs">
            <div>
              <label className="font-semibold text-gray-700 block mb-1.5">
                Default Files View Mode
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="viewMode"
                    value="list"
                    checked={defaultView === 'list'}
                    onChange={() => setDefaultView('list')}
                    className="text-purple-600"
                  />
                  <span>Table / List View</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="viewMode"
                    value="grid"
                    checked={defaultView === 'grid'}
                    onChange={() => setDefaultView('grid')}
                    className="text-purple-600"
                  />
                  <span>Grid Cards View</span>
                </label>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={autoVerifyChecksum}
                  onChange={(e) => setAutoVerifyChecksum(e.target.checked)}
                  className="rounded text-purple-600"
                />
                <span>Generate & verify SHA-256 checksum on all uploads</span>
              </label>
              <span className="text-[11px] text-gray-400 ml-5 block mt-0.5">
                Guarantees bit-level integrity against storage bit rot and tampering.
              </span>
            </div>

            <button
              onClick={handleSavePreferences}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

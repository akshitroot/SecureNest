import React from 'react';
import { X, Shield, User, HardDrive, Key, Smartphone, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserAvatar, getDefaultAvatar } from '../../utils/avatar';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGoogleModal: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenGoogleModal
}) => {
  const { user, profile, logout, toggle2FA } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg border border-gray-100 shadow-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Account & Security Settings</h2>
              <p className="text-xs text-gray-500">Manage your private vault credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs">
          {/* Profile overview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <img
              src={getUserAvatar(user?.avatar_url, user?.full_name, user?.email)}
              alt={user?.full_name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = getDefaultAvatar(user?.full_name, user?.email);
              }}
              className="w-12 h-12 rounded-full object-cover border border-purple-300"
            />
            <div>
              <h3 className="text-sm font-bold text-gray-900">{user?.full_name}</h3>
              <p className="text-gray-500 font-mono">{user?.email}</p>
              <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded">
                Role: {user?.role || 'User'}
              </span>
            </div>
          </div>

          {/* Storage Quota */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
            <div className="flex justify-between font-semibold text-gray-700">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                Allocated Vault Quota
              </span>
              <span>100 GB Dedicated</span>
            </div>
            <p className="text-gray-400 text-[11px]">
              Stored inside isolated tenant partition with SHA-256 data verification.
            </p>
          </div>

          {/* Authentication & SSO */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-semibold text-gray-800">Auth Method</span>
              </div>
              <span className="capitalize font-mono font-bold text-purple-600">
                {user?.auth_provider || 'Email / Password'}
              </span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenGoogleModal();
              }}
              className="w-full text-center py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
            >
              Configure Google OAuth Integration
            </button>
          </div>

          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-800">Two-Factor Authentication</p>
                <p className="text-gray-400 text-[11px]">Require OTP verification</p>
              </div>
            </div>
            <button
              onClick={toggle2FA}
              className={`px-3 py-1 rounded-lg font-semibold text-xs transition-colors ${
                profile?.two_factor_enabled
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {profile?.two_factor_enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex items-center gap-1.5 text-red-600 hover:text-red-700 font-semibold text-xs px-3 py-2 rounded-xl hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

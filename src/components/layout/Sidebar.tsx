import React from 'react';
import { 
  HardDrive, 
  Users, 
  Clock, 
  Star, 
  Trash2, 
  ShieldCheck, 
  LogOut, 
  Cloud,
  Settings,
  X,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserAvatar, getDefaultAvatar } from '../../utils/avatar';

export type NavTab = 'my-drive' | 'shared' | 'recent' | 'favourite' | 'trash' | 'security' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user, profile, logout } = useAuth();

  const navItems = [
    { id: 'my-drive' as NavTab, label: 'My Drive', icon: HardDrive },
    { id: 'shared' as NavTab, label: 'Shared with Me', icon: Users },
    { id: 'recent' as NavTab, label: 'Recent', icon: Clock },
    { id: 'favourite' as NavTab, label: 'Favourite', icon: Star },
    { id: 'trash' as NavTab, label: 'Trash', icon: Trash2 },
    { id: 'security' as NavTab, label: 'Security Center', icon: ShieldCheck, badge: 'Protected' },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const usedBytes = profile?.storage_used_bytes || 0;
  const quotaBytes = profile?.storage_quota_bytes || 100 * 1024 * 1024 * 1024;
  const usagePercent = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  const formatGB = (b: number) => (b / (1024 * 1024 * 1024)).toFixed(1);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Main Sidebar (Drawer on mobile, static column on md+) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 md:z-10
        w-64 bg-[#141419] text-gray-300 flex flex-col justify-between shrink-0 select-none min-h-screen border-r border-gray-800/40
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Logo & Close Button on Mobile */}
        <div>
          <div className="p-6 pb-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/30">
                <Cloud className="w-5 h-5 fill-white/20" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
                  SecureNest
                </h1>
                <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">
                  Private Cloud Vault
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white md:hidden hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items matching reference UI */}
          <nav className="px-3 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white shadow-md shadow-purple-600/25 font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isActive ? 'bg-white/25 text-white' : 'bg-purple-900/40 text-purple-300 border border-purple-700/30'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Account & SaaS Storage Plan Card */}
        <div className="p-4 border-t border-gray-800/60 space-y-3">
          {/* SaaS Plan / Vault Card */}
          <div className="bg-gradient-to-br from-purple-950/30 to-gray-900/80 rounded-2xl p-3.5 border border-purple-900/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider">
                Private Cloud Space
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Active
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Storage Quota</span>
                <span className="text-white font-mono font-semibold">
                  {formatGB(usedBytes)} / {formatGB(quotaBytes)} GB
                </span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, usagePercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* User Profile Bar & Secure Logout */}
          <div className="flex items-center justify-between pt-1">
            <div 
              onClick={() => handleSelect('settings')}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
              title="Open Account Settings"
            >
              <img
                src={getUserAvatar(user?.avatar_url, user?.full_name, user?.email)}
                alt={user?.full_name || 'My Account'}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar(user?.full_name, user?.email);
                }}
                className="w-8 h-8 rounded-full object-cover border border-purple-500/40 ring-1 ring-purple-500/20 group-hover:border-purple-400 transition-all"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                  {user?.full_name || 'My Account'}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="text-gray-400 hover:text-red-400 p-2 rounded-xl hover:bg-gray-800/80 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

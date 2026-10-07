import React, { useState } from 'react';
import { 
  Search, 
  HelpCircle, 
  Settings, 
  Bell, 
  Shield, 
  Cloud, 
  Menu, 
  PieChart,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserAvatar, getDefaultAvatar } from '../../utils/avatar';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSettings: () => void;
  onOpenMobileSidebar?: () => void;
  onToggleMobileStorage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onOpenMobileSidebar,
  onToggleMobileStorage
}) => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  return (
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20">
      {/* Left: Mobile Hamburger & Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 -ml-1 text-gray-600 hover:text-gray-900 md:hidden hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Input matching reference UI */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search your files..."
            className="w-full bg-[#f8fafc] border border-gray-200/80 rounded-full pl-10 sm:pl-11 pr-8 py-2 text-xs sm:text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 bg-gray-200/80 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Right Actions & Utilities */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
        {/* Mobile Storage Drawer Toggle (< xl) */}
        {onToggleMobileStorage && (
          <button
            onClick={onToggleMobileStorage}
            className="xl:hidden p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer border border-gray-200/80"
            title="Storage Breakdown"
          >
            <PieChart className="w-4 h-4" />
          </button>
        )}

        {/* SecureNest Cloud Storage Status Badge (hidden on mobile, visible on sm+) */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 bg-purple-50 text-purple-700 border border-purple-200/70 rounded-full text-xs font-semibold shadow-2xs">
          <Cloud className="w-3.5 h-3.5 text-purple-600" />
          <span>SecureNest Cloud</span>
        </div>

        {/* Security Indicator (hidden on small screens) */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-medium">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted Vault</span>
        </div>

        {/* Help Popover Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowHelp(!showHelp);
              setShowNotifications(false);
            }}
            className="w-9 h-9 rounded-full border border-gray-200/90 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer"
            title="Help & Storage Info"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {showHelp && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                <span className="text-xs font-bold text-gray-900">Vault Security Info</span>
                <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                SecureNest encrypts your files with SHA-256 integrity checks and isolates storage strictly to your private tenant space.
              </p>
              <div className="mt-3 pt-2 border-t border-gray-50 flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>100% Isolated & Private</span>
              </div>
            </div>
          )}
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full border border-gray-200/90 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Account Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Notification Bell with Clean Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowHelp(false);
            }}
            className="w-9 h-9 rounded-full border border-gray-200/90 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-purple-500 absolute top-2 right-2 ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                <span className="text-xs font-bold text-gray-900">Activity & Alerts</span>
                <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-purple-50/50">
                  <Shield className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Cloud Storage Online</p>
                    <p className="text-[11px] text-gray-500">Your private vault is secure and ready.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-emerald-50/50">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Tenant Vault Isolated</p>
                    <p className="text-[11px] text-gray-500">Zero cross-user data leakage detected.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div 
          onClick={onOpenSettings}
          className="flex items-center gap-2 pl-1 cursor-pointer group"
          title="Account Settings"
        >
          <img
            src={getUserAvatar(user?.avatar_url, user?.full_name, user?.email)}
            alt="User profile"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getDefaultAvatar(user?.full_name, user?.email);
            }}
            className="w-9 h-9 rounded-full object-cover border border-purple-200 ring-2 ring-purple-100 group-hover:ring-purple-300 transition-all"
          />
        </div>
      </div>
    </header>
  );
};

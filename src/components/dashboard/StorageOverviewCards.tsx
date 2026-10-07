import React from 'react';
import { Cloud, FileCheck, Folder, ShieldCheck } from 'lucide-react';

interface StorageOverviewCardsProps {
  totalFiles: number;
  totalFolders: number;
  usedBytes: number;
  quotaBytes: number;
  usagePercent: number;
}

export const StorageOverviewCards: React.FC<StorageOverviewCardsProps> = ({
  totalFiles,
  totalFolders,
  usedBytes,
  quotaBytes,
  usagePercent
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const quotaGB = (quotaBytes / (1024 * 1024 * 1024)).toFixed(0);

  const cards = [
    {
      id: 'storage',
      title: 'Cloud Vault Storage',
      subtitle: `${totalFiles} items stored`,
      metric: `${formatBytes(usedBytes)} / ${quotaGB} GB`,
      progress: Math.min(100, Math.max(0, usagePercent)),
      barColor: 'bg-purple-600',
      iconBg: 'bg-purple-50 text-purple-600',
      icon: <Cloud className="w-5 h-5" />
    },
    {
      id: 'files',
      title: 'Encrypted Files',
      subtitle: `${formatBytes(usedBytes)} encrypted`,
      metric: `${totalFiles} Files`,
      progress: totalFiles > 0 ? 100 : 0,
      barColor: 'bg-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600',
      icon: <FileCheck className="w-5 h-5" />
    },
    {
      id: 'folders',
      title: 'Directories & Folders',
      subtitle: 'Organized hierarchy',
      metric: `${totalFolders} Folders`,
      progress: totalFolders > 0 ? 100 : 0,
      barColor: 'bg-amber-500',
      iconBg: 'bg-amber-50 text-amber-600',
      icon: <Folder className="w-5 h-5" />
    },
    {
      id: 'security',
      title: 'Vault Security',
      subtitle: 'Private Tenant Sandbox',
      metric: 'SHA-256 Verified',
      progress: 100,
      barColor: 'bg-indigo-600',
      iconBg: 'bg-indigo-50 text-indigo-600',
      icon: <ShieldCheck className="w-5 h-5" />
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((c) => (
        <div
          key={c.id}
          className="bg-white rounded-2xl p-4.5 border border-gray-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow group"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform" style={{ background: 'var(--icon-bg, inherit)' }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>
              {c.icon}
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-800 tracking-tight">{c.title}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{c.subtitle}</p>

          <div className="mt-4">
            <div className="flex justify-between items-center text-[11px] font-medium text-gray-600 mb-1.5">
              <span>{c.metric}</span>
              {c.id === 'storage' && (
                <span className="text-[10px] text-gray-400 font-mono">{usagePercent.toFixed(1)}%</span>
              )}
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${c.barColor}`}
                style={{ width: `${c.progress}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive, 
  Upload as UploadIcon,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react';
import { DashboardStats } from '../../types';

interface StorageSidebarProps {
  stats: DashboardStats | null;
  onFileUpload: (file: File) => Promise<void>;
  onUploadFiles?: (files: File[]) => Promise<void>;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const StorageSidebar: React.FC<StorageSidebarProps> = ({ 
  stats, 
  onFileUpload, 
  onUploadFiles,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const formatBytes = (bytes: number | undefined) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const usedBytes = stats?.storage?.usedBytes ?? 0;
  const quotaGB = stats?.storage?.quotaGB ?? 100;
  const usagePercent = stats?.storage?.usagePercent ?? 0;

  // Real breakdown strictly calculated from user's storage
  const categories = [
    {
      label: 'Documents',
      icon: FileText,
      iconColor: 'text-[#8b5cf6]',
      bgColor: 'bg-purple-50',
      count: stats?.breakdown?.Documents?.count || 0,
      sizeText: formatBytes(stats?.breakdown?.Documents?.bytes)
    },
    {
      label: 'Image',
      icon: ImageIcon,
      iconColor: 'text-[#6366f1]',
      bgColor: 'bg-indigo-50',
      count: stats?.breakdown?.Image?.count || 0,
      sizeText: formatBytes(stats?.breakdown?.Image?.bytes)
    },
    {
      label: 'Video',
      icon: Video,
      iconColor: 'text-[#a855f7]',
      bgColor: 'bg-purple-50',
      count: stats?.breakdown?.Video?.count || 0,
      sizeText: formatBytes(stats?.breakdown?.Video?.bytes)
    },
    {
      label: 'Audio',
      icon: Music,
      iconColor: 'text-[#ec4899]',
      bgColor: 'bg-pink-50',
      count: stats?.breakdown?.Audio?.count || 0,
      sizeText: formatBytes(stats?.breakdown?.Audio?.bytes)
    },
    {
      label: 'ZIP',
      icon: Archive,
      iconColor: 'text-[#7e22ce]',
      bgColor: 'bg-purple-50',
      count: stats?.breakdown?.ZIP?.count || 0,
      sizeText: formatBytes(stats?.breakdown?.ZIP?.bytes)
    }
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processUpload(Array.from(files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processUpload(Array.from(files));
      e.target.value = '';
    }
  };

  const processUpload = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      if (onUploadFiles) {
        await onUploadFiles(fileList);
      } else {
        for (const file of fileList) {
          await onFileUpload(file);
        }
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
      setTimeout(() => setUploadError(null), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  // SVG Arch calculations for half donut gauge
  const radius = 64;
  const strokeWidth = 14;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, usagePercent)) / 100) * circumference;

  const content = (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 tracking-tight">
            Cloud Storage
          </h2>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 xl:hidden hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Half Donut Radial Gauge matching reference UI */}
        <div className="relative flex flex-col items-center justify-center my-4">
          <svg className="w-48 h-28 overflow-visible" viewBox="0 0 160 90">
            {/* Background Arc */}
            <path
              d="M 16 80 A 64 64 0 0 1 144 80"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Value Arc in Purple */}
            <path
              d="M 16 80 A 64 64 0 0 1 144 80"
              fill="none"
              stroke="#7c3aed"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Centered Storage Figure */}
          <div className="absolute bottom-2 text-center">
            <span className="text-2xl font-black text-gray-900 tracking-tight block">
              {formatBytes(usedBytes)}
            </span>
            <span className="text-xs font-medium text-gray-400">
              Used of {quotaGB} GB {usagePercent > 0 ? `(${usagePercent.toFixed(1)}%)` : ''}
            </span>
          </div>
        </div>

        {/* File Categories Breakdown */}
        <div className="space-y-4 mt-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.label} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${cat.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${cat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 tracking-tight">{cat.label}</p>
                    <p className="text-[11px] text-gray-400">
                      {cat.count.toLocaleString()} Files <span className="mx-0.5 text-gray-300">|</span> {cat.sizeText}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Zone Card at the bottom matching reference */}
      <div className="mt-8">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-purple-600 bg-purple-50/60 scale-[1.01]'
              : 'border-purple-200/90 hover:border-purple-400 bg-gray-50/50 hover:bg-purple-50/20'
          }`}
        >
          {isUploading ? (
            <div className="py-2">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold text-purple-900">Encrypting & Storing...</p>
              <p className="text-[10px] text-gray-400">SHA-256 Checksum generation</p>
            </div>
          ) : uploadSuccess ? (
            <div className="py-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 animate-bounce" />
              <p className="text-xs font-semibold text-emerald-800">Vault Upload Complete!</p>
              <p className="text-[10px] text-emerald-600">Securely saved to private cloud</p>
            </div>
          ) : uploadError ? (
            <div className="py-2">
              <p className="text-xs font-semibold text-red-600 mb-1">{uploadError}</p>
              <p className="text-[10px] text-gray-400">Click to try again</p>
            </div>
          ) : (
            <>
              <div className="w-11 h-11 rounded-full bg-purple-100/70 text-purple-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <UploadIcon className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-xs font-bold text-gray-800 tracking-tight">Upload Your Files</p>
              <p className="text-[11px] text-gray-400 mt-1">Drag and drop your files here</p>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 xl:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Mobile Drawer (visible on < xl when opened) */}
      <aside className={`
        fixed inset-y-0 right-0 z-50 xl:hidden
        w-80 bg-white p-6 flex flex-col justify-between shadow-2xl border-l border-gray-100 overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {content}
      </aside>

      {/* Desktop Column (always visible on xl+) */}
      <aside className="hidden xl:flex w-80 bg-white border-l border-gray-100 p-6 flex-col justify-between shrink-0 min-h-screen">
        {content}
      </aside>
    </>
  );
};

import React from 'react';
import { Folder, FileText, Video, Music, Image as ImageIcon, Archive, Clock } from 'lucide-react';
import { StoredFile } from '../../types';

interface RecentUploadsProps {
  files: StoredFile[];
  onSelectFile: (file: StoredFile) => void;
  onSeeAll: () => void;
}

export const RecentUploads: React.FC<RecentUploadsProps> = ({ files, onSelectFile, onSeeAll }) => {
  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const getFileVisual = (file: StoredFile) => {
    switch (file.file_category) {
      case 'Image':
        return {
          icon: <ImageIcon className="w-5 h-5 text-rose-500" />,
          bg: 'bg-rose-50'
        };
      case 'Video':
        return {
          icon: <Video className="w-5 h-5 text-rose-600" />,
          bg: 'bg-rose-50'
        };
      case 'Audio':
        return {
          icon: <Music className="w-5 h-5 text-pink-500" />,
          bg: 'bg-pink-50'
        };
      case 'ZIP':
        return {
          icon: <Archive className="w-5 h-5 text-purple-600" />,
          bg: 'bg-purple-50'
        };
      case 'Documents':
        return {
          icon: <FileText className="w-5 h-5 text-sky-500" />,
          bg: 'bg-sky-50'
        };
      default:
        return {
          icon: <Folder className="w-5 h-5 text-amber-500" />,
          bg: 'bg-amber-50'
        };
    }
  };

  if (files.length === 0) {
    return null; // Keep dashboard completely clean when empty, as requested!
  }

  const displayList = files.slice(0, 6);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900 tracking-tight">Recent Uploads</h2>
        <button
          onClick={onSeeAll}
          className="text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors cursor-pointer"
        >
          See All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayList.map((file) => {
          const visual = getFileVisual(file);
          return (
            <div
              key={file.id}
              onClick={() => onSelectFile(file)}
              className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3.5 hover:shadow-md hover:border-purple-200/60 transition-all cursor-pointer group"
            >
              <div className={`w-11 h-11 rounded-xl ${visual.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                {visual.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-purple-600 transition-colors">
                  {file.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  1 Files <span className="mx-1 text-gray-300">|</span> {formatSize(file.size_bytes)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

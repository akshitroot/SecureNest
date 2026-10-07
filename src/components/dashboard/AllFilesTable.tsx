import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive, 
  Folder as FolderIcon,
  Download, 
  Star, 
  Trash2, 
  Edit3, 
  ArrowUpDown, 
  List, 
  Grid, 
  Lock, 
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Upload,
  FolderOpen,
  FolderInput
} from 'lucide-react';
import { StoredFile, Folder } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getUserAvatar, getDefaultAvatar } from '../../utils/avatar';
import { getAuthToken } from '../../services/api';

interface AllFilesTableProps {
  files: StoredFile[];
  folders: Folder[];
  currentFolder: Folder | null;
  onOpenFolder: (folder: Folder | null) => void;
  onDownloadFile: (file: StoredFile) => void;
  onToggleFavorite: (file: StoredFile) => void;
  onRenameFile: (file: StoredFile) => void;
  onMoveFile?: (file: StoredFile) => void;
  onTrashFile: (file: StoredFile) => void;
  onRestoreFile?: (file: StoredFile) => void;
  onDeletePermanent?: (file: StoredFile) => void;
  isTrashView?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onUploadClick?: () => void;
}

export const AllFilesTable: React.FC<AllFilesTableProps> = ({
  files,
  folders,
  currentFolder,
  onOpenFolder,
  onDownloadFile,
  onToggleFavorite,
  onRenameFile,
  onMoveFile,
  onTrashFile,
  onRestoreFile,
  onDeletePermanent,
  isTrashView = false,
  isLoading = false,
  error = null,
  onRetry,
  onUploadClick
}) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortField, setSortField] = useState<'name' | 'date' | 'size'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const authToken = getAuthToken() || '';

  const toggleSort = (field: 'name' | 'date' | 'size') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return 'Root';
    const match = folders.find(f => f.id === folderId);
    return match ? match.name : 'Folder';
  };

  const renderFileIcon = (file: StoredFile) => {
    if (file.file_category === 'Image' && !imageErrorMap[file.id]) {
      return (
        <img
          src={`/api/files/${file.id}/view?token=${encodeURIComponent(authToken)}`}
          alt={file.name}
          onError={() => setImageErrorMap(prev => ({ ...prev, [file.id]: true }))}
          className="w-8 h-8 rounded-lg object-cover border border-purple-100"
        />
      );
    }

    switch (file.file_category) {
      case 'Image':
        return <ImageIcon className="w-5 h-5 text-rose-500" />;
      case 'Video':
        return <Video className="w-5 h-5 text-rose-600" />;
      case 'Audio':
        return <Music className="w-5 h-5 text-pink-500" />;
      case 'ZIP':
        return <Archive className="w-5 h-5 text-purple-600" />;
      case 'Documents':
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
          return <FileText className="w-5 h-5 text-emerald-500" />;
        }
        return <FileText className="w-5 h-5 text-sky-500" />;
      default:
        return <FileText className="w-5 h-5 text-purple-500" />;
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    if (sortField === 'name') {
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortField === 'size') {
      return sortAsc ? a.size_bytes - b.size_bytes : b.size_bytes - a.size_bytes;
    }
    if (sortField === 'date') {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortAsc ? ta - tb : tb - ta;
    }
    return 0;
  });

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.02)]">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900 tracking-tight">
            {isTrashView ? 'Trash' : 'All Files'}
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>

          {/* Breadcrumb if inside folder */}
          {currentFolder && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              <button
                onClick={() => onOpenFolder(null)}
                className="hover:text-purple-600 font-medium cursor-pointer"
              >
                Root
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-semibold text-gray-900">{currentFolder.name}</span>
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white text-purple-600 shadow-2xs font-semibold' : 'text-gray-400 hover:text-gray-700'}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white text-purple-600 shadow-2xs font-semibold' : 'text-gray-400 hover:text-gray-700'}`}
            title="Grid view"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Folders Row if any exist */}
      {folders.length > 0 && !isTrashView && (
        <div className="py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Folders</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => onOpenFolder(folder)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-300 hover:bg-purple-50/20 cursor-pointer transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                  <FolderIcon className="w-4 h-4 fill-amber-500/20" />
                </div>
                <span className="text-sm font-semibold text-gray-800 truncate group-hover:text-purple-600">
                  {folder.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Skeleton State */}
      {isLoading && files.length === 0 && (
        <div className="py-12 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/60 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200" />
                <div className="space-y-1.5">
                  <div className="w-48 h-3.5 bg-gray-200 rounded" />
                  <div className="w-24 h-2.5 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="w-16 h-3 bg-gray-200 rounded" />
              <div className="w-20 h-3 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && files.length === 0 && (
        <div className="py-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Failed to load files</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold inline-flex items-center gap-2 hover:bg-purple-700 transition-colors cursor-pointer shadow-sm shadow-purple-600/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sortedFiles.length === 0 && folders.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">No files in this view</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            {isTrashView ? 'Your trash is completely clean.' : 'Upload documents, media, or archives to your private encrypted vault.'}
          </p>
          {!isTrashView && onUploadClick && (
            <button
              onClick={onUploadClick}
              className="mt-4 px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-xs font-semibold inline-flex items-center gap-2 hover:bg-purple-700 transition-all cursor-pointer shadow-md shadow-purple-600/20"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Your First File</span>
            </button>
          )}
        </div>
      )}

      {/* List / Table Mode */}
      {viewMode === 'list' && sortedFiles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm mt-2">
            <thead>
              <tr className="text-xs font-medium text-gray-400 border-b border-gray-100 select-none">
                <th 
                  onClick={() => toggleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-700"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Folder</th>
                <th 
                  onClick={() => toggleSort('date')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-700"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Uploaded / Modified</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('size')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-700"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Size</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedFiles.map((file) => (
                <tr
                  key={file.id}
                  className="hover:bg-purple-50/20 group transition-colors"
                >
                  {/* File Name & Icon / Thumbnail */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {renderFileIcon(file)}
                      </div>
                      <div className="min-w-0">
                        <span 
                          onClick={() => onDownloadFile(file)}
                          className="font-medium text-gray-800 truncate block max-w-xs group-hover:text-purple-600 transition-colors cursor-pointer"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono block">
                          {file.file_category} • {file.mime_type || 'binary'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <img
                        src={getUserAvatar(user?.avatar_url, user?.full_name, user?.email)}
                        alt="Owner avatar"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getDefaultAvatar(user?.full_name, user?.email);
                        }}
                        className="w-5 h-5 rounded-full object-cover border border-purple-200"
                      />
                      <span className="text-xs text-gray-600 font-medium">Me</span>
                    </div>
                  </td>

                  {/* Folder Location */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium">{getFolderName(file.folder_id)}</span>
                    </div>
                  </td>

                  {/* Last Modified / Upload Date */}
                  <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(file.created_at)}
                  </td>

                  {/* File Size */}
                  <td className="py-3 px-4 text-xs text-gray-500 font-mono whitespace-nowrap">
                    {formatSize(file.size_bytes)}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                      {!isTrashView ? (
                        <>
                          <button
                            onClick={() => onToggleFavorite(file)}
                            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${file.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                            title={file.is_favorite ? 'Remove favorite' : 'Mark favorite'}
                          >
                            <Star className={`w-4 h-4 ${file.is_favorite ? 'fill-amber-500' : ''}`} />
                          </button>

                          <button
                            onClick={() => onDownloadFile(file)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                            title="Secure Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onRenameFile(file)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Rename"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {onMoveFile && (
                            <button
                              onClick={() => onMoveFile(file)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                              title="Move to Folder"
                            >
                              <FolderInput className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => onTrashFile(file)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {onRestoreFile && (
                            <button
                              onClick={() => onRestoreFile(file)}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            >
                              Restore
                            </button>
                          )}
                          {onDeletePermanent && (
                            <button
                              onClick={() => onDeletePermanent(file)}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              Delete Forever
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid Mode */}
      {viewMode === 'grid' && sortedFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-3">
          {sortedFiles.map(file => (
            <div
              key={file.id}
              className="p-4 rounded-xl border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden">
                  {renderFileIcon(file)}
                </div>
                {!isTrashView && (
                  <button
                    onClick={() => onToggleFavorite(file)}
                    className="text-gray-300 hover:text-amber-500 cursor-pointer"
                  >
                    <Star className={`w-4 h-4 ${file.is_favorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                  </button>
                )}
              </div>

              <div className="mt-3">
                <p 
                  onClick={() => onDownloadFile(file)}
                  className="text-sm font-semibold text-gray-800 truncate cursor-pointer hover:text-purple-600" 
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatSize(file.size_bytes)} · {formatDate(file.created_at)}
                </p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3 text-gray-400" />
                  <span>{getFolderName(file.folder_id)}</span>
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-mono">SHA-256</span>
                <div className="flex items-center gap-1">
                  {!isTrashView ? (
                    <>
                      <button
                        onClick={() => onDownloadFile(file)}
                        className="p-1 text-gray-400 hover:text-purple-600 cursor-pointer"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRenameFile(file)}
                        className="p-1 text-gray-400 hover:text-blue-600 cursor-pointer"
                        title="Rename"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {onMoveFile && (
                        <button
                          onClick={() => onMoveFile(file)}
                          className="p-1 text-gray-400 hover:text-purple-600 cursor-pointer"
                          title="Move to Folder"
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onTrashFile(file)}
                        className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                        title="Trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    onRestoreFile && (
                      <button
                        onClick={() => onRestoreFile(file)}
                        className="text-xs text-emerald-600 font-medium cursor-pointer"
                      >
                        Restore
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

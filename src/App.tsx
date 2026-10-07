import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { StorageOverviewCards } from './components/dashboard/StorageOverviewCards';
import { RecentUploads } from './components/dashboard/RecentUploads';
import { AllFilesTable } from './components/dashboard/AllFilesTable';
import { StorageSidebar } from './components/dashboard/StorageSidebar';
import { SecurityCenter } from './components/security/SecurityCenter';
import { SettingsView } from './components/settings/SettingsView';
import { GoogleOAuthModal } from './components/modals/GoogleOAuthModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { NewFolderModal } from './components/modals/NewFolderModal';
import { RenameModal } from './components/modals/RenameModal';
import { MoveModal } from './components/modals/MoveModal';
import { AuthPage } from './components/auth/AuthPage';
import { StoredFile, Folder, DashboardStats } from './types';
import { authFetch, getAuthToken } from './services/api';
import { 
  Plus, 
  ArrowDownToLine, 
  Loader2, 
  UploadCloud, 
  Lock, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef<number>(0);

  // Navigation & Search State
  const [currentTab, setCurrentTab] = useState<NavTab>('my-drive');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Responsive Drawer States for Mobile / Tablets
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileStorageOpen, setIsMobileStorageOpen] = useState<boolean>(false);

  // Data State
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Drag and Drop Zone State
  const [isDraggingOverMain, setIsDraggingOverMain] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<{
    current: number;
    total: number;
    currentFileName: string;
  } | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Modals State
  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);
  const [renamingFile, setRenamingFile] = useState<StoredFile | null>(null);
  const [movingFile, setMovingFile] = useState<StoredFile | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Load Files & Stats
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingData(true);

      let filesUrl = `/api/files?sort=date-desc`;
      if (currentTab === 'trash') {
        filesUrl += `&isTrashed=true`;
      } else if (currentTab === 'favourite') {
        filesUrl += `&isFavorite=true`;
      } else {
        filesUrl += `&isTrashed=false`;
        if (currentFolder) {
          filesUrl += `&folderId=${encodeURIComponent(currentFolder.id)}`;
        }
      }

      if (searchQuery.trim()) {
        filesUrl += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const [filesRes, foldersRes, statsRes] = await Promise.all([
        authFetch(filesUrl),
        authFetch(`/api/folders${currentFolder ? `?parentId=${encodeURIComponent(currentFolder.id)}` : ''}`),
        authFetch('/api/dashboard/stats')
      ]);

      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setFiles(filesData.files || []);
        setDataError(null);
      } else {
        const errJson = await filesRes.json().catch(() => ({}));
        setDataError(errJson.error || 'Failed to retrieve files from vault');
      }

      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(foldersData.folders || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err: any) {
      console.error('Failed to load drive data:', err);
      setDataError(err.message || 'Network error fetching drive data');
    } finally {
      setLoadingData(false);
    }
  }, [user, currentTab, currentFolder, searchQuery]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Batch / Single File Upload Handler
  const handleUploadFiles = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    setUploadQueue({
      current: 1,
      total: filesToUpload.length,
      currentFileName: filesToUpload[0].name
    });

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadQueue({
          current: i + 1,
          total: filesToUpload.length,
          currentFileName: file.name
        });

        const formData = new FormData();
        formData.append('file', file);
        if (currentFolder) {
          formData.append('folderId', currentFolder.id);
        }

        const res = await authFetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }

        const data = await res.json();
        if (data.file) {
          // Immediately update file list so uploaded file appears without delay
          setFiles(prev => [data.file, ...prev.filter(f => f.id !== data.file.id)]);
        }
      }

      // Re-fetch all files and stats to ensure totals and breakdown match
      await loadData();
      const count = filesToUpload.length;
      setUploadSuccessMsg(`Successfully uploaded ${count} file${count > 1 ? 's' : ''} to ${currentFolder ? currentFolder.name : 'My Drive'}`);
      setTimeout(() => setUploadSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'File upload failed');
    } finally {
      setUploadQueue(null);
    }
  };

  const handleUploadFile = async (file: File) => {
    await handleUploadFiles([file]);
  };

  // Drag and drop event handlers over main dashboard area
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounter.current += 1;
      setIsDraggingOverMain(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOverMain(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOverMain(false);

    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await handleUploadFiles(Array.from(droppedFiles));
    }
  };

  // Trigger file picker from "Import" button
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Download Handler using cryptographically signed tickets
  const handleDownloadFile = async (file: StoredFile) => {
    try {
      const res = await authFetch(`/api/files/${file.id}/download-ticket`);
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.downloadUrl;
      } else {
        const token = getAuthToken() || '';
        window.location.href = `/api/files/download?id=${file.id}&ticket=${encodeURIComponent(token)}`;
      }
    } catch (err) {
      console.error('Download error:', err);
      const token = getAuthToken() || '';
      window.location.href = `/api/files/download?id=${file.id}&ticket=${encodeURIComponent(token)}`;
    }
  };

  // Favorite toggle with optimistic UI update
  const handleToggleFavorite = async (file: StoredFile) => {
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, is_favorite: !f.is_favorite } : f));
    const res = await authFetch(`/api/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: !file.is_favorite })
    });
    if (res.ok) {
      await loadData();
    }
  };

  // Move File Handler
  const handleMoveFile = async (fileId: string, targetFolderId: string | null) => {
    // Optimistic UI update
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, folder_id: targetFolderId } : f));
    const res = await authFetch(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: targetFolderId })
    });
    if (res.ok) {
      await loadData();
    }
  };

  // Trash File with immediate state update
  const handleTrashFile = async (file: StoredFile) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    const res = await authFetch(`/api/files/${file.id}/trash`, { method: 'POST' });
    if (res.ok) {
      await loadData();
    }
  };

  // Restore File
  const handleRestoreFile = async (file: StoredFile) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    const res = await authFetch(`/api/files/${file.id}/restore`, { method: 'POST' });
    if (res.ok) {
      await loadData();
    }
  };

  // Permanent Delete
  const handleDeletePermanent = async (file: StoredFile) => {
    if (!window.confirm(`Permanently remove ${file.name}? This cannot be undone.`)) return;
    setFiles(prev => prev.filter(f => f.id !== file.id));
    const res = await authFetch(`/api/files/${file.id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadData();
    }
  };

  // Rename File
  const handleRename = async (fileId: string, newName: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: newName } : f));
    const res = await authFetch(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    if (res.ok) {
      await loadData();
    }
  };

  // Create Folder
  const handleCreateFolder = async (name: string) => {
    const res = await authFetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        parentId: currentFolder?.id || null
      })
    });
    if (res.ok) {
      await loadData();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onOpenGoogleModal={() => setIsGoogleModalOpen(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Hidden file input for header Import button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={async (e) => {
          const fileList = e.target.files;
          if (fileList && fileList.length > 0) {
            await handleUploadFiles(Array.from(fileList));
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Responsive Left Sidebar matching reference UI */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setCurrentFolder(null);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSettings={() => setCurrentTab('settings')}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onToggleMobileStorage={() => setIsMobileStorageOpen(prev => !prev)}
        />

        <div className="flex-1 flex min-w-0">
          {/* Central Main View with drag & drop listeners */}
          <main 
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="flex-1 min-w-0 p-4 sm:p-8 overflow-y-auto relative"
          >
            {/* Visual Drag & Drop Overlay over the Main Dashboard Area */}
            {isDraggingOverMain && (
              <div className="absolute inset-4 z-40 rounded-3xl bg-purple-950/15 backdrop-blur-md border-3 border-dashed border-purple-500 flex flex-col items-center justify-center p-8 text-center pointer-events-none shadow-2xl transition-all duration-200">
                <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center text-purple-600 mb-4 animate-bounce">
                  <UploadCloud className="w-10 h-10 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  Drop files to upload to {currentFolder ? `"${currentFolder.name}"` : 'My Drive'}
                </h3>
                <p className="text-xs text-gray-600 max-w-md mt-1.5 font-medium">
                  Files will be instantly encrypted with SHA-256 integrity checksums and securely written to your private cloud storage.
                </p>

                <div className="mt-5 flex items-center gap-3 text-[11px] font-semibold text-purple-900 bg-white/95 px-4 py-2 rounded-full border border-purple-200 shadow-sm">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-600" />
                    Private Cloud
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    SHA-256 Verified
                  </span>
                  <span>•</span>
                  <span>Target: {currentFolder ? currentFolder.name : 'Root Directory'}</span>
                </div>
              </div>
            )}

            {currentTab === 'settings' ? (
              <SettingsView onOpenGoogleModal={() => setIsGoogleModalOpen(true)} />
            ) : currentTab === 'security' ? (
              <SecurityCenter
                onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
              />
            ) : (
              <div>
                {/* View Header with Action Buttons matching reference UI */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight capitalize">
                      {currentTab === 'my-drive' ? 'My Drive' : currentTab.replace('-', ' ')}
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                      SecureNest Cloud Storage • Drop files anywhere to upload
                    </p>
                  </div>

                  {/* "+ New" and "Import" Buttons matching reference UI */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsNewFolderOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                      <span>New</span>
                    </button>

                    <button
                      onClick={handleImportClick}
                      className="px-4 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-purple-600/25 transition-all cursor-pointer"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>Import</span>
                    </button>
                  </div>
                </div>

                {/* 4 SecureNest Storage Overview Cards (only on My Drive view) */}
                {currentTab === 'my-drive' && !currentFolder && !searchQuery && (
                  <StorageOverviewCards
                    totalFiles={stats?.fileCount || 0}
                    totalFolders={stats?.folderCount || 0}
                    usedBytes={stats?.storage?.usedBytes || 0}
                    quotaBytes={stats?.storage?.quotaBytes || 107374182400}
                    usagePercent={stats?.storage?.usagePercent || 0}
                  />
                )}

                {/* Recent Uploads Grid (only on My Drive view) */}
                {currentTab === 'my-drive' && !currentFolder && !searchQuery && (
                  <RecentUploads
                    files={(stats?.recentFiles && stats.recentFiles.length > 0) ? stats.recentFiles : files.slice(0, 6)}
                    onSelectFile={handleDownloadFile}
                    onSeeAll={() => {}}
                  />
                )}

                {/* All Files Table / Grid */}
                <AllFilesTable
                  files={files}
                  folders={folders}
                  currentFolder={currentFolder}
                  onOpenFolder={setCurrentFolder}
                  onDownloadFile={handleDownloadFile}
                  onToggleFavorite={handleToggleFavorite}
                  onRenameFile={(f) => setRenamingFile(f)}
                  onMoveFile={(f) => setMovingFile(f)}
                  onTrashFile={handleTrashFile}
                  onRestoreFile={handleRestoreFile}
                  onDeletePermanent={handleDeletePermanent}
                  isTrashView={currentTab === 'trash'}
                  isLoading={loadingData}
                  error={dataError}
                  onRetry={loadData}
                  onUploadClick={handleImportClick}
                />
              </div>
            )}
          </main>

          {/* Right Storage Sidebar matching reference UI (Responsive Drawer on mobile, column on xl) */}
          <StorageSidebar
            stats={stats}
            onFileUpload={handleUploadFile}
            onUploadFiles={handleUploadFiles}
            isMobileOpen={isMobileStorageOpen}
            onCloseMobile={() => setIsMobileStorageOpen(false)}
          />
        </div>
      </div>

      {/* Floating Upload Progress Toast */}
      {uploadQueue && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141419] text-white p-4 rounded-2xl shadow-2xl border border-gray-800 flex items-center gap-3.5 max-w-sm">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-white truncate">
              Uploading ({uploadQueue.current}/{uploadQueue.total}): {uploadQueue.currentFileName}
            </p>
            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="bg-purple-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(uploadQueue.current / uploadQueue.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {uploadSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/95 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl border border-emerald-800 flex items-center gap-2.5 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{uploadSuccessMsg}</span>
        </div>
      )}

      {/* Interactive Modals */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      <RenameModal
        isOpen={Boolean(renamingFile)}
        file={renamingFile}
        onClose={() => setRenamingFile(null)}
        onRename={handleRename}
      />

      <MoveModal
        isOpen={Boolean(movingFile)}
        file={movingFile}
        onClose={() => setMovingFile(null)}
        onMove={handleMoveFile}
      />

      <GoogleOAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenGoogleModal={() => {
          setIsSettingsOpen(false);
          setIsGoogleModalOpen(true);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

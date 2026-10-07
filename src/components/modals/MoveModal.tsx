import React, { useState, useEffect } from 'react';
import { X, FolderInput, Folder, HardDrive, Check, Loader2 } from 'lucide-react';
import { StoredFile, Folder as FolderType } from '../../types';
import { authFetch } from '../../services/api';

interface MoveModalProps {
  isOpen: boolean;
  file: StoredFile | null;
  onClose: () => void;
  onMove: (fileId: string, targetFolderId: string | null) => Promise<void>;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  isOpen,
  file,
  onClose,
  onMove
}) => {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && file) {
      setSelectedFolderId(file.folder_id || null);
      loadAllFolders();
    }
  }, [isOpen, file]);

  const loadAllFolders = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/folders?all=true');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error('Failed to load folders for move modal:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const handleConfirmMove = async () => {
    setSubmitting(true);
    try {
      await onMove(file.id, selectedFolderId);
      onClose();
    } catch (err) {
      console.error('Failed to move file:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shadow-2xs">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">Move File</h3>
              <p className="text-xs text-gray-400 truncate max-w-[220px]">
                {file.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Destination Folder Selector */}
        <div className="p-6 space-y-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Select Destination Folder
          </label>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="text-xs">Loading folders...</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {/* Root / My Drive option */}
              <div
                onClick={() => setSelectedFolderId(null)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedFolderId === null
                    ? 'border-purple-600 bg-purple-50/50 shadow-2xs'
                    : 'border-gray-100 hover:border-purple-200 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedFolderId === null ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Root Directory</p>
                    <p className="text-[10px] text-gray-400">My Drive (Top Level)</p>
                  </div>
                </div>
                {selectedFolderId === null && (
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* User Folders */}
              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/50 shadow-2xs'
                        : 'border-gray-100 hover:border-purple-200 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-purple-600 text-white' : 'bg-amber-50 text-amber-600'
                      }`}>
                        <Folder className="w-4 h-4 fill-amber-500/20" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[200px]">
                          {folder.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {folder.parent_id ? 'Subfolder' : 'Folder in My Drive'}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {folders.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  No custom folders created yet. You can move files to Root or create a new folder first.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmMove}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Moving...</span>
              </>
            ) : (
              <span>Confirm Move</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

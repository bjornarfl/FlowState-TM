import { useCallback, useRef, type RefObject } from 'react';
import type { ThreatModel } from '../types/threatModel';
import type { GitHubMetadata, GitHubAction } from '../integrations/github/types';
import type { SaveSource } from '../contexts/SaveStateContext';
import type { FileChangeDetectionHandle } from './useFileChangeDetection';
import {
  saveAutoSaveDraft,
  saveToBrowserStorage,
  updateModelContent,
  saveFileWithPicker,
  writeToFileHandle,
  requestFileHandlePermission,
  storeFileHandle,
} from '../utils/browserStorage';

interface YamlEditorRef {
  getContent: () => string | undefined;
}

interface UseSaveHandlersOptions {
  yamlContent: string;
  yamlEditorRef: RefObject<YamlEditorRef | null>;
  threatModel: ThreatModel | null;
  githubMetadata: GitHubMetadata | null;
  browserModelId: string | null;
  setBrowserModelId: (id: string | null) => void;
  localFileHandle: FileSystemFileHandle | null;
  setLocalFileHandle: (handle: FileSystemFileHandle | null) => void;
  setLocalFileName: (name: string | null) => void;
  setThreatModel: (model: ThreatModel | null) => void;
  saveSource: SaveSource | null;
  markSaved: (source?: SaveSource, timestamp?: number) => void;
  fileChangeDetection: FileChangeDetectionHandle;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setShowCommitModal: (show: boolean) => void;
  requirePat: (action: GitHubAction) => Promise<any>;
}

interface UseSaveHandlersReturn {
  handleSaveToBrowser: () => Promise<void>;
  handleSaveToFile: () => Promise<void>;
  handleSaveToNewFile: () => Promise<void>;
  handleSaveToNewBrowser: () => Promise<void>;
  handleCommitToGitHub: () => Promise<void>;
  handleQuickSave: () => Promise<void>;
  quickSaveRef: RefObject<(() => Promise<void>) | null>;
}

export function useSaveHandlers({
  yamlContent,
  yamlEditorRef,
  threatModel,
  githubMetadata,
  browserModelId,
  setBrowserModelId,
  localFileHandle,
  setLocalFileHandle,
  setLocalFileName,
  setThreatModel,
  saveSource,
  markSaved,
  fileChangeDetection,
  showToast,
  setShowCommitModal,
  requirePat,
}: UseSaveHandlersOptions): UseSaveHandlersReturn {
  const quickSaveRef = useRef<(() => Promise<void>) | null>(null);

  const handleSaveToBrowser = useCallback(async (): Promise<void> => {
    const content = yamlEditorRef.current?.getContent() || yamlContent;
    if (content && threatModel?.name) {
      try {
        let id: string;
        if (browserModelId) {
          // Update existing entry in-place
          await updateModelContent(browserModelId, content, threatModel.name, githubMetadata ?? undefined);
          id = browserModelId;
        } else {
          // Create a new browser storage entry
          id = await saveToBrowserStorage(threatModel.name, content, undefined, githubMetadata ?? undefined);
          setBrowserModelId(id);
        }
        const source: SaveSource = { type: 'browser', modelId: id, modelName: threatModel.name };
        // Update auto-save draft with current content (draft always persists for crash recovery)
        const now = Date.now();
        await saveAutoSaveDraft(threatModel.name, content, githubMetadata ?? undefined, { type: 'browser', modelId: id, modelName: threatModel.name }, now);
        markSaved(source, now);
        showToast(`Saved "${threatModel.name}" to browser storage`, 'success');
      } catch (error) {
        showToast(`Failed to save to browser: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
    }
  }, [yamlContent, threatModel?.name, githubMetadata, browserModelId, markSaved]);

  const handleSaveToFile = useCallback(async (): Promise<void> => {
    const content = yamlEditorRef.current?.getContent() || yamlContent;
    if (!content) {
      showToast('No content to save', 'error');
      return;
    }

    try {
      if (localFileHandle) {
        // We have an existing file handle - try to write directly to it
        const hasPermission = await requestFileHandlePermission(localFileHandle, 'readwrite');
        if (hasPermission) {
          const newLastModified = await writeToFileHandle(localFileHandle, content);
          fileChangeDetection.updateLastKnownModified(newLastModified);
          const source: SaveSource = { type: 'file', handle: localFileHandle, fileName: localFileHandle.name };
          // Update auto-save draft with current content (draft always persists for crash recovery)
          const now = Date.now();
          await saveAutoSaveDraft(threatModel?.name || 'Untitled', content, githubMetadata ?? undefined, { type: 'file', fileName: localFileHandle.name }, now);
          markSaved(source, now);
          showToast(`Saved to ${localFileHandle.name}`, 'success');
        } else {
          // Permission denied - offer to save as new file
          const shouldSaveNew = confirm('Permission to write to the original file was denied. Would you like to save to a new file?');
          if (shouldSaveNew) {
            const handle = await saveFileWithPicker(content, threatModel?.name ? `${threatModel.name}.yaml` : 'threat_model.yaml');
            if (handle) {
              setLocalFileHandle(handle);
              setLocalFileName(handle.name);
              await storeFileHandle(handle);
              const source: SaveSource = { type: 'file', handle, fileName: handle.name };
              // Update auto-save draft with current content (draft always persists for crash recovery)
              const now = Date.now();
              await saveAutoSaveDraft(threatModel?.name || 'Untitled', content, githubMetadata ?? undefined, { type: 'file', fileName: handle.name }, now);
              markSaved(source, now);
              showToast(`Saved to ${handle.name}`, 'success');
            }
          }
        }
      } else {
        // No existing file handle - show the save file picker
        const handle = await saveFileWithPicker(content, threatModel?.name ? `${threatModel.name}.yaml` : 'threat_model.yaml');
        if (handle) {
          setLocalFileHandle(handle);
          setLocalFileName(handle.name);
          await storeFileHandle(handle);
          const source: SaveSource = { type: 'file', handle, fileName: handle.name };
          // Update auto-save draft with current content (draft always persists for crash recovery)
          const now = Date.now();
          await saveAutoSaveDraft(threatModel?.name || 'Untitled', content, githubMetadata ?? undefined, { type: 'file', fileName: handle.name }, now);
          markSaved(source, now);
          showToast(`Saved to ${handle.name}`, 'success');
        }
      }
    } catch (error) {
      showToast(`Failed to save to file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [yamlContent, threatModel?.name, localFileHandle, githubMetadata, markSaved, fileChangeDetection]);

  const handleSaveToNewFile = useCallback(async (): Promise<void> => {
    const content = yamlEditorRef.current?.getContent() || yamlContent;
    if (!content) {
      showToast('No content to save', 'error');
      return;
    }

    try {
      // Always show the save file picker for a new file
      const handle = await saveFileWithPicker(content, threatModel?.name ? `${threatModel.name}.yaml` : 'threat_model.yaml');
      if (handle) {
        setLocalFileHandle(handle);
        setLocalFileName(handle.name);
        await storeFileHandle(handle);
        const source: SaveSource = { type: 'file', handle, fileName: handle.name };
        // Update auto-save draft with current content (draft always persists for crash recovery)
        const now = Date.now();
        await saveAutoSaveDraft(threatModel?.name || 'Untitled', content, githubMetadata ?? undefined, { type: 'file', fileName: handle.name }, now);
        markSaved(source, now);
        showToast(`Saved to ${handle.name}`, 'success');
      }
    } catch (error) {
      showToast(`Failed to save to file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [yamlContent, threatModel?.name, githubMetadata, markSaved]);

  const handleSaveToNewBrowser = useCallback(async (): Promise<void> => {
    const content = yamlEditorRef.current?.getContent() || yamlContent;
    if (!content || !threatModel?.name) {
      showToast('No content to save', 'error');
      return;
    }

    try {
      // Prompt user for a new name
      const newName = prompt('Enter a name for the new browser storage entry:', `${threatModel.name} (copy)`);
      if (!newName) {
        // User cancelled
        return;
      }

      // Create a new browser storage entry with the new name
      const id = await saveToBrowserStorage(newName, content, undefined, githubMetadata ?? undefined);
      setBrowserModelId(id);
      
      // Update threat model name to match the new name
      const updatedThreatModel = { ...threatModel, name: newName };
      setThreatModel(updatedThreatModel);
      
      const source: SaveSource = { type: 'browser', modelId: id, modelName: newName };
      // Update auto-save draft with current content (draft always persists for crash recovery)
      const now = Date.now();
      await saveAutoSaveDraft(newName, content, githubMetadata ?? undefined, { type: 'browser', modelId: id, modelName: newName }, now);
      markSaved(source, now);
      showToast(`Saved as "${newName}" to browser storage`, 'success');
    } catch (error) {
      showToast(`Failed to save to browser: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [yamlContent, threatModel, githubMetadata, markSaved]);

  const handleCommitToGitHub = useCallback(async () => {
    // Ensure we have a PAT before opening the commit modal
    const client = await requirePat('commit');
    if (client) {
      setShowCommitModal(true);
    }
  }, [requirePat]);

  const handleQuickSave = useCallback(async (): Promise<void> => {
    if (!saveSource) {
      // No save source set yet — default to local
      await handleSaveToFile();
      return;
    }
    switch (saveSource.type) {
      case 'browser':
        await handleSaveToBrowser();
        break;
      case 'file':
        await handleSaveToFile();
        break;
      case 'github':
        await handleCommitToGitHub();
        break;
    }
  }, [saveSource, handleSaveToBrowser, handleSaveToFile, handleCommitToGitHub]);

  // Keep ref in sync so keyboard shortcut always calls latest version
  quickSaveRef.current = handleQuickSave;

  return {
    handleSaveToBrowser,
    handleSaveToFile,
    handleSaveToNewFile,
    handleSaveToNewBrowser,
    handleCommitToGitHub,
    handleQuickSave,
    quickSaveRef,
  };
}

import { useCallback } from 'react';
import { produce } from 'immer';
import type { ThreatModel } from '../../../types/threatModel';
import type {
  GitHubMetadata,
  GitHubDomain,
  GitHubAction,
  CommitExtraFilesOptions,
  CommitFile,
} from '../types';
import type { GitHubApiClient } from '../githubApi';
import type { SyncResult } from './useGitHubIntegration';
import type { SaveSource } from '../../../contexts/SaveStateContext';
import { generateMarkdown } from '../../../hooks/useDiagramExport';
import { parseYaml, updateYamlField } from '../../../utils/yamlParser';
import {
  saveAutoSaveDraft,
  saveToBrowserStorage,
} from '../../../utils/browserStorage';

interface YamlEditorRef {
  getContent: () => string | undefined;
}

export interface UseGitHubOperationsOptions {
  yamlContent: string;
  yamlEditorRef: React.RefObject<YamlEditorRef | null>;
  threatModel: ThreatModel | null;
  githubDomain: GitHubDomain;
  githubMetadata: GitHubMetadata | null;
  setGitHubMetadata: (metadata: GitHubMetadata | null) => void;
  setThreatModel: (model: ThreatModel | null) => void;
  setYamlContent: (content: string) => void;
  getApiClient: () => GitHubApiClient | null;
  requirePat: (action: GitHubAction) => Promise<GitHubApiClient | null>;
  cleanupPat: () => void;
  syncWithRepository: (model: ThreatModel) => Promise<SyncResult>;
  closeSettingsModal: () => void;
  captureDiagram: (scale: number) => Promise<string | null | undefined>;
  markSaved: (source?: SaveSource, timestamp?: number) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  showCommitModal: boolean;
  setShowCommitModal: (show: boolean) => void;
  showSyncModal: boolean;
  setShowSyncModal: (show: boolean) => void;
  syncResult: SyncResult | null;
  setSyncResult: (result: SyncResult | null) => void;
}

export interface UseGitHubOperationsReturn {
  handleCommitModalClose: () => void;
  handleCommit: (
    owner: string,
    repo: string,
    branch: string,
    path: string,
    commitMessage: string,
    sha?: string,
    extraFiles?: CommitExtraFilesOptions,
  ) => Promise<void>;
  getCommitApiClient: () => Promise<GitHubApiClient | null>;
  handleSyncWithGitHub: () => Promise<void>;
  handleSyncModalConfirm: () => Promise<void>;
  handleSyncModalCancel: () => void;
}

export function useGitHubOperations({
  yamlContent,
  yamlEditorRef,
  threatModel,
  githubDomain,
  githubMetadata,
  setGitHubMetadata,
  setThreatModel,
  setYamlContent,
  getApiClient,
  requirePat,
  cleanupPat,
  syncWithRepository,
  closeSettingsModal,
  captureDiagram,
  markSaved,
  showToast,
  setShowCommitModal,
  setShowSyncModal,
  syncResult,
  setSyncResult,
}: UseGitHubOperationsOptions): UseGitHubOperationsReturn {

  const applyControlSyncResults = useCallback((controlSyncs: SyncResult['controlsSynced']) => {
    if (!threatModel || !controlSyncs.length) return;

    // Update threat model with synced control statuses
    const updatedModel = produce(threatModel, draft => {
      if (!draft.controls) return;

      for (const syncResult of controlSyncs) {
        const control = draft.controls.find(c => c.ref === syncResult.ref);
        if (!control) continue;

        if (syncResult.synced && syncResult.newStatus !== undefined) {
          control.status = syncResult.newStatus;
          
          // If issue was not found (404), remove the status_link
          if (syncResult.error?.includes('404')) {
            delete control.status_link;
          }
        }
      }
    });

    // Update the YAML content
    let updatedYaml = yamlContent;
    for (const syncResult of controlSyncs) {
      if (syncResult.synced && syncResult.newStatus !== undefined) {
        updatedYaml = updateYamlField(
          updatedYaml,
          'controls',
          syncResult.ref,
          'status',
          syncResult.newStatus
        );
        
        // Remove status_link if issue was not found
        if (syncResult.error?.includes('404')) {
          updatedYaml = updateYamlField(
            updatedYaml,
            'controls',
            syncResult.ref,
            'status_link',
            undefined
          );
        }
      }
    }

    setThreatModel(updatedModel);
    setYamlContent(updatedYaml);
  }, [threatModel, yamlContent, setThreatModel, setYamlContent]);

  const handleCommitModalClose = useCallback(() => {
    setShowCommitModal(false);
  }, [setShowCommitModal]);

  const handleCommit = useCallback(async (
    owner: string,
    repo: string,
    branch: string,
    path: string,
    commitMessage: string,
    sha?: string,
    extraFiles?: CommitExtraFilesOptions
  ): Promise<void> => {
    const content = yamlEditorRef.current?.getContent() || yamlContent;
    if (!content) {
      throw new Error('No content to commit');
    }

    try {
      // Get API client
      let client = getApiClient();
      if (!client) {
        client = await requirePat('commit');
        if (!client) {
          throw new Error('GitHub authentication required');
        }
      }

      // Derive base name from the YAML path for consistent naming
      // e.g., ".threat-models/my-model.yaml" → "my-model"
      const pathDir = path.substring(0, path.lastIndexOf('/') + 1); // ".threat-models/"
      const yamlFilename = path.substring(path.lastIndexOf('/') + 1); // "my-model.yaml"
      const baseName = yamlFilename.replace(/\.(yaml|yml)$/i, ''); // "my-model"

      if (extraFiles?.includeDiagramImage || extraFiles?.includeMarkdownFile) {
        // Multi-file commit using Git Data API
        const files: CommitFile[] = [];

        // Always include the YAML file
        files.push({
          path,
          content,
        });

        // Capture diagram if image is requested
        let pngBase64: string | undefined;
        if (extraFiles.includeDiagramImage) {
          const diagramDataUrl = await captureDiagram(3); // 3x scale
          if (diagramDataUrl) {
            pngBase64 = diagramDataUrl.split(',')[1]; // Strip data:image/png;base64, prefix
            files.push({
              path: `${pathDir}${baseName}.png`,
              content: pngBase64,
              isBase64: true,
            });
          }
        }

        // Generate markdown if requested
        if (extraFiles.includeMarkdownFile && threatModel) {
          // If both image and markdown are selected, reference the PNG file.
          // If only markdown is selected, embed a Mermaid diagram instead.
          const includePngReference = extraFiles.includeDiagramImage && !!pngBase64;

          // Build metadata for the markdown footer links
          const metadataForMarkdown = {
            domain: githubDomain,
            owner,
            repository: repo,
            branch,
            path,
            sha: sha || '',
            loadedAt: Date.now(),
          };

          let markdown = generateMarkdown(
            threatModel,
            threatModel.name || baseName,
            metadataForMarkdown,
            includePngReference
          );

          // If referencing PNG, update the image path to match actual filename
          if (includePngReference) {
            const defaultPngRef = `${(threatModel.name || baseName).replace(/\s+/g, '_').toLowerCase()}_diagram.png`;
            const actualPngFilename = `${baseName}.png`;
            markdown = markdown.replace(defaultPngRef, actualPngFilename);
          }

          files.push({
            path: `${pathDir}${baseName}.md`,
            content: markdown,
          });
        }

        // Perform atomic multi-file commit
        const result = await client.createMultiFileCommit(
          owner,
          repo,
          branch,
          commitMessage,
          files
        );

        // After multi-file commit, get the new YAML file SHA for metadata
        const newYamlSha = await client.getFileSha(owner, repo, path, branch);

        // Create updated metadata
        const updatedMetadata: GitHubMetadata = {
          domain: githubDomain,
          owner,
          repository: repo,
          branch,
          path,
          sha: newYamlSha || result.commitSha,
          loadedAt: Date.now(),
        };

        // Update the metadata state
        setGitHubMetadata(updatedMetadata);

        // Update metadata in browser storage if this model is saved
        if (threatModel?.name) {
          await saveToBrowserStorage(
            threatModel.name,
            content,
            undefined,
            updatedMetadata
          );
        }

        // Update autosave draft with new metadata
        const now = Date.now();
        await saveAutoSaveDraft(
          threatModel?.name || 'Untitled',
          content,
          updatedMetadata,
          undefined,
          now
        );

        const fileCount = files.length;
        const ghSource: SaveSource = { type: 'github', metadata: updatedMetadata };
        markSaved(ghSource, now);
        showToast(`Successfully committed ${fileCount} file${fileCount > 1 ? 's' : ''} to ${owner}/${repo}`, 'success');
      } else {
        // Single-file commit (original behavior)
        const response = await client.createOrUpdateFile(
          owner,
          repo,
          path,
          content,
          commitMessage,
          branch,
          sha
        );

        // Create updated metadata with new SHA and timestamp
        const updatedMetadata: GitHubMetadata = {
          domain: githubDomain,
          owner,
          repository: repo,
          branch,
          path,
          sha: response.content.sha,
          loadedAt: Date.now(),
        };

        // Update the metadata state
        setGitHubMetadata(updatedMetadata);

        // Update metadata in browser storage if this model is saved
        if (threatModel?.name) {
          await saveToBrowserStorage(
            threatModel.name,
            content,
            undefined,
            updatedMetadata
          );
        }

        // Update autosave draft with new metadata
        const now = Date.now();
        await saveAutoSaveDraft(
          threatModel?.name || 'Untitled',
          content,
          updatedMetadata,
          undefined,
          now
        );

        showToast(`Successfully committed to ${owner}/${repo}`, 'success');
        const ghSource: SaveSource = { type: 'github', metadata: updatedMetadata };
        markSaved(ghSource, now);
      }
    } catch (error) {
      throw error; // Re-throw to let modal handle the error display
    }
  }, [yamlContent, githubDomain, threatModel, getApiClient, requirePat, setGitHubMetadata, captureDiagram, markSaved, yamlEditorRef, showToast]);

  const getCommitApiClient = useCallback(() => requirePat('commit'), [requirePat]);

  const handleSyncWithGitHub = useCallback(async () => {
    if (!githubMetadata || !threatModel) {
      showToast('No GitHub metadata available', 'error');
      return;
    }

    // Close the settings modal first so PAT modal can appear if needed
    closeSettingsModal();
    
    try {
      const result = await syncWithRepository(threatModel);
      setSyncResult(result);
      
      if (result.fileConflict) {
        // Show conflict modal
        setShowSyncModal(true);
      } else {
        // No file conflict, just apply control syncs
        if (result.controlsSynced.length > 0) {
          const syncedCount = result.controlsSynced.filter(c => c.synced).length;
          const errorCount = result.controlsSynced.filter(c => c.error).length;
          
          // Apply control updates
          applyControlSyncResults(result.controlsSynced);
          
          showToast(
            `Sync complete: ${syncedCount} control(s) synced with GitHub issues` +
            (errorCount > 0 ? `, ${errorCount} had errors` : '') +
            `, no file conflicts`,
            'success'
          );
        } else {
          showToast('Sync complete: No changes needed', 'success');
        }
        
        // Clean up PAT when no conflict (already done in syncWithRepository)
        // But call it here too in case of any edge cases
        cleanupPat();
      }
    } catch (error) {
      console.error('Sync error:', error);
      showToast(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [githubMetadata, threatModel, syncWithRepository, closeSettingsModal, showToast, applyControlSyncResults, setSyncResult, setShowSyncModal, cleanupPat]);

  const handleSyncModalConfirm = useCallback(async () => {
    // User wants to load the latest version from GitHub
    setShowSyncModal(false);
    
    if (!githubMetadata) return;

    try {
      const client = getApiClient();
      if (!client) {
        showToast('GitHub authentication required', 'error');
        return;
      }

      // Load the latest version
      const { content, sha } = await client.getFileContent(
        githubMetadata.owner,
        githubMetadata.repository,
        githubMetadata.path,
        githubMetadata.branch
      );

      // Parse and load it
      const parsed = parseYaml(content);
      setThreatModel(parsed);
      setYamlContent(content);

      // Update metadata with current time and new SHA
      const updatedMetadata = {
        ...githubMetadata,
        sha,
        loadedAt: Date.now(),
      };
      setGitHubMetadata(updatedMetadata);

      // Save to autosave
      await saveAutoSaveDraft(parsed.name || 'Untitled', content, updatedMetadata);

      // Clean up PAT after successful load
      cleanupPat();

      showToast('Loaded latest version from GitHub', 'success');
    } catch (error) {
      console.error('Failed to load latest:', error);
      showToast(`Failed to load latest version: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      // Clean up PAT even on error
      cleanupPat();
    }
  }, [githubMetadata, getApiClient, setThreatModel, setYamlContent, setGitHubMetadata, cleanupPat, showToast, setShowSyncModal]);

  const handleSyncModalCancel = useCallback(() => {
    setShowSyncModal(false);
    
    // Still apply control syncs even if user keeps current file version
    if (syncResult && syncResult.controlsSynced.length > 0) {
      const syncedCount = syncResult.controlsSynced.filter(c => c.synced).length;
      
      if (syncedCount > 0) {
        applyControlSyncResults(syncResult.controlsSynced);
        showToast(`Control statuses updated (${syncedCount} synced)`, 'success');
      }
    }

    // Clean up PAT after user makes their choice
    cleanupPat();
  }, [syncResult, applyControlSyncResults, cleanupPat, setShowSyncModal, showToast]);

  return {
    handleCommitModalClose,
    handleCommit,
    getCommitApiClient,
    handleSyncWithGitHub,
    handleSyncModalConfirm,
    handleSyncModalCancel,
  };
}

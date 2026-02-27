import { useCallback, type MutableRefObject } from 'react';
import type { ThreatModel } from '../types/threatModel';
import type { GitHubMetadata } from '../integrations/github/types';
import type { SaveSource } from '../contexts/SaveStateContext';
import { parseYaml } from '../utils/yamlParser';
import {
  clearFileHandle,
} from '../utils/browserStorage';

/**
 * Describes how a model was loaded so `useModelLoader` can set the right
 * source-specific state (GitHub metadata, file handle, browser model ID, etc.)
 */
export type LoadSource =
  | { type: 'file'; fileHandle: FileSystemFileHandle }
  | { type: 'browser'; modelId: string; modelName?: string }
  | { type: 'github'; metadata: GitHubMetadata }
  | { type: 'url'; githubMetadata?: GitHubMetadata }
  | { type: 'template' }
  | { type: 'draft'; saveSource?: DraftSaveSource; isDirty?: boolean; lastSavedToSourceAt?: number }
  | { type: 'initial'; githubMetadata?: GitHubMetadata; saveSource?: SaveSource };

/** Mirrors the serialised save-source shape stored in auto-save drafts */
export interface DraftSaveSource {
  type: 'browser' | 'file' | 'github';
  modelId?: string;
  modelName?: string;
  fileName?: string;
  githubMeta?: GitHubMetadata;
}

interface UseModelLoaderOptions {
  buildNodesAndEdges: (model: ThreatModel) => { nodes: any[]; edges: any[] };
  setYamlContent: (content: string) => void;
  setThreatModel: (model: ThreatModel | null) => void;
  setNodes: (nodes: any[] | ((prev: any[]) => any[])) => void;
  setEdges: (edges: any[] | ((prev: any[]) => any[])) => void;
  setGitHubMetadata: (metadata: GitHubMetadata | null) => void;
  setLocalFileHandle: (handle: FileSystemFileHandle | null) => void;
  setLocalFileName: (name: string | null) => void;
  setBrowserModelId: (id: string | null) => void;
  clearHistory: () => void;
  clearSaveState: () => void;
  markSaved: (source?: SaveSource, timestamp?: number) => void;
  markDirty: () => void;
  setSaveSource: (source: SaveSource) => void;
  loadTimestampRef: MutableRefObject<number>;
  pendingFitViewRef: MutableRefObject<boolean>;
}

export function useModelLoader({
  buildNodesAndEdges,
  setYamlContent,
  setThreatModel,
  setNodes,
  setEdges,
  setGitHubMetadata,
  setLocalFileHandle,
  setLocalFileName,
  setBrowserModelId,
  clearHistory,
  clearSaveState,
  markSaved,
  markDirty,
  setSaveSource,
  loadTimestampRef,
  pendingFitViewRef,
}: UseModelLoaderOptions) {
  /**
   * Load a parsed model + YAML content into the editor, setting all
   * source-specific state and rebuilding the diagram.
   *
   * Every load path (file, browser, GitHub, URL, template, draft) funnels
   * through this single function, eliminating the previously-duplicated
   * parse → set state → build nodes/edges → clear history → fit view blocks.
   */
  const loadFromContent = useCallback((
    content: string,
    source: LoadSource,
    /** Supply a pre-parsed model to skip re-parsing (e.g. URL-decoded models) */
    preParsedModel?: ThreatModel,
  ) => {
    const model = preParsedModel ?? parseYaml(content);

    loadTimestampRef.current = Date.now();
    setYamlContent(content);
    setThreatModel(model);

    // --- Source-specific state ---
    switch (source.type) {
      case 'file':
        setGitHubMetadata(null);
        setBrowserModelId(null);
        setLocalFileHandle(source.fileHandle);
        setLocalFileName(source.fileHandle.name);
        markSaved({ type: 'file', handle: source.fileHandle, fileName: source.fileHandle.name });
        break;

      case 'browser':
        setGitHubMetadata(null);
        setLocalFileHandle(null);
        setLocalFileName(null);
        clearFileHandle();
        setBrowserModelId(source.modelId);
        markSaved({ type: 'browser', modelId: source.modelId, modelName: source.modelName || model.name || 'Untitled' });
        break;

      case 'github':
        setLocalFileHandle(null);
        setLocalFileName(null);
        setBrowserModelId(null);
        clearFileHandle();
        setGitHubMetadata(source.metadata);
        markSaved({ type: 'github', metadata: source.metadata });
        break;

      case 'url':
        if (source.githubMetadata) {
          setGitHubMetadata(source.githubMetadata);
        }
        // URL loads don't set a save source — model is ephemeral until saved
        break;

      case 'template':
        setGitHubMetadata(null);
        setLocalFileHandle(null);
        setLocalFileName(null);
        setBrowserModelId(null);
        clearFileHandle();
        clearSaveState();
        break;

      case 'draft':
        // Draft restores whatever save source was persisted
        if (source.saveSource) {
          // Handled by caller after this function returns, because draft
          // restoration involves async operations (e.g. getStoredFileHandle)
        }
        break;

      case 'initial':
        if (source.githubMetadata) {
          setGitHubMetadata(source.githubMetadata);
          if (source.saveSource) {
            setSaveSource(source.saveSource);
          }
        }
        break;
    }

    // --- Rebuild diagram ---
    const { nodes: nodesWithCallbacks, edges: edgesWithCallbacks } = buildNodesAndEdges(model);
    setNodes(nodesWithCallbacks);
    setEdges(edgesWithCallbacks);
    clearHistory();
    pendingFitViewRef.current = true;
  }, [buildNodesAndEdges, clearHistory, setGitHubMetadata, markSaved, clearSaveState, setSaveSource, markDirty]);

  /**
   * Handle YAML editor manual edits — updates the diagram without clearing
   * undo history or fitting the view (the user is actively editing).
   */
  const loadFromYamlUpdate = useCallback((updatedModel: ThreatModel, newYamlContent: string) => {
    setThreatModel(updatedModel);
    setYamlContent(newYamlContent);

    const { nodes: nodesWithCallbacks, edges: edgesWithCallbacks } = buildNodesAndEdges(updatedModel);
    setNodes(nodesWithCallbacks);
    setEdges(edgesWithCallbacks);
  }, [buildNodesAndEdges]);

  return {
    loadFromContent,
    loadFromYamlUpdate,
  };
}

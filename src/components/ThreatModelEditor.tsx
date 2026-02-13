import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { produce } from 'immer';
// @ts-ignore - @xyflow/react has type declaration issues but works at runtime
import { ReactFlow, applyNodeChanges, applyEdgeChanges, Background, Controls, MiniMap, SelectionMode } from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import '../App.css';
import ThreatModelNode from './canvas/ThreatModelNode';
import BoundaryNode from './canvas/BoundaryNode';
import EditableCell from './tables/EditableCell';
import EditableTextarea from './tables/EditableTextarea';
import ParticipantsInput from './ParticipantsInput';
import type { ParticipantsInputRef } from './ParticipantsInput';
import EditableEdge from './canvas/EditableEdge';
import EdgeMarkers from './canvas/EdgeMarkers';
import CustomConnectionLine from './canvas/CustomConnectionLine';
import ComponentsTable, { ComponentsTableRef } from './tables/ComponentsTable';
import AssetsTable, { AssetsTableRef } from './tables/AssetsTable';
import ThreatsTable, { ThreatsTableRef } from './tables/ThreatsTable';
import ControlsTable, { ControlsTableRef } from './tables/ControlsTable';
import ArchitectureSection, { ArchitectureSectionRef } from './tables/ArchitectureSection';
import SummarySection from './tables/SummarySection';
import type { YamlEditorRef } from './YamlEditor';
import { DiscardModal } from './modals/DiscardModal';
import { ExternalChangeModal } from './modals/ExternalChangeModal';
import { PatModal } from './integrations/github/modals/PatModal';
import { GitHubSettingsModal } from './integrations/github/modals/GitHubSettingsModal';
import { GitHubCommitModal } from './integrations/github/modals/GitHubCommitModal';
import { GitHubSyncModal } from './integrations/github/modals/GitHubSyncModal';
import { FileBrowser } from './filebrowser/FileBrowser';
import { GitHubLoadModal } from './integrations/github/modals/GitHubLoadModal';
import { SourceType } from './filebrowser/SourceSelector';
import { ResizeDivider } from './ResizeDivider';
import { loadTemplateByPath } from '../utils/templateLoader';
import { 
  getAutoSaveDraft, 
  clearAutoSaveDraft,
  saveAutoSaveDraft,
  saveToBrowserStorage,
  updateModelContent,
  isFileSystemAccessSupported,
  openFileWithPicker,
  saveFileWithPicker,
  writeToFileHandle,
  requestFileHandlePermission,
  storeFileHandle,
  getStoredFileHandle,
  clearFileHandle,
} from '../utils/browserStorage';
import type { SerializedSaveSource } from '../utils/browserStorage';
import { useGitHubIntegration, SyncResult } from '../hooks/useGitHubIntegration';
import type { GitHubMetadata } from './integrations/github/types';
import { getPat, clearPatIfNotPersisted } from './integrations/github/patStorage';
import { useToast } from '../contexts/ToastContext';
import { useSaveState } from '../contexts/SaveStateContext';
import type { SaveSource } from '../contexts/SaveStateContext';

// Lazy load YamlEditor and its heavy dependencies (syntax-highlighter)
const YamlEditor = lazy(() => import('./YamlEditor'));
import CanvasToolbar from './canvas/CanvasToolbar';
import { CanvasOverlay } from './canvas/CanvasOverlay';
import { Navbar } from './navbar/Navbar';
import { parseYaml, updateYamlField, appendYamlItem, removeRefFromArrayFields, removeYamlItem, modelToYaml } from '../utils/yamlParser';
import { transformThreatModel } from '../utils/flowTransformer';
import { generateShareableUrl, getModelFromUrl, decodeModelFromUrl } from '../utils/urlEncoder';
import { findUnoccupiedPosition } from '../utils/navigationHelpers';
import { generateComponentRef, generateBoundaryRef, generateAssetRef, generateThreatRef, generateControlRef, generateAssetName, generateThreatName, generateControlName, generateComponentName, generateBoundaryName } from '../utils/refGenerators';
import { useDiagramExport, generateMarkdown } from '../hooks/useDiagramExport';
import { useThreatModelState } from '../hooks/useThreatModelState';
import { useFlowDiagram } from '../hooks/useFlowDiagram';
import { useAutoSave } from '../hooks/useAutoSave';
import { useFileChangeDetection } from '../hooks/useFileChangeDetection';
import { useCanvasNavigation } from '../hooks/useCanvasNavigation';
import { useDataFlowCreation } from '../hooks/useDataFlowCreation';
import { useDataFlowReconnection } from '../hooks/useDataFlowReconnection';
import type { ThreatModel, ComponentType} from '../types/threatModel';
import type { GitHubAction, GitHubDomain, CommitExtraFilesOptions, CommitFile } from './integrations/github/types';
import { GitHubApiClient } from './integrations/github/githubApi';

const nodeTypes = {
  threatModelNode: ThreatModelNode,
  boundaryNode: BoundaryNode,
};

const edgeTypes = {
  editableEdge: EditableEdge,
};

// Wrapper component for GitHub file browser that handles PAT requirement
interface GitHubLoadModalWrapperProps {
  domain: GitHubDomain;
  onFileSelect: (content: string, metadata: GitHubMetadata) => void;
  onBack: () => void;
  onError: (error: string) => void;
  requirePat: (action: GitHubAction) => Promise<GitHubApiClient | null>;
}

function GitHubLoadModalWrapper({
  domain,
  onFileSelect,
  onBack,
  onError,
  requirePat,
}: GitHubLoadModalWrapperProps) {
  const [token, setToken] = React.useState<string | null>(null);
  const [activeDomain, setActiveDomain] = React.useState<GitHubDomain>(domain);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    
    // First, check if we already have a PAT for the requested domain
    const existingPat = getPat(domain);
    if (existingPat) {
      setToken(existingPat);
      setActiveDomain(domain);
      setIsLoading(false);
      setIsModalOpen(true);
      return;
    }
    
    // If not, request one - this may change the domain
    requirePat('load').then((client) => {
      if (cancelled) return;
      
      if (client) {
        // PAT was provided, check which domain it was stored for
        // The user might have changed the domain in the modal
        const storedDomain = client.getDomain();
        const pat = getPat(storedDomain);
        if (pat) {
          setToken(pat);
          setActiveDomain(storedDomain);
          setIsLoading(false);
          setIsModalOpen(true);
        } else {
          onError('Failed to retrieve PAT after authentication');
          onBack();
        }
      } else {
        // User cancelled PAT modal - clean up temporary PAT
        clearPatIfNotPersisted();
        onBack();
      }
    }).catch((err) => {
      if (!cancelled) {
        onError(`GitHub authentication failed: ${err.message || 'Unknown error'}`);
        // Clean up temporary PAT on error
        clearPatIfNotPersisted();
        onBack();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [domain, requirePat, onBack, onError]);

  const handleClose = () => {
    setIsModalOpen(false);
    // Clean up temporary PAT when closing the load modal
    clearPatIfNotPersisted();
    onBack();
  };

  if (isLoading || !token) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ 
          color: 'var(--text-primary)',
          background: 'var(--bg-primary)',
          padding: '2rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)',
        }}>
          Authenticating with GitHub...
        </div>
      </div>
    );
  }

  return (
    <GitHubLoadModal
      isOpen={isModalOpen}
      token={token}
      domain={activeDomain}
      onFileSelect={onFileSelect}
      onClose={handleClose}
      onError={onError}
    />
  );
}

export interface ThreatModelEditorProps {
  initialContent?: string;
  initialFile?: File;
  initialGitHubMetadata?: GitHubMetadata;
}

export default function ThreatModelEditor({
  initialContent,
  initialFile,
  initialGitHubMetadata,
}: ThreatModelEditorProps): React.JSX.Element {
  // Use state management hook
  const {
    nodes,
    edges,
    threatModel,
    yamlContent,
    isDraggingEdge,
    isDraggingNode,
    isEditingMode,
    setNodes,
    setEdges,
    setThreatModel,
    setYamlContent,
    setIsDraggingEdge,
    setIsDraggingNode,
    setIsEditingMode,
    threatModelRef,
    nodesRef,
    edgesRef,
    arrowKeyMovedNodesRef,
    updateYaml,
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
    recordState,
    handleAssetNameChange,
    handleAssetDescriptionChange,
    handleThreatNameChange,
    handleThreatDescriptionChange,
    handleThreatStatusChange,
    handleThreatStatusLinkChange,
    handleThreatStatusNoteChange,
    handleControlNameChange,
    handleControlDescriptionChange,
    handleControlStatusChange,
    handleControlStatusLinkChange,
    handleControlStatusNoteChange,
    handleThreatAffectedComponentsChange,
    handleThreatAffectedDataFlowsChange,
    handleThreatAffectedAssetsChange,
    handleControlMitigatesChange,
    handleControlImplementedInChange,
    handleComponentNameChange,
    handleComponentTypeChange,
    handleComponentDescriptionChange,
    handleComponentAssetsChange,
    handleBoundaryNameChange,
    handleBoundaryDescriptionChange,
    handleBoundaryResizeEnd,
    handleDataFlowLabelChange,
    handleDataFlowDirectionChange,
    handleToggleDirectionAndReverse,
    handleThreatModelNameChange,
    handleThreatModelDescriptionChange,
    handleParticipantsChange,
    handleReorderAssets,
    handleReorderComponents,
    handleReorderThreats,
    handleReorderControls,
  } = useThreatModelState();

  // GitHub integration hook
  const {
    domain: githubDomain,
    githubMetadata,
    isPatModalOpen,
    isSettingsModalOpen,
    patModalAction,
    patError,
    isValidatingPat,
    setDomain: setGitHubDomain,
    setGitHubMetadata,
    closePatModal,
    openSettingsModal,
    closeSettingsModal,
    submitPat,
    getApiClient,
    requirePat,
    cleanupPat,
    syncWithRepository,
  } = useGitHubIntegration();
  
  // Local UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCanvasCollapsed, setIsCanvasCollapsed] = useState(false);
  const [sidebarView, setSidebarView] = useState<'tables' | 'yaml'>('tables');
  const [mobileView, setMobileView] = useState<'tables' | 'yaml' | 'canvas'>('tables');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [tablesSectionWidth, setTablesSectionWidth] = useState(() => {
    const saved = localStorage.getItem('tablesSectionWidth');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showExternalChangeModal, setShowExternalChangeModal] = useState(false);
  const [externalChangeContent, setExternalChangeContent] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceType | null>(null);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [localFileHandle, setLocalFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [browserModelId, setBrowserModelId] = useState<string | null>(null);
  const [isWorkingSectionCollapsed, setIsWorkingSectionCollapsed] = useState(false);
  const [isThreatsSectionCollapsed, setIsThreatsSectionCollapsed] = useState(false);
  const [isControlsSectionCollapsed, setIsControlsSectionCollapsed] = useState(false);
  const [isSummarySectionCollapsed, setIsSummarySectionCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const yamlEditorRef = useRef<YamlEditorRef>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const participantsInputRef = useRef<ParticipantsInputRef>(null);
  const componentsTableRef = useRef<ComponentsTableRef>(null);
  const assetsTableRef = useRef<AssetsTableRef>(null);
  const threatsTableRef = useRef<ThreatsTableRef>(null);
  const controlsTableRef = useRef<ControlsTableRef>(null);
  const architectureSectionRef = useRef<ArchitectureSectionRef>(null);
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const reactFlowInstanceRef = useRef<any>(null);
  const pendingFitViewRef = useRef(false);
  const loadedFromUrlRef = useRef(false);
  const justExitedEditModeRef = useRef(false);
  const quickSaveRef = useRef<(() => Promise<void>) | null>(null);

  // Use toast hook
  const { showToast } = useToast();

  // Use save state context
  const {
    saveSource,
    lastSavedAt,
    isDirty,
    setSaveSource,
    markSaved,
    markDirty,
    clearSaveState,
    autoSaveSettings,
  } = useSaveState();

  // Wrapped setIsEditingMode that tracks when we exit edit mode
  const handleEditModeChange = useCallback((isEditing: boolean) => {
    if (!isEditing && isEditingMode) {
      // We're exiting edit mode - set flag to temporarily disable selection
      justExitedEditModeRef.current = true;
      // Clear the flag after a short delay to re-enable selection
      setTimeout(() => {
        justExitedEditModeRef.current = false;
      }, 100);
    }
    setIsEditingMode(isEditing);
  }, [isEditingMode, setIsEditingMode]);

  // Callback to select a specific node (deselects all others)
  const handleSelectNode = useCallback((nodeId: string) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        selected: node.id === nodeId,
      }))
    );
  }, [setNodes]);

  // Use diagram export hook
  const { captureDiagram, handleDownloadFolder, handleCopyToConfluence, handleCopyDiagramToClipboard } = useDiagramExport(threatModel, isDarkMode, githubMetadata);

  // Enable auto-save for YAML content changes
  const saveSourceMeta: SerializedSaveSource | undefined = useMemo(() => {
    if (!saveSource) return undefined;
    switch (saveSource.type) {
      case 'browser':
        return { type: 'browser' as const, modelId: saveSource.modelId, modelName: saveSource.modelName };
      case 'file':
        return { type: 'file' as const, fileName: saveSource.fileName };
      case 'github':
        return { type: 'github' as const, githubMeta: saveSource.metadata };
      default:
        return undefined;
    }
  }, [saveSource]);

  // Determine whether source-level auto-save is active for the current file
  const isAutoSaveToBrowser = autoSaveSettings.autoSaveBrowserFiles && saveSource?.type === 'browser';
  const isAutoSaveToFile = autoSaveSettings.autoSaveLocalFiles && saveSource?.type === 'file';
  const isAutoSavingToSource = isAutoSaveToBrowser || isAutoSaveToFile;

  // --- External file change detection ---
  // Use a ref for the reload callback to avoid forward-reference issues
  // (handleCreateAsset etc. are defined later in the component)
  const reloadFromExternalRef = useRef<((newContent: string) => void) | null>(null);

  const fileChangeDetection = useFileChangeDetection({
    fileHandle: localFileHandle,
    isDirty,
    enabled: saveSource?.type === 'file',
    onExternalChange: useCallback((newContent: string) => {
      reloadFromExternalRef.current?.(newContent);
    }, []),
    onConflictDetected: useCallback((newContent: string) => {
      // Editor is dirty — show conflict modal
      setExternalChangeContent(newContent);
      setShowExternalChangeModal(true);
    }, []),
  });

  useAutoSave(
    threatModel?.name || 'Untitled',
    yamlContent,
    {
      enabled: !!threatModel && !!yamlContent,
      delay: 2000,
      githubMetadata,
      autoSaveToBrowser: isAutoSaveToBrowser,
      autoSaveToFile: isAutoSaveToFile,
      browserModelId: saveSource?.type === 'browser' ? saveSource.modelId : null,
      fileHandle: saveSource?.type === 'file' ? saveSource.handle : null,
      saveSourceMeta,
      lastSavedToSourceAt: lastSavedAt,
      isDirty,
      onSave: () => {
        // When auto-saving to source, update the last-saved timestamp
        if (isAutoSavingToSource) {
          markSaved();
        }
      },
      onFileWritten: (lastModified: number) => {
        // Keep file-change detection in sync with our own writes
        fileChangeDetection.updateLastKnownModified(lastModified);
      },
    }
  );

  // After loading a new file, fit the canvas to show all nodes once they render
  useEffect(() => {
    if (pendingFitViewRef.current && nodes.length > 0 && reactFlowInstanceRef.current) {
      pendingFitViewRef.current = false;
      // Wait one frame for React Flow to measure the new nodes
      requestAnimationFrame(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 400 });
      });
    }
  }, [nodes]);

  // Track dirty state: mark dirty whenever yamlContent changes, unless
  // we're within a load window (used by load handlers to avoid marking a
  // freshly-loaded file as dirty). The timestamp approach survives multiple
  // rapid yamlContent updates that can happen during a single load cycle
  // (e.g. content set → editor sync → normalization).
  const loadTimestampRef = useRef(Date.now()); // initial load counts
  useEffect(() => {
    // Suppress dirty marking for 500ms after a load event
    if (Date.now() - loadTimestampRef.current < 500) {
      return;
    }
    if (yamlContent) {
      markDirty();
    }
  }, [yamlContent, markDirty]);

  // Helper function to check if component is inside boundary
  const isComponentInsideBoundary = useCallback(
    (componentNode: any, boundaryNode: any): boolean => {
      if (!componentNode || !boundaryNode) return false;

      const componentPosition = componentNode.position;
      const nodeWidth = 140;
      const nodeHeight = 80;

      const boundaryPosition = boundaryNode.position;
      // Check multiple possible locations for boundary dimensions (measured, direct props, or style)
      const boundaryWidth = boundaryNode.measured?.width ?? boundaryNode.width ?? boundaryNode.style?.width ?? 0;
      const boundaryHeight = boundaryNode.measured?.height ?? boundaryNode.height ?? boundaryNode.style?.height ?? 0;

      const boundaryBounds = {
        left: boundaryPosition.x,
        right: boundaryPosition.x + boundaryWidth,
        top: boundaryPosition.y,
        bottom: boundaryPosition.y + boundaryHeight,
      };

      // Check if component center is inside boundary
      const componentCenterX = componentPosition.x + nodeWidth / 2;
      const componentCenterY = componentPosition.y + nodeHeight / 2;

      return (
        componentCenterX >= boundaryBounds.left &&
        componentCenterX <= boundaryBounds.right &&
        componentCenterY >= boundaryBounds.top &&
        componentCenterY <= boundaryBounds.bottom
      );
    },
    []
  );

  // Helper function to update boundary memberships based on current positions
  const updateBoundaryMemberships = useCallback(
    (currentNodes: any[]) => {
      if (!threatModel) return;

      // Find all boundaries and their current dimensions
      const boundaryNodes = currentNodes.filter((n) => n.type === 'boundaryNode');
      const componentNodes = currentNodes.filter((n) => n.type === 'threatModelNode');

      // Build a map of which boundaries contain which components
      const boundaryMemberships = new Map<string, Set<string>>();
      
      boundaryNodes.forEach((boundaryNode) => {
        const containedComponents = new Set<string>();
        
        componentNodes.forEach((componentNode) => {
          if (isComponentInsideBoundary(componentNode, boundaryNode)) {
            containedComponents.add(componentNode.id);
          }
        });
        
        boundaryMemberships.set(boundaryNode.id, containedComponents);
      });

      // Update the threat model with new memberships
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          
          draft.boundaries?.forEach((boundary) => {
            const newMembers = boundaryMemberships.get(boundary.ref);
            const components = newMembers ? Array.from(newMembers) : [];
            
            // Get current boundary node to preserve dimensions
            const boundaryNode = boundaryNodes.find((n) => n.id === boundary.ref);
            if (boundaryNode) {
              boundary.x = boundaryNode.position.x;
              boundary.y = boundaryNode.position.y;
              boundary.width = boundaryNode.measured?.width ?? boundaryNode.width ?? boundaryNode.style?.width ?? boundary.width;
              boundary.height = boundaryNode.measured?.height ?? boundaryNode.height ?? boundaryNode.style?.height ?? boundary.height;
            }
            
            boundary.components = components.length > 0 ? components : undefined;
          });
        })
      );
      
      // Update YAML for each boundary's components
      updateYaml((content) => {
        let updated = content;
        boundaryMemberships.forEach((members, boundaryRef) => {
          const components = Array.from(members);
          // Update or add the components field - use empty array to remove if no components
          updated = updateYamlField(updated, 'boundaries', boundaryRef, 'components', components.length > 0 ? components : undefined);
        });
        return updated;
      });
    },
    [threatModel, isComponentInsideBoundary, updateYaml]
  );

  // Use flow diagram hook for ReactFlow interactions
  const {
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onNodeDragStart,
    onSelectionDragStop: onSelectionDragStopOriginal,
    onSelectionDragStart: onSelectionDragStartOriginal,
    onConnect,
    onReconnect,
  } = useFlowDiagram({
    threatModel,
    nodes,
    edges,
    setNodes,
    setEdges,
    setThreatModel,
    setIsDraggingNode,
    setIsEditingMode,
    isDraggingNode,
    threatModelRef,
    nodesRef,
    edgesRef,
    arrowKeyMovedNodesRef,
    updateYaml,
    updateBoundaryMemberships,
    isComponentInsideBoundary,
    handleDataFlowLabelChange,
    handleDataFlowDirectionChange,
    handleToggleDirectionAndReverse,
    recordState,
  });

  // Use node navigation hook for Option/Alt + arrow keys
  useCanvasNavigation({
    nodes,
    edges,
    setNodes,
    setEdges,
    isEditingMode,
    reactFlowInstance: reactFlowInstanceRef.current,
  });

  // Use data flow creation hook for keyboard-based flow creation (d key)
  const { creationState, cancelCreation } = useDataFlowCreation({
    nodes,
    edges,
    setNodes,
    isEditingMode,
    onConnect,
    reactFlowInstance: reactFlowInstanceRef.current,
  });

  // Use data flow reconnection hook for keyboard-based flow reconnection (d key on edge)
  const { reconnectionState, cancelReconnection } = useDataFlowReconnection({
    nodes,
    edges,
    setNodes,
    setEdges,
    isEditingMode,
    reactFlowInstance: reactFlowInstanceRef.current,
  });

  // Wrap selection handlers to track selection state
  const onSelectionDragStart = useCallback((event: any, nodes: any[]) => {
    setIsSelecting(true);
    onSelectionDragStartOriginal(event, nodes);
  }, [onSelectionDragStartOriginal]);

  const onSelectionDragStop = useCallback((event: any, nodes: any[]) => {
    setIsSelecting(false);
    onSelectionDragStopOriginal(event, nodes);
  }, [onSelectionDragStopOriginal]);

  // Handle selection box start/end
  const onSelectionStart = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const onSelectionEnd = useCallback(() => {
    setIsSelecting(false);
  }, []);

  // Handle clicking on the canvas pane (background) to deselect nodes and cancel data flow operations
  const onPaneClick = useCallback(() => {
    setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, selected: false })));
    setEdges((currentEdges) => currentEdges.map((edge) => ({ ...edge, selected: false })));
    cancelCreation();
    cancelReconnection();
  }, [setNodes, setEdges, cancelCreation, cancelReconnection]);

  // Handle clicking on nodes to cancel data flow operations
  // Don't cancel when Cmd/Ctrl is pressed (for multi-selection)
  const onNodeClick = useCallback((event: React.MouseEvent, _node: any) => {
    // Only cancel operations if Cmd/Ctrl is not pressed (to allow multi-selection)
    if (!event.metaKey && !event.ctrlKey) {
      cancelCreation();
      cancelReconnection();
    }
  }, [cancelCreation, cancelReconnection]);

  // Handle clicking on edges to cancel data flow operations
  const onEdgeClick = useCallback(() => {
    cancelCreation();
    cancelReconnection();
  }, [cancelCreation, cancelReconnection]);

  // Handle clicking outside the canvas (e.g., in tables section) to deselect nodes and cancel data flow operations
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside the canvas
      if (reactFlowWrapperRef.current && !reactFlowWrapperRef.current.contains(target)) {
        // Deselect all nodes and edges
        setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, selected: false })));
        setEdges((currentEdges) => currentEdges.map((edge) => ({ ...edge, selected: false })));
        // Cancel any active data flow operations
        cancelCreation();
        cancelReconnection();
      }
    };

    document.addEventListener('mousedown', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [setNodes, setEdges, cancelCreation, cancelReconnection]);

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Save tables section width to localStorage
  useEffect(() => {
    localStorage.setItem('tablesSectionWidth', tablesSectionWidth.toString());
  }, [tablesSectionWidth]);

  // Handler for resizing tables section
  const handleResize = useCallback((width: number) => {
    setTablesSectionWidth(width);
  }, []);

  // Keyboard shortcuts for undo/redo and edit mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
      
      // Check if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      const isEditing = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.contentEditable === 'true';
      
      if (isCtrlOrCmd && !isEditing) {
        if (event.shiftKey && event.key.toLowerCase() === 'z') {
          // Cmd/Ctrl + Shift + Z = Redo
          event.preventDefault();
          redo();
        } else if (event.key.toLowerCase() === 'z') {
          // Cmd/Ctrl + Z = Undo
          event.preventDefault();
          undo();
        }
      }

      // Cmd/Ctrl + S = Quick save (works even when editing text)
      if (isCtrlOrCmd && event.key.toLowerCase() === 's') {
        event.preventDefault();
        quickSaveRef.current?.();
      }
      
      // Press '-' to toggle all table sections
      if (event.key === '-' && !isEditing && !isCtrlOrCmd) {
        event.preventDefault();
        // Check if all sections are currently collapsed or expanded
        const allCollapsed = isWorkingSectionCollapsed && isThreatsSectionCollapsed && isControlsSectionCollapsed && isSummarySectionCollapsed;
        const allExpanded = !isWorkingSectionCollapsed && !isThreatsSectionCollapsed && !isControlsSectionCollapsed && !isSummarySectionCollapsed;
        
        // If all are collapsed or mixed state, expand all. If all are expanded, collapse all.
        const shouldExpand = allCollapsed || (!allExpanded);
        
        setIsWorkingSectionCollapsed(!shouldExpand);
        setIsThreatsSectionCollapsed(!shouldExpand);
        setIsControlsSectionCollapsed(!shouldExpand);
        setIsSummarySectionCollapsed(!shouldExpand);
      }
      
      // Press 'e' to start edit mode on selected node or edge
      if (event.key.toLowerCase() === 'e' && !isEditing && !isCtrlOrCmd) {
        const selectedNodes = nodes.filter((node) => node.selected);
        const selectedEdges = edges.filter((edge) => edge.selected);
        
        if (selectedNodes.length === 1) {
          event.preventDefault();
          const selectedNode = selectedNodes[0];
          
          // Trigger edit mode by updating the node data
          setNodes((prevNodes) => 
            prevNodes.map((node) => 
              node.id === selectedNode.id
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      initialEditMode: true,
                    },
                  }
                : node
            )
          );
          
          // Reset initialEditMode after a short delay to allow future toggling
          setTimeout(() => {
            setNodes((prevNodes) => 
              prevNodes.map((node) => 
                node.id === selectedNode.id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        initialEditMode: false,
                      },
                    }
                  : node
              )
            );
          }, 100);
        } else if (selectedEdges.length === 1) {
          event.preventDefault();
          const selectedEdge = selectedEdges[0];
          
          // Trigger edit mode by updating the edge data
          setEdges((prevEdges) => 
            prevEdges.map((edge) => 
              edge.id === selectedEdge.id
                ? {
                    ...edge,
                    data: {
                      ...edge.data,
                      initialEditMode: true,
                    },
                  }
                : edge
            )
          );
          
          // Reset initialEditMode after a short delay to allow future toggling
          setTimeout(() => {
            setEdges((prevEdges) => 
              prevEdges.map((edge) => 
                edge.id === selectedEdge.id
                  ? {
                      ...edge,
                      data: {
                        ...edge.data,
                        initialEditMode: false,
                      },
                    }
                  : edge
              )
            );
          }, 100);
        }
      }
      
      // Arrow key movement for selected nodes (but not when alt/option is pressed for navigation or during data flow creation)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && !isEditingMode && !isCtrlOrCmd && !event.altKey && creationState.phase === 'idle') {
        const selectedNodes = nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          
          const moveAmount = event.shiftKey ? 25 : 5;
          let deltaX = 0;
          let deltaY = 0;
          
          switch (event.key) {
            case 'ArrowUp':
              deltaY = -moveAmount;
              break;
            case 'ArrowDown':
              deltaY = moveAmount;
              break;
            case 'ArrowLeft':
              deltaX = -moveAmount;
              break;
            case 'ArrowRight':
              deltaX = moveAmount;
              break;
          }
          
          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              if (node.selected) {
                // Track that this node was moved via arrow keys
                // The keyup handler in useFlowDiagram will handle updating threat model state and YAML
                arrowKeyMovedNodesRef.current.add(node.id);
                
                return {
                  ...node,
                  position: {
                    x: node.position.x + deltaX,
                    y: node.position.y + deltaY,
                  },
                };
              }
              return node;
            })
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, nodes, setNodes, creationState.phase, isWorkingSectionCollapsed, isThreatsSectionCollapsed, isControlsSectionCollapsed, isSummarySectionCollapsed]);

  // Sync YAML content to editor ref after state updates
  useEffect(() => {
    if (yamlEditorRef.current) {
      yamlEditorRef.current.setContent(yamlContent);
    }
  }, [yamlContent]);

  // Update all node availableAssets when threat model assets change
  useEffect(() => {
    if (!threatModel) return;
    
    const availableAssets = threatModel.assets?.map(a => ({ ref: a.ref, name: a.name })) || [];
    
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.type === 'threatModelNode') {
          return {
            ...node,
            data: {
              ...node.data,
              availableAssets,
            },
          };
        }
        return node;
      })
    );
  }, [threatModel?.assets, setNodes]);

  // Update nodes with data flow creation/reconnection state (focused handle and connection focus)
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.type === 'threatModelNode') {
          // Determine if this node's handles should show focus (for creation or reconnection)
          const shouldShowHandleFocus = 
            (creationState.phase === 'source-handle' && node.id === creationState.sourceNodeId) ||
            (creationState.phase === 'target-handle' && node.id === creationState.targetNodeId) ||
            (reconnectionState.phase === 'source-handle' && node.id === reconnectionState.sourceNodeId) ||
            (reconnectionState.phase === 'target-handle' && node.id === reconnectionState.targetNodeId);
          
          const focusedHandleId = shouldShowHandleFocus 
            ? (creationState.phase !== 'idle' ? creationState.focusedHandleId : reconnectionState.focusedHandleId)
            : null;
          
          // Hide selection border on source node during data flow creation
          const isInDataFlowCreation = 
            (creationState.phase !== 'idle' && node.id === creationState.sourceNodeId) ||
            (reconnectionState.phase !== 'idle' && (node.id === reconnectionState.sourceNodeId || node.id === reconnectionState.targetNodeId));
          
          // Show handles when in handle selection mode (phase 1 or 3)
          const isHandleSelectionMode = shouldShowHandleFocus;
          
          return {
            ...node,
            data: {
              ...node.data,
              focusedHandleId,
              isInDataFlowCreation,
              isHandleSelectionMode,
              // isFocusedForConnection is already set by the useDataFlowCreation/useDataFlowReconnection hooks
            },
          };
        }
        return node;
      })
    );
  }, [
    creationState.phase, 
    creationState.sourceNodeId, 
    creationState.targetNodeId, 
    creationState.focusedHandleId, 
    reconnectionState.phase,
    reconnectionState.sourceNodeId,
    reconnectionState.targetNodeId,
    reconnectionState.focusedHandleId,
    setNodes
  ]);

  const handleCanvasCollapse = useCallback((): void => {
    setIsCanvasCollapsed((prevState) => {
      const newCanvasState = !prevState;
      // If canvas is being collapsed, auto-expand sidebar if needed
      if (newCanvasState && isCollapsed) {
        setIsCollapsed(false);
      }
      return newCanvasState;
    });
  }, [isCollapsed]);

  const handleSidebarCollapse = useCallback((): void => {
    setIsCollapsed((prevState) => {
      const newSidebarState = !prevState;
      // If sidebar is being collapsed, auto-expand canvas if needed
      if (newSidebarState && isCanvasCollapsed) {
        setIsCanvasCollapsed(false);
      }
      return newSidebarState;
    });
  }, [isCanvasCollapsed]);

  /**
   * Handle mobile view changes - synchronize with sidebarView
   */
  const handleMobileViewChange = useCallback((view: 'tables' | 'yaml' | 'canvas'): void => {
    setMobileView(view);
    // Synchronize sidebarView for tables and yaml views
    if (view === 'tables' || view === 'yaml') {
      setSidebarView(view);
    }
  }, []);

  /**
   * Add a new component to the canvas
   */
  const handleAddComponent = useCallback((componentType: ComponentType, position?: { x: number; y: number }): void => {
    const ref = generateComponentRef(threatModelRef.current);
    
    // Generate name from ref
    const name = generateComponentName(ref);
    
    // Place at provided position or at center of viewport
    let x: number, y: number;
    if (position) {
      x = position.x;
      y = position.y;
    } else {
      // Get center of viewport in flow coordinates
      if (reactFlowInstanceRef.current && reactFlowWrapperRef.current) {
        const bounds = reactFlowWrapperRef.current.getBoundingClientRect();
        // Calculate center in absolute screen coordinates
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        
        // Convert screen coordinates to flow coordinates and center the node
        const flowCenter = reactFlowInstanceRef.current.screenToFlowPosition({
          x: centerX,
          y: centerY,
        });
        
        const targetX = Math.round(flowCenter.x - 70); // Center horizontally (140/2)
        const targetY = Math.round(flowCenter.y - 40); // Center vertically (80/2)
        
        // Find an unoccupied position near the target
        // Components are 140x80
        const unoccupiedPos = findUnoccupiedPosition(targetX, targetY, nodesRef.current, 140, 80);
        x = unoccupiedPos.x;
        y = unoccupiedPos.y;
      } else {
        // Fallback to origin if reactFlow instance is not available
        x = 0;
        y = 0;
      }
    }
    
    // Create the new component object
    const newComponent = {
      ref,
      name,
      component_type: componentType,
      x,
      y,
    };
    
    // Update threat model state
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        draft.components.push(newComponent);
      })
    );
    
    // Update YAML
    updateYaml((content) => appendYamlItem(content, 'components', newComponent));
    
    // Add the node to the diagram
    const newNode = {
      id: ref,
      type: 'threatModelNode',
      position: { x, y },
      selected: true,
      data: {
        label: name,
        ref,
        description: undefined,
        componentType: componentType,
        assets: [],
        availableAssets: threatModelRef.current?.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
        initialEditMode: true,
        onNameChange: (newName: string) => handleComponentNameChange(ref, newName),
        onEditModeChange: handleEditModeChange,
        onTypeChange: (newType: ComponentType) => handleComponentTypeChange(ref, newType),
        onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(ref, newDescription),
        onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(ref, newAssets),
        onCreateAsset: handleCreateAsset,
        onSelectNode: () => handleSelectNode(ref),
      },
    };
    
    // Deselect all other nodes, then add the new selected node
    setNodes((prevNodes) => [
      ...prevNodes.map(n => ({ ...n, selected: false })),
      newNode
    ]);
    
    // Record state for undo/redo after node creation
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, handleComponentNameChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, recordState]);

  /**
   * Add a new boundary to the canvas
   */
  const handleAddBoundary = useCallback((position?: { x: number; y: number }): void => {
    const ref = generateBoundaryRef(threatModelRef.current);
    const name = generateBoundaryName(ref);
    
    // Get boundary count for z-index calculation
    const boundaryCount = nodesRef.current.filter(n => n.type === 'boundaryNode').length;
    
    // Place at provided position or at center of viewport
    let x: number, y: number;
    if (position && !isNaN(position.x) && !isNaN(position.y)) {
      x = position.x;
      y = position.y;
    } else {
      // Get center of viewport in flow coordinates
      if (reactFlowInstanceRef.current && reactFlowWrapperRef.current) {
        const bounds = reactFlowWrapperRef.current.getBoundingClientRect();
        // Calculate center in absolute screen coordinates
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        
        // Convert screen coordinates to flow coordinates and center the boundary
        const flowCenter = reactFlowInstanceRef.current.screenToFlowPosition({
          x: centerX,
          y: centerY,
        });
        
        const targetX = Math.round(flowCenter.x - 75); // Center horizontally (150/2)
        const targetY = Math.round(flowCenter.y - 37.5); // Center vertically (75/2)
        
        // Find an unoccupied position near the target
        // Boundaries are 150x75
        const unoccupiedPos = findUnoccupiedPosition(targetX, targetY, nodesRef.current, 150, 75);
        x = unoccupiedPos.x;
        y = unoccupiedPos.y;
      } else {
        // Fallback to origin if reactFlow instance is not available
        x = 0;
        y = 0;
      }
    }
    
    // Start with minimum size
    const width = 150;
    const height = 75;
    
    // Create the new boundary object
    const newBoundary = {
      ref,
      name,
      x,
      y,
      width,
      height,
    };
    
    // Update threat model state
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        if (!draft.boundaries) {
          draft.boundaries = [];
        }
        draft.boundaries.push(newBoundary);
      })
    );
    
    // Update YAML
    updateYaml((content) => appendYamlItem(content, 'boundaries', newBoundary));
    
    // Calculate z-index based on existing boundaries
    const zIndex = -(boundaryCount + 2) * 10;
    
    // Add the node to the diagram
    const newNode = {
      id: ref,
      type: 'boundaryNode',
      position: { x, y },
      selectable: true,
      style: {
        width,
        height,
        zIndex,
      },
      data: {
        label: name,
        description: undefined,
        onNameChange: (newName: string) => handleBoundaryNameChange(ref, newName),
        onEditModeChange: handleEditModeChange,
        onResizeEnd: (w: number, h: number) => handleBoundaryResizeEnd(ref, w, h),
      },
    };
    
    setNodes((prevNodes) => [...prevNodes, newNode]);
    
    // Record state for undo/redo after node creation
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, handleBoundaryNameChange, handleBoundaryResizeEnd, recordState]);

  /**
   * Add a new asset
   */
  const handleAddAsset = useCallback((): void => {
    const ref = generateAssetRef(threatModelRef.current);
    const newAsset = {
      ref,
      name: generateAssetName(ref),
    };
    
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        if (!draft.assets) {
          draft.assets = [];
        }
        draft.assets.push(newAsset);
      })
    );
    
    updateYaml((content) => appendYamlItem(content, 'assets', newAsset));
    
    // Record state for undo/redo
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, recordState]);

  /**
   * Create a new asset with a given name (called from EditablePicker)
   */
  const handleCreateAsset = useCallback((name: string): string => {
    const ref = generateAssetRef(threatModelRef.current);
    const newAsset = {
      ref,
      name: name.trim(),
    };
    
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        if (!draft.assets) {
          draft.assets = [];
        }
        draft.assets.push(newAsset);
      })
    );
    
    updateYaml((content) => appendYamlItem(content, 'assets', newAsset));
    
    // Record state for undo/redo
    setTimeout(() => {
      recordState();
    }, 0);
    
    return ref;
  }, [updateYaml, recordState]);

  /**
   * Remove an asset
   */
  const handleRemoveAsset = useCallback((assetRef: string): void => {
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        
        // Remove asset
        if (draft.assets) {
          draft.assets = draft.assets.filter((a) => a.ref !== assetRef);
        }
        
        // Remove from components' assets
        draft.components.forEach((c) => {
          if (c.assets) {
            c.assets = c.assets.filter((a) => a !== assetRef);
          }
        });
        
        // Remove from threats' affected_assets
        draft.threats?.forEach((t) => {
          if (t.affected_assets) {
            t.affected_assets = t.affected_assets.filter((a) => a !== assetRef);
          }
        });
      })
    );
    
    updateYaml((content) => {
      let updated = removeYamlItem(content, 'assets', assetRef);
      updated = removeRefFromArrayFields(updated, assetRef, ['assets', 'affected_assets']);
      return updated;
    });
    
    // Record state for undo/redo
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, recordState]);

  /**
   * Add a new threat
   */
  const handleAddThreat = useCallback((): void => {
    const ref = generateThreatRef(threatModelRef.current);
    const newThreat = {
      ref,
      name: generateThreatName(ref),
    };
    
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        if (!draft.threats) {
          draft.threats = [];
        }
        draft.threats.push(newThreat);
      })
    );
    
    updateYaml((content) => appendYamlItem(content, 'threats', newThreat));
    
    // Record state for undo/redo
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, recordState]);

  /**
   * Remove a threat
   */
  const handleRemoveThreat = useCallback((threatRef: string): void => {
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        
        // Remove threat
        if (draft.threats) {
          draft.threats = draft.threats.filter((t) => t.ref !== threatRef);
        }
        
        // Remove from controls' mitigates
        draft.controls?.forEach((c) => {
          if (c.mitigates) {
            c.mitigates = c.mitigates.filter((m) => m !== threatRef);
          }
        });
      })
    );
    
    updateYaml((content) => {
      let updated = removeYamlItem(content, 'threats', threatRef);
      updated = removeRefFromArrayFields(updated, threatRef, ['mitigates']);
      return updated;
    });
    
    // Record state for undo/redo
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, recordState]);

  /**
   * Add a new control
   */
  const handleAddControl = useCallback((): void => {
    const ref = generateControlRef(threatModelRef.current);
    const newControl = {
      ref,
      name: generateControlName(ref),
    };
    
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        if (!draft.controls) {
          draft.controls = [];
        }
        draft.controls.push(newControl);
      })
    );
    
    updateYaml((content) => appendYamlItem(content, 'controls', newControl));
    
    // Record state for undo/redo
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, recordState]);

  /**
   * Remove a control
   */
  const handleRemoveControl = useCallback((controlRef: string): void => {
    setThreatModel(
      produce((draft) => {
        if (!draft || !draft.controls) return;
        draft.controls = draft.controls.filter((c) => c.ref !== controlRef);
      })
    );
    
    updateYaml((content) => removeYamlItem(content, 'controls', controlRef));
    
    // Record state for undo/redo
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, recordState]);

  /**
   * Remove a component from the table (and canvas)
   */
  const handleRemoveComponent = useCallback((componentRef: string): void => {
    const connectedEdgeIds = edgesRef.current
      .filter((e) => e.source === componentRef || e.target === componentRef)
      .map((e) => e.id);
    
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        
        // Remove component
        draft.components = draft.components.filter((c) => c.ref !== componentRef);
        
        // Remove connected data flows
        if (draft.data_flows) {
          draft.data_flows = draft.data_flows.filter((df) => !connectedEdgeIds.includes(df.ref));
        }
        
        // Remove from boundaries
        draft.boundaries?.forEach((b) => {
          if (b.components) {
            b.components = b.components.filter((c) => c !== componentRef);
          }
        });
        
        // Remove from threats
        draft.threats?.forEach((t) => {
          if (t.affected_components) {
            t.affected_components = t.affected_components.filter((c) => c !== componentRef);
          }
          if (t.affected_data_flows) {
            t.affected_data_flows = t.affected_data_flows.filter((df) => !connectedEdgeIds.includes(df));
          }
        });
        
        // Remove from controls
        draft.controls?.forEach((c) => {
          if (c.implemented_in) {
            c.implemented_in = c.implemented_in.filter((comp) => comp !== componentRef);
          }
        });
      })
    );
    
    updateYaml((content) => {
      let updated = removeYamlItem(content, 'components', componentRef);
      updated = removeRefFromArrayFields(updated, componentRef, [
        'components',
        'affected_components',
        'implemented_in',
      ]);
      for (const edgeId of connectedEdgeIds) {
        updated = removeYamlItem(updated, 'data_flows', edgeId);
        updated = removeRefFromArrayFields(updated, edgeId, ['affected_data_flows']);
      }
      return updated;
    });
    
    setNodes((prevNodes) => prevNodes.filter((n) => n.id !== componentRef));
    setEdges((prevEdges) => prevEdges.filter((e) => e.source !== componentRef && e.target !== componentRef));
  }, [updateYaml]);

  /**
   * Remove a boundary from the table (and canvas)
   */
  const handleRemoveBoundary = useCallback((boundaryRef: string): void => {
    setThreatModel(
      produce((draft) => {
        if (!draft || !draft.boundaries) return;
        draft.boundaries = draft.boundaries.filter((b) => b.ref !== boundaryRef);
      })
    );
    
    updateYaml((content) => removeYamlItem(content, 'boundaries', boundaryRef));
    
    setNodes((prevNodes) => prevNodes.filter((n) => n.id !== boundaryRef));
  }, [updateYaml]);

  /**
   * Remove a data flow from the table (and canvas)
   */
  const handleRemoveDataFlow = useCallback((dataFlowRef: string): void => {
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        
        // Remove data flow
        if (draft.data_flows) {
          draft.data_flows = draft.data_flows.filter((df) => df.ref !== dataFlowRef);
        }
        
        // Remove from threats
        draft.threats?.forEach((t) => {
          if (t.affected_data_flows) {
            t.affected_data_flows = t.affected_data_flows.filter((df) => df !== dataFlowRef);
          }
        });
      })
    );
    
    updateYaml((content) => {
      let updated = removeYamlItem(content, 'data_flows', dataFlowRef);
      updated = removeRefFromArrayFields(updated, dataFlowRef, ['affected_data_flows']);
      return updated;
    });
    
    setEdges((prevEdges) => prevEdges.filter((e) => e.id !== dataFlowRef));
  }, [updateYaml]);

  // Keyboard hotkeys for creating components (1-4)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Get the mouse position in flow coordinates
      const getFlowPosition = () => {
        if (!reactFlowInstanceRef.current) return null;
        
        // Use ReactFlow's built-in screenToFlowPosition method for accurate transformation
        const flowPosition = reactFlowInstanceRef.current.screenToFlowPosition({
          x: mousePositionRef.current.x,
          y: mousePositionRef.current.y,
        });
        
        // Validate that we got valid numbers, not NaN
        if (isNaN(flowPosition.x) || isNaN(flowPosition.y)) {
          return null;
        }
        
        // Offset by half the node size to center the node at cursor position
        // Standard node size is approximately 140x80
        return { x: flowPosition.x - 70, y: flowPosition.y - 40 };
      };

      const position = getFlowPosition();
      
      switch (event.key) {
        case '1':
          event.preventDefault();
          handleAddComponent('internal', position || undefined);
          break;
        case '2':
          event.preventDefault();
          handleAddComponent('external_dependency', position || undefined);
          break;
        case '3':
          event.preventDefault();
          handleAddComponent('data_store', position || undefined);
          break;
        case '4':
          event.preventDefault();
          handleAddBoundary(position || undefined);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleAddComponent, handleAddBoundary]);

  /**
   * Handle drag and drop for adding components and boundaries
   */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    if (!reactFlowInstanceRef.current) return;

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    try {
      const dragData = JSON.parse(type);
      const rawPosition = reactFlowInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Calculate offset to center the component/boundary at cursor position
      let position;
      if (dragData.type === 'component') {
        // Standard component size is approximately 140x80
        position = {
          x: Math.round(rawPosition.x - 70),
          y: Math.round(rawPosition.y - 40),
        };
        handleAddComponent(dragData.componentType, position);
      } else if (dragData.type === 'boundary') {
        // Boundary minimum size is 150x75
        position = {
          x: Math.round(rawPosition.x - 75),
          y: Math.round(rawPosition.y - 37.5),
        };
        handleAddBoundary(position);
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  }, [handleAddComponent, handleAddBoundary]);

  /**
   * Cross-table navigation callbacks
   */
  // Map column names between Assets and Threats tables
  const mapAssetsToThreatsColumn = useCallback((assetsColumn: 'name' | 'description'): 'name' | 'description' | 'items' | 'status' => {
    // name -> name, description -> description
    return assetsColumn;
  }, []);

  const mapThreatsToAssetsColumn = useCallback((threatsColumn: 'name' | 'description' | 'items' | 'status'): 'name' | 'description' => {
    // name -> name, description -> description, items -> description, status -> description (fallback)
    return threatsColumn === 'name' ? 'name' : 'description';
  }, []);

  // Map column names between Threats and Controls tables
  const mapThreatsToControlsColumn = useCallback((threatsColumn: 'name' | 'description' | 'items' | 'status'): number => {
    // name -> 0 (name), description -> 1 (description), items -> 2 (items), status -> 3 (status)
    if (threatsColumn === 'name') return 0;
    if (threatsColumn === 'description') return 1;
    if (threatsColumn === 'items') return 2;
    return 3; // status
  }, []);

  const mapControlsToThreatsColumn = useCallback((controlsColumnIndex: number): 'name' | 'description' | 'items' | 'status' => {
    // 0 (name) -> name, 1 (description) -> description, 2 (items) -> items, 3 (status) -> status
    if (controlsColumnIndex === 0) return 'name';
    if (controlsColumnIndex === 1) return 'description';
    if (controlsColumnIndex === 2) return 'items';
    return 'status';
  }, []);

  // Title and Description navigation callbacks
  const handleTitleNavigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (direction === 'down') {
      descriptionInputRef.current?.focus();
    }
  }, []);

  const handleTitleTabPress = useCallback((shiftKey: boolean) => {
    if (!shiftKey) {
      descriptionInputRef.current?.focus();
    }
  }, []);

  const handleDescriptionNavigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (direction === 'up') {
      titleInputRef.current?.focus();
    } else if (direction === 'down') {
      participantsInputRef.current?.focus();
    }
  }, []);

  const handleDescriptionTabPress = useCallback((shiftKey: boolean) => {
    if (shiftKey) {
      titleInputRef.current?.focus();
    } else {
      participantsInputRef.current?.focus();
    }
  }, []);

  // Participants navigation callbacks
  const handleParticipantsNavigate = useCallback((direction: 'up' | 'down') => {
    if (direction === 'up') {
      descriptionInputRef.current?.focus();
    } else if (direction === 'down') {
      componentsTableRef.current?.focusCellByColumn('name', 0);
    }
  }, []);

  const handleParticipantsTabPress = useCallback((shiftKey: boolean) => {
    if (shiftKey) {
      descriptionInputRef.current?.focus();
    } else {
      componentsTableRef.current?.focusCellByColumn('name', 0);
    }
  }, []);

  // Components navigation callbacks
  const handleComponentsNavigateToNextTable = useCallback((column: 'name' | 'type' | 'description' | 'assets') => {
    const targetColumn = column === 'type' ? 'name' : (column === 'assets' ? 'description' : column);
    assetsTableRef.current?.focusCellByColumn(targetColumn as 'name' | 'description', 0);
  }, []);

  const handleComponentsNavigateToPreviousTable = useCallback((_column: 'name' | 'type' | 'description' | 'assets') => {
    // Navigate back to participants field
    participantsInputRef.current?.focus();
  }, []);

  // Assets navigation callbacks
  const handleAssetsNavigateToNextTable = useCallback((column: 'name' | 'description') => {
    const targetColumn = mapAssetsToThreatsColumn(column);
    threatsTableRef.current?.focusCellByColumn(targetColumn, 0);
  }, [mapAssetsToThreatsColumn]);

  const handleAssetsNavigateToPreviousTable = useCallback((column: 'name' | 'description') => {
    // Navigate back to components table, mapping to the appropriate column
    const components = threatModel?.components || [];
    if (components.length > 0) {
      // Map assets column to components column: name -> name, description -> description
      const targetColumn = column === 'description' ? 'description' : 'name';
      componentsTableRef.current?.focusCellByColumn(targetColumn, components.length - 1);
    } else {
      descriptionInputRef.current?.focus();
    }
  }, [threatModel?.components]);

  // Threats navigation callbacks
  const handleThreatsNavigateToNextTable = useCallback((column: 'name' | 'description' | 'items' | 'status') => {
    const targetColumnIndex = mapThreatsToControlsColumn(column);
    controlsTableRef.current?.focusCellByColumnIndex(targetColumnIndex, 0);
  }, [mapThreatsToControlsColumn]);

  const handleThreatsNavigateToPreviousTable = useCallback((column: 'name' | 'description' | 'items' | 'status') => {
    const targetColumn = mapThreatsToAssetsColumn(column);
    assetsTableRef.current?.focusCellByColumn(targetColumn, (threatModel?.assets?.length || 1) - 1);
  }, [mapThreatsToAssetsColumn, threatModel?.assets?.length]);

  const handleControlsNavigateToPreviousTable = useCallback((columnIndex: number) => {
    const targetColumn = mapControlsToThreatsColumn(columnIndex);
    threatsTableRef.current?.focusCellByColumn(targetColumn, (threatModel?.threats?.length || 1) - 1);
  }, [mapControlsToThreatsColumn, threatModel?.threats?.length]);

  // Architecture navigation callbacks
  const handleArchitectureNavigateToPreviousTable = useCallback((table: 'boundary' | 'dataflow', column: string) => {
    // When navigating up from architecture section
    const assets = threatModel?.assets || [];
    const boundaries = threatModel?.boundaries || [];
    
    // Map architecture columns back to assets/threats columns
    // name -> name, description/label -> description
    let targetColumn: 'name' | 'description' = 'name';
    if (column === 'description' || column === 'label') {
      targetColumn = 'description';
    }
    
    if (table === 'boundary') {
      // Navigating from boundary, go to last asset
      if (assets.length > 0) {
        assetsTableRef.current?.focusCellByColumn(targetColumn, assets.length - 1);
      }
    } else if (table === 'dataflow') {
      // Navigating from data flow - check if there are boundaries above
      if (boundaries.length > 0) {
        // Navigate to last boundary
        const cellType = column === 'label' ? 'description' : 'name';
        architectureSectionRef.current?.focusCell('boundary', cellType, boundaries.length - 1);
      } else if (assets.length > 0) {
        // No boundaries, go to assets
        assetsTableRef.current?.focusCellByColumn(targetColumn, assets.length - 1);
      }
    }
  }, [threatModel?.assets, threatModel?.boundaries]);

  const handleArchitectureNavigateToNextTable = useCallback((table: 'boundary' | 'dataflow', column: string) => {
    // When navigating down from architecture section (only from data flows), go to threats
    if (table === 'dataflow') {
      // Map data flow columns to threats columns
      // direction -> name, label -> description
      const targetColumn: 'name' | 'description' | 'items' = column === 'label' ? 'description' : 'name';
      threatsTableRef.current?.focusCellByColumn(targetColumn, 0);
    }
  }, []);

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

  const handleDownloadFolderClick = useCallback(async (): Promise<void> => {
    // Get content from YAML editor if available (includes unsaved changes), otherwise use state
    const content = yamlEditorRef.current?.getContent() || yamlContent;
    if (content) {
      await handleDownloadFolder(content);
    }
  }, [yamlContent, handleDownloadFolder]);

  const handleCopyToConfluenceClick = useCallback(async (): Promise<void> => {
    const success = await handleCopyToConfluence();
    if (success) {
      showToast('Confluence markup copied to clipboard! Paste into an empty Confluence page.', 'success');
    } else {
      showToast('Failed to copy to clipboard', 'error');
    }
  }, [handleCopyToConfluence, showToast]);

  const handleCopyDiagramToClipboardClick = useCallback(async (): Promise<void> => {
    const success = await handleCopyDiagramToClipboard();
    if (success) {
      showToast('Data Flow Diagram image copied to clipboard!', 'success');
    } else {
      showToast('Failed to copy diagram to clipboard', 'error');
    }
  }, [handleCopyDiagramToClipboard, showToast]);

  const handleCopyAsYamlClick = useCallback(async (): Promise<void> => {
    try {
      // Get content from YAML editor if available (includes unsaved changes), otherwise use state
      const content = yamlEditorRef.current?.getContent() || yamlContent;
      if (!content) {
        showToast('No content to copy', 'error');
        return;
      }
      await navigator.clipboard.writeText(content);
      showToast('YAML copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy YAML to clipboard:', error);
      showToast('Failed to copy YAML to clipboard', 'error');
    }
  }, [yamlContent, showToast]);

  const handleCopyAsMarkdownClick = useCallback(async (): Promise<void> => {
    try {
      if (!threatModel) {
        showToast('No threat model to export', 'error');
        return;
      }
      
      // Generate markdown from the threat model (with embedded diagram, not PNG reference)
      const markdown = generateMarkdown(threatModel, undefined, githubMetadata, false);
      
      await navigator.clipboard.writeText(markdown);
      showToast('Markdown copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy markdown to clipboard:', error);
      showToast('Failed to copy markdown to clipboard', 'error');
    }
  }, [threatModel, githubMetadata, showToast]);

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

  const handleCommitModalClose = useCallback(() => {
    setShowCommitModal(false);
  }, []);

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
  }, [yamlContent, githubDomain, threatModel, getApiClient, requirePat, setGitHubMetadata, captureDiagram, markSaved]);

  const getCommitApiClient = useCallback(() => requirePat('commit'), [requirePat]);

  // Sync handlers
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
  }, [githubMetadata, threatModel, syncWithRepository, closeSettingsModal, showToast]);

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
  }, [githubMetadata, getApiClient, setThreatModel, setYamlContent, setGitHubMetadata, cleanupPat]);

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
  }, [syncResult, applyControlSyncResults, cleanupPat]);

  // Handler for processing uploaded or selected files
  const handleFileSelect = useCallback((
    file: File | { name: string; content: string },
    fileHandle?: FileSystemFileHandle | null,
    loadedBrowserModelId?: string
  ) => {
    setShowFileBrowser(false);

    // Reset save state from the previous file immediately
    clearSaveState();
    
    // Clear file handle when loading from browser storage (file handle is explicitly null)
    // Keep it when loading from local file picker (fileHandle is provided)
    if (fileHandle === null) {
      setLocalFileHandle(null);
      setLocalFileName(null);
      clearFileHandle();
    } else if (fileHandle) {
      setLocalFileHandle(fileHandle);
      setLocalFileName(fileHandle.name);
      storeFileHandle(fileHandle);
    }

    // Track browser model ID for in-place updates
    if (loadedBrowserModelId) {
      setBrowserModelId(loadedBrowserModelId);
    } else {
      setBrowserModelId(null);
    }
    
    const processContent = async (content: string) => {
      const model = parseYaml(content);
      loadTimestampRef.current = Date.now();
      setYamlContent(content);
      setThreatModel(model);
      // Clear GitHub metadata when loading non-GitHub files
      setGitHubMetadata(null);
      
      const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
      
      const nodesWithCallbacks = transformedNodes.map((node) => {
        if (node.type === 'threatModelNode') {
          return {
            ...node,
            data: {
              ...node.data,
              availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
              onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
              onEditModeChange: handleEditModeChange,
              onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
              onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
              onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
              onCreateAsset: handleCreateAsset,
              onSelectNode: () => handleSelectNode(node.id),
            },
          };
        } else if (node.type === 'boundaryNode') {
          return {
            ...node,
            data: {
              ...node.data,
              onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
              onEditModeChange: handleEditModeChange,
              onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
            },
          };
        }
        return node;
      });
      
      const edgesWithCallbacks = transformedEdges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          edgeRef: edge.id,
          onLabelChange: handleDataFlowLabelChange,
          onDirectionChange: handleDataFlowDirectionChange,
          onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
          onEditModeChange: handleEditModeChange,
        },
      }));
      
      setNodes(nodesWithCallbacks);
      setEdges(edgesWithCallbacks);
      clearHistory();
      pendingFitViewRef.current = true;

      // Set save source based on how the file was loaded
      if (loadedBrowserModelId) {
        markSaved({ type: 'browser', modelId: loadedBrowserModelId, modelName: model.name || 'Untitled' });
      } else if (fileHandle) {
        markSaved({ type: 'file', handle: fileHandle, fileName: fileHandle.name });
      }
      // Template or fallback — save state already cleared at the top
    };
    
    if (file instanceof File) {
      file.text().then(processContent).catch((err) => {
        console.error('Failed to read file:', err);
        showToast('Failed to read file', 'error');
      });
    } else {
      processContent(file.content).catch((err) => {
        console.error('Failed to process content:', err);
        showToast('Failed to process content', 'error');
      });
    }
  }, [handleDataFlowLabelChange, handleComponentNameChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, handleBoundaryNameChange, handleBoundaryResizeEnd, handleDataFlowDirectionChange, clearHistory, setGitHubMetadata, markSaved, clearSaveState]);

  // Populate the external reload ref — needs to be after all node-callback
  // handlers are defined so they can be captured in the closure.
  reloadFromExternalRef.current = (newContent: string) => {
    loadTimestampRef.current = Date.now();
    const model = parseYaml(newContent);
    setYamlContent(newContent);
    setThreatModel(model);

    const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
    const nodesWithCallbacks = transformedNodes.map((node) => {
      if (node.type === 'threatModelNode') {
        return {
          ...node,
          data: {
            ...node.data,
            availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
            onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
            onEditModeChange: handleEditModeChange,
            onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
            onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
            onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
            onCreateAsset: handleCreateAsset,
            onSelectNode: () => handleSelectNode(node.id),
          },
        };
      } else if (node.type === 'boundaryNode') {
        return {
          ...node,
          data: {
            ...node.data,
            onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
            onEditModeChange: handleEditModeChange,
            onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
          },
        };
      }
      return node;
    });
    const edgesWithCallbacks = transformedEdges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        edgeRef: edge.id,
        onLabelChange: handleDataFlowLabelChange,
        onDirectionChange: handleDataFlowDirectionChange,
        onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
        onEditModeChange: handleEditModeChange,
      },
    }));
    setNodes(nodesWithCallbacks);
    setEdges(edgesWithCallbacks);
    clearHistory();
    pendingFitViewRef.current = true;

    if (localFileHandle) {
      markSaved({ type: 'file', handle: localFileHandle, fileName: localFileHandle.name });
    }
    showToast('File reloaded — changed externally', 'info');
  };

  // Handler for opening local files - uses File System Access API when available
  const handleUploadFromLocal = useCallback(async () => {
    if (isFileSystemAccessSupported()) {
      try {
        const result = await openFileWithPicker();
        if (result) {
          // Use the file handle and content from the picker
          const file = { name: result.name, content: result.content };
          handleFileSelect(file, result.handle);
          // Seed the file-change detection baseline with the file's current timestamp
          fileChangeDetection.updateLastKnownModified(result.lastModified);
        }
      } catch (error) {
        console.error('Failed to open file:', error);
        showToast(`Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
    } else {
      // Fall back to file input
      fileInputRef.current?.click();
    }
  }, [handleFileSelect, fileChangeDetection]);

  // Handlers for new threat model creation
  const handleNewThreatModelClick = useCallback((source: SourceType) => {
    // Show discard modal if there are unsaved changes (isDirty), or if there's
    // no save source yet but the user has made edits (canUndo). The latter
    // covers the case where the user loaded a template and edited it but never
    // saved — isDirty isn't meaningful without a save source, so we fall back
    // to undo history as evidence of user work.
    const shouldShowModal = isDirty || (!saveSource && canUndo);
    
    setSelectedSource(source);

    if (shouldShowModal) {
      // Show discard modal before proceeding
      setShowDiscardModal(true);
    } else {
      // No changes to discard, proceed directly
      if (source === 'empty') {
        // Load empty template directly
        loadTemplateByPath('empty.yaml')
          .then((content) => {
            const model = parseYaml(content);
            loadTimestampRef.current = Date.now();
            setYamlContent(content);
            setThreatModel(model);
            // Clear GitHub metadata and file handle when loading empty template
            setGitHubMetadata(null);
            setLocalFileHandle(null);
            setLocalFileName(null);
            setBrowserModelId(null);
            clearFileHandle();
            clearSaveState();
            const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
            
            const nodesWithCallbacks = transformedNodes.map((node) => {
              if (node.type === 'threatModelNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
                    onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
                    onEditModeChange: handleEditModeChange,
                    onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
                    onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
                    onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
                    onCreateAsset: handleCreateAsset,
                    onSelectNode: () => handleSelectNode(node.id),
                  },
                };
              } else if (node.type === 'boundaryNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
                    onEditModeChange: handleEditModeChange,
                    onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
                  },
                };
              }
              return node;
            });
            
            const edgesWithCallbacks = transformedEdges.map((edge) => ({
              ...edge,
              data: {
                ...edge.data,
                edgeRef: edge.id,
                onLabelChange: handleDataFlowLabelChange,
                onDirectionChange: handleDataFlowDirectionChange,
                onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
                onEditModeChange: handleEditModeChange,
              },
            }));
            
            setNodes(nodesWithCallbacks);
            setEdges(edgesWithCallbacks);
            clearHistory();
            pendingFitViewRef.current = true;
          })
          .catch((err) => {
            console.error('Failed to load empty template:', err);
            showToast('Failed to load empty template', 'error');
          });
      } else if (source === 'upload') {
        // Use File System Access API when available, otherwise fall back to file input
        handleUploadFromLocal();
      } else {
        // Open file browser modal
        setShowFileBrowser(true);
      }
    }
  }, [isDirty, saveSource, canUndo, handleDataFlowLabelChange, handleComponentNameChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, handleBoundaryNameChange, handleBoundaryResizeEnd, handleDataFlowDirectionChange, clearHistory, setGitHubMetadata, handleUploadFromLocal]);

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardModal(false);
    
    if (selectedSource === 'empty') {
      // Load empty template directly
      loadTemplateByPath('empty.yaml')
        .then((content) => {
          const model = parseYaml(content);
          loadTimestampRef.current = Date.now();
          setYamlContent(content);
          setThreatModel(model);
          // Clear GitHub metadata and file handle when loading empty template
          setGitHubMetadata(null);
          setLocalFileHandle(null);
          setLocalFileName(null);
          setBrowserModelId(null);
          clearFileHandle();
          clearSaveState();
          const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
          
          const nodesWithCallbacks = transformedNodes.map((node) => {
            if (node.type === 'threatModelNode') {
              return {
                ...node,
                data: {
                  ...node.data,
                  availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
                  onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
                  onEditModeChange: handleEditModeChange,
                  onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
                  onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
                  onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
                  onCreateAsset: handleCreateAsset,
                  onSelectNode: () => handleSelectNode(node.id),
                },
              };
            } else if (node.type === 'boundaryNode') {
              return {
                ...node,
                data: {
                  ...node.data,
                  onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
                  onEditModeChange: handleEditModeChange,
                  onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
                },
              };
            }
            return node;
          });
          
          const edgesWithCallbacks = transformedEdges.map((edge) => ({
            ...edge,
            data: {
              ...edge.data,
              edgeRef: edge.id,
              onLabelChange: handleDataFlowLabelChange,
              onDirectionChange: handleDataFlowDirectionChange,
              onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
              onEditModeChange: handleEditModeChange,
            },
          }));
          
          setNodes(nodesWithCallbacks);
          setEdges(edgesWithCallbacks);
          clearHistory();
          pendingFitViewRef.current = true;
        })
        .catch((err) => {
          console.error('Failed to load empty template:', err);
          showToast('Failed to load empty template', 'error');
        });
    } else if (selectedSource === 'upload') {
      // Use File System Access API when available, otherwise fall back to file input
      handleUploadFromLocal();
    } else {
      // Open file browser modal
      setShowFileBrowser(true);
    }
  }, [selectedSource, handleDataFlowLabelChange, handleComponentNameChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, handleBoundaryNameChange, handleBoundaryResizeEnd, handleDataFlowDirectionChange, clearHistory, setGitHubMetadata, handleUploadFromLocal]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardModal(false);
    setSelectedSource(null);
  }, []);

  // --- External change conflict handlers ---
  const handleKeepMyChanges = useCallback(() => {
    setShowExternalChangeModal(false);
    setExternalChangeContent(null);
    fileChangeDetection.resolveConflict();
  }, [fileChangeDetection]);

  const handleLoadExternalChanges = useCallback(() => {
    if (!externalChangeContent) return;
    setShowExternalChangeModal(false);
    fileChangeDetection.resolveConflict();

    // Reload the external content using the shared reload helper
    reloadFromExternalRef.current?.(externalChangeContent);
    setExternalChangeContent(null);
    showToast('Loaded external changes', 'success');
  }, [externalChangeContent, fileChangeDetection, showToast]);

  const handleSaveAsAndLoadExternal = useCallback(async () => {
    // Save current work to a new file, then load the external content
    const content = yamlEditorRef.current?.getContent() || yamlContent;
    if (content) {
      const handle = await saveFileWithPicker(content, threatModel?.name ? `${threatModel.name}.yaml` : 'threat_model.yaml');
      if (!handle) {
        // User cancelled the save dialog - stay in the modal
        return;
      }
      showToast(`Saved your changes to ${handle.name}`, 'success');
    }
    // Now load the external changes
    handleLoadExternalChanges();
  }, [yamlContent, threatModel?.name, handleLoadExternalChanges, showToast]);

  const handleFileBrowserBack = useCallback(() => {
    setShowFileBrowser(false);
    setSelectedSource(null);
  }, []);

  // Handler for loading threat model from GitHub
  const handleGitHubFileSelect = useCallback((content: string, metadata: GitHubMetadata) => {
    setShowFileBrowser(false);
    setSelectedSource(null);

    // Reset save state from the previous file immediately
    clearSaveState();
    
    const model = parseYaml(content);
    loadTimestampRef.current = Date.now();
    setYamlContent(content);
    setThreatModel(model);
    setGitHubMetadata(metadata);
    // Clear local file handle when loading from GitHub
    setLocalFileHandle(null);
    setLocalFileName(null);
    setBrowserModelId(null);
    clearFileHandle();
    // Set save source to GitHub (markSaved resets dirty + sets timestamp)
    markSaved({ type: 'github', metadata });
    
    const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
    
    const nodesWithCallbacks = transformedNodes.map((node) => {
      if (node.type === 'threatModelNode') {
        return {
          ...node,
          data: {
            ...node.data,
            availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
            onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
            onEditModeChange: handleEditModeChange,
            onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
            onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
            onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
            onCreateAsset: handleCreateAsset,
            onSelectNode: () => handleSelectNode(node.id),
          },
        };
      } else if (node.type === 'boundaryNode') {
        return {
          ...node,
          data: {
            ...node.data,
            onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
            onEditModeChange: handleEditModeChange,
            onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
          },
        };
      }
      return node;
    });
    
    const edgesWithCallbacks = transformedEdges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        edgeRef: edge.id,
        onLabelChange: handleDataFlowLabelChange,
        onDirectionChange: handleDataFlowDirectionChange,
        onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
        onEditModeChange: handleEditModeChange,
      },
    }));
    
    setNodes(nodesWithCallbacks);
    setEdges(edgesWithCallbacks);
    clearHistory();
    pendingFitViewRef.current = true;
    
    // Clean up PAT after successful GitHub action completion
    cleanupPat();
  }, [handleDataFlowLabelChange, handleComponentNameChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, handleBoundaryNameChange, handleBoundaryResizeEnd, handleDataFlowDirectionChange, clearHistory, setGitHubMetadata, cleanupPat, markSaved, clearSaveState]);

  // Handler for GitHub errors
  const handleGitHubError = useCallback((error: string) => {
    console.error('GitHub error:', error);
    showToast(error, 'error');
  }, [showToast]);

  // Handler for generating shareable link
  const handleGenerateShareLink = useCallback(() => {
    if (!threatModel) {
      showToast('No threat model to share', 'error');
      return;
    }

    try {
      const shareUrl = generateShareableUrl(threatModel, githubMetadata);
      const urlLength = shareUrl.length;
      
      // Warn if URL is larger than safe thresholds
      if (urlLength > 8000) {
        showToast('Warning: Share link is very large and may have compatibility issues', 'warning');
      } 
      // Copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        if (urlLength <= 8000) {
          showToast('Share link copied to clipboard!', 'success');
        } else {
          // Already showed warning above, just confirm copy
          showToast('Share link copied (see warning)', 'success');
        }
      }).catch(() => {
        showToast('Failed to copy share link to clipboard', 'error');
      });
    } catch (error) {
      console.error('Failed to generate share link:', error);
      showToast('Failed to generate share link', 'error');
    }
  }, [threatModel, showToast]);

  // Handler for file upload using traditional file input (fallback)
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      // When using file input fallback, we don't have a file handle
      handleFileSelect(file);
    }
    // Reset the input for future uploads
    event.currentTarget.value = '';
  }, [handleFileSelect]);



  // Handler for YAML editor updates - regenerates the entire diagram
  const handleYamlUpdate = useCallback((updatedModel: ThreatModel, newYamlContent: string): void => {
    setThreatModel(updatedModel);
    setYamlContent(newYamlContent);
    
    // Regenerate the diagram from the updated model
    const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(updatedModel, handleDataFlowLabelChange);
    
    // Add callbacks to nodes
    const nodesWithCallbacks = transformedNodes.map((node) => {
      if (node.type === 'threatModelNode') {
        return {
          ...node,
          data: {
            ...node.data,
            availableAssets: updatedModel.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
            onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
            onEditModeChange: handleEditModeChange,
            onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
            onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
            onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
            onCreateAsset: handleCreateAsset,
            onSelectNode: () => handleSelectNode(node.id),
          },
        };
      } else if (node.type === 'boundaryNode') {
        return {
          ...node,
          data: {
            ...node.data,
            onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
            onEditModeChange: handleEditModeChange,
            onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
          },
        };
      }
      return node;
    });
    
    // Add callbacks to edges - store edge ref in data and pass stable handler references
    const edgesWithCallbacks = transformedEdges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        edgeRef: edge.id, // Store the edge ref
        onLabelChange: handleDataFlowLabelChange,
        onDirectionChange: handleDataFlowDirectionChange,
        onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
        onEditModeChange: handleEditModeChange,
      },
    }));
    
    setNodes(nodesWithCallbacks);
    setEdges(edgesWithCallbacks);
  }, [handleComponentNameChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, handleBoundaryNameChange, handleBoundaryResizeEnd, handleDataFlowLabelChange, handleDataFlowDirectionChange, handleSelectNode]);

  useEffect(() => {
    async function loadData(): Promise<void> {
      try {
        setLoading(true);
        
        // Check for model in URL first (highest priority)
        const encodedModel = getModelFromUrl();
        if (encodedModel && !initialContent && !initialFile && !loadedFromUrlRef.current) {
          try {
            loadedFromUrlRef.current = true;
            const { model, githubMetadata } = decodeModelFromUrl(encodedModel);
            const rawYaml = modelToYaml(model);
            
            // Set GitHub metadata if present
            if (githubMetadata) {
              setGitHubMetadata(githubMetadata);
            }
            
            setYamlContent(rawYaml);
            setThreatModel(model);
            
            const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
            
            const nodesWithCallbacks = transformedNodes.map((node) => {
              if (node.type === 'threatModelNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
                    onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
                    onEditModeChange: handleEditModeChange,
                    onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
                    onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
                    onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
                    onCreateAsset: handleCreateAsset,
                    onSelectNode: () => handleSelectNode(node.id),
                  },
                };
              } else if (node.type === 'boundaryNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
                    onEditModeChange: handleEditModeChange,
                    onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
                  },
                };
              }
              return node;
            });
            
            const edgesWithCallbacks = transformedEdges.map((edge) => ({
              ...edge,
              data: {
                ...edge.data,
                edgeRef: edge.id,
                onLabelChange: handleDataFlowLabelChange,
                onDirectionChange: handleDataFlowDirectionChange,
                onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
                onEditModeChange: handleEditModeChange,
              },
            }));
            
            setNodes(nodesWithCallbacks);
            setEdges(edgesWithCallbacks);
            setError(null);
            clearHistory();
            pendingFitViewRef.current = true;
            
            showToast('Threat model loaded from share link', 'success');
            setLoading(false);
            
            // Clear URL parameter after a short delay to ensure state is updated
            setTimeout(() => {
              window.history.replaceState({}, '', window.location.pathname);
            }, 100);
            
            return;
          } catch (urlError) {
            console.error('Failed to load threat model from URL:', urlError);
            showToast('Failed to load shared threat model', 'error');
            loadedFromUrlRef.current = false;
            // Fall through to load default content
          }
        }
        
        // Check for auto-save draft (only if no initial content/file/URL provided)
        if (!initialContent && !initialFile && !loadedFromUrlRef.current) {
          const draft = await getAutoSaveDraft();
          if (draft) {
            try {
              // Automatically resume the draft
              const model = parseYaml(draft.content);
              setYamlContent(draft.content);
              // Restore GitHub metadata if available
              if (draft.githubMetadata) {
                setGitHubMetadata(draft.githubMetadata);
              }

              // Restore save source from draft
              if (draft.saveSource) {
                if (draft.saveSource.type === 'browser' && draft.saveSource.modelId) {
                  setBrowserModelId(draft.saveSource.modelId);
                  markSaved({
                    type: 'browser',
                    modelId: draft.saveSource.modelId,
                    modelName: draft.saveSource.modelName || 'Untitled',
                  }, draft.lastSavedToSourceAt);
                } else if (draft.saveSource.type === 'file' && draft.saveSource.fileName) {
                  // Try to restore file handle from IndexedDB
                  const storedHandle = await getStoredFileHandle();
                  if (storedHandle) {
                    setLocalFileHandle(storedHandle);
                    setLocalFileName(storedHandle.name);
                    markSaved({
                      type: 'file',
                      handle: storedHandle,
                      fileName: storedHandle.name,
                    }, draft.lastSavedToSourceAt);
                  }
                  // If handle is gone, we can't restore file source — user will need to re-save
                } else if (draft.saveSource.type === 'github' && draft.saveSource.githubMeta) {
                  markSaved({
                    type: 'github',
                    metadata: draft.saveSource.githubMeta,
                  }, draft.lastSavedToSourceAt);
                }

                // Restore the dirty flag from the draft
                if (draft.isDirty) {
                  markDirty();
                }
              }
              setThreatModel(model);
              
              const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
              
              const nodesWithCallbacks = transformedNodes.map((node) => {
                if (node.type === 'threatModelNode') {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
                      onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
                      onEditModeChange: handleEditModeChange,
                      onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
                      onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
                      onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
                      onCreateAsset: handleCreateAsset,
                      onSelectNode: () => handleSelectNode(node.id),
                    },
                  };
                } else if (node.type === 'boundaryNode') {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
                      onEditModeChange: handleEditModeChange,
                      onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
                    },
                  };
                }
                return node;
              });
              
              const edgesWithCallbacks = transformedEdges.map((edge) => ({
                ...edge,
                data: {
                  ...edge.data,
                  edgeRef: edge.id,
                  onLabelChange: handleDataFlowLabelChange,
                  onDirectionChange: handleDataFlowDirectionChange,
                  onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
                  onEditModeChange: handleEditModeChange,
                },
              }));
              
              setNodes(nodesWithCallbacks);
              setEdges(edgesWithCallbacks);
              clearHistory();
              pendingFitViewRef.current = true;
              // Update load timestamp AFTER all state updates to prevent spurious dirty marking
              loadTimestampRef.current = Date.now();
              setLoading(false);
              return;
            } catch (draftError) {
              // Draft is corrupted or invalid - clear it and fall through to load empty template
              console.error('Failed to load auto-save draft (corrupted or invalid), loading empty template instead:', draftError);
              await clearAutoSaveDraft();
              // Continue to load empty template below
            }
          }
        }
        
        let rawYaml: string;
        
        // Use initial content if provided, otherwise load empty template
        // Skip if we already loaded from URL
        if (loadedFromUrlRef.current) {
          return;
        }
        
        if (initialContent) {
          rawYaml = initialContent;
          // If GitHub metadata is provided with initial content, set it
          if (initialGitHubMetadata) {
            setGitHubMetadata(initialGitHubMetadata);
            setSaveSource({ type: 'github', metadata: initialGitHubMetadata });
          }
        } else if (initialFile) {
          rawYaml = await initialFile.text();
        } else {
          // Load empty template as default
          rawYaml = await loadTemplateByPath('empty.yaml');
        }
        
        setYamlContent(rawYaml);
        
        // Parse the YAML to get the model
        const data = parseYaml(rawYaml);
        const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(data, handleDataFlowLabelChange);
        
        // Add onNameChange callback to each node's data
        const nodesWithCallbacks = transformedNodes.map((node) => {
          if (node.type === 'threatModelNode') {
            return {
              ...node,
              data: {
                ...node.data,
                availableAssets: data.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
                onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
                onEditModeChange: handleEditModeChange,
                onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
                onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
                onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
                onCreateAsset: handleCreateAsset,
                onSelectNode: () => handleSelectNode(node.id),
              },
            };
          } else if (node.type === 'boundaryNode') {
            return {
              ...node,
              data: {
                ...node.data,
                onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
                onEditModeChange: handleEditModeChange,
                onResizeEnd: (width: number, height: number) => handleBoundaryResizeEnd(node.id, width, height),
              },
            };
          }
          return node;
        });
        
        // Add callbacks to edges - store edge ref in data and pass stable handler references
        const edgesWithCallbacks = transformedEdges.map((edge) => ({
          ...edge,
          data: {
            ...edge.data,
            edgeRef: edge.id, // Store the edge ref
            onLabelChange: handleDataFlowLabelChange,
            onDirectionChange: handleDataFlowDirectionChange,
            onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
            onEditModeChange: handleEditModeChange,
          },
        }));
        
        setNodes(nodesWithCallbacks);
        setEdges(edgesWithCallbacks);
        setThreatModel(data);
        setError(null);
        pendingFitViewRef.current = true;
      } catch (err) {
        console.error('Failed to load threat model:', err);
        setError('Failed to load threat model. Please check the console for details.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [initialContent, initialFile, initialGitHubMetadata, handleComponentNameChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, handleBoundaryNameChange, handleBoundaryResizeEnd, handleDataFlowLabelChange, handleDataFlowDirectionChange, clearHistory, showToast]);

  // Handle edge dragging visualization
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Check if clicking on a handle or an edge
      const target = e.target as HTMLElement;
      if (target.closest('.react-flow__handle') || target.closest('svg')?.closest('.react-flow__edges')) {
        setIsDraggingEdge(true);
        document.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingEdge(false);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);



  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading threat model...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '18px', color: '#dc2626', textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Error</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${isSelecting ? 'selecting' : ''}`} data-mobile-view={mobileView}>
      <Navbar
        isCollapsed={isCollapsed}
        isCanvasCollapsed={isCanvasCollapsed}
        sidebarView={sidebarView}
        mobileView={mobileView}
        isDarkMode={isDarkMode}
        canUndo={canUndo}
        canRedo={canRedo}
        localFileName={localFileName}
        canSaveToFile={isFileSystemAccessSupported()}
        onSidebarCollapse={handleSidebarCollapse}
        onCanvasCollapse={handleCanvasCollapse}
        onSidebarViewChange={setSidebarView}
        onMobileViewChange={handleMobileViewChange}
        onCopyToConfluence={handleCopyToConfluenceClick}
        onCopyDiagramToClipboard={handleCopyDiagramToClipboardClick}
        onCopyAsYaml={handleCopyAsYamlClick}
        onCopyAsMarkdown={handleCopyAsMarkdownClick}
        onUndo={undo}
        onRedo={redo}
        onNewThreatModel={handleNewThreatModelClick}
        onQuickSave={handleQuickSave}
        onSaveToBrowser={handleSaveToBrowser}
        onSaveToFile={handleSaveToFile}
        onSaveToNewFile={handleSaveToNewFile}
        onSaveToNewBrowser={handleSaveToNewBrowser}
        onCommitToGitHub={handleCommitToGitHub}
        onDownloadFolder={handleDownloadFolderClick}
        onDarkModeToggle={() => setIsDarkMode(!isDarkMode)}
        onGitHubSettingsClick={openSettingsModal}
        onGenerateShareLink={handleGenerateShareLink}
      />

      <div className="content-wrapper">
        <div 
          className={`tables-container ${isCollapsed ? 'collapsed' : ''} ${sidebarView === 'yaml' ? 'yaml-view' : ''}`}
          style={{ width: isCollapsed ? 0 : isCanvasCollapsed ? '100%' : `${tablesSectionWidth}px` }}
        >
          <div style={{ display: sidebarView === 'yaml' ? 'flex' : 'none', height: '100%' }}>
            {sidebarView === 'yaml' && yamlContent && (
              <Suspense fallback={
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%',
                  color: 'var(--text-secondary)'
                }}>
                  Loading YAML editor...
                </div>
              }>
                <YamlEditor 
                  ref={yamlEditorRef}
                  initialContent={yamlContent}
                  onUpdate={handleYamlUpdate}
                />
              </Suspense>
            )}
          </div>
          {sidebarView === 'tables' && (
          <>
          <div className="header-section">
            <div className="title-section">
              <div className="threat-model-title">
                <EditableCell
                  ref={titleInputRef}
                  value={threatModel?.name || ''}
                  placeholder={threatModel?.name === 'TM Title' ? 'TM Title' : undefined}
                  onSave={handleThreatModelNameChange}
                  onNavigate={handleTitleNavigate}
                  onTabPress={handleTitleTabPress}
                  allowEmpty={false}
                />
              </div>
              <div className="threat-model-description">
                <EditableTextarea
                  ref={descriptionInputRef}
                  value={threatModel?.description || ''}
                  placeholder={!threatModel?.description || threatModel?.description === 'Description of scope...' ? 'Description of scope...' : undefined}
                  onSave={handleThreatModelDescriptionChange}
                  onNavigate={handleDescriptionNavigate}
                  onTabPress={handleDescriptionTabPress}
                />
              </div>
              <div className="threat-model-participants">
                <ParticipantsInput
                  ref={participantsInputRef}
                  value={threatModel?.participants || []}
                  onSave={handleParticipantsChange}
                  onNavigate={handleParticipantsNavigate}
                  onTabPress={handleParticipantsTabPress}
                />
              </div>
            </div>
          </div>
        
        {/* Tables Section */}
        <div className='tables-container-content'>
        <h2 className="collapsible-section-header" onClick={() => setIsWorkingSectionCollapsed(!isWorkingSectionCollapsed)}>
          <span>What are we working on?</span>
          <span className="collapse-arrow">{isWorkingSectionCollapsed ? '▶' : '▼'}</span>
        </h2>
        {!isWorkingSectionCollapsed && (
          <>
            <ComponentsTable
              ref={componentsTableRef}
              threatModel={threatModel}
              onComponentNameChange={handleComponentNameChange}
              onComponentTypeChange={handleComponentTypeChange}
              onComponentDescriptionChange={handleComponentDescriptionChange}
              onComponentAssetsChange={handleComponentAssetsChange}
              onCreateAsset={handleCreateAsset}
              onRemoveComponent={handleRemoveComponent}
              onAddComponent={(componentType) => handleAddComponent(componentType)}
              onReorderComponents={handleReorderComponents}
              onNavigateToNextTable={handleComponentsNavigateToNextTable}
              onNavigateToPreviousTable={handleComponentsNavigateToPreviousTable}
            />

            <AssetsTable
              ref={assetsTableRef}
              threatModel={threatModel}
              onAssetNameChange={handleAssetNameChange}
              onAssetDescriptionChange={handleAssetDescriptionChange}
              onRemoveAsset={handleRemoveAsset}
              onAddAsset={handleAddAsset}
              onReorderAssets={handleReorderAssets}
              onNavigateToNextTable={handleAssetsNavigateToNextTable}
              onNavigateToPreviousTable={handleAssetsNavigateToPreviousTable}
            />
        <ArchitectureSection
          ref={architectureSectionRef}
          threatModel={threatModel}
          handleBoundaryNameChange={handleBoundaryNameChange}
          handleBoundaryDescriptionChange={handleBoundaryDescriptionChange}
          handleDataFlowDirectionChange={handleDataFlowDirectionChange}
          handleDataFlowLabelChange={handleDataFlowLabelChange}
          handleRemoveBoundary={handleRemoveBoundary}
          handleRemoveDataFlow={handleRemoveDataFlow}
          onNavigateToPreviousTable={handleArchitectureNavigateToPreviousTable}
          onNavigateToNextTable={handleArchitectureNavigateToNextTable}
        />
          </>
        )}

        <div className="tables-divider"></div>
        <h2 className="collapsible-section-header" onClick={() => setIsThreatsSectionCollapsed(!isThreatsSectionCollapsed)}>
          <span>What can go wrong?</span>
          <span className="collapse-arrow">{isThreatsSectionCollapsed ? '▶' : '▼'}</span>
        </h2>
        {!isThreatsSectionCollapsed && (
          <ThreatsTable
            ref={threatsTableRef}
            threatModel={threatModel}
            githubMetadata={githubMetadata ?? undefined}
            onThreatNameChange={handleThreatNameChange}
            onThreatDescriptionChange={handleThreatDescriptionChange}
            onThreatAffectedComponentsChange={handleThreatAffectedComponentsChange}
            onThreatAffectedDataFlowsChange={handleThreatAffectedDataFlowsChange}
            onThreatAffectedAssetsChange={handleThreatAffectedAssetsChange}
            onThreatStatusChange={handleThreatStatusChange}
            onThreatStatusLinkChange={handleThreatStatusLinkChange}
            onThreatStatusNoteChange={handleThreatStatusNoteChange}
            onRemoveThreat={handleRemoveThreat}
            onAddThreat={handleAddThreat}
            onReorderThreats={handleReorderThreats}
            onNavigateToNextTable={handleThreatsNavigateToNextTable}
            onNavigateToPreviousTable={handleThreatsNavigateToPreviousTable}
          />
        )}
        <div className="tables-divider"></div>
        <h2 className="collapsible-section-header" onClick={() => setIsControlsSectionCollapsed(!isControlsSectionCollapsed)}>
          <span>What are we going to do about it?</span>
          <span className="collapse-arrow">{isControlsSectionCollapsed ? '▶' : '▼'}</span>
        </h2>
        {!isControlsSectionCollapsed && (
          <ControlsTable
            ref={controlsTableRef}
            threatModel={threatModel}
            githubMetadata={githubMetadata ?? undefined}
            onControlNameChange={handleControlNameChange}
            onControlDescriptionChange={handleControlDescriptionChange}
            onControlStatusChange={handleControlStatusChange}
            onControlStatusLinkChange={handleControlStatusLinkChange}
            onControlStatusNoteChange={handleControlStatusNoteChange}
            onControlMitigatesChange={handleControlMitigatesChange}
            onControlImplementedInChange={handleControlImplementedInChange}
            onRemoveControl={handleRemoveControl}
            onAddControl={handleAddControl}
            onReorderControls={handleReorderControls}
            onNavigateToPreviousTable={handleControlsNavigateToPreviousTable}
          />
        )}
        <div className="tables-divider"></div>
        <h2 className="collapsible-section-header" onClick={() => setIsSummarySectionCollapsed(!isSummarySectionCollapsed)}>
          <span>Did we do a good job?</span>
          <span className="collapse-arrow">{isSummarySectionCollapsed ? '▶' : '▼'}</span>
        </h2>
        {!isSummarySectionCollapsed && (
          <SummarySection 
            threatModel={threatModel} 
            threatsTableRef={threatsTableRef}
            controlsTableRef={controlsTableRef}
            onExpandThreatsSection={() => setIsThreatsSectionCollapsed(false)}
            onExpandControlsSection={() => setIsControlsSectionCollapsed(false)}
          />
        )}
        </div>

        </>
        )}
      </div>
      
      {!isCollapsed && !isCanvasCollapsed && (
        <ResizeDivider 
          onResize={handleResize}
          minWidth={500}
          maxWidth={1000}
        />
      )}
      
      <div className={`diagram-section ${isCanvasCollapsed ? 'collapsed' : ''}`}>
        <CanvasToolbar 
          onAddComponent={handleAddComponent}
          onAddBoundary={handleAddBoundary}
        />
        <div 
          ref={reactFlowWrapperRef}
          className={`react-flow__container ${isDraggingEdge ? 'dragging-edge' : ''}`}
          onMouseMove={(event) => {
            mousePositionRef.current = { x: event.clientX, y: event.clientY };
          }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <EdgeMarkers />
          <CanvasOverlay
            title={
              creationState.phase !== 'idle' ? 'Creating Data-Flow Connection' :
              reconnectionState.phase !== 'idle' ? 'Reconnecting Data-Flow' : ''
            }
            instruction={
              creationState.phase === 'source-handle' ? 'Select source handle' :
              creationState.phase === 'target-node' ? 'Select target node' :
              creationState.phase === 'target-handle' ? 'Select target handle' :
              reconnectionState.phase === 'source-node' ? 'Select source node' :
              reconnectionState.phase === 'source-handle' ? 'Select source handle' :
              reconnectionState.phase === 'target-node' ? 'Select target node' :
              reconnectionState.phase === 'target-handle' ? 'Select target handle' : ''
            }
            keybindings={[
              { keys: ['Esc'], label: 'Cancel' },
              { keys: ['⌫'], label: 'Back' },
              { keys: [], label: 'Navigate', isArrowKeys: true },
              { keys: ['↵'], label: 'Confirm' },
            ]}
            show={creationState.phase !== 'idle' || reconnectionState.phase !== 'idle'}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onSelectionDragStart={onSelectionDragStart}
            onSelectionDragStop={onSelectionDragStop}
            onSelectionStart={onSelectionStart}
            onSelectionEnd={onSelectionEnd}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            onReconnect={onReconnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineComponent={CustomConnectionLine}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={!isEditingMode}
            nodesFocusable={true}
            panOnDrag={!isEditingMode}
            panOnScroll={true}
            zoomOnDoubleClick={false}
            selectionOnDrag={!isEditingMode && !justExitedEditModeRef.current}
            selectionMode={SelectionMode.Partial}
            disableKeyboardA11y={true}
            multiSelectionKeyCode={['Meta', 'Control']}
            deleteKeyCode={creationState.phase === 'idle' && reconnectionState.phase === 'idle' ? ['Backspace', 'Delete'] : null}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
      </div>

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Discard modal */}
      {showDiscardModal && (
        <DiscardModal
          onConfirm={handleDiscardConfirm}
          onCancel={handleDiscardCancel}
        />
      )}

      {/* External file change conflict modal */}
      {showExternalChangeModal && (
        <ExternalChangeModal
          fileName={localFileName || 'file'}
          onKeepMine={handleKeepMyChanges}
          onLoadExternal={handleLoadExternalChanges}
          onSaveAs={handleSaveAsAndLoadExternal}
        />
      )}

      {/* PAT modal for GitHub authentication */}
      {isPatModalOpen && patModalAction && (
        <PatModal
          action={patModalAction}
          domain={githubDomain}
          onSubmit={submitPat}
          onCancel={closePatModal}
          onChangeDomain={setGitHubDomain}
          isValidating={isValidatingPat}
          error={patError || undefined}
        />
      )}

      {/* GitHub Settings modal */}
      {isSettingsModalOpen && (
        <GitHubSettingsModal
          domain={githubDomain}
          onDomainChange={setGitHubDomain}
          githubMetadata={githubMetadata}
          onClose={closeSettingsModal}
          onSync={githubMetadata ? handleSyncWithGitHub : undefined}
        />
      )}

      {/* GitHub Sync modal */}
      {showSyncModal && syncResult && (
        <GitHubSyncModal
          onConfirm={handleSyncModalConfirm}
          onCancel={handleSyncModalCancel}
          hasLocalChanges={canUndo}
          remoteUpdatedAt={syncResult.fileUpdatedAt || new Date().toISOString()}
          localLoadedAt={new Date(githubMetadata?.loadedAt || Date.now()).toISOString()}
        />
      )}

      {/* GitHub Commit modal */}
      {showCommitModal && (
        <GitHubCommitModal
          isOpen={showCommitModal}
          metadata={githubMetadata}
          threatModelName={threatModel?.name || 'Untitled'}
          domain={githubDomain}
          getApiClient={getCommitApiClient}
          onClose={handleCommitModalClose}
          onCommit={handleCommit}
        />
      )}

      {/* File browser modal - for templates and browser storage */}
      {showFileBrowser && selectedSource && selectedSource !== 'github' && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 9999,
          background: 'var(--bg-primary)'
        }}>
          <FileBrowser
            source={selectedSource}
            onFileSelect={handleFileSelect}
            onBack={handleFileBrowserBack}
            isDarkMode={isDarkMode}
            onDarkModeChange={setIsDarkMode}
            onMetadataLoad={(metadata) => setGitHubMetadata(metadata ?? null)}
            onGenerateShareLink={handleGenerateShareLink}
          />
        </div>
      )}

      {/* GitHub Load modal */}
      {showFileBrowser && selectedSource === 'github' && (
        <GitHubLoadModalWrapper
          domain={githubDomain}
          onFileSelect={handleGitHubFileSelect}
          onBack={handleFileBrowserBack}
          onError={handleGitHubError}
          requirePat={requirePat}
        />
      )}
    </div>
  );
}

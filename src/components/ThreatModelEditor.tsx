import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { produce } from 'immer';
import { Shapes } from 'lucide-react';
// @ts-ignore - @xyflow/react has type declaration issues but works at runtime
import { ReactFlow, applyNodeChanges, applyEdgeChanges, Background, Controls, MiniMap, SelectionMode } from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import '../App.css';
import ThreatModelNode from './canvas/ThreatModelNode';
import BoundaryNode from './canvas/BoundaryNode';
import EditableCell from './tables/EditableCell';
import EditableTextarea from './tables/EditableTextarea';
import ParticipantsInput from './tables/ParticipantsInput';
import type { ParticipantsInputRef } from './tables/ParticipantsInput';
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
import { PatModal } from '../integrations/github/modals/PatModal';
import { GitHubSettingsModal } from '../integrations/github/modals/GitHubSettingsModal';
import { GitHubCommitModal } from '../integrations/github/modals/GitHubCommitModal';
import { GitHubSyncModal } from '../integrations/github/modals/GitHubSyncModal';
import { FileBrowser } from './filebrowser/FileBrowser';
import { GitHubLoadModalWrapper } from '../integrations/github/modals/GitHubLoadModalWrapper';
import { SourceType } from './filebrowser/SourceSelector';
import { ResizeDivider } from './layout/ResizeDivider';
import { TabPanelHeader, TabPanelHeaderContent } from './layout/TabPanelHeader';
import TutorialPanel from './tutorials/TutorialPanel';
import './layout/TabPanel.css';
import { useTabLayout } from '../hooks/useTabLayout';
import { DndContext, DragOverlay, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { NativeDragAwarePointerSensor } from './canvas/NativeDragAwarePointerSensor';
import { loadTemplateByPath } from '../utils/templateLoader';
import { 
  getAutoSaveDraft, 
  clearAutoSaveDraft,
  isFileSystemAccessSupported,
  openFileWithPicker,
  saveFileWithPicker,
  storeFileHandle,
  getStoredFileHandle,
  clearFileHandle,
} from '../utils/browserStorage';
import type { SerializedSaveSource } from '../utils/browserStorage';
import { useGitHubIntegration, SyncResult } from '../integrations/github/hooks/useGitHubIntegration';
import type { GitHubMetadata } from '../integrations/github/types';

import { useToast } from '../contexts/ToastContext';
import { useSaveState } from '../contexts/SaveStateContext';
// Lazy load YamlEditor and its heavy dependencies (syntax-highlighter)
const YamlEditor = lazy(() => import('./YamlEditor'));
import CanvasToolbar from './canvas/CanvasToolbar';
import { CanvasOverlay } from './canvas/CanvasOverlay';
import { Navbar } from './navbar/Navbar';
import { parseYaml, updateYamlField, appendYamlItem, removeRefFromArrayFields, removeYamlItem, modelToYaml } from '../utils/yamlParser';
import { transformThreatModel, sortNodesByRenderOrder } from '../utils/flowTransformer';
import { generateShareableUrl, getModelFromUrl, decodeModelFromUrl } from '../utils/urlEncoder';
import { findUnoccupiedPosition } from '../utils/navigationHelpers';
import { isComponentInsideBoundary } from '../utils/geometryHelpers';
import { addCallbacksToNodesAndEdges } from '../utils/nodeEdgeCallbackBuilder';
import { generateComponentRef, generateBoundaryRef, generateAssetRef, generateThreatRef, generateControlRef, generateAssetName, generateThreatName, generateControlName, generateComponentName, generateBoundaryName } from '../utils/refGenerators';
import { useDiagramExport, generateMarkdown } from '../hooks/useDiagramExport';
import { useThreatModelState } from '../hooks/useThreatModelState';
import { useFlowDiagram } from '../hooks/useFlowDiagram';
import { useAutoSave } from '../hooks/useAutoSave';
import { useFileChangeDetection } from '../hooks/useFileChangeDetection';
import { useCanvasNavigation } from '../hooks/useCanvasNavigation';
import { useDataFlowCreation } from '../hooks/useDataFlowCreation';
import { useDataFlowReconnection } from '../hooks/useDataFlowReconnection';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSaveHandlers } from '../hooks/useSaveHandlers';
import { useGitHubOperations } from '../integrations/github/hooks/useGitHubOperations';
import { useTableNavigation } from '../hooks/useTableNavigation';
import { useModelLoader } from '../hooks/useModelLoader';
import type { ThreatModel, ComponentType} from '../types/threatModel';

const nodeTypes = {
  threatModelNode: ThreatModelNode,
  boundaryNode: BoundaryNode,
};

const edgeTypes = {
  editableEdge: EditableEdge,
};

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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Tab layout system (replaces old isCollapsed / isCanvasCollapsed / sidebarView / tablesSectionWidth)
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const {
    tabs,
    tabWidths,
    canAddTab,
    addTab,
    removeTab,
    changeTabView,
    reorderTabs,
    resizeTabs,
    openOrSwitchToView,
  } = useTabLayout(contentWrapperRef);

  // dnd-kit: require 5px drag distance before starting to avoid accidental drags
  // Uses NativeDragAwarePointerSensor to avoid blocking native HTML5 drag-and-drop (canvas toolbar)
  const dndSensors = useSensors(
    useSensor(NativeDragAwarePointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const activeDragTab = activeDragId ? tabs.find((t) => t.id === activeDragId) : null;

  // Compute where to show the drop indicator line
  const dropIndicatorIndex = useMemo(() => {
    if (!activeDragId || !overId || activeDragId === overId) return -1;
    const activeIdx = tabs.findIndex((t) => t.id === activeDragId);
    const overIdx = tabs.findIndex((t) => t.id === overId);
    if (activeIdx === -1 || overIdx === -1) return -1;
    // Show indicator at the edge where the tab will be inserted
    // If dragging right (activeIdx < overIdx), indicator appears after overIdx
    // If dragging left (activeIdx > overIdx), indicator appears before overIdx
    return activeIdx < overIdx ? overIdx + 1 : overIdx;
  }, [activeDragId, overId, tabs]);

  // Compute the left % for the absolutely-positioned drop indicator
  const dropIndicatorLeft = useMemo(() => {
    if (dropIndicatorIndex < 0) return null;
    let left = 0;
    for (let i = 0; i < dropIndicatorIndex && i < tabWidths.length; i++) {
      left += tabWidths[i];
    }
    return `${Math.min(left, 100)}%`;
  }, [dropIndicatorIndex, tabWidths]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      setOverId(null);
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = tabs.findIndex((t) => t.id === active.id);
        const newIndex = tabs.findIndex((t) => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderTabs(oldIndex, newIndex);
        }
      }
    },
    [tabs, reorderTabs]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverId(null);
  }, []);

  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showExternalChangeModal, setShowExternalChangeModal] = useState(false);
  const [externalChangeContent, setExternalChangeContent] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceType | null>(null);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
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
  const buildNodesAndEdgesRef = useRef<(model: ThreatModel) => { nodes: any[]; edges: any[] }>(null!);
  const loadFromContentRef = useRef<(content: string, source: import('../hooks/useModelLoader').LoadSource, preParsedModel?: ThreatModel) => void>(null!);

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
    [threatModel, updateYaml]
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

  // Stable wrapper that transforms a model into nodes+edges with all callbacks attached.
  // Used by every load/update path to eliminate the previously-duplicated ~45-line block.
  const buildNodesAndEdges = useCallback(
    (model: ThreatModel) => {
      const { nodes: transformedNodes, edges: transformedEdges } = transformThreatModel(model, handleDataFlowLabelChange);
      return addCallbacksToNodesAndEdges(transformedNodes, transformedEdges, model, {
        handleComponentNameChange,
        handleEditModeChange,
        handleComponentTypeChange,
        handleComponentDescriptionChange,
        handleComponentAssetsChange,
        handleCreateAsset,
        handleSelectNode,
        handleBoundaryNameChange,
        handleBoundaryResizeEnd,
        handleDataFlowLabelChange,
        handleDataFlowDirectionChange,
        handleToggleDirectionAndReverse,
      });
    },
    [handleComponentNameChange, handleEditModeChange, handleComponentTypeChange, handleComponentDescriptionChange, handleComponentAssetsChange, handleCreateAsset, handleSelectNode, handleBoundaryNameChange, handleBoundaryResizeEnd, handleDataFlowLabelChange, handleDataFlowDirectionChange, handleToggleDirectionAndReverse],
  );

  // Keep ref in sync so effects/callbacks can use it without depending on its identity
  buildNodesAndEdgesRef.current = buildNodesAndEdges;

  // Model loading: centralised load-from-content and YAML-update helpers
  const { loadFromContent, loadFromYamlUpdate } = useModelLoader({
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
  });

  // Keep ref in sync so the loadData effect can use the latest version
  loadFromContentRef.current = loadFromContent;

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
    
    // Add the node to the diagram
    const newNode = {
      id: ref,
      type: 'boundaryNode',
      position: { x, y },
      selectable: true,
      style: {
        width,
        height,
      },
      data: {
        label: name,
        description: undefined,
        onNameChange: (newName: string) => handleBoundaryNameChange(ref, newName),
        onEditModeChange: handleEditModeChange,
        onResizeEnd: (w: number, h: number, x: number, y: number) => handleBoundaryResizeEnd(ref, w, h, x, y),
      },
    };
    
    setNodes((prevNodes) => sortNodesByRenderOrder([...prevNodes, newNode]));
    
    // Record state for undo/redo after node creation
    setTimeout(() => {
      recordState();
    }, 0);
  }, [updateYaml, handleBoundaryNameChange, handleBoundaryResizeEnd, recordState]);

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

  // Save handlers (browser storage, local file, quick save)
  const {
    handleSaveToBrowser,
    handleSaveToFile,
    handleSaveToNewFile,
    handleSaveToNewBrowser,
    handleCommitToGitHub,
    handleQuickSave,
    quickSaveRef,
  } = useSaveHandlers({
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
  });

  // Keyboard shortcuts (undo/redo, save, section toggles, edit mode, arrow keys, 1-4 creation)
  useKeyboardShortcuts({
    undo,
    redo,
    nodes,
    edges,
    setNodes,
    setEdges,
    creationPhase: creationState.phase,
    isEditingMode,
    arrowKeyMovedNodesRef,
    quickSaveRef,
    mousePositionRef,
    reactFlowInstanceRef,
    sectionCollapseStates: {
      isWorkingSectionCollapsed,
      setIsWorkingSectionCollapsed,
      isThreatsSectionCollapsed,
      setIsThreatsSectionCollapsed,
      isControlsSectionCollapsed,
      setIsControlsSectionCollapsed,
      isSummarySectionCollapsed,
      setIsSummarySectionCollapsed,
    },
    handleAddComponent,
    handleAddBoundary,
  });

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


  // Table navigation callbacks (tab / arrow key between header fields and tables)
  const {
    handleTitleNavigate,
    handleTitleTabPress,
    handleDescriptionNavigate,
    handleDescriptionTabPress,
    handleParticipantsNavigate,
    handleParticipantsTabPress,
    handleComponentsNavigateToNextTable,
    handleComponentsNavigateToPreviousTable,
    handleAssetsNavigateToNextTable,
    handleAssetsNavigateToPreviousTable,
    handleThreatsNavigateToNextTable,
    handleThreatsNavigateToPreviousTable,
    handleControlsNavigateToPreviousTable,
    handleArchitectureNavigateToPreviousTable,
    handleArchitectureNavigateToNextTable,
  } = useTableNavigation({
    titleInputRef,
    descriptionInputRef,
    participantsInputRef,
    componentsTableRef,
    assetsTableRef,
    threatsTableRef,
    controlsTableRef,
    architectureSectionRef,
    threatModel,
  });

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

  // GitHub operations (commit, sync, conflict resolution)
  const {
    handleCommitModalClose,
    handleCommit,
    getCommitApiClient,
    handleSyncWithGitHub,
    handleSyncModalConfirm,
    handleSyncModalCancel,
  } = useGitHubOperations({
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
    showCommitModal,
    setShowCommitModal,
    showSyncModal,
    setShowSyncModal,
    syncResult,
    setSyncResult,
  });

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
    
    const processContent = (content: string) => {
      if (loadedBrowserModelId) {
        loadFromContent(content, { type: 'browser', modelId: loadedBrowserModelId });
      } else if (fileHandle) {
        loadFromContent(content, { type: 'file', fileHandle });
      } else {
        // Template or fallback — save state already cleared at the top
        loadFromContent(content, { type: 'template' });
      }
    };
    
    if (file instanceof File) {
      file.text().then(processContent).catch((err) => {
        console.error('Failed to read file:', err);
        showToast('Failed to read file', 'error');
      });
    } else {
      try {
        processContent(file.content);
      } catch (err) {
        console.error('Failed to process content:', err);
        showToast('Failed to process content', 'error');
      }
    }
  }, [loadFromContent, clearSaveState]);

  // Populate the external reload ref — needs to be after all node-callback
  // handlers are defined so they can be captured in the closure.
  reloadFromExternalRef.current = (newContent: string) => {
    // Re-load the file content, preserving the current file handle as the source
    if (localFileHandle) {
      loadFromContent(newContent, { type: 'file', fileHandle: localFileHandle });
    } else {
      loadFromContent(newContent, { type: 'template' });
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
            loadFromContent(content, { type: 'template' });
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
  }, [isDirty, saveSource, canUndo, loadFromContent, handleUploadFromLocal]);

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardModal(false);
    
    if (selectedSource === 'empty') {
      // Load empty template directly
      loadTemplateByPath('empty.yaml')
        .then((content) => {
          loadFromContent(content, { type: 'template' });
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
  }, [selectedSource, loadFromContent, handleUploadFromLocal]);

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
    
    loadFromContent(content, { type: 'github', metadata });
    
    // Clean up PAT after successful GitHub action completion
    cleanupPat();
  }, [loadFromContent, cleanupPat, clearSaveState]);

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

  // File drag-and-drop: allow users to drop a YAML/JSON file anywhere on the window
  const dragCounterRef = useRef(0);
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      // Only react to files being dragged (not internal drag-and-drop)
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounterRef.current++;
        setIsFileDragOver(true);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      // Only handle file drags — let internal drags (canvas toolbar) propagate normally
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsFileDragOver(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      // Only handle file drops — let internal drops (canvas toolbar) propagate normally
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsFileDragOver(false);

      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      const name = file.name.toLowerCase();
      if (!name.endsWith('.yaml') && !name.endsWith('.yml') && !name.endsWith('.json')) {
        showToast('Please drop a .yaml, .yml, or .json file', 'error');
        return;
      }

      handleFileSelect(file);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFileSelect, showToast]);



  // Handler for YAML editor updates - regenerates the entire diagram
  const handleYamlUpdate = useCallback((updatedModel: ThreatModel, newYamlContent: string): void => {
    loadFromYamlUpdate(updatedModel, newYamlContent);
  }, [loadFromYamlUpdate]);

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
            
            loadFromContentRef.current(rawYaml, { type: 'url', githubMetadata }, model);
            setError(null);
            
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
              // Automatically resume the draft — use buildNodesAndEdgesRef directly
              // because draft restoration has async steps (getStoredFileHandle) that
              // must complete before we can call loadFromContent.
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
              
              const { nodes: nodesWithCallbacks, edges: edgesWithCallbacks } = buildNodesAndEdgesRef.current(model);
              
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
        
        // Use initial content if provided, otherwise load empty template
        // Skip if we already loaded from URL
        if (loadedFromUrlRef.current) {
          return;
        }
        
        let rawYaml: string;
        
        if (initialContent) {
          rawYaml = initialContent;
          loadFromContentRef.current(rawYaml, {
            type: 'initial',
            githubMetadata: initialGitHubMetadata ?? undefined,
            saveSource: initialGitHubMetadata ? { type: 'github', metadata: initialGitHubMetadata } : undefined,
          });
        } else if (initialFile) {
          rawYaml = await initialFile.text();
          loadFromContentRef.current(rawYaml, { type: 'template' });
        } else {
          // Load empty template as default
          rawYaml = await loadTemplateByPath('empty.yaml');
          loadFromContentRef.current(rawYaml, { type: 'template' });
        }
        
        setError(null);
      } catch (err) {
        console.error('Failed to load threat model:', err);
        setError('Failed to load threat model. Please check the console for details.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [initialContent, initialFile, initialGitHubMetadata, clearHistory, showToast]);

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
    <div className={`app-container ${isSelecting ? 'selecting' : ''}`}>
      <Navbar
        isDarkMode={isDarkMode}
        canUndo={canUndo}
        canRedo={canRedo}
        localFileName={localFileName}
        canSaveToFile={isFileSystemAccessSupported()}
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
        onOpenTutorials={() => openOrSwitchToView('tutorials')}
      />

      {/* Desktop: tab-based multi-panel layout */}
      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="content-wrapper" ref={contentWrapperRef}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
        {tabs.map((tab, i) => {
          const isFirstTables = tab.view === 'tables' && tabs.findIndex(t => t.view === 'tables') === i;
          const isFirstYaml = tab.view === 'yaml' && tabs.findIndex(t => t.view === 'yaml') === i;
          const isFirstCanvas = tab.view === 'canvas' && tabs.findIndex(t => t.view === 'canvas') === i;

          return (
            <React.Fragment key={tab.id}>
              <div
                className="tab-panel"
                data-view={tab.view}
                style={{ width: `${tabWidths[i]}%` }}
              >
                <TabPanelHeader
                  tab={tab}
                  tabCount={tabs.length}
                  canAddTab={canAddTab}
                  onAddTab={addTab}
                  onRemoveTab={removeTab}
                  onChangeView={changeTabView}
                />

                {/* Tables view */}
                {tab.view === 'tables' && (
                  <div className="tab-panel-tables">
                    <div className="header-section">
                      <div className="title-section">
                        <div className="threat-model-title">
                          <EditableCell
                            ref={isFirstTables ? titleInputRef : undefined}
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
                            ref={isFirstTables ? descriptionInputRef : undefined}
                            value={threatModel?.description || ''}
                            placeholder={!threatModel?.description || threatModel?.description === 'Description of scope...' ? 'Description of scope...' : undefined}
                            onSave={handleThreatModelDescriptionChange}
                            onNavigate={handleDescriptionNavigate}
                            onTabPress={handleDescriptionTabPress}
                          />
                        </div>
                        <div className="threat-model-participants">
                          <ParticipantsInput
                            ref={isFirstTables ? participantsInputRef : undefined}
                            value={threatModel?.participants || []}
                            onSave={handleParticipantsChange}
                            onNavigate={handleParticipantsNavigate}
                            onTabPress={handleParticipantsTabPress}
                          />
                        </div>
                      </div>
                    </div>

                    <div className='tables-container-content'>
                      <h2 className="collapsible-section-header" onClick={() => setIsWorkingSectionCollapsed(!isWorkingSectionCollapsed)}>
                        <span>What are we working on?</span>
                        <span className="collapse-arrow">{isWorkingSectionCollapsed ? '▶' : '▼'}</span>
                      </h2>
                      {!isWorkingSectionCollapsed && (
                        <>
                          <ComponentsTable
                            ref={isFirstTables ? componentsTableRef : undefined}
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
                            ref={isFirstTables ? assetsTableRef : undefined}
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
                            ref={isFirstTables ? architectureSectionRef : undefined}
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
                          ref={isFirstTables ? threatsTableRef : undefined}
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
                          ref={isFirstTables ? controlsTableRef : undefined}
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
                  </div>
                )}

                {/* YAML view */}
                {tab.view === 'yaml' && (
                  <div className="tab-panel-yaml">
                    {yamlContent && (
                      <Suspense fallback={
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          height: '100%',
                          width: '100%',
                          color: 'var(--text-secondary)'
                        }}>
                          Loading YAML editor...
                        </div>
                      }>
                        <YamlEditor 
                          ref={isFirstYaml ? yamlEditorRef : undefined}
                          initialContent={yamlContent}
                          onUpdate={handleYamlUpdate}
                        />
                      </Suspense>
                    )}
                  </div>
                )}

                {/* Canvas view */}
                {tab.view === 'canvas' && isFirstCanvas && (
                  <div className="tab-panel-canvas">
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
                        zIndexMode="manual"
                        elevateNodesOnSelect={false}
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
                )}

                {/* Canvas placeholder for duplicate canvas tabs */}
                {tab.view === 'canvas' && !isFirstCanvas && (
                  <div className="tab-panel-canvas-placeholder">
                    <Shapes size={16} />
                    <span>Canvas is shown in another tab</span>
                  </div>
                )}

                {/* Tutorials view */}
                {tab.view === 'tutorials' && (
                  <TutorialPanel />
                )}
              </div>

              {/* Resize divider between tabs */}
              {i < tabs.length - 1 && (
                <ResizeDivider
                  dividerIndex={i}
                  onResizeTab={resizeTabs}
                />
              )}
            </React.Fragment>
          );
        })}
        </SortableContext>
        {dropIndicatorLeft !== null && (
          <div className="tab-drop-indicator" style={{ left: dropIndicatorLeft }} />
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragTab ? (
          <div className="tab-panel-header tab-panel-header--overlay">
            <TabPanelHeaderContent
              tab={activeDragTab}
              showDragHandle
            />
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

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
          onSave={handleQuickSave}
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
          zIndex: 10001,
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

      {/* File drag-and-drop overlay */}
      {isFileDragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">
            <div className="drop-overlay-icon">📄</div>
            <div className="drop-overlay-text">Drop file to open</div>
          </div>
        </div>
      )}
    </div>
  );
}

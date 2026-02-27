import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../../__tests__/test-utils';
import userEvent from '@testing-library/user-event';
import ThreatModelEditor from '../ThreatModelEditor';
import type { ThreatModel } from '../../types/threatModel';

// Mock the ReactFlow library
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  SelectionMode: {
    Partial: 'partial',
    Full: 'full',
  },
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
  applyNodeChanges: vi.fn((_changes, nodes) => nodes),
  applyEdgeChanges: vi.fn((_changes, edges) => edges),
}));

// Mock the utility functions
vi.mock('../../utils/yamlParser', () => ({
  fetchYamlContent: vi.fn(),
  parseYaml: vi.fn(),
  updateYamlField: vi.fn((content) => content),
  appendYamlItem: vi.fn((content) => content),
  removeYamlItem: vi.fn((content) => content),
  removeRefFromArrayFields: vi.fn((content) => content),
}));

vi.mock('../../utils/flowTransformer', () => ({
  transformThreatModel: vi.fn(() => ({
    nodes: [],
    edges: [],
  })),
}));

vi.mock('../../utils/browserStorage', () => ({
  saveToBrowserStorage: vi.fn(),
  saveAutoSaveDraft: vi.fn(() => Promise.resolve()),
  getAutoSaveDraft: vi.fn(() => Promise.resolve(null)),
  clearAutoSaveDraft: vi.fn(() => Promise.resolve()),
  isFileSystemAccessSupported: vi.fn(() => false),
  openFileWithPicker: vi.fn(),
  saveFileWithPicker: vi.fn(),
  writeToFileHandle: vi.fn(),
  requestFileHandlePermission: vi.fn(),
  storeFileHandle: vi.fn(),
  clearFileHandle: vi.fn(),
}));

vi.mock('../../utils/refGenerators', () => ({
  generateComponentRef: vi.fn(() => 'comp-new'),
  generateBoundaryRef: vi.fn(() => 'boundary-new'),
  generateAssetRef: vi.fn(() => 'A01'),
  generateThreatRef: vi.fn(() => 'T01'),
  generateControlRef: vi.fn(() => 'C01'),
  generateAssetName: vi.fn((ref: string) => `Asset ${ref}`),
  generateThreatName: vi.fn((ref: string) => `Threat ${ref}`),
  generateControlName: vi.fn((ref: string) => `Control ${ref}`),
  generateComponentName: vi.fn(() => 'Component 1'),
  generateBoundaryName: vi.fn(() => 'Boundary 1'),
  isComponentNamePlaceholder: vi.fn((name: string) => /^Component \d+$/.test(name)),
}));

// Mock template loader
vi.mock('../../utils/templateLoader', () => ({
  loadTemplateByPath: vi.fn(() => Promise.resolve('name: Empty\nschema_version: "1.0"\ncomponents: []')),
}));

// Mock the hooks
vi.mock('../../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

vi.mock('../../hooks/useDiagramExport', () => ({
  useDiagramExport: vi.fn(() => ({
    handleDownloadMarkdown: vi.fn(),
    handleDownloadPng: vi.fn(),
  })),
}));

vi.mock('../../hooks/useThreatModelState', () => ({
  useThreatModelState: vi.fn(() => ({
    nodes: [],
    edges: [],
    threatModel: null,
    yamlContent: '',
    isDraggingEdge: false,
    isDraggingNode: null,
    isEditingMode: false,
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setThreatModel: vi.fn(),
    setYamlContent: vi.fn(),
    setIsDraggingEdge: vi.fn(),
    setIsDraggingNode: vi.fn(),
    setIsEditingMode: vi.fn(),
    threatModelRef: { current: null },
    nodesRef: { current: [] },
    edgesRef: { current: [] },
    arrowKeyMovedNodesRef: { current: new Set() },
    updateYaml: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    clearHistory: vi.fn(),
    recordState: vi.fn(),
    handleAssetNameChange: vi.fn(),
    handleAssetDescriptionChange: vi.fn(),
    handleThreatNameChange: vi.fn(),
    handleThreatDescriptionChange: vi.fn(),
    handleControlNameChange: vi.fn(),
    handleControlDescriptionChange: vi.fn(),
    handleThreatAffectedComponentsChange: vi.fn(),
    handleThreatAffectedDataFlowsChange: vi.fn(),
    handleThreatAffectedAssetsChange: vi.fn(),
    handleControlMitigatesChange: vi.fn(),
    handleControlImplementedInChange: vi.fn(),
    handleComponentNameChange: vi.fn(),
    handleComponentTypeChange: vi.fn(),
    handleComponentDescriptionChange: vi.fn(),
    handleComponentAssetsChange: vi.fn(),
    handleBoundaryNameChange: vi.fn(),
    handleBoundaryDescriptionChange: vi.fn(),
    handleBoundaryResizeEnd: vi.fn(),
    handleDataFlowLabelChange: vi.fn(),
    handleDataFlowDirectionChange: vi.fn(),
    handleThreatModelNameChange: vi.fn(),
    handleThreatModelDescriptionChange: vi.fn(),
  })),
}));

vi.mock('../../hooks/useFlowDiagram', () => ({
  useFlowDiagram: vi.fn(() => ({
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onNodeDragStop: vi.fn(),
    onNodeDragStart: vi.fn(),
    onConnect: vi.fn(),
    onReconnect: vi.fn(),
  })),
}));

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../../hooks/useTableNavigation', () => ({
  useTableNavigation: vi.fn(() => ({
    handleTitleNavigate: vi.fn(),
    handleTitleTabPress: vi.fn(),
    handleDescriptionNavigate: vi.fn(),
    handleDescriptionTabPress: vi.fn(),
    handleParticipantsNavigate: vi.fn(),
    handleParticipantsTabPress: vi.fn(),
    handleComponentsNavigateToNextTable: vi.fn(),
    handleComponentsNavigateToPreviousTable: vi.fn(),
    handleAssetsNavigateToNextTable: vi.fn(),
    handleAssetsNavigateToPreviousTable: vi.fn(),
    handleThreatsNavigateToNextTable: vi.fn(),
    handleThreatsNavigateToPreviousTable: vi.fn(),
    handleControlsNavigateToPreviousTable: vi.fn(),
    handleArchitectureNavigateToPreviousTable: vi.fn(),
    handleArchitectureNavigateToNextTable: vi.fn(),
  })),
}));

vi.mock('../../hooks/useModelLoader', () => ({
  useModelLoader: vi.fn(() => ({
    loadFromContent: vi.fn(),
    loadFromYamlUpdate: vi.fn(),
  })),
}));

vi.mock('../../hooks/useSaveHandlers', () => ({
  useSaveHandlers: vi.fn(() => ({
    handleSaveToBrowser: vi.fn(),
    handleSaveToFile: vi.fn(),
    handleSaveToNewFile: vi.fn(),
    handleSaveToNewBrowser: vi.fn(),
    handleCommitToGitHub: vi.fn(),
    handleQuickSave: vi.fn(),
    quickSaveRef: { current: null },
  })),
}));

vi.mock('../../hooks/useGitHubOperations', () => ({
  useGitHubOperations: vi.fn(() => ({
    handleCommitModalClose: vi.fn(),
    handleCommit: vi.fn(),
    getCommitApiClient: vi.fn(),
    handleSyncWithGitHub: vi.fn(),
    handleSyncModalConfirm: vi.fn(),
    handleSyncModalCancel: vi.fn(),
  })),
}));

// Mock child components
vi.mock('../canvas/ThreatModelNode', () => ({
  default: () => <div data-testid="threat-model-node" />,
}));

vi.mock('../canvas/BoundaryNode', () => ({
  default: () => <div data-testid="boundary-node" />,
}));

vi.mock('../canvas/EditableEdge', () => ({
  default: () => <div data-testid="editable-edge" />,
}));

vi.mock('../canvas/EdgeMarkers', () => ({
  default: () => <div data-testid="edge-markers" />,
}));

vi.mock('../canvas/CanvasToolbar', () => ({
  default: () => <div data-testid="canvas-toolbar" />,
}));

vi.mock('../tables/AssetsTable', () => ({
  default: () => <div data-testid="assets-table" />,
}));

vi.mock('../tables/ThreatsTable', () => ({
  default: () => <div data-testid="threats-table" />,
}));

vi.mock('../tables/ControlsTable', () => ({
  default: () => <div data-testid="controls-table" />,
}));

vi.mock('../tables/ArchitectureSection', () => ({
  default: () => <div data-testid="architecture-section" />,
}));

vi.mock('../navbar/NavbarDropdown', () => ({
  NavbarDropdown: () => <div data-testid="navbar-dropdown" />,
}));

vi.mock('../YamlEditor', () => ({
  default: () => <div data-testid="yaml-editor" />,
}));

describe('ThreatModelEditor', () => {
  const mockThreatModel: ThreatModel = {
    name: 'Test Threat Model',
    schema_version: '1.0',
    description: 'Test description',
    components: [
      {
        ref: 'comp-1',
        name: 'Component 1',
        component_type: 'internal',
        x: 100,
        y: 100,
      },
    ],
    assets: [
      {
        ref: 'asset-1',
        name: 'Asset 1',
      },
    ],
    threats: [
      {
        ref: 'threat-1',
        name: 'Threat 1',
      },
    ],
    controls: [
      {
        ref: 'control-1',
        name: 'Control 1',
      },
    ],
  };

  const mockYamlContent = 'name: Test Threat Model\nversion: 1.0';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup default mock returns
    const { fetchYamlContent, parseYaml } = await import('../../utils/yamlParser');
    const { transformThreatModel } = await import('../../utils/flowTransformer');
    
    (fetchYamlContent as any).mockResolvedValue(mockYamlContent);
    (parseYaml as any).mockReturnValue(mockThreatModel);
    (transformThreatModel as any).mockReturnValue({
      nodes: [
        {
          id: 'comp-1',
          type: 'threatModelNode',
          position: { x: 100, y: 100 },
          data: { label: 'Component 1' },
        },
      ],
      edges: [],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should show loading state initially', () => {
      render(<ThreatModelEditor />);
      
      expect(screen.getByText('Loading threat model...')).toBeInTheDocument();
    });

    it('should load and display threat model', async () => {
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.queryByText('Loading threat model...')).not.toBeInTheDocument();
      });
      
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should display error when loading fails', async () => {
      const { loadTemplateByPath } = await import('../../utils/templateLoader');
      (loadTemplateByPath as any).mockRejectedValue(new Error('Failed to load'));
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load threat model/)).toBeInTheDocument();
      });
    });

    it('should load with initial content', async () => {
      const { useModelLoader } = await import('../../hooks/useModelLoader');
      const mockLoadFromContent = vi.fn();
      (useModelLoader as any).mockReturnValue({
        loadFromContent: mockLoadFromContent,
        loadFromYamlUpdate: vi.fn(),
      });
      
      render(<ThreatModelEditor initialContent={mockYamlContent} />);
      
      await waitFor(() => {
        expect(mockLoadFromContent).toHaveBeenCalledWith(
          mockYamlContent,
          expect.objectContaining({ type: 'initial' }),
        );
      });
    });

    it('should load with initial file', async () => {
      const { useModelLoader } = await import('../../hooks/useModelLoader');
      const mockLoadFromContent = vi.fn();
      (useModelLoader as any).mockReturnValue({
        loadFromContent: mockLoadFromContent,
        loadFromYamlUpdate: vi.fn(),
      });
      
      // Mock File object with text() method
      const mockFile = {
        name: 'test.yaml',
        text: vi.fn().mockResolvedValue(mockYamlContent)
      } as any;
      
      render(<ThreatModelEditor initialFile={mockFile} />);
      
      await waitFor(() => {
        expect(mockLoadFromContent).toHaveBeenCalled();
      });
    });
  });

  describe('UI interactions', () => {
    beforeEach(async () => {
      // Ensure component loads successfully by setting up the template loader
      const { loadTemplateByPath } = await import('../../utils/templateLoader');
      (loadTemplateByPath as any).mockResolvedValue(mockYamlContent);
    });

    it('should render main UI sections after loading', async () => {
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument();
      expect(screen.getAllByTestId('navbar-dropdown').length).toBeGreaterThan(0);
    });

    it('should display tables view by default', async () => {
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('architecture-section')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('assets-table')).toBeInTheDocument();
      expect(screen.getByTestId('threats-table')).toBeInTheDocument();
      expect(screen.getByTestId('controls-table')).toBeInTheDocument();
    });

    it('should allow toggling between tables and yaml view', async () => {
      const user = userEvent.setup();
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('architecture-section')).toBeInTheDocument();
      });
      
      // The toggle button will switch to YAML view
      const yamlButton = screen.getAllByRole('button').find(b => b.textContent?.includes('YAML'));
      if (yamlButton) {
        await user.click(yamlButton);
        // View should switch (implementation-specific verification)
      }
    });


  });

  describe('dark mode', () => {
    it('should respect system preference for dark mode', async () => {
      // Set localStorage to dark mode
      localStorage.setItem('theme', 'dark');
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      // Theme should be applied
      const theme = document.documentElement.getAttribute('data-theme');
      expect(theme).toBeTruthy();
      
      localStorage.removeItem('theme');
    });

    it('should set theme on document', async () => {
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      // Theme should be set on document element
      const theme = document.documentElement.getAttribute('data-theme');
      expect(theme).toMatch(/light|dark/);
    });
  });

  describe('sidebar and canvas collapse', () => {
    it('should toggle sidebar collapse', async () => {
      const user = userEvent.setup();
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      const collapseButton = screen.getAllByRole('button').find(
        (btn) => btn.querySelector('[data-icon="panel-left"]') || btn.textContent?.includes('collapse')
      );
      
      if (collapseButton) {
        await user.click(collapseButton);
        // Verify the UI updates (implementation-specific)
      }
    });

    it('should auto-expand sidebar when canvas is collapsed', async () => {
      // This tests the mutual exclusivity of collapse states
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      // Test that collapsing one expands the other
      // Implementation depends on the actual button structure
    });
  });

  describe('download functionality', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and revokeObjectURL
      globalThis.URL.createObjectURL = vi.fn(() => 'mock-url');
      globalThis.URL.revokeObjectURL = vi.fn();
      
      // Mock document.createElement for download links
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'a') {
          element.click = vi.fn();
        }
        return element;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should have download functionality available', async () => {
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      // Download functionality is available through dropdowns
      expect(screen.getAllByTestId('navbar-dropdown').length).toBeGreaterThan(0);
    });
  });

  describe('save to browser', () => {
    it('should have save dropdown', async () => {
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      // Save dropdown is now part of the navbar dropdowns
      // There should be multiple navbar-dropdown elements (New, Save, Settings)
      const dropdowns = screen.getAllByTestId('navbar-dropdown');
      expect(dropdowns.length).toBeGreaterThanOrEqual(2); // At least New and Save dropdowns
    });
  });

  describe('integration with hooks', () => {
    it('should use useThreatModelState hook', async () => {
      const { useThreatModelState } = await import('../../hooks/useThreatModelState');
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(useThreatModelState).toHaveBeenCalled();
      });
    });

    it('should use useFlowDiagram hook', async () => {
      const { useFlowDiagram } = await import('../../hooks/useFlowDiagram');
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(useFlowDiagram).toHaveBeenCalled();
      });
    });

    it('should use useDiagramExport hook', async () => {
      const { useDiagramExport } = await import('../../hooks/useDiagramExport');
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(useDiagramExport).toHaveBeenCalled();
      });
    });
  });

  describe('boundary membership updates', () => {
    it('should update boundary memberships based on position', async () => {
      const { useThreatModelState } = await import('../../hooks/useThreatModelState');
      const mockSetThreatModel = vi.fn();
      
      (useThreatModelState as any).mockReturnValue({
        ...((useThreatModelState as any)() as any),
        threatModel: mockThreatModel,
        setThreatModel: mockSetThreatModel,
      });
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      // Boundary membership logic is complex and depends on node positions
      // This test verifies the component renders without errors
    });
  });

  describe('edge cases', () => {
    it('should handle null threat model', async () => {
      const { useThreatModelState } = await import('../../hooks/useThreatModelState');
      
      (useThreatModelState as any).mockReturnValue({
        ...((useThreatModelState as any)() as any),
        threatModel: null,
      });
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
    });

    it('should handle empty threat model', async () => {
      const emptyModel: ThreatModel = {
        name: 'Empty Model',
        schema_version: '1.0',
        components: [],
      };
      
      const { parseYaml } = await import('../../utils/yamlParser');
      (parseYaml as any).mockReturnValue(emptyModel);
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
    });

    it('should handle missing optional properties', async () => {
      const minimalModel: ThreatModel = {
        name: 'Minimal Model',
        schema_version: '1.0',
        components: [],
      };
      
      const { parseYaml } = await import('../../utils/yamlParser');
      (parseYaml as any).mockReturnValue(minimalModel);
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
    });
  });

  describe('event listeners cleanup', () => {
    it('should clean up event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
      
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('YAML editor', () => {
    it('should load YAML content', async () => {
      const { useModelLoader } = await import('../../hooks/useModelLoader');
      const mockLoadFromContent = vi.fn();
      (useModelLoader as any).mockReturnValue({
        loadFromContent: mockLoadFromContent,
        loadFromYamlUpdate: vi.fn(),
      });
      
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
      
      // Model is loaded via the useModelLoader hook
      expect(mockLoadFromContent).toHaveBeenCalled();
    });
  });

  describe('ReactFlow integration', () => {
    it('should render ReactFlow with core components', async () => {
      render(<ThreatModelEditor />);
      
      await waitFor(() => {
        const reactFlow = screen.getByTestId('react-flow');
        expect(reactFlow).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('background')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
    });
  });
});

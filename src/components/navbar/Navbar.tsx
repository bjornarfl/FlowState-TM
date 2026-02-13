import React from 'react';
import { BookDashed, Download, FileText, Settings, Save, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Table2, Code2, Moon, Sun, Undo2, Redo2, Plus, Wand2, Upload, Database, Github, FolderGit2, HardDrive, FileOutput, Shapes, Link, Copy, Image, Timer, TimerOff } from 'lucide-react';
import { NavbarDropdown } from './NavbarDropdown';
import { SourceType } from '../filebrowser/SourceSelector';
import { useSaveState } from '../../contexts/SaveStateContext';

import './Navbar.css';

export interface NavbarProps {
  isCollapsed: boolean;
  isCanvasCollapsed: boolean;
  sidebarView: 'tables' | 'yaml';
  mobileView?: 'tables' | 'yaml' | 'canvas';
  isDarkMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canSaveToFile?: boolean;
  localFileName?: string | null;
  onSidebarCollapse: () => void;
  onCanvasCollapse: () => void;
  onSidebarViewChange: (view: 'tables' | 'yaml') => void;
  onMobileViewChange?: (view: 'tables' | 'yaml' | 'canvas') => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewThreatModel: (source: SourceType) => void;
  onQuickSave: () => void;
  onSaveToBrowser: () => void;
  onSaveToFile?: () => void;
  onSaveToNewFile?: () => void;
  onSaveToNewBrowser?: () => void;
  onCommitToGitHub?: () => void;
  onDownloadFolder: () => void;
  onDarkModeToggle: () => void;
  onGitHubSettingsClick?: () => void;
  onGenerateShareLink?: () => void;
  onCopyToConfluence: () => void;
  onCopyDiagramToClipboard?: () => void;
  onCopyAsYaml?: () => void;
  onCopyAsMarkdown?: () => void;
}

// ── Helper: human-readable relative time ──────────────────────────────────

function formatSaveTime(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const savedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  const diffTime = today.getTime() - savedDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function Navbar({
  isCollapsed,
  isCanvasCollapsed,
  sidebarView,
  mobileView = 'tables',
  isDarkMode,
  canUndo,
  canRedo,
  canSaveToFile,
  localFileName,
  onSidebarCollapse,
  onCanvasCollapse,
  onSidebarViewChange,
  onMobileViewChange,
  onUndo,
  onRedo,
  onNewThreatModel,
  onQuickSave,
  onSaveToBrowser,
  onSaveToFile,
  onSaveToNewFile,
  onSaveToNewBrowser,
  onCommitToGitHub,
  onDownloadFolder,
  onCopyToConfluence,
  onCopyDiagramToClipboard,
  onCopyAsYaml,
  onCopyAsMarkdown,
  onDarkModeToggle,
  onGitHubSettingsClick,
  onGenerateShareLink,
}: NavbarProps): React.JSX.Element {
  // ── Save state from context ──────────────────────────────────────────
  const {
    saveSource,
    lastSavedAt,
    isDirty,
    autoSaveSettings,
    setAutoSaveSettings,
  } = useSaveState();

  // ── Build the center indicator ───────────────────────────────────────
  let indicatorContent: React.ReactNode = null;

  const isAutoSavingToSource =
    (autoSaveSettings.autoSaveBrowserFiles && saveSource?.type === 'browser') ||
    (autoSaveSettings.autoSaveLocalFiles && saveSource?.type === 'file');

  if (saveSource) {
    // When auto-saving to source, show live status instead of timestamp
    const savedLabel = isAutoSavingToSource
      ? (isDirty ? 'Saving…' : 'Saved')
      : lastSavedAt
        ? `last saved ${formatSaveTime(lastSavedAt)}`
        : '';
    // Only show dirty dot when NOT auto-saving to source
    const dirtyDot = isDirty && !isAutoSavingToSource ? (
      <span className="navbar-indicator-dirty" title="Unsaved changes">●</span>
    ) : null;

    switch (saveSource.type) {
      case 'github': {
        const meta = saveSource.metadata;
        indicatorContent = (
          <a
            className="navbar-save-indicator navbar-save-indicator--github"
            href={`https://${meta.domain}/${meta.owner}/${meta.repository}/blob/${meta.branch}/${meta.path}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`View ${meta.path} on ${meta.domain}\n${savedLabel}`}
          >
            <FolderGit2 size={14} />
            <span className="navbar-indicator-name">{meta.owner}/{meta.repository}</span>
            <span className="navbar-indicator-saved">{savedLabel}</span>
            {dirtyDot}
          </a>
        );
        break;
      }
      case 'file': {
        indicatorContent = (
          <span
            className="navbar-save-indicator navbar-save-indicator--file"
            title={`Editing local file: ${saveSource.fileName}\n${savedLabel}`}
          >
            <HardDrive size={14} />
            <span className="navbar-indicator-name">{saveSource.fileName}</span>
            <span className="navbar-indicator-saved">{savedLabel}</span>
            {dirtyDot}
          </span>
        );
        break;
      }
      case 'browser': {
        indicatorContent = (
          <span
            className="navbar-save-indicator navbar-save-indicator--browser"
            title={`Saved in browser storage: ${saveSource.modelName}\n${savedLabel}`}
          >
            <Database size={14} />
            <span className="navbar-indicator-name">{saveSource.modelName}</span>
            <span className="navbar-indicator-saved">{savedLabel}</span>
            {dirtyDot}
          </span>
        );
        break;
      }
    }
  } else {
    // No save source — show "Never saved"
    indicatorContent = (
      <span
        className="navbar-save-indicator navbar-save-indicator--none"
        title="This model has not been saved yet"
      >
        <span className="navbar-indicator-saved">Not saved</span>
      </span>
    );
  }
  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Desktop view toggle */}
        {!isCollapsed && (
          <div className="navbar-toggle navbar-toggle-desktop">
            <button
              className={`navbar-toggle-button ${sidebarView === 'tables' ? 'active' : ''}`}
              onClick={() => onSidebarViewChange('tables')}
              title="Table View"
            >
              <Table2 size={16} />
              <span>Tables</span>
            </button>
            <button
              className={`navbar-toggle-button ${sidebarView === 'yaml' ? 'active' : ''}`}
              onClick={() => onSidebarViewChange('yaml')}
              title="YAML Editor"
            >
              <Code2 size={16} />
              <span>YAML</span>
            </button>
          </div>
        )}
        
        {/* Mobile view toggle - 3 buttons */}
        <div className="navbar-toggle navbar-toggle-mobile">
          <button
            className={`navbar-toggle-button ${mobileView === 'tables' ? 'active' : ''}`}
            onClick={() => onMobileViewChange?.('tables')}
            title="Table View"
          >
            <Table2 size={16} />
            <span>Tables</span>
          </button>
          <button
            className={`navbar-toggle-button ${mobileView === 'yaml' ? 'active' : ''}`}
            onClick={() => onMobileViewChange?.('yaml')}
            title="YAML Editor"
          >
            <Code2 size={16} />
            <span>YAML</span>
          </button>
          <button
            className={`navbar-toggle-button ${mobileView === 'canvas' ? 'active' : ''}`}
            onClick={() => onMobileViewChange?.('canvas')}
            title="Canvas View"
          >
            <Shapes size={16} />
            <span>Canvas</span>
          </button>
        </div>

        {/* Desktop collapse buttons */}
        <button 
          className="navbar-button collapse-button navbar-button-desktop"
          onClick={onSidebarCollapse}
          title={isCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        <button 
          className="navbar-button canvas-collapse-button navbar-button-desktop"
          onClick={onCanvasCollapse}
          title={isCanvasCollapsed ? "Show canvas" : "Hide canvas"}
        >
          {isCanvasCollapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
        </button>
      </div>

      <div className="navbar-center">
        <h1 className="navbar-title">FlowState TM</h1>
        {indicatorContent}
      </div>

      <div className="navbar-right">
        <button 
          className="navbar-button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd/Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.5, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <Undo2 size={20} />
        </button>
        
        <button 
          className="navbar-button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd/Ctrl+Shift+Z)"
          style={{ opacity: canRedo ? 1 : 0.5, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <Redo2 size={20} />
        </button>

        <NavbarDropdown
          trigger={<Plus size={20} />}
          title="New threat model"
          items={[
            {
              label: 'New Threat Model',
              icon: <Wand2 size={16} />,
              onClick: () => onNewThreatModel('empty'),
            },
            {
              label: 'Load from Template',
              icon: <BookDashed size={16} />,
              onClick: () => onNewThreatModel('templates'),
            },
            {
              label: 'Load from Local',
              icon: <Upload size={16} />,
              onClick: () => onNewThreatModel('upload'),
            },
            {
              label: 'Load from Browser Storage',
              icon: <Database size={16} />,
              onClick: () => onNewThreatModel('browser'),
            },
            {
              label: 'Load from GitHub',
              icon: <Github size={16} />,
              onClick: () => onNewThreatModel('github'),
            },
          ]}
        />
                    
        <NavbarDropdown
          trigger={<Save size={20} />}
          title="Save threat model"
          items={[
            {
              label: saveSource
                ? `Save (${saveSource.type === 'github' ? 'GitHub' : saveSource.type === 'file' ? saveSource.fileName : 'Browser'})`
                : 'Save',
              icon: <Save size={16} />,
              onClick: onQuickSave,
              shortcut: '⌘S',
            },
            // Source-specific "save to new" options
            ...(saveSource?.type === 'file' && canSaveToFile && onSaveToNewFile ? [{
              label: 'Save to New File...',
              icon: <FileOutput size={16} />,
              onClick: onSaveToNewFile,
            }] : []),
            ...(saveSource?.type === 'browser' && onSaveToNewBrowser ? [{
              label: 'Save to New Browser Storage...',
              icon: <Database size={16} />,
              onClick: onSaveToNewBrowser,
            }] : []),
            // Cross-save options
            ...(canSaveToFile && onSaveToFile && saveSource?.type !== 'file' ? [{
              label: 'Save to File...',
              icon: <FileOutput size={16} />,
              onClick: onSaveToFile,
            }] : []),
            ...(saveSource?.type !== 'browser' ? [{
              label: 'Save to Browser Storage',
              icon: <Database size={16} />,
              onClick: onSaveToBrowser,
            }] : []),
            {
              label: 'Download ZIP Folder',
              icon: <Download size={16} />,
              onClick: onDownloadFolder,
            },
            ...(onCommitToGitHub ? [{
              label: 'Commit to GitHub',
              icon: <Github size={16} />,
              onClick: onCommitToGitHub,
            }] : []),
          ]}
        />

        <NavbarDropdown
          trigger={<Copy size={20} />}
          title="Copy to Clipboard"
          items={[
            ...(onCopyDiagramToClipboard ? [{
              label: 'Copy DFD as Image',
              icon: <Image size={16} />,
              onClick: onCopyDiagramToClipboard,
            }] : []),
            ...(onCopyAsYaml ? [{
              label: 'Copy as YAML',
              icon: <Code2 size={16} />,
              onClick: onCopyAsYaml,
            }] : []),
            ...(onCopyAsMarkdown ? [{
              label: 'Copy as Markdown',
              icon: <FileText size={16} />,
              onClick: onCopyAsMarkdown,
            }] : []),
            {
              label: 'Copy as Confluence Markup',
              icon: <FileText size={16} />,
              onClick: onCopyToConfluence,
            },
            ...(onGenerateShareLink ? [{
              label: 'Copy Shareable Link',
              icon: <Link size={16} />,
              onClick: onGenerateShareLink,
            }] : []),
          ]}
        />

        <NavbarDropdown
          trigger={<Settings size={20} />}
          title="Settings"
          items={[
            {
              label: isDarkMode ? 'Light Mode' : 'Dark Mode',
              icon: isDarkMode ? <Sun size={16} /> : <Moon size={16} />,
              onClick: onDarkModeToggle,
            },
            {
              label: autoSaveSettings.autoSaveLocalFiles ? 'Auto-save local files: On' : 'Auto-save local files: Off',
              icon: autoSaveSettings.autoSaveLocalFiles ? <Timer size={16} /> : <TimerOff size={16} />,
              onClick: () => setAutoSaveSettings({ ...autoSaveSettings, autoSaveLocalFiles: !autoSaveSettings.autoSaveLocalFiles }),
            },
            {
              label: autoSaveSettings.autoSaveBrowserFiles ? 'Auto-save browser files: On' : 'Auto-save browser files: Off',
              icon: autoSaveSettings.autoSaveBrowserFiles ? <Timer size={16} /> : <TimerOff size={16} />,
              onClick: () => setAutoSaveSettings({ ...autoSaveSettings, autoSaveBrowserFiles: !autoSaveSettings.autoSaveBrowserFiles }),
            },
            ...(onGitHubSettingsClick ? [{
              label: 'GitHub Settings',
              icon: <Github size={16} />,
              onClick: onGitHubSettingsClick,
            }] : []),
          ]}
        />
      </div>
    </nav>
  );
}

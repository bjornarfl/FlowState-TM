import React from 'react';
import { BookDashed, Download, FileText, Settings, Save, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Table2, Code2, Moon, Sun, Undo2, Redo2, Plus, Wand2, Upload, Database, Github, FolderGit2, HardDrive, FileOutput, Shapes, Link, Copy, Image } from 'lucide-react';
import { NavbarDropdown } from './NavbarDropdown';
import { SourceType } from '../filebrowser/SourceSelector';
import type { GitHubMetadata } from '../integrations/github/types';
import './Navbar.css';

export interface NavbarProps {
  isCollapsed: boolean;
  isCanvasCollapsed: boolean;
  sidebarView: 'tables' | 'yaml';
  mobileView?: 'tables' | 'yaml' | 'canvas';
  isDarkMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  githubMetadata?: GitHubMetadata | null;
  localFileName?: string | null;
  canSaveToFile?: boolean;
  onSidebarCollapse: () => void;
  onCanvasCollapse: () => void;
  onSidebarViewChange: (view: 'tables' | 'yaml') => void;
  onMobileViewChange?: (view: 'tables' | 'yaml' | 'canvas') => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewThreatModel: (source: SourceType) => void;
  onSaveToBrowser: () => void;
  onSaveToFile?: () => void;
  onSaveToNewFile?: () => void;
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

export function Navbar({
  isCollapsed,
  isCanvasCollapsed,
  sidebarView,
  mobileView = 'tables',
  isDarkMode,
  canUndo,
  canRedo,
  githubMetadata,
  localFileName,
  canSaveToFile,
  onSidebarCollapse,
  onCanvasCollapse,
  onSidebarViewChange,
  onMobileViewChange,
  onUndo,
  onRedo,
  onNewThreatModel,
  onSaveToBrowser,
  onSaveToFile,
  onSaveToNewFile,
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
        {githubMetadata && (
          <a 
            className="navbar-github-indicator"
            href={`https://${githubMetadata.domain}/${githubMetadata.owner}/${githubMetadata.repository}/blob/${githubMetadata.branch}/${githubMetadata.path}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`View ${githubMetadata.path} on ${githubMetadata.domain}`}
          >
            <FolderGit2 size={14} />
            <span>{githubMetadata.owner}/{githubMetadata.repository}</span>
          </a>
        )}
        {!githubMetadata && localFileName && (
          <span 
            className="navbar-local-file-indicator"
            title={`Editing local file: ${localFileName}`}
          >
            <HardDrive size={14} />
            <span>{localFileName}</span>
          </span>
        )}
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
            ...(canSaveToFile && onSaveToFile ? [{
              label: localFileName ? `Save to ${localFileName}` : 'Save to File...',
              icon: <FileOutput size={16} />,
              onClick: onSaveToFile,
            }] : []),
            ...(canSaveToFile && onSaveToNewFile && localFileName ? [{
              label: 'Save to New File...',
              icon: <FileOutput size={16} />,
              onClick: onSaveToNewFile,
            }] : []),
            {
              label: 'Save to Browser Storage',
              icon: <Database size={16} />,
              onClick: onSaveToBrowser,
            },
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

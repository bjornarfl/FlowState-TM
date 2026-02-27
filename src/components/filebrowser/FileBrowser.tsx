import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Edit2, Copy } from 'lucide-react';
import { SourceType } from './SourceSelector';
import { SettingsDropdown } from './SettingsDropdown';
import {
  loadTemplateByPath,
  getAvailableTemplates,
} from '../../utils/templateLoader';
import {
  getSavedModelsFromBrowser,
  loadModelWithMetadata,
  deleteFromBrowserStorage,
  renameModelInBrowserStorage,
  duplicateModelInBrowserStorage,
  SavedModel,
} from '../../utils/browserStorage';
import type { GitHubMetadata } from '../../integrations/github/types';
import './FileBrowser.css';

interface FileBrowserProps {
  source: SourceType;
  onFileSelect: (file: File | { name: string; content: string }, fileHandle?: FileSystemFileHandle | null, browserModelId?: string) => void;
  onBack: () => void;
  isDarkMode: boolean;
  onDarkModeChange: (isDarkMode: boolean) => void;
  onMetadataLoad?: (metadata: GitHubMetadata | null | undefined) => void;
  onGenerateShareLink?: () => void;
}

interface TemplateFile {
  name: string;
  path: string;
  description?: string;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  source,
  onFileSelect,
  onBack,
  isDarkMode,
  onDarkModeChange,
  onMetadataLoad,
  onGenerateShareLink,
}) => {
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (source === 'templates') {
        setLoading(true);
        setError(null);
        try {
          const availableTemplates = await getAvailableTemplates();
          setTemplates(availableTemplates);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Failed to load templates'
          );
        } finally {
          setLoading(false);
        }
      } else if (source === 'browser') {
        setLoading(true);
        setError(null);
        try {
          const models = await getSavedModelsFromBrowser();
          setSavedModels(models);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Failed to load saved models'
          );
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadData();
  }, [source]);

  const handleTemplateSelect = (template: TemplateFile) => {
    setLoading(true);
    setError(null);
    loadTemplateByPath(template.path)
      .then((content) => {
        // Clear metadata when loading templates
        if (onMetadataLoad) {
          onMetadataLoad(null);
        }
        // Pass null for file handle to clear any existing handle
        onFileSelect({
          name: template.name,
          content,
        }, null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load template');
        setLoading(false);
      });
  };

  const handleSavedModelSelect = async (model: SavedModel) => {
    setLoading(true);
    setError(null);
    try {
      const savedModel = await loadModelWithMetadata(model.id);
      if (!savedModel) {
        throw new Error('Failed to load saved model');
      }
      // Call metadata callback if provided
      if (onMetadataLoad) {
        onMetadataLoad(savedModel.githubMetadata);
      }
      // Pass null for file handle to clear any existing handle, and pass model ID
      onFileSelect({
        name: savedModel.name,
        content: savedModel.content,
      }, null, savedModel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
      setLoading(false);
    }
  };

  const handleDeleteModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this threat model?')) {
      return;
    }
    
    try {
      await deleteFromBrowserStorage(modelId);
      setSavedModels((prev) => prev.filter((m) => m.id !== modelId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  const handleRenameStart = (model: SavedModel, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModelId(model.id);
    setEditingName(model.name);
  };

  const handleRenameSave = async (modelId: string) => {
    if (!editingName.trim()) {
      setEditingModelId(null);
      return;
    }
    
    try {
      await renameModelInBrowserStorage(modelId, editingName.trim());
      setSavedModels((prev) =>
        prev.map((m) =>
          m.id === modelId ? { ...m, name: editingName.trim() } : m
        )
      );
      setEditingModelId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename model');
    }
  };

  const handleDuplicateModel = async (model: SavedModel, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const newId = await duplicateModelInBrowserStorage(model.id);
      if (newId) {
        const models = await getSavedModelsFromBrowser();
        setSavedModels(models);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate model');
    }
  };

  const handleGitHubLoad = () => {
    // Placeholder for GitHub integration
    console.log('GitHub integration not yet implemented');
  };

  const renderContent = () => {
    switch (source) {
      case 'templates':
        return (
          <div className="file-list">
            <h2>Templates</h2>
            {error && <div className="error-message">{error}</div>}
            {loading ? (
              <div className="loading">Loading templates...</div>
            ) : templates.length > 0 ? (
              templates.map((template) => (
                <div
                  key={template.path}
                  className="file-item-container"
                >
                  <button
                    className="file-item"
                    onClick={() => handleTemplateSelect(template)}
                    disabled={loading}
                  >
                    <span className="file-icon">📄</span>
                    <div className="file-details">
                      <span className="file-name">{template.name}</span>
                      {template.description && (
                        <span className="file-description">
                          {template.description}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No templates found</p>
              </div>
            )}
          </div>
        );

      case 'browser':
        return (
          <div className="file-list">
            <h2>Browser Data</h2>
            {error && <div className="error-message">{error}</div>}
            {loading ? (
              <div className="loading">Loading saved models...</div>
            ) : savedModels.length > 0 ? (
              <div>
                {savedModels.map((model) => (
                  <div key={model.id} className="file-item-container">
                    <button
                      className="file-item"
                      onClick={() => handleSavedModelSelect(model)}
                      disabled={loading}
                    >
                      <span className="file-icon">💾</span>
                      <div className="file-details">
                        {editingModelId === model.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleRenameSave(model.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSave(model.id);
                              } else if (e.key === 'Escape') {
                                setEditingModelId(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rename-input"
                            autoFocus
                          />
                        ) : (
                          <span className="file-name">{model.name}</span>
                        )}
                        <span className="file-description">
                          Saved {new Date(model.savedAt).toLocaleString()}
                        </span>
                      </div>
                    </button>
                    <div className="file-actions">
                      <button
                        className="action-button"
                        onClick={(e) => handleRenameStart(model, e)}
                        title="Rename"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="action-button"
                        onClick={(e) => handleDuplicateModel(model, e)}
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="action-button delete-button"
                        onClick={(e) => handleDeleteModel(model.id, e)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No threat models saved in browser yet</p>
                <p className="empty-hint">
                  Threat models you save will appear here
                </p>
              </div>
            )}
          </div>
        );

      case 'github':
        return (
          <div className="file-list">
            <h2>GitHub Integration</h2>
            <div className="empty-state">
              <p>GitHub integration coming soon</p>
              <button className="placeholder-button" onClick={handleGitHubLoad}>
                Connect to GitHub
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const sourceLabel: Record<SourceType, string> = {
    empty: 'New Model',
    templates: 'Templates',
    upload: 'Upload from Local',
    browser: 'Browser Data',
    github: 'GitHub Integration',
  };

  return (
    <div className="file-browser">
      <nav className="navbar">
        <div className="navbar-left">
          <button 
            className="navbar-button back-button"
            onClick={onBack}
            title="Back to source selection"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="navbar-title">{sourceLabel[source]}</span>
        </div>
        <div className="navbar-right">
          <SettingsDropdown
            isDarkMode={isDarkMode}
            onDarkModeChange={onDarkModeChange}
            onGenerateShareLink={onGenerateShareLink}
          />
        </div>
      </nav>
      <div className="file-browser-content">{renderContent()}</div>
    </div>
  );
};

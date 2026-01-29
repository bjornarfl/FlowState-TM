import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import type { ThreatModel } from '../types/threatModel';
import { parseYaml } from '../utils/yamlParser';
import { regenerateAllRefs } from '../utils/refGenerators';
import './YamlEditor.css';

// Dark mode theme matching VS Code
const darkYamlTheme: { [key: string]: React.CSSProperties } = {
  'hljs': {
    display: 'block',
    overflowX: 'auto' as const,
    padding: '0',
    background: 'transparent',
    color: '#d4d4d4',
  } as React.CSSProperties,
  'hljs-literal': {
    color: '#9cdcfe',
  },
  'hljs-string': {
    color: '#ce9178',
  },
  'hljs-number': {
    color: '#b5cea8',
  },
  'hljs-comment': {
    color: '#6a9955',
  },
  'hljs-attr': {
    color: '#9cdcfe',
  },
  'hljs-section': {
    color: '#9cdcfe',
  },
  'hljs-bullet': {
    color: '#ffffff',
  },
  'hljs-symbol': {
    color: '#ffffff',
  },
  'hljs-meta': {
    color: '#ffff00',
  },
};

// Light mode theme
const lightYamlTheme: { [key: string]: React.CSSProperties } = {
  'hljs': {
    display: 'block',
    overflowX: 'auto' as const,
    padding: '0',
    background: 'transparent',
    color: '#1a1a1a',
  } as React.CSSProperties,
  'hljs-literal': {
    color: '#0052cc',
  },
  'hljs-string': {
    color: '#b8481f',
  },
  'hljs-number': {
    color: '#22863a',
  },
  'hljs-comment': {
    color: '#3d7b1f',
  },
  'hljs-attr': {
    color: '#0052cc',
  },
  'hljs-section': {
    color: '#0052cc',
  },
  'hljs-bullet': {
    color: '#000000',
  },
  'hljs-symbol': {
    color: '#000000',
  },
  'hljs-meta': {
    color: '#d97f0c',
  },
};

export interface YamlEditorRef {
  getContent: () => string;
  getModelName: () => string;
  setContent: (content: string) => void;
}

interface YamlEditorProps {
  initialContent: string;
  onUpdate: (updatedModel: ThreatModel, yamlContent: string) => void;
}

const YamlEditor = forwardRef<YamlEditorRef, YamlEditorProps>(({ initialContent, onUpdate }, ref): React.JSX.Element => {
  const [yamlContent, setYamlContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.getAttribute('data-theme') === 'dark');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightContainerRef = useRef<HTMLDivElement>(null);
  
  // Keep a ref to the current content for the imperative handle
  const contentRef = useRef(yamlContent);
  useEffect(() => {
    contentRef.current = yamlContent;
  }, [yamlContent]);

  // Listen for theme changes
  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // Expose methods via ref - use refs instead of state to avoid stale closures
  useImperativeHandle(ref, () => ({
    getContent: () => contentRef.current,
    getModelName: () => {
      try {
        const parsed = parseYaml(contentRef.current);
        return parsed?.name || 'threat_model';
      } catch {
        return 'threat_model';
      }
    },
    setContent: (content: string) => {
      setYamlContent(content);
      setLastSavedContent(content);
      setHasUnsavedChanges(false);
      setError(null);
    },
  }), []);

  // Sync scroll between line numbers, textarea, and highlight container
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
    if (textareaRef.current && highlightContainerRef.current) {
      highlightContainerRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightContainerRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setYamlContent(newContent);
    setHasUnsavedChanges(newContent !== lastSavedContent);

    // Try to parse and validate the YAML
    try {
      const parsed = parseYaml(newContent);
      if (parsed && typeof parsed === 'object') {
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }, [lastSavedContent]);

  const handleApply = useCallback(() => {
    try {
      const parsed = parseYaml(yamlContent);
      if (parsed && typeof parsed === 'object') {
        // Schema validation is now handled by parseYaml
        onUpdate(parsed, yamlContent);
        setLastSavedContent(yamlContent);
        setError(null);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }, [yamlContent, onUpdate]);

  const handleReset = useCallback(() => {
    setYamlContent(lastSavedContent);
    setError(null);
    setHasUnsavedChanges(false);
  }, [lastSavedContent]);

  const handleRegenerateRefs = useCallback(() => {
    try {
      const regeneratedYaml = regenerateAllRefs(yamlContent);
      setYamlContent(regeneratedYaml);
      setHasUnsavedChanges(true);
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }, [yamlContent]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl + S to apply changes
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (hasUnsavedChanges && !error) {
        handleApply();
      }
    }
    // Escape to reset
    if (e.key === 'Escape' && hasUnsavedChanges) {
      handleReset();
    }
    // Handle Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      // Insert 2 spaces at cursor position
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      setYamlContent(newValue);
      setHasUnsavedChanges(true);
      
      // Move cursor after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  }, [hasUnsavedChanges, error, handleApply, handleReset]);

  // Calculate line numbers
  const lineCount = yamlContent.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="yaml-editor">
      <div className="yaml-editor-header">
        <span className="yaml-editor-title">YAML Editor</span>
        <div className="yaml-editor-actions">
          <button 
            className="yaml-editor-button regenerate"
            onClick={handleRegenerateRefs}
            title="Regenerate all refs based on item names"
          >
            Normalize Refs
          </button>
          {hasUnsavedChanges && (
            <>
              <button 
                className="yaml-editor-button reset"
                onClick={handleReset}
                title="Reset changes (Esc)"
              >
                Reset
              </button>
              <button 
                className="yaml-editor-button apply"
                onClick={handleApply}
                disabled={!!error}
                title="Apply changes (⌘S)"
              >
                Apply
              </button>
            </>
          )}
          {!hasUnsavedChanges && (
            <span className="yaml-editor-status synced">✓ Synced</span>
          )}
        </div>
      </div>
      
      {error && (
        <div className="yaml-editor-error">
          <span className="yaml-editor-error-icon">⚠️</span>
          <span className="yaml-editor-error-message">{error}</span>
        </div>
      )}
      
      <div className="yaml-editor-container">
        <div className="yaml-editor-line-numbers" ref={lineNumbersRef}>
          {lineNumbers.map((num) => (
            <div key={num} className="yaml-editor-line-number">{num}</div>
          ))}
        </div>
        <div className="yaml-editor-highlight-wrapper">
          <div className="yaml-editor-highlight-container" ref={highlightContainerRef}>
            <SyntaxHighlighter
              language="yaml"
              style={isDarkMode ? darkYamlTheme : lightYamlTheme}
              customStyle={{
                background: 'transparent',
                padding: '12px 16px',
                paddingBottom: '100vh',
                margin: 0,
                fontSize: '13px',
                lineHeight: '20px',
                fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
                overflow: 'visible',
                letterSpacing: '0',
                whiteSpace: 'pre',
              }}
              wrapLines={false}
              PreTag="pre"
              CodeTag="code"
              codeTagProps={{
                style: {
                  fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
                  fontSize: '13px',
                  lineHeight: '20px',
                  margin: 0,
                  padding: 0,
                  letterSpacing: '0',
                },
              }}
            >
              {yamlContent || ' '}
            </SyntaxHighlighter>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="yaml-editor-textarea"
          value={yamlContent}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          wrap="off"
        />
      </div>
      
      <div className="yaml-editor-footer">
        <span className="yaml-editor-hint">
          Tab to indent • ⌘S to apply • Esc to reset
        </span>
        <span className="yaml-editor-line-count">
          {lineCount} lines
        </span>
      </div>
    </div>
  );
});

// Wrap with memo to prevent re-renders when props haven't changed
const MemoizedYamlEditor = React.memo(YamlEditor, (prevProps, nextProps) => {
  // Only re-render if initialContent changed
  return prevProps.initialContent === nextProps.initialContent &&
         prevProps.onUpdate === nextProps.onUpdate;
});

export default MemoizedYamlEditor;
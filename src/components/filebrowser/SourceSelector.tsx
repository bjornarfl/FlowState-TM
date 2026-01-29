import React from 'react';
import { Wand2, FileText, Upload, Database, Github } from 'lucide-react';
import './SourceSelector.css';

export type SourceType = 'empty' | 'templates' | 'upload' | 'browser' | 'github';

interface SourceSelectorProps {
  onSourceSelect: (source: SourceType) => void;
}

const iconMap: Record<SourceType, React.ReactNode> = {
  empty: <Wand2 size={48} />,
  templates: <FileText size={48} />,
  upload: <Upload size={48} />,
  browser: <Database size={48} />,
  github: <Github size={48} />,
};

const sources: Array<{
  id: SourceType;
  name: string;
  description: string;
}> = [
  {
    id: 'empty',
    name: 'New Threat Model',
    description: 'Start with an empty template',
  },
  {
    id: 'templates',
    name: 'Templates',
    description: 'Choose from built-in templates',
  },
  {
    id: 'upload',
    name: 'Upload from Local',
    description: 'Upload a YAML file from your computer',
  },
  {
    id: 'browser',
    name: 'Browser Data',
    description: 'Access threat models saved in your browser',
  },
  {
    id: 'github',
    name: 'GitHub Integration',
    description: 'Load threat models from GitHub repositories',
  },
];

export const SourceSelector: React.FC<SourceSelectorProps> = ({
  onSourceSelect,
}) => {
  return (
    <div className="source-selector">
      <div className="source-selector-header">
        <h1>FlowState TM</h1>
        <p>Select a source to load or create a threat model</p>
      </div>
      <div className="source-grid">
        {sources.map((source, index) => (
          <button
            key={source.id}
            className={`source-folder ${index === 0 ? 'source-folder-first' : ''}`}
            onClick={() => onSourceSelect(source.id)}
          >
            <div className="source-icon">{iconMap[source.id]}</div>
            <div className="source-name">{source.name}</div>
            <div className="source-description">{source.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

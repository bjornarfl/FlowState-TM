import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import TutorialList from './TutorialList';
import type { Tutorial } from '../../types/tutorial';
import { loadTutorial, loadTutorialIndex } from '../../utils/tutorialLoader';
import { useTutorial } from '../../contexts/TutorialContext';
import './TutorialPanel.css';

export default function TutorialPanel(): React.JSX.Element {
  const { currentTutorial, currentContent, selectTutorial, backToList } = useTutorial();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectTutorial = (tutorial: Tutorial) => {
    setLoading(true);
    setError(null);
    loadTutorial(tutorial.file)
      .then((text) => {
        selectTutorial(tutorial, text);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load tutorial');
        setLoading(false);
        console.error(err);
      });
  };

  const handleTutorialLink = (filename: string) => {
    setLoading(true);
    setError(null);
    loadTutorialIndex()
      .then((index) => {
        const tutorial = index.tutorials.find((t) => t.file === filename);
        if (tutorial) {
          return loadTutorial(filename).then((text) => {
            selectTutorial(tutorial, text);
            setLoading(false);
          });
        } else {
          throw new Error(`Tutorial not found: ${filename}`);
        }
      })
      .catch((err) => {
        setError('Failed to load linked tutorial');
        setLoading(false);
        console.error(err);
      });
  };

  return (
    <div className="tutorial-panel">
      <div className="tutorial-panel-body">
        {loading && (
          <div className="tutorial-panel-loading">
            <div className="loading-spinner"></div>
            <p>Loading tutorial...</p>
          </div>
        )}
        {error && (
          <div className="tutorial-panel-error">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && currentTutorial && currentContent && (
          <>
            <button className="tutorial-panel-back" onClick={backToList} title="Back to list">
              <ArrowLeft size={14} />
              <span>All Tutorials</span>
            </button>
            <MarkdownRenderer content={currentContent} onTutorialLink={handleTutorialLink} />
          </>
        )}
        {!loading && !error && !currentTutorial && (
          <TutorialList onSelectTutorial={handleSelectTutorial} />
        )}
      </div>
    </div>
  );
}

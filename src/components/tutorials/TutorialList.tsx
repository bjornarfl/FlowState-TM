import React, { useState, useEffect } from 'react';
import { BookOpen, Clock } from 'lucide-react';
import type { Tutorial, TutorialIndex } from '../../types/tutorial';
import { loadTutorialIndex } from '../../utils/tutorialLoader';
import './TutorialList.css';

interface TutorialListProps {
  onSelectTutorial: (tutorial: Tutorial) => void;
}

export default function TutorialList({ onSelectTutorial }: TutorialListProps): React.JSX.Element {
  const [index, setIndex] = useState<TutorialIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTutorialIndex()
      .then((data) => {
        setIndex(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load tutorials');
        setLoading(false);
        console.error(err);
      });
  }, []);

  if (loading) {
    return (
      <div className="tutorial-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading tutorials...</p>
      </div>
    );
  }

  if (error || !index) {
    return (
      <div className="tutorial-list-error">
        <p>{error || 'No tutorials available'}</p>
      </div>
    );
  }

  // Group tutorials by category
  const tutorialsByCategory = index.tutorials.reduce(
    (acc, tutorial) => {
      if (!acc[tutorial.category]) {
        acc[tutorial.category] = [];
      }
      acc[tutorial.category].push(tutorial);
      return acc;
    },
    {} as Record<string, Tutorial[]>
  );

  // Sort tutorials within each category by order
  Object.keys(tutorialsByCategory).forEach((category) => {
    tutorialsByCategory[category].sort((a, b) => a.order - b.order);
  });

  return (
    <div className="tutorial-list">
      <div className="tutorial-list-content">
        {index.categories.map((category) => {
          const tutorials = tutorialsByCategory[category.name];
          if (!tutorials || tutorials.length === 0) return null;

          return (
            <div key={category.id} className="tutorial-category">
              <div className="tutorial-category-header">
                <h3>{category.name}</h3>
                <p>{category.description}</p>
              </div>

              <div className="tutorial-cards">
                {tutorials.map((tutorial) => (
                  <button
                    key={tutorial.id}
                    className="tutorial-card"
                    onClick={() => onSelectTutorial(tutorial)}
                  >
                    <div className="tutorial-card-icon">
                      <BookOpen size={24} />
                    </div>
                    <div className="tutorial-card-content">
                      <h4>{tutorial.title}</h4>
                      <p>{tutorial.description}</p>
                      {tutorial.duration && (
                        <div className="tutorial-card-meta">
                          <Clock size={14} />
                          <span>{tutorial.duration}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

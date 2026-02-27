import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Tutorial } from '../types/tutorial';

interface TutorialContextType {
  currentTutorial: Tutorial | null;
  currentContent: string;
  selectTutorial: (tutorial: Tutorial, content: string) => void;
  backToList: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

interface TutorialProviderProps {
  children: ReactNode;
}

export function TutorialProvider({ children }: TutorialProviderProps): React.JSX.Element {
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null);
  const [currentContent, setCurrentContent] = useState<string>('');

  const selectTutorial = (tutorial: Tutorial, content: string) => {
    setCurrentTutorial(tutorial);
    setCurrentContent(content);
  };

  const backToList = () => {
    setCurrentTutorial(null);
    setCurrentContent('');
  };

  return (
    <TutorialContext.Provider
      value={{
        currentTutorial,
        currentContent,
        selectTutorial,
        backToList,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextType {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}

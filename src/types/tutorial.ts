/**
 * Represents a single tutorial item
 */
export interface Tutorial {
  id: string;
  title: string;
  file: string;
  description: string;
  category: string;
  order: number;
  duration?: string;
}

/**
 * Represents a tutorial category
 */
export interface TutorialCategory {
  id: string;
  name: string;
  description: string;
}

/**
 * The structure of the tutorial index file
 */
export interface TutorialIndex {
  tutorials: Tutorial[];
  categories: TutorialCategory[];
}

/**
 * Tutorial viewing mode
 */
export type TutorialMode = 'modal' | 'sidebar' | 'closed';

import type { TutorialIndex } from '../types/tutorial';
import { resolvePath } from '../config';

/**
 * Cache for tutorial index and content
 */
const cache: {
  index: TutorialIndex | null;
  content: Map<string, string>;
} = {
  index: null,
  content: new Map(),
};

/**
 * Loads the tutorial index file
 */
export async function loadTutorialIndex(): Promise<TutorialIndex> {
  if (cache.index) {
    return cache.index;
  }

  try {
    const response = await fetch(resolvePath('tutorials/index.json'));
    if (!response.ok) {
      throw new Error(`Failed to load tutorial index: ${response.statusText}`);
    }
    const data = await response.json();
    cache.index = data;
    return data;
  } catch (error) {
    console.error('Error loading tutorial index:', error);
    throw error;
  }
}

/**
 * Loads a specific tutorial markdown file
 */
export async function loadTutorial(filename: string): Promise<string> {
  if (cache.content.has(filename)) {
    return cache.content.get(filename)!;
  }

  try {
    const response = await fetch(resolvePath(`tutorials/${filename}`));
    if (!response.ok) {
      throw new Error(`Failed to load tutorial: ${response.statusText}`);
    }
    const text = await response.text();
    cache.content.set(filename, text);
    return text;
  } catch (error) {
    console.error(`Error loading tutorial ${filename}:`, error);
    throw error;
  }
}

/**
 * Clears the tutorial cache
 */
export function clearTutorialCache(): void {
  cache.index = null;
  cache.content.clear();
}

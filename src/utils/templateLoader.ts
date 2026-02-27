/**
 * Template Loader Utility
 * Handles loading threat model templates from the templates/index.json manifest
 */

import { resolvePath } from '../config';

export interface TemplateMetadata {
  name: string;
  file: string;
  path: string;
  description?: string;
  tags?: string[];
  order?: number;
}

export interface TemplateIndex {
  templates: Omit<TemplateMetadata, 'path'>[];
}

/**
 * Cache for template index and content
 */
const cache: {
  index: TemplateIndex | null;
  content: Map<string, string>;
} = {
  index: null,
  content: new Map(),
};

/**
 * Loads the template index file
 */
export async function loadTemplateIndex(): Promise<TemplateIndex> {
  if (cache.index) {
    return cache.index;
  }

  try {
    const response = await fetch(resolvePath('templates/index.json'));
    if (!response.ok) {
      throw new Error(`Failed to load template index: ${response.statusText}`);
    }
    const data = await response.json();
    cache.index = data;
    return data;
  } catch (error) {
    console.error('Error loading template index:', error);
    throw error;
  }
}

/**
 * Fetch and load a template file by path
 */
export const loadTemplateByPath = async (
  path: string
): Promise<string> => {
  if (cache.content.has(path)) {
    return cache.content.get(path)!;
  }

  const response = await fetch(resolvePath(path));
  if (!response.ok) {
    throw new Error(
      `Failed to load template from ${path}: ${response.statusText}`
    );
  }
  const text = await response.text();
  cache.content.set(path, text);
  return text;
};

/**
 * Parse a threat model file (YAML or JSON)
 */
export const parseThreateModelFile = async (
  file: File
): Promise<string> => {
  return file.text();
};

/**
 * Get all available templates from the index.json manifest
 */
export const getAvailableTemplates = async (): Promise<TemplateMetadata[]> => {
  const index = await loadTemplateIndex();
  return index.templates
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((t) => ({
      ...t,
      path: `templates/${t.file}`,
    }));
};

/**
 * Clears the template cache
 */
export function clearTemplateCache(): void {
  cache.index = null;
  cache.content.clear();
}

/**
 * Utility functions for generating unique reference IDs
 */

import type { ThreatModel, Direction } from '../types/threatModel';
import yaml from 'js-yaml';

/**
 * Generic function to generate a unique ref for any entity type
 * @param prefix - The prefix for the ref (e.g., 'component', 'asset', 'threat')
 * @param existingRefs - Set of existing refs to check against
 * @param uppercase - Whether to use uppercase prefix (default: false)
 * @param zeroPad - Whether to zero-pad the number (default: false)
 * @returns A unique ref string
 */
export function generateUniqueRef(
  prefix: string, 
  existingRefs: Set<string>,
  uppercase: boolean = false,
  zeroPad: boolean = false
): string {
  let counter = 1;
  const prefixStr = uppercase ? prefix.toUpperCase() : prefix;
  let ref = zeroPad ? `${prefixStr}${String(counter).padStart(2, '0')}` : `${prefixStr}-${counter}`;
  while (existingRefs.has(ref)) {
    counter++;
    ref = zeroPad ? `${prefixStr}${String(counter).padStart(2, '0')}` : `${prefixStr}-${counter}`;
  }
  return ref;
}

/**
 * Generate a unique component ref
 */
export function generateComponentRef(threatModel: ThreatModel | null): string {
  const existingRefs = new Set(threatModel?.components?.map(c => c.ref) || []);
  return generateUniqueRef('component', existingRefs);
}

/**
 * Generate a unique boundary ref
 */
export function generateBoundaryRef(threatModel: ThreatModel | null): string {
  const existingRefs = new Set(threatModel?.boundaries?.map(b => b.ref) || []);
  return generateUniqueRef('boundary', existingRefs);
}

/**
 * Generate a unique asset ref
 */
export function generateAssetRef(threatModel: ThreatModel | null): string {
  const existingRefs = new Set(threatModel?.assets?.map(a => a.ref) || []);
  return generateUniqueRef('A', existingRefs, true, true);
}

/**
 * Generate a unique threat ref
 */
export function generateThreatRef(threatModel: ThreatModel | null): string {
  const existingRefs = new Set(threatModel?.threats?.map(t => t.ref) || []);
  return generateUniqueRef('T', existingRefs, true, true);
}

/**
 * Generate a unique control ref
 */
export function generateControlRef(threatModel: ThreatModel | null): string {
  const existingRefs = new Set(threatModel?.controls?.map(c => c.ref) || []);
  return generateUniqueRef('C', existingRefs, true, true);
}

/**
 * Generate a unique asset name based on the ref
 */
export function generateAssetName(ref: string): string {
  return `Asset ${ref}`;
}

/**
 * Generate a unique threat name based on the ref
 */
export function generateThreatName(ref: string): string {
  return `Threat ${ref}`;
}

/**
 * Generate a unique control name based on the ref
 */
export function generateControlName(ref: string): string {
  return `Control ${ref}`;
}

/**
 * Generate a unique component name based on the ref
 */
export function generateComponentName(ref: string): string {
  // Extract number from ref like "component-1" -> "1"
  const match = ref.match(/\d+$/);
  return match ? `Component ${match[0]}` : 'Component';
}

/**
 * Generate a unique boundary name based on the ref
 */
export function generateBoundaryName(ref: string): string {
  // Extract number from ref like "boundary-1" -> "1"
  const match = ref.match(/\d+$/);
  return match ? `Boundary ${match[0]}` : 'Boundary';
}

/**
 * Check if a component name is a placeholder (e.g., "Component 1", "Component 2")
 */
export function isComponentNamePlaceholder(name: string): boolean {
  return /^Component \d+$/.test(name);
}

/**
 * Check if an asset name is a placeholder (e.g., "Asset A01", "Asset A02")
 */
export function isAssetNamePlaceholder(name: string): boolean {
  return /^Asset A\d{2}$/.test(name);
}

/**
 * Check if a threat name is a placeholder (e.g., "Threat T01", "Threat T02")
 */
export function isThreatNamePlaceholder(name: string): boolean {
  return /^Threat T\d{2}$/.test(name);
}

/**
 * Check if a control name is a placeholder (e.g., "Control C01", "Control C02")
 */
export function isControlNamePlaceholder(name: string): boolean {
  return /^Control C\d{2}$/.test(name);
}

/**
 * Check if a dataflow label is a placeholder (e.g., "DF1", "DF2", "DF123")
 */
export function isDataFlowLabelPlaceholder(label: string): boolean {
  return /^DF\d+$/.test(label);
}

/**
 * Check if a boundary name is a placeholder (e.g., "Boundary 1", "Boundary 2")
 */
export function isBoundaryNamePlaceholder(name: string): boolean {
  return /^Boundary \d+$/.test(name);
}

/**
 * Generate a data flow ref based on source, destination, and direction
 * If a ref with this name already exists, append a number to make it unique
 */
export function generateDataFlowRef(
  source: string,
  destination: string,
  direction: Direction,
  existingRefs?: string[]
): string {
  const arrow = direction === 'bidirectional' ? '<->' : '->';
  const baseRef = `${source}${arrow}${destination}`;
  
  // If no existing refs provided or the ref doesn't exist, return the base ref
  if (!existingRefs || !existingRefs.includes(baseRef)) {
    return baseRef;
  }
  
  // Generate a unique ref by appending a number
  let counter = 1;
  let uniqueRef = `${baseRef}_${counter}`;
  while (existingRefs.includes(uniqueRef)) {
    counter++;
    uniqueRef = `${baseRef}_${counter}`;
  }
  return uniqueRef;
}

/**
 * Convert a string to a slug (URL-friendly format)
 * @param text - The text to slugify
 * @returns A slugified version of the text
 */
export function slugify(text: string | number): string {
  // Convert to string if it's a number (handles cases where YAML parses "1" as number)
  const str = String(text);
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-')  // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Make a slug unique by appending a number if it already exists
 * @param baseSlug - The base slug to make unique
 * @param existingRefs - Set of existing refs to check against
 * @returns A unique slug
 */
function makeSlugUnique(baseSlug: string, existingRefs: Set<string>): string {
  if (!existingRefs.has(baseSlug)) {
    return baseSlug;
  }
  
  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;
  while (existingRefs.has(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }
  return uniqueSlug;
}

/**
 * Regenerate all refs in a threat model based on slugified names
 * Updates all references throughout the model to maintain consistency
 * This function preserves comments, whitespace, and formatting
 * @param yamlContent - The YAML content to process
 * @returns Updated YAML content with regenerated refs
 */
export function regenerateAllRefs(yamlContent: string): string {
  try {
    // Parse to get the model structure
    // Use FAILSAFE_SCHEMA to prevent numeric string conversion issues
    const model = yaml.load(yamlContent, {
      schema: yaml.FAILSAFE_SCHEMA,
      json: true
    }) as ThreatModel;
    
    // Maps to track old ref -> new ref
    const refMap = new Map<string, string>();
    
    // Track all new refs to ensure uniqueness across all types
    const allNewRefs = new Set<string>();
    
    // Process each entity type and build the ref map
    const processEntity = (entity: { ref: string; name: string }) => {
      const slug = slugify(entity.name);
      const newRef = makeSlugUnique(slug, allNewRefs);
      allNewRefs.add(newRef);
      refMap.set(entity.ref, newRef);
    };
    
    // Build the mapping
    model.components?.forEach(processEntity);
    model.boundaries?.forEach(processEntity);
    model.assets?.forEach(processEntity);
    model.threats?.forEach(processEntity);
    model.controls?.forEach(processEntity);
    
    // Process data flows separately - use updated component refs and maintain arrow format
    if (model.data_flows) {
      model.data_flows.forEach(flow => {
        // Get the updated component refs
        const newSource = refMap.get(flow.source) || flow.source;
        const newDest = refMap.get(flow.destination) || flow.destination;
        
        // Always create ref with proper arrow format (never use label)
        const arrow = flow.direction === 'bidirectional' ? '<->' : '->';
        let newRef = `${newSource}${arrow}${newDest}`;
        
        // Ensure uniqueness
        newRef = makeSlugUnique(newRef, allNewRefs);
        allNewRefs.add(newRef);
        refMap.set(flow.ref, newRef);
      });
    }
    
    // Now do targeted replacements in the YAML content
    let result = yamlContent;
    
    // Sort by length (longest first) to avoid partial replacements
    const sortedRefs = Array.from(refMap.entries()).sort((a, b) => b[0].length - a[0].length);
    
    for (const [oldRef, newRef] of sortedRefs) {
      // Escape special regex characters in the old ref
      const escapedOldRef = oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Replace ref: oldRef (as a field value)
      // Match both formats:
      //   1. "ref: oldRef" on its own line (indented under a dash)
      //   2. "- ref: oldRef" where ref is inline with the list dash
      result = result.replace(
        new RegExp(`^(\\s*-?\\s*ref:\\s*)${escapedOldRef}(\\s*(?:#.*)?)$`, 'gm'),
        `$1${newRef}$2`
      );
      
      // Replace references in arrays and lists
      // Pattern: "- oldRef" (as list item) at the end of line
      result = result.replace(
        new RegExp(`^(\\s*-\\s+)${escapedOldRef}(\\s*(?:#.*)?)$`, 'gm'),
        `$1${newRef}$2`
      );
      
      // Pattern: "[..., oldRef, ...]" (inline array)
      // Match within square brackets with optional spaces and commas
      result = result.replace(
        new RegExp(`(\\[\\s*|,\\s*)${escapedOldRef}(\\s*(?:,|\\]))`, 'g'),
        `$1${newRef}$2`
      );
      
      // Pattern: "source: oldRef" or "destination: oldRef"
      result = result.replace(
        new RegExp(`^(\\s*(?:source|destination):\\s*)${escapedOldRef}(\\s*(?:#.*)?)$`, 'gm'),
        `$1${newRef}$2`
      );
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to regenerate refs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

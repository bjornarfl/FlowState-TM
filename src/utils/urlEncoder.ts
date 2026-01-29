import LZString from 'lz-string';
import type { ThreatModel } from '../types/threatModel';
import type { GitHubMetadata } from '../components/integrations/github/types';

/**
 * Compact key mapping for size reduction
 * Maps verbose YAML keys to short abbreviations
 */
const COMPACT_MAP: Record<string, string> = {
  'schema_version': 'sv',
  'name': 'n',
  'description': 'd',
  'components': 'c',
  'component_type': 'ct',
  'internal': 'i',
  'external_dependency': 'e',
  'data_store': 'ds',
  'data_flows': 'df',
  'boundaries': 'b',
  'threats': 'th',
  'controls': 'co',
  'assets': 'a',
  'affected_components': 'ac',
  'affected_data_flows': 'af',
  'affected_assets': 'aa',
  'mitigates': 'm',
  'implemented_in': 'ii',
  'source': 's',
  'destination': 'de',
  'direction': 'di',
  'label': 'l',
  'source_point': 'sp',
  'destination_point': 'dp',
  'width': 'w',
  'height': 'h',
  'status': 'st',
  'status_link': 'sl',
  'status_note': 'sn',
  'unidirectional': 'u',
  'bidirectional': 'bi',
  // GitHub metadata keys
  'github_metadata': 'gm',
  'domain': 'do',
  'owner': 'o',
  'repository': 'r',
  'sha': 'sh',
  'loadedAt': 'la',
};

/**
 * Reverse mapping for decompaction
 */
const EXPAND_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COMPACT_MAP).map(([k, v]) => [v, k])
);

/**
 * Recursively compactify an object by replacing keys with shortened versions
 */
function compactifyObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => compactifyObject(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const compactKey = COMPACT_MAP[key] || key;
      const compactValue = typeof value === 'string' && COMPACT_MAP[value] 
        ? COMPACT_MAP[value] 
        : compactifyObject(value);
      result[compactKey] = compactValue;
    }
    return result;
  }

  return obj;
}

/**
 * Recursively expand an object by replacing shortened keys with original versions
 */
function expandObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => expandObject(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const expandedKey = EXPAND_MAP[key] || key;
      const expandedValue = typeof value === 'string' && EXPAND_MAP[value]
        ? EXPAND_MAP[value]
        : expandObject(value);
      result[expandedKey] = expandedValue;
    }
    return result;
  }

  return obj;
}

/**
 * Encode a threat model into a compressed URL-safe string
 * Uses JSON + compact keys + LZ-String compression
 * 
 * @param model - The threat model to encode
 * @param githubMetadata - Optional GitHub metadata to include
 * @returns Compressed and URL-safe string
 */
export function encodeModelForUrl(model: ThreatModel, githubMetadata?: GitHubMetadata | null): string {
  try {
    // Combine model and metadata if present
    const payload = githubMetadata
      ? { ...model, github_metadata: githubMetadata }
      : model;
    
    // Step 1: Compactify keys
    const compacted = compactifyObject(payload);
    
    // Step 2: Convert to JSON
    const json = JSON.stringify(compacted);
    
    // Step 3: Compress with LZ-String
    const compressed = LZString.compressToEncodedURIComponent(json);
    
    return compressed;
  } catch (error) {
    console.error('Failed to encode model for URL:', error);
    throw new Error('Failed to encode threat model for URL sharing');
  }
}

/**
 * Decode a compressed URL string back into a threat model
 * 
 * @param encoded - The compressed URL-safe string
 * @returns Object containing the decoded threat model and optional GitHub metadata
 */
export function decodeModelFromUrl(encoded: string): { model: ThreatModel; githubMetadata?: GitHubMetadata } {
  try {
    // Step 1: Decompress with LZ-String
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    
    if (!json) {
      throw new Error('Failed to decompress URL data');
    }
    
    // Step 2: Parse JSON
    const compacted = JSON.parse(json);
    
    // Step 3: Expand keys back to original names
    const expanded = expandObject(compacted);
    
    // Step 4: Extract GitHub metadata if present
    const { github_metadata, ...model } = expanded;
    
    return {
      model: model as ThreatModel,
      ...(github_metadata && { githubMetadata: github_metadata as GitHubMetadata })
    };
  } catch (error) {
    console.error('Failed to decode model from URL:', error);
    throw new Error('Failed to decode threat model from URL');
  }
}

/**
 * Generate a shareable URL for a threat model
 * 
 * @param model - The threat model to share
 * @param githubMetadata - Optional GitHub metadata to include
 * @param baseUrl - The base URL (defaults to current window location)
 * @returns Full shareable URL
 */
export function generateShareableUrl(model: ThreatModel, githubMetadata?: GitHubMetadata | null, baseUrl?: string): string {
  const encoded = encodeModelForUrl(model, githubMetadata);
  const base = baseUrl || window.location.origin + window.location.pathname;
  return `${base}?model=${encoded}`;
}

/**
 * Check if the current URL contains a shared model
 * 
 * @returns The encoded model string if present, null otherwise
 */
export function getModelFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('model');
}

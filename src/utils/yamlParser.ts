import yaml from 'js-yaml';
import Ajv from 'ajv';
import type { ThreatModel } from '../types/threatModel';
import threatModelSchema from '../../threat_model.schema.json';

// ============================================================================
// Schema Validation Setup
// ============================================================================

// Configure Ajv for JSON schema validation
// Note: Ajv requires runtime code generation which needs 'wasm-unsafe-eval' in CSP
const ajv = new Ajv({ 
  allErrors: true, 
  strict: false
});
const validateThreatModel = ajv.compile(threatModelSchema);

// ============================================================================
// YAML Parsing Configuration
// ============================================================================

/**
 * Safe YAML parsing options to prevent attacks
 */
const SAFE_YAML_OPTIONS = {
  // Prevent YAML bombs and billion laughs attacks
  maxAliasCount: 100,
  // Use CORE_SCHEMA (safe, no custom types)
  schema: yaml.CORE_SCHEMA,
  // Set JSON compatibility mode
  json: true,
};

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a parsed YAML line with its indentation and content
 */
interface YamlLine {
  raw: string;
  trimmed: string;
  indent: number;
}

/**
 * Position and metadata for a YAML section
 */
interface SectionPosition {
  startIndex: number;
  indent: number;
  inSection: boolean;
}

/**
 * Position and metadata for a YAML item within a section
 */
interface ItemPosition {
  startIndex: number;
  endIndex: number;
  indent: number;
  fieldIndent: number;
}

/**
 * Result of a field match operation
 */
interface FieldMatch {
  lineIndex: number;
  indent: number;
  existingValue: string;
  isPipeStyle: boolean;
}

// ============================================================================
// Constants and Regex Patterns
// ============================================================================

/** Regex pattern for matching item ref lines */
const REF_PATTERN = /^-?\s*ref:\s*(.+)$/;

/** Regex pattern for matching any field in a YAML item */
const ANY_FIELD_PATTERN = /^(\s+)(\w+):/;

/** Regex pattern for pipe-style multiline indicators */
const PIPE_STYLE_PATTERN = /\|[-+]?$/;

// ============================================================================
// Core Utility Functions
// ============================================================================

/**
 * Fetch raw YAML content from a file
 * @param yamlPath - Path to the YAML file
 * @returns Raw YAML string
 */
export async function fetchYamlContent(yamlPath: string): Promise<string> {
  const response = await fetch(yamlPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch YAML file: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Parse YAML string into ThreatModel with validation
 * @param yamlContent - Raw YAML string
 * @returns Parsed and validated threat model data
 * @throws Error if YAML is invalid or doesn't conform to schema
 */
export function parseYaml(yamlContent: string): ThreatModel {
  try {
    // Parse YAML with safety limits
    const parsed = yaml.load(yamlContent, SAFE_YAML_OPTIONS);
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML: Expected an object');
    }
    
    // Validate against JSON schema
    const isValid = validateThreatModel(parsed);
    
    if (!isValid) {
      const errors = validateThreatModel.errors || [];
      const errorMessages = errors.map(err => {
        const path = err.instancePath || 'root';
        return `${path}: ${err.message}`;
      }).join('; ');
      
      throw new Error(`Schema validation failed: ${errorMessages}`);
    }
    
    return parsed as unknown as ThreatModel;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Helper to escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a raw YAML line into structured format
 */
function parseLine(line: string): YamlLine {
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;
  return { raw: line, trimmed, indent };
}

/**
 * Check if a value indicates a pipe-style multiline block
 */
function isPipeStyleValue(value: string): boolean {
  return PIPE_STYLE_PATTERN.test(value);
}

/**
 * Extract ref value from a ref line, removing quotes
 */
function extractRefValue(line: string): string | null {
  const match = line.match(REF_PATTERN);
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

/**
 * Check if we're leaving a section based on indentation
 */
function isLeavingSection(line: YamlLine, sectionIndent: number): boolean {
  return line.trimmed.length > 0 && 
         !line.trimmed.startsWith('#') && 
         line.indent <= sectionIndent && 
         !line.trimmed.startsWith('-');
}

/**
 * Find a section in YAML lines and return its position
 * @param lines - Array of YAML lines
 * @param sectionName - Name of the section to find (e.g., 'components', 'threats')
 * @returns Section position information or null if not found
 */
function findSection(lines: string[], sectionName: string): SectionPosition | null {
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLine(lines[i]);
    if (parsed.trimmed === `${sectionName}:` || parsed.trimmed.startsWith(`${sectionName}: `)) {
      return {
        startIndex: i,
        indent: parsed.indent,
        inSection: true
      };
    }
  }
  return null;
}

/**
 * Find an item by ref within a section
 * @param lines - Array of YAML lines
 * @param sectionStart - Starting index of the section
 * @param sectionIndent - Indentation level of the section
 * @param targetRef - Ref value to search for
 * @returns Item position information or null if not found
 */
function findItemByRef(
  lines: string[], 
  sectionStart: number, 
  sectionIndent: number, 
  targetRef: string
): ItemPosition | null {
  let itemStartIndex = -1;
  let itemIndent = 0;
  let fieldIndent = 0;
  
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const parsed = parseLine(lines[i]);
    
    // Check if we've left the section
    if (isLeavingSection(parsed, sectionIndent)) {
      // If we're tracking an item, end it here
      if (itemStartIndex !== -1) {
        return {
          startIndex: itemStartIndex,
          endIndex: i - 1,
          indent: itemIndent,
          fieldIndent
        };
      }
      break;
    }
    
    // Check for item start with ref
    if (parsed.trimmed.startsWith('- ref:')) {
      const refValue = extractRefValue(parsed.trimmed);
      if (refValue === targetRef) {
        itemStartIndex = i;
        itemIndent = parsed.indent;
        fieldIndent = 0; // Will be detected from fields
        continue;
      } else if (itemStartIndex !== -1) {
        // Found next item, return previous item's position
        return {
          startIndex: itemStartIndex,
          endIndex: i - 1,
          indent: itemIndent,
          fieldIndent
        };
      }
    }
    
    // Detect field indent from any field in target item
    if (itemStartIndex !== -1 && fieldIndent === 0) {
      const fieldMatch = parsed.raw.match(ANY_FIELD_PATTERN);
      if (fieldMatch && !parsed.trimmed.startsWith('-')) {
        fieldIndent = fieldMatch[1].length;
      }
    }
  }
  
  // If we found the item but reached end of file or section, 
  // find the actual last line of content for this item
  if (itemStartIndex !== -1) {
    let lastContentLine = itemStartIndex;
    
    // Scan forward from item start to find last line that belongs to this item
    for (let i = itemStartIndex + 1; i < lines.length; i++) {
      const parsed = parseLine(lines[i]);
      
      // Skip empty lines and comments when determining boundaries
      if (!parsed.trimmed || parsed.trimmed.startsWith('#')) {
        continue;
      }
      
      // Check if we've left the section
      if (isLeavingSection(parsed, sectionIndent)) {
        break;
      }
      
      // If this line is indented at or less than the item indent and is not part of the item
      // (e.g., it's a new section or item at the same level), stop here
      if (parsed.indent <= itemIndent && !parsed.trimmed.startsWith('-')) {
        break;
      }
      
      // This line belongs to the item
      lastContentLine = i;
    }
    
    return {
      startIndex: itemStartIndex,
      endIndex: lastContentLine,
      indent: itemIndent,
      fieldIndent
    };
  }
  
  return null;
}

/**
 * Skip multiline content following a field
 * @param lines - Array of YAML lines
 * @param startIndex - Starting index (field line)
 * @param fieldIndent - Indentation of the field
 * @param isPipeStyle - Whether this is a pipe-style block
 * @returns Index of the last line to skip
 */
function skipMultilineContent(
  lines: string[], 
  startIndex: number, 
  fieldIndent: number, 
  isPipeStyle: boolean
): number {
  let currentIndex = startIndex;
  
  while (currentIndex + 1 < lines.length) {
    const parsed = parseLine(lines[currentIndex + 1]);
    
    // For pipe-style blocks, blank lines are part of the content
    // For regular fields, blank lines mark the end of the field
    if (parsed.raw === '' && !isPipeStyle) {
      break;
    }
    
    // Content belonging to this field is indented more than the field
    if (parsed.raw === '' || (parsed.indent > fieldIndent && (parsed.trimmed.startsWith('-') || isPipeStyle || parsed.trimmed !== ''))) {
      // Stop if we hit another field at the same level (not for pipe style)
      if (!isPipeStyle && parsed.trimmed && !parsed.trimmed.startsWith('-') && parsed.indent === fieldIndent) {
        break;
      }
      // For pipe blocks, continue until we hit content at same or lower indent (excluding blank lines)
      if (isPipeStyle && parsed.trimmed && parsed.indent <= fieldIndent) {
        break;
      }
      currentIndex++;
    } else {
      break;
    }
  }
  
  return currentIndex;
}

// ============================================================================
// YAML Formatting Functions
// ============================================================================

/**
 * Helper to properly quote a YAML string value if needed
 * For multiline strings, uses pipe (|) style
 * @param value - String value to format
 * @param indent - Indentation to use for multiline blocks
 * @returns Formatted YAML value
 */
function yamlQuote(value: string, indent: string = ''): string {
  // If value contains newlines, use pipe style for better readability
  if (value.includes('\n')) {
    const lines = value.split('\n');
    const blockIndent = indent + '  ';
    return '|\n' + lines.map(line => blockIndent + line).join('\n');
  }
  
  // Check if value needs quoting (contains special chars, starts with special chars, etc.)
  if (
    value.includes(':') ||
    value.includes('#') ||
    value.startsWith(' ') ||
    value.endsWith(' ') ||
    value.startsWith('"') ||
    value.startsWith("'") ||
    /^[{[\]&*!|>'"%@`]/.test(value) ||
    value === '' ||
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    value === 'yes' ||
    value === 'no'
  ) {
    // Use double quotes and escape internal quotes
    return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return value;
}

/**
 * Format a field value for YAML output
 * @param value - Value to format (string, number, or array)
 * @param indent - Indentation string for multiline values
 * @returns Formatted value string
 */
function formatValue(value: string | number | string[], indent: string = ''): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[${value.join(', ')}]`;
  } else if (typeof value === 'number') {
    return Math.round(value).toString();
  } else {
    return yamlQuote(String(value), indent);
  }
}

/**
 * Format a field with its value for YAML output
 * @param fieldName - Name of the field
 * @param value - Field value
 * @param indent - Indentation string
 * @returns Complete field line
 */
function formatFieldLine(fieldName: string, value: string | number | string[], indent: string): string {
  const formattedValue = formatValue(value, indent);
  return `${indent}${fieldName}: ${formattedValue}`;
}

// ============================================================================
// Field Update Helper Functions
// ============================================================================

/**
 * Find a field within an item and return match information
 * @param lines - Array of YAML lines
 * @param itemPosition - Position of the item to search within
 * @param fieldName - Name of the field to find
 * @returns Field match information or null if not found
 */
function findFieldInItem(
  lines: string[], 
  itemPosition: ItemPosition, 
  fieldName: string
): FieldMatch | null {
  const fieldPattern = new RegExp(`^(\\s*)${escapeRegex(fieldName)}:\\s*(.*)$`);
  
  for (let i = itemPosition.startIndex; i <= itemPosition.endIndex && i < lines.length; i++) {
    const match = lines[i].match(fieldPattern);
    if (match) {
      const indent = match[1].length;
      const existingValue = match[2].trim();
      const isPipeStyle = isPipeStyleValue(existingValue);
      
      return {
        lineIndex: i,
        indent,
        existingValue,
        isPipeStyle
      };
    }
  }
  
  return null;
}

/**
 * Replace a field value in the result array
 * @param result - Array of result lines being built
 * @param lines - Original lines array
 * @param currentIndex - Current line index being processed
 * @param fieldMatch - Information about the matched field
 * @param newValue - New value to set
 * @returns New current index after skipping multiline content
 */
function replaceFieldValue(
  result: string[],
  lines: string[],
  currentIndex: number,
  fieldMatch: FieldMatch,
  fieldName: string,
  newValue: string | number | string[]
): number {
  const indent = ' '.repeat(fieldMatch.indent);
  
  if (Array.isArray(newValue)) {
    if (newValue.length === 0) {
      // Skip the field entirely for empty arrays
      return skipMultilineContent(lines, currentIndex, fieldMatch.indent, fieldMatch.isPipeStyle);
    }
    // Always use inline format for arrays
    result.push(formatFieldLine(fieldName, newValue, indent));
  } else {
    // Scalar value
    result.push(formatFieldLine(fieldName, newValue, indent));
  }
  
  // Skip any existing multiline content
  return skipMultilineContent(lines, currentIndex, fieldMatch.indent, fieldMatch.isPipeStyle);
}

/**
 * Insert a missing field into an item
 * @param result - Array of result lines being built
 * @param lastContentLineIndex - Index of the last content line in the item
 * @param fieldName - Name of the field to insert
 * @param value - Value to insert
 * @param fieldIndent - Indentation for fields
 * @param itemIndent - Indentation of the item
 */
function insertMissingField(
  result: string[],
  lastContentLineIndex: number,
  fieldName: string,
  value: string | number | string[],
  fieldIndent: number,
  itemIndent: number
): void {
  const indent = ' '.repeat(fieldIndent || itemIndent + 4);
  const fieldLine = formatFieldLine(fieldName, value, indent);
  
  const insertPos = lastContentLineIndex >= 0 ? lastContentLineIndex + 1 : result.length;
  result.splice(insertPos, 0, fieldLine);
}

// ============================================================================
// Main YAML Update Functions
// ============================================================================

/**
 * Find and update a specific field value in YAML content for an item identified by ref.
 * Preserves comments and formatting. If the field doesn't exist, it will be added.
 * If newValue is undefined, the field will be removed.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param section - Section name (e.g., 'components', 'assets', 'threats')
 * @param ref - Reference identifier of the item to update
 * @param field - Field name to update
 * @param newValue - New value (undefined to remove field, empty array to remove field)
 * @returns Modified YAML string
 */
export function updateYamlField(
  yamlContent: string,
  section: string,
  ref: string,
  field: string,
  newValue: string | number | string[] | undefined
): string {
  const lines = yamlContent.split('\n');
  const result: string[] = [];
  
  // Find the section
  const sectionPos = findSection(lines, section);
  if (!sectionPos) {
    // Section not found, return original content
    return yamlContent;
  }
  
  // Find the item within the section
  const itemPos = findItemByRef(lines, sectionPos.startIndex, sectionPos.indent, ref);
  if (!itemPos) {
    // Item not found, return original content
    return yamlContent;
  }
  
  // Track if we found and updated the field
  let fieldFound = false;
  let lastContentLineIndex = -1;
  
  // Process all lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // If we're within the target item and looking for the field
    if (i >= itemPos.startIndex && i <= itemPos.endIndex && !fieldFound) {
      const parsed = parseLine(line);
      
      // Update last content line tracking
      if (parsed.trimmed && !parsed.trimmed.startsWith('#')) {
        if (parsed.indent > itemPos.indent || parsed.trimmed.startsWith('-')) {
          lastContentLineIndex = result.length;
        }
      }
      
      // Update field indent detection
      if (itemPos.fieldIndent === 0) {
        const fieldMatch = line.match(ANY_FIELD_PATTERN);
        if (fieldMatch && !parsed.trimmed.startsWith('-')) {
          itemPos.fieldIndent = fieldMatch[1].length;
        }
      }
      
      // Try to find the field
      const fieldMatch = findFieldInItem([line], 
        { ...itemPos, startIndex: 0, endIndex: 0 }, 
        field
      );
      
      if (fieldMatch) {
        fieldFound = true;
        fieldMatch.lineIndex = i; // Update to actual line index
        
        if (newValue === undefined || (Array.isArray(newValue) && newValue.length === 0)) {
          // Remove the field - skip this line and any multiline content
          i = skipMultilineContent(lines, i, fieldMatch.indent, fieldMatch.isPipeStyle);
          continue;
        } else {
          // Replace the field value
          i = replaceFieldValue(result, lines, i, fieldMatch, field, newValue);
          lastContentLineIndex = result.length - 1;
          continue;
        }
      }
    }
    
    // If we just finished processing the target item and field wasn't found, insert it
    if (i === itemPos.endIndex && !fieldFound && newValue !== undefined && (!Array.isArray(newValue) || newValue.length > 0)) {
      result.push(line);
      insertMissingField(result, lastContentLineIndex !== -1 ? lastContentLineIndex : result.length - 1, 
        field, newValue, itemPos.fieldIndent, itemPos.indent);
      continue;
    }
    
    result.push(line);
  }
  
  return normalizeYamlWhitespace(result.join('\n'));
}

/**
 * Generic function to rename a ref and update all references to it throughout the YAML.
 * This ensures the new ref is unique and updates:
 * 1. The ref field of the item itself
 * 2. Any references to it in array fields throughout the document
 * 3. Any references in scalar fields (e.g., source/destination in data-flows)
 * 4. Data-flow refs when source or destination changes (if enabled)
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param oldRef - Current reference value
 * @param newRef - New reference value (will be made unique if needed)
 * @param options - Optional configuration
 * @returns Object containing the modified YAML string and the actual ref used (if made unique)
 * @throws Error if oldRef doesn't exist and requireRefExists is true
 */
export function renameRef(
  yamlContent: string,
  oldRef: string,
  newRef: string,
  options?: {
    /** Array field names that might contain this ref type (e.g., ['affected_data_flows']) */
    arrayFields?: string[];
    /** Scalar field names that might contain this ref (e.g., ['source', 'destination']) */
    scalarFields?: string[];
    /** Whether to regenerate data-flow refs when source/destination changes (default: false) */
    regenerateDataFlowRefs?: boolean;
    /** Whether to ensure uniqueness of the new ref (default: true) */
    ensureUnique?: boolean;
    /** Whether to require that the ref exists as an item (default: true) */
    requireRefExists?: boolean;
  }
): { yamlContent: string; actualRef: string } {
  const ensureUnique = options?.ensureUnique ?? true;
  const arrayFields = options?.arrayFields ?? [];
  const scalarFields = options?.scalarFields ?? [];
  const regenerateDataFlowRefs = options?.regenerateDataFlowRefs ?? false;
  const requireRefExists = options?.requireRefExists ?? true;
  
  if (oldRef === newRef) {
    return { yamlContent, actualRef: newRef };
  }
  
  // Check if oldRef exists
  const oldRefExists = yamlContent.split('\n').some(line => {
    const refMatch = line.match(/^(\s*-?\s*)ref:\s*(.+)$/);
    if (refMatch) {
      const refValue = refMatch[2].trim().replace(/^["']|["']$/g, '');
      return refValue === oldRef;
    }
    return false;
  });
  
  if (!oldRefExists && requireRefExists) {
    throw new Error(`Reference '${oldRef}' not found in document`);
  }
  
  // Make newRef unique if needed
  let actualRef = newRef;
  if (ensureUnique && newRef !== oldRef) {
    actualRef = makeRefUnique(yamlContent, newRef, oldRef);
  }
  
  const lines = yamlContent.split('\n');
  const result: string[] = [];
  
  // Track data-flow items that need ref regeneration (index -> {source, dest, direction, refLineIdx})
  const dataFlowsToRegenerate = new Map<number, {
    source: string;
    destination: string;
    direction: string;
    refLineIdx: number;
  }>();
  
  // First pass: collect data-flow information
  if (regenerateDataFlowRefs) {
    let currentItemStartIdx = -1;
    let currentItemRefIdx = -1;
    let tempSource: string | null = null;
    let tempDestination: string | null = null;
    let tempDirection = 'unidirectional';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsed = parseLine(line);
      
      // Detect start of a new item (starts with "  - ref:")
      if (line.match(/^\s*-\s*ref:\s*.+$/)) {
        // Save previous item if it had source and destination
        if (currentItemStartIdx >= 0 && tempSource && tempDestination) {
          dataFlowsToRegenerate.set(currentItemStartIdx, {
            source: tempSource,
            destination: tempDestination,
            direction: tempDirection,
            refLineIdx: currentItemRefIdx
          });
        }
        
        // Check if this might be a data-flow item
        const isDataFlow = i + 1 < lines.length && 
          (lines[i + 1].match(/^\s+source:/) || lines[i + 1].match(/^\s+destination:/));
        
        if (isDataFlow) {
          currentItemStartIdx = i;
          currentItemRefIdx = i;
          tempSource = null;
          tempDestination = null;
          tempDirection = 'unidirectional';
        } else {
          currentItemStartIdx = -1;
        }
      } else if (currentItemStartIdx >= 0) {
        // We're inside a potential data-flow item
        const sourceMatch = line.match(/^\s+source:\s*(.+)$/);
        if (sourceMatch) {
          tempSource = sourceMatch[1].trim().replace(/^["']|["']$/g, '');
        }
        
        const destMatch = line.match(/^\s+destination:\s*(.+)$/);
        if (destMatch) {
          tempDestination = destMatch[1].trim().replace(/^["']|["']$/g, '');
        }
        
        const dirMatch = line.match(/^\s+direction:\s*(.+)$/);
        if (dirMatch) {
          tempDirection = dirMatch[1].trim().replace(/^["']|["']$/g, '');
        }
        
        // Check if we're starting a new top-level item (end of current data-flow)
        if (parsed.indent <= 2 && line.match(/^\s*-\s+\w+:/)) {
          if (tempSource && tempDestination) {
            dataFlowsToRegenerate.set(currentItemStartIdx, {
              source: tempSource,
              destination: tempDestination,
              direction: tempDirection,
              refLineIdx: currentItemRefIdx
            });
          }
          currentItemStartIdx = -1;
        }
      }
    }
    
    // Handle last item if file ends while tracking
    if (currentItemStartIdx >= 0 && tempSource && tempDestination) {
      dataFlowsToRegenerate.set(currentItemStartIdx, {
        source: tempSource,
        destination: tempDestination,
        direction: tempDirection,
        refLineIdx: currentItemRefIdx
      });
    }
  }
  
  // Second pass: apply all transformations
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const parsed = parseLine(line);
    
    // Match the ref field: "  - ref: old-ref" or "    ref: old-ref"
    const refMatch = line.match(/^(\s*-?\s*)ref:\s*(.+)$/);
    if (refMatch) {
      const refValue = refMatch[2].trim().replace(/^["']|["']$/g, '');
      if (refValue === oldRef) {
        const prefix = refMatch[1];
        const formattedRef = yamlQuote(actualRef);
        line = `${prefix}ref: ${formattedRef}`;
      } else if (regenerateDataFlowRefs && dataFlowsToRegenerate.has(i)) {
        // This is a data-flow ref that needs regeneration
        const dfInfo = dataFlowsToRegenerate.get(i)!;
        // Update with new source/destination that may have been renamed
        let source = dfInfo.source === oldRef ? actualRef : dfInfo.source;
        let dest = dfInfo.destination === oldRef ? actualRef : dfInfo.destination;
        const arrow = dfInfo.direction === 'bidirectional' ? '<->' : '->';
        const newDataFlowRef = `${source}${arrow}${dest}`;
        const prefix = refMatch[1];
        line = `${prefix}ref: ${newDataFlowRef}`;
      }
    }
    
    // Match inline arrays for any specified field names
    for (const fieldName of arrayFields) {
      const inlineArrayRegex = new RegExp(`^(\\s*)${escapeRegex(fieldName)}:\\s*\\[(.+)\\]$`);
      const inlineArrayMatch = line.match(inlineArrayRegex);
      if (inlineArrayMatch) {
        const indent = inlineArrayMatch[1];
        const items = inlineArrayMatch[2].split(',').map(item => item.trim());
        const updatedItems = items.map(item => {
          const cleanItem = item.replace(/^["']|["']$/g, '');
          return cleanItem === oldRef ? actualRef : cleanItem;
        });
        line = `${indent}${fieldName}: [${updatedItems.join(', ')}]`;
        break; // Only match once per line
      }
    }
    
    // Handle scalar field updates (e.g., source, destination in data-flows)
    for (const fieldName of scalarFields) {
      const scalarFieldRegex = new RegExp(`^(\\s*)${escapeRegex(fieldName)}:\\s*(.+)$`);
      const scalarMatch = line.match(scalarFieldRegex);
      if (scalarMatch) {
        const indent = scalarMatch[1];
        const value = scalarMatch[2].trim().replace(/^["']|["']$/g, '');
        if (value === oldRef) {
          line = `${indent}${fieldName}: ${actualRef}`;
        }
        break;
      }
    }
    
    // Multi-line array item: "      - old-ref"
    // Only replace if we're in an array context (not a map item with colon)
    const arrayItemMatch = parsed.trimmed.match(/^-\s*(.+)$/);
    if (arrayItemMatch && !parsed.trimmed.includes(':')) {
      const itemValue = arrayItemMatch[1].trim().replace(/^["']|["']$/g, '');
      if (itemValue === oldRef) {
        const indent = ' '.repeat(parsed.indent);
        line = `${indent}- ${actualRef}`;
      }
    }
    
    result.push(line);
  }
  
  return { yamlContent: normalizeYamlWhitespace(result.join('\n')), actualRef };
}

/**
 * Make a ref unique by appending a number if it already exists.
 * @param yamlContent - Raw YAML string to check against
 * @param desiredRef - The desired ref value
 * @param excludeRef - A ref to exclude from uniqueness check (e.g., the old ref being renamed)
 * @returns A unique ref based on desiredRef
 */
function makeRefUnique(yamlContent: string, desiredRef: string, excludeRef?: string): string {
  const existingRefs = new Set<string>();
  const lines = yamlContent.split('\n');
  
  // Collect all existing refs
  for (const line of lines) {
    const refMatch = line.match(/^(\s*-?\s*)ref:\s*(.+)$/);
    if (refMatch) {
      const refValue = refMatch[2].trim().replace(/^["']|["']$/g, '');
      if (refValue !== excludeRef) {
        existingRefs.add(refValue);
      }
    }
  }
  
  // If desired ref is not in use, return it
  if (!existingRefs.has(desiredRef)) {
    return desiredRef;
  }
  
  // Find a unique variant by appending numbers
  let counter = 1;
  let uniqueRef = `${desiredRef}-${counter}`;
  while (existingRefs.has(uniqueRef)) {
    counter++;
    uniqueRef = `${desiredRef}-${counter}`;
  }
  
  return uniqueRef;
}

/**
 * Rename a data flow ref and update all references to it throughout the YAML.
 * This updates:
 * 1. The ref field of the data_flow item itself
 * 2. Any references in affected_data_flows arrays in threats
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param oldRef - Current reference value
 * @param newRef - New reference value
 * @returns Modified YAML string
 * @deprecated Use renameRef with arrayFields: ['affected_data_flows'] instead
 */
export function renameDataFlowRef(
  yamlContent: string,
  oldRef: string,
  newRef: string
): string {
  return renameRef(yamlContent, oldRef, newRef, {
    arrayFields: ['affected_data_flows'],
    ensureUnique: false, // Keep backward compatibility - don't auto-unique
    requireRefExists: false // Keep backward compatibility - allow renaming refs that don't exist as items
  }).yamlContent;
}

/**
 * Rename a component ref and update all references to it throughout the YAML.
 * Components can be referenced in:
 * - boundaries.components
 * - threats.affected_components
 * - controls.implemented_in
 * - data_flows.source and data_flows.destination
 * 
 * When a component is renamed, data-flow refs are automatically regenerated
 * based on the new source/destination values (e.g., api->db becomes api-gateway->db).
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param oldRef - Current reference value
 * @param newRef - New reference value (will be made unique if already exists)
 * @returns Object containing the modified YAML and actual ref used
 */
export function renameComponentRef(
  yamlContent: string,
  oldRef: string,
  newRef: string
): { yamlContent: string; actualRef: string } {
  return renameRef(yamlContent, oldRef, newRef, {
    arrayFields: ['components', 'affected_components', 'implemented_in'],
    scalarFields: ['source', 'destination'],
    regenerateDataFlowRefs: true
  });
}

/**
 * Rename an asset ref and update all references to it throughout the YAML.
 * Assets can be referenced in:
 * - components.assets
 * - threats.affected_assets
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param oldRef - Current reference value
 * @param newRef - New reference value (will be made unique if already exists)
 * @returns Object containing the modified YAML and actual ref used
 */
export function renameAssetRef(
  yamlContent: string,
  oldRef: string,
  newRef: string
): { yamlContent: string; actualRef: string } {
  return renameRef(yamlContent, oldRef, newRef, {
    arrayFields: ['assets', 'affected_assets']
  });
}

/**
 * Rename a boundary ref and update all references to it throughout the YAML.
 * Note: Boundaries are not currently referenced in arrays elsewhere,
 * but this provides consistency with other rename functions.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param oldRef - Current reference value
 * @param newRef - New reference value (will be made unique if already exists)
 * @returns Object containing the modified YAML and actual ref used
 */
export function renameBoundaryRef(
  yamlContent: string,
  oldRef: string,
  newRef: string
): { yamlContent: string; actualRef: string } {
  return renameRef(yamlContent, oldRef, newRef, {
    arrayFields: [] // Boundaries aren't referenced elsewhere
  });
}

/**
 * Rename a threat ref and update all references to it throughout the YAML.
 * Threats can be referenced in:
 * - controls.mitigates
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param oldRef - Current reference value
 * @param newRef - New reference value (will be made unique if already exists)
 * @returns Object containing the modified YAML and actual ref used
 */
export function renameThreatRef(
  yamlContent: string,
  oldRef: string,
  newRef: string
): { yamlContent: string; actualRef: string } {
  return renameRef(yamlContent, oldRef, newRef, {
    arrayFields: ['mitigates']
  });
}

/**
 * Rename a control ref and update all references to it throughout the YAML.
 * Note: Controls are not currently referenced in arrays elsewhere,
 * but this provides consistency with other rename functions.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param oldRef - Current reference value
 * @param newRef - New reference value (will be made unique if already exists)
 * @returns Object containing the modified YAML and actual ref used
 */
export function renameControlRef(
  yamlContent: string,
  oldRef: string,
  newRef: string
): { yamlContent: string; actualRef: string } {
  return renameRef(yamlContent, oldRef, newRef, {
    arrayFields: [] // Controls aren't referenced elsewhere
  });
}

/**
 * Remove a ref from all array fields that might contain it.

 * This is used when deleting components or data flows to clean up references.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param refToRemove - Reference value to remove from arrays
 * @param fieldNames - Array of field names to check (e.g., ['affected_components', 'implemented_in'])
 * @returns Modified YAML string
 */
export function removeRefFromArrayFields(
  yamlContent: string,
  refToRemove: string,
  fieldNames: string[]
): string {
  const lines = yamlContent.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const parsed = parseLine(line);
    let shouldSkipLine = false;
    
    // Check each field name for inline arrays
    for (const fieldName of fieldNames) {
      const inlineArrayRegex = new RegExp(`^(\\s*)${escapeRegex(fieldName)}:\\s*\\[(.*)\\]$`);
      const inlineArrayMatch = line.match(inlineArrayRegex);
      
      if (inlineArrayMatch) {
        const indent = inlineArrayMatch[1];
        const arrayContent = inlineArrayMatch[2].trim();
        
        if (arrayContent === '') {
          // Empty array, keep as-is
          break;
        }
        
        const items = arrayContent.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
        const filteredItems = items.filter(item => item !== refToRemove);
        
        if (filteredItems.length === 0) {
          // Remove the entire field if empty
          shouldSkipLine = true;
        } else if (filteredItems.length !== items.length) {
          // Only update if something was actually removed
          line = `${indent}${fieldName}: [${filteredItems.join(', ')}]`;
        }
        break;
      }
    }
    
    if (shouldSkipLine) {
      continue;
    }
    
    // Handle multi-line array items: "      - ref-to-remove"
    const arrayItemMatch = parsed.trimmed.match(/^-\s*(.+)$/);
    if (arrayItemMatch && !parsed.trimmed.includes(':')) {
      const itemValue = arrayItemMatch[1].trim().replace(/^["']|["']$/g, '');
      if (itemValue === refToRemove) {
        // Skip this item
        continue;
      }
    }
    
    result.push(line);
  }
  
  return normalizeYamlWhitespace(result.join('\n'));
}

/**
 * Update a top-level field in the YAML (like name, description).
 * This modifies fields at the root level of the YAML document.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param field - Field name to update
 * @param newValue - New value for the field
 * @returns Modified YAML string
 */
export function updateYamlTopLevelField(
  yamlContent: string,
  field: string,
  newValue: string
): string {
  const pattern = new RegExp(`^(${escapeRegex(field)}:)\\s*(.*)$`, 'm');
  const formattedValue = yamlQuote(newValue);
  return yamlContent.replace(pattern, `$1 ${formattedValue}`);
}

/**
 * Add, update, or remove an optional top-level field in YAML.
 * If the value is empty/blank, the field is removed.
 * If the field doesn't exist and value is non-empty, it's added after description.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param field - Field name to add/update/remove
 * @param newValue - New value (empty string removes the field)
 * @returns Modified YAML string
 */
export function updateYamlOptionalTopLevelField(
  yamlContent: string,
  field: string,
  newValue: string
): string {
  const trimmedValue = newValue.trim();
  const fieldPattern = new RegExp(`^${escapeRegex(field)}:.*$`, 'm');
  const fieldExists = fieldPattern.test(yamlContent);

  // If value is empty, remove the field if it exists
  if (!trimmedValue) {
    if (fieldExists) {
      // Remove the line (including newline)
      const removePattern = new RegExp(`^${escapeRegex(field)}:.*\n`, 'm');
      return yamlContent.replace(removePattern, '');
    }
    return yamlContent; // Field doesn't exist and value is empty, no change needed
  }

  // If field exists, update it
  if (fieldExists) {
    const pattern = new RegExp(`^(${escapeRegex(field)}:)\\s*(.*)$`, 'm');
    const formattedValue = yamlQuote(trimmedValue);
    return yamlContent.replace(pattern, `$1 ${formattedValue}`);
  }

  // Field doesn't exist, add it after description (or after name if no description)
  const lines = yamlContent.split('\n');
  let insertIndex = -1;

  // Find where to insert (after description or name)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('description:')) {
      insertIndex = i + 1;
      break;
    } else if (line.startsWith('name:') && insertIndex === -1) {
      insertIndex = i + 1;
    }
  }

  if (insertIndex === -1) {
    // Fallback: insert after schema_version
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('schema_version:')) {
        insertIndex = i + 1;
        break;
      }
    }
  }

  if (insertIndex !== -1) {
    const formattedValue = yamlQuote(trimmedValue);
    lines.splice(insertIndex, 0, `${field}: ${formattedValue}`);
    return lines.join('\n');
  }

  return yamlContent; // Shouldn't reach here, but return unchanged if we can't find insert point
}

/**
 * Update a top-level string array field in the YAML (like participants).
 * Handles adding, updating, and removing the entire array.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param field - Field name to update (e.g., 'participants')
 * @param values - Array of string values (empty array removes the field)
 * @returns Modified YAML string
 */
export function updateYamlTopLevelStringArray(
  yamlContent: string,
  field: string,
  values: string[]
): string {
  const lines = yamlContent.split('\n');
  const fieldPattern = new RegExp(`^${escapeRegex(field)}:`);

  // Find the existing field and its extent
  let fieldStartIndex = -1;
  let fieldEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (fieldPattern.test(lines[i])) {
      fieldStartIndex = i;
      // Check if it's an inline empty array like "participants: []"
      if (/:\s*\[\s*\]/.test(lines[i])) {
        fieldEndIndex = i;
        break;
      }
      // Find the end of this array (items are indented lines starting with "- ")
      fieldEndIndex = i;
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        // Empty lines within the array are part of it
        if (line.trim() === '') {
          fieldEndIndex = j;
          continue;
        }
        // Indented lines (array items) are part of the field
        if (/^\s+-\s/.test(line)) {
          fieldEndIndex = j;
        } else {
          // Non-indented, non-empty line means the array has ended
          break;
        }
      }
      break;
    }
  }

  // If values are empty, remove the field entirely
  if (values.length === 0) {
    if (fieldStartIndex !== -1) {
      // Remove trailing empty lines after the field
      while (fieldEndIndex + 1 < lines.length && lines[fieldEndIndex + 1].trim() === '') {
        fieldEndIndex++;
      }
      lines.splice(fieldStartIndex, fieldEndIndex - fieldStartIndex + 1);
      return lines.join('\n');
    }
    return yamlContent; // Nothing to remove
  }

  // Build the new field lines
  const newFieldLines = [`${field}:`];
  for (const val of values) {
    newFieldLines.push(`  - ${yamlQuote(val)}`);
  }

  if (fieldStartIndex !== -1) {
    // Replace existing field
    lines.splice(fieldStartIndex, fieldEndIndex - fieldStartIndex + 1, ...newFieldLines);
  } else {
    // Insert after description (or after name if no description)
    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('description:')) {
        insertIndex = i + 1;
        break;
      } else if (lines[i].startsWith('name:') && insertIndex === -1) {
        insertIndex = i + 1;
      }
    }
    if (insertIndex === -1) {
      // Fallback: insert after schema_version
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('schema_version:')) {
          insertIndex = i + 1;
          break;
        }
      }
    }
    if (insertIndex !== -1) {
      lines.splice(insertIndex, 0, ...newFieldLines);
    }
  }

  return lines.join('\n');
}

/**
 * Append a new item to a YAML array section (like data_flows, components, etc.).
 * This preserves all existing content and comments. Handles empty sections and
 * empty array notation (section: []).
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param section - Section name to append to (e.g., 'threats', 'assets')
 * @param item - Object representing the item to append
 * @returns Modified YAML string
 */
export function appendYamlItem(
  yamlContent: string,
  section: string,
  item: Record<string, unknown>
): string {
  const lines = yamlContent.split('\n');
  let inSection = false;
  let sectionIndent = 0;
  let itemIndent = 2; // Default item indent (will be detected from existing items)
  let lastItemEndIndex = -1; // Track where the last actual item content ends
  let emptyArrayLineIndex = -1; // Track if there's an empty array on the same line as section header
  
  // First pass: find the section and track where items are
  let inMultilineBlock = false;
  let multilineBlockIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;
    
    // Check if we're entering the target section
    if (trimmed.startsWith(`${section}:`)) {
      inSection = true;
      sectionIndent = indent;
      
      // Check if this line has an empty array (e.g., "assets: []")
      if (trimmed === `${section}: []`) {
        emptyArrayLineIndex = i;
      }
      continue;
    }
    
    // If we're in the section
    if (inSection) {
      // Check if we're in a multiline block (pipe style |)
      if (inMultilineBlock) {
        // Still in multiline if indented more than the field that started it
        if (trimmed.length === 0 || indent > multilineBlockIndent) {
          lastItemEndIndex = i;
        } else {
          inMultilineBlock = false;
        }
      }
      
      // Check if this line starts a multiline block
      if (trimmed.endsWith('|') || trimmed.endsWith('|-') || trimmed.endsWith('|+')) {
        inMultilineBlock = true;
        multilineBlockIndent = indent;
        lastItemEndIndex = i;
      }
      
      // Detect item indent and track last item position
      // Only count '-' at the item indent level, not within nested content
      if (trimmed.startsWith('-') && !inMultilineBlock && (indent === sectionIndent || indent === sectionIndent + 2)) {
        itemIndent = indent;
        lastItemEndIndex = i;
      } else if (trimmed && !trimmed.startsWith('#') && !inMultilineBlock && indent > sectionIndent && !trimmed.endsWith('|') && !trimmed.endsWith('|-') && !trimmed.endsWith('|+')) {
        // This is a field within an item (not a comment, has content, indented more than section)
        lastItemEndIndex = i;
      }
      
      // Check if we're leaving the section (new top-level key at same or lower indent)
      if (trimmed.length > 0 && !trimmed.startsWith('#') && indent <= sectionIndent && !trimmed.startsWith('-')) {
        inSection = false;
        break;
      }
    }
  }
  
  // If we found an empty array on the section header line, we need to replace it
  if (emptyArrayLineIndex >= 0) {
    const result: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i === emptyArrayLineIndex) {
        // Replace the empty array line with just the section header
        result.push(`${' '.repeat(sectionIndent)}${section}:`);
        const newItemLines = formatYamlItem(item, sectionIndent + 2);
        result.push(...newItemLines);
        // Check if next line exists and isn't blank before adding spacing
        // Only add blank line if next content is a section or section-level comment
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextParsed = parseLine(nextLine);
          if (nextParsed.trimmed && (nextParsed.indent <= sectionIndent || nextParsed.trimmed.startsWith('#'))) {
            result.push('');
          }
        }
      } else {
        result.push(lines[i]);
      }
    }
    return normalizeYamlWhitespace(result.join('\n'));
  }
  
  // If we found items, insert after the last one
  // If section exists but no items, insert right after section header
  // If section doesn't exist, append at end
  
  let insertAfterIndex: number = lines.length - 1;
  if (lastItemEndIndex >= 0) {
    insertAfterIndex = lastItemEndIndex;
  } else {
    // Find section header line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith(`${section}:`)) {
        insertAfterIndex = i;
        break;
      }
    }
  }
  
  // Build result
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    
    if (i === insertAfterIndex) {
      // If there's already at least one item in the section, add whitespace before new item
      if (lastItemEndIndex >= 0) {
        result.push('');
      }
      
      const newItemLines = formatYamlItem(item, itemIndent);
      result.push(...newItemLines);
      
      // Add blank line after new item only if next line is a section or section-level comment
      const nextLineIndex = i + 1;
      if (nextLineIndex < lines.length) {
        const nextLine = lines[nextLineIndex];
        const nextParsed = parseLine(nextLine);
        if (nextParsed.trimmed && (nextParsed.indent <= sectionIndent || 
            (nextParsed.trimmed.startsWith('#') && nextParsed.indent <= sectionIndent))) {
          result.push('');
        }
      }
    }
  }
  
  // If section wasn't found at all, append new section at end
  if (lastItemEndIndex === -1 && !lines.some(l => l.trimStart().startsWith(`${section}:`))) {
    result.push('');
    result.push(`${section}:`);
    const newItemLines = formatYamlItem(item, 2);
    result.push(...newItemLines);
    result.push(''); // Add blank line after the item when creating new section
  }
  
  return normalizeYamlWhitespace(result.join('\n'));
}

/**
 * Reorder items within a YAML array section by a new ref order.
 * Surgically extracts each item block (preserving its formatting, comments,
 * pipe blocks, etc.) and reassembles them in the specified order.
 *
 * @param yamlContent - Raw YAML string to modify
 * @param section - Section name (e.g., 'assets', 'components', 'threats', 'controls')
 * @param newOrder - Array of ref values in the desired order
 * @returns Modified YAML string with items reordered
 */
export function reorderYamlSection(
  yamlContent: string,
  section: string,
  newOrder: string[]
): string {
  const lines = yamlContent.split('\n');

  // 1. Find where the section starts
  let sectionStart = -1;
  let sectionIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLine(lines[i]);
    if (parsed.trimmed === `${section}:` || parsed.trimmed.startsWith(`${section}: `)) {
      sectionStart = i;
      sectionIndent = parsed.indent;
      break;
    }
  }

  if (sectionStart === -1) return yamlContent;

  // 2. Find the end of the section by looking for either:
  //    - A non-blank, non-comment line at sectionIndent or lower (a new section key)
  //    - A top-level comment that precedes a new section (blank line + comment pattern)
  // We include blank lines / comments that are between items, but NOT trailing
  // comments that introduce the next section.
  let sectionEnd = lines.length;
  let lastItemContentEnd = sectionStart; // tracks last line that belongs to an item

  for (let i = sectionStart + 1; i < lines.length; i++) {
    const parsed = parseLine(lines[i]);

    // A non-blank, non-comment, non-item line at section indent = new section key
    if (parsed.trimmed.length > 0 &&
        !parsed.trimmed.startsWith('#') &&
        parsed.indent <= sectionIndent &&
        !parsed.trimmed.startsWith('-')) {
      sectionEnd = i;
      break;
    }

    // A top-level comment at sectionIndent (e.g. "# Components") after a blank line
    // might be introducing the next section — verify by looking ahead for a
    // non-comment line at sectionIndent or lower (i.e. an actual section key)
    if (parsed.trimmed.startsWith('#') && parsed.indent <= sectionIndent) {
      if (i > 0 && lines[i - 1].trim() === '') {
        // Look ahead past any further comments/blanks to find the next real line
        let isNextSection = false;
        for (let j = i + 1; j < lines.length; j++) {
          const ahead = parseLine(lines[j]);
          if (ahead.trimmed.length === 0 || ahead.trimmed.startsWith('#')) continue;
          // Found a non-comment, non-blank line — check its indent
          if (ahead.indent <= sectionIndent && !ahead.trimmed.startsWith('-')) {
            isNextSection = true;
          }
          break;
        }
        if (isNextSection) {
          sectionEnd = i;
          break;
        }
      }
    }

    // Track the last line that looks like item content (non-blank)
    if (parsed.trimmed.length > 0) {
      lastItemContentEnd = i;
    }
  }

  // Trim sectionEnd to exclude trailing blank lines between last item and sectionEnd
  // (they belong to inter-section spacing, not items)
  if (sectionEnd > lastItemContentEnd + 1) {
    sectionEnd = lastItemContentEnd + 1;
  }

  // 3. Extract individual item blocks (lines between one `- ref:` and the next)
  const itemBlocks = new Map<string, string[]>();
  let currentRef: string | null = null;
  let currentBlock: string[] = [];
  let inPipeBlock = false;
  let pipeBlockFieldIndent = 0;

  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const parsed = parseLine(lines[i]);

    // Detect item start
    if (parsed.trimmed.startsWith('- ref:')) {
      // Save the previous item block
      if (currentRef !== null) {
        // Trim trailing blank lines from the block
        while (currentBlock.length > 0 && currentBlock[currentBlock.length - 1].trim() === '') {
          currentBlock.pop();
        }
        itemBlocks.set(currentRef, currentBlock);
      }
      currentRef = extractRefValue(parsed.trimmed);
      currentBlock = [lines[i]];
      inPipeBlock = false;
      continue;
    }

    if (currentRef !== null) {
      // Track pipe blocks to avoid misinterpreting their content
      if (!inPipeBlock && parsed.trimmed &&
        (parsed.trimmed.endsWith('|') || parsed.trimmed.endsWith('|-') || parsed.trimmed.endsWith('|+'))) {
        inPipeBlock = true;
        pipeBlockFieldIndent = parsed.indent;
        currentBlock.push(lines[i]);
        continue;
      }

      if (inPipeBlock) {
        if (parsed.trimmed === '' || parsed.indent > pipeBlockFieldIndent) {
          currentBlock.push(lines[i]);
          continue;
        } else {
          inPipeBlock = false;
          // Fall through to normal handling
        }
      }

      currentBlock.push(lines[i]);
    }
  }

  // Save the last block
  if (currentRef !== null) {
    while (currentBlock.length > 0 && currentBlock[currentBlock.length - 1].trim() === '') {
      currentBlock.pop();
    }
    itemBlocks.set(currentRef, currentBlock);
  }

  // If no items found, nothing to reorder
  if (itemBlocks.size === 0) return yamlContent;

  // 4. Reassemble: lines before section items + reordered items + lines after section
  const result: string[] = [];

  // Lines up to and including the section header
  for (let i = 0; i <= sectionStart; i++) {
    result.push(lines[i]);
  }

  // Reordered item blocks, separated by blank lines
  let first = true;
  for (const ref of newOrder) {
    const block = itemBlocks.get(ref);
    if (!block) continue;
    if (!first) {
      result.push('');
    }
    result.push(...block);
    first = false;
  }

  // Lines after the section
  for (let i = sectionEnd; i < lines.length; i++) {
    result.push(lines[i]);
  }

  return normalizeYamlWhitespace(result.join('\n'));
}

/**
 * Remove an item from a YAML array section by ref.
 * This removes the entire item including all its fields and preserves
 * the rest of the YAML structure.
 * 
 * @param yamlContent - Raw YAML string to modify
 * @param section - Section name containing the item (e.g., 'components', 'threats')
 * @param ref - Reference value of the item to remove
 * @returns Modified YAML string
 */
export function removeYamlItem(
  yamlContent: string,
  section: string,
  ref: string
): string {
  const lines = yamlContent.split('\n');
  const result: string[] = [];
  let inSection = false;
  let inTargetItem = false;
  let sectionIndent = 0;
  let sectionLineIndex = -1;
  let itemIndent = 0;
  let inPipeBlock = false;
  let pipeBlockFieldIndent = 0;
  let itemFound = false;
  let hasOtherItems = false;
  let skipNextBlankLine = false; // Track if we should skip one trailing blank line
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseLine(line);
    
    // Check if we're entering the target section
    if (parsed.trimmed.startsWith(`${section}:`)) {
      inSection = true;
      sectionIndent = parsed.indent;
      sectionLineIndex = result.length;
      result.push(line);
      continue;
    }
    
    // Check if we're leaving the section
    if (inSection && isLeavingSection(parsed, sectionIndent)) {
      inSection = false;
      inTargetItem = false;
      inPipeBlock = false;
      skipNextBlankLine = false;
    }
    
    // Look for items with matching ref in this section
    if (inSection && parsed.trimmed.startsWith('- ref:')) {
      const refValue = extractRefValue(parsed.trimmed);
      if (refValue === ref) {
        inTargetItem = true;
        itemFound = true;
        itemIndent = parsed.indent;
        inPipeBlock = false;
        skipNextBlankLine = false;
        continue; // Skip this line (start of item to remove)
      } else {
        inTargetItem = false;
        inPipeBlock = false;
        skipNextBlankLine = false;
        hasOtherItems = true; // Found another item in this section
      }
    }
    
    // Skip lines that belong to the target item
    if (inTargetItem) {
      // Check if we're starting a pipe-style block
      if (!inPipeBlock && parsed.trimmed && (parsed.trimmed.endsWith('|') || parsed.trimmed.endsWith('|-') || parsed.trimmed.endsWith('|+'))) {
        inPipeBlock = true;
        pipeBlockFieldIndent = parsed.indent;
        continue;
      }
      
      // Check if we're still in a pipe block
      if (inPipeBlock) {
        // In pipe block, blank lines and indented content are part of the block
        if (parsed.trimmed === '' || parsed.indent > pipeBlockFieldIndent) {
          continue;
        } else {
          // Exited pipe block (content at same or lower indent)
          inPipeBlock = false;
          // Don't continue here - process this line with normal logic below
        }
      }
      
      // Check for new item at same level
      if (parsed.trimmed.startsWith('-') && parsed.indent <= itemIndent) {
        // New item, stop skipping
        inTargetItem = false;
        inPipeBlock = false;
        skipNextBlankLine = false;
        hasOtherItems = true; // Found another item after the removed one
      } else if (parsed.trimmed === '') {
        // Hit a blank line (not in pipe block)
        // Skip only the first blank line after the item (the trailing whitespace)
        if (skipNextBlankLine) {
          skipNextBlankLine = false; // We've consumed the one blank line to skip
          continue; // Skip this blank line
        }
        // For subsequent blank lines, exit the item (they separate sections)
        inTargetItem = false;
        inPipeBlock = false;
        skipNextBlankLine = false;
      } else if (parsed.indent <= itemIndent && parsed.trimmed) {
        // Content at same or lower indent than item (and not blank) - we've left the item
        inTargetItem = false;
        inPipeBlock = false;
        skipNextBlankLine = false;
      } else if (parsed.indent > itemIndent || parsed.trimmed.startsWith('#')) {
        // Still in target item (indented content or inline comments), skip
        // Mark that we should skip the next blank line (trailing whitespace)
        skipNextBlankLine = true;
        continue;
      }
    }
    
    result.push(line);
  }
  
  // If we removed an item and there are no other items left in the section,
  // convert the section to empty array notation
  if (itemFound && !hasOtherItems && sectionLineIndex !== -1) {
    const sectionLine = result[sectionLineIndex];
    const indent = sectionLine.match(/^(\s*)/)?.[1] || '';
    result[sectionLineIndex] = `${indent}${section}: []`;
    
    // Remove lines immediately after the section line that belong to the now-empty section
    // BUT stop at:
    // 1. A blank line (content after blank line belongs to next section)
    // 2. Content at same or lower indent that isn't a comment (new section)
    // 3. Comments at the section indent level (they belong to the next section)
    let i = sectionLineIndex + 1;
    let hasSeenBlankLine = false;
    
    while (i < result.length) {
      const parsed = parseLine(result[i]);
      
      // If we hit a blank line, mark it and continue to see what comes after
      if (!parsed.trimmed) {
        hasSeenBlankLine = true;
        i++;
        continue;
      }
      
      // If we previously saw a blank line, content after it belongs to the next section
      // So stop removing - we're done cleaning up
      if (hasSeenBlankLine) {
        break;
      }
      
      // Keep lines that start a new section (at same or lower indent, not a comment)
      if (parsed.trimmed && !parsed.trimmed.startsWith('#') && parsed.indent <= sectionIndent) {
        break;
      }
      
      // Keep comments at the section indent level - they belong to the next section
      if (parsed.trimmed.startsWith('#') && parsed.indent <= sectionIndent) {
        break;
      }
      
      // Remove indented content or comments that are part of the now-empty section
      // (before any blank line)
      if (parsed.trimmed.startsWith('#') || parsed.indent > sectionIndent) {
        result.splice(i, 1);
        // Don't increment i since we removed an item
      } else {
        break;
      }
    }
  }
  
  // Only normalize if we actually modified the content
  if (itemFound) {
    return normalizeYamlWhitespace(result.join('\n'));
  } else {
    return yamlContent;
  }
}

/**
 * Format an object as YAML array item lines.
 * Creates properly indented YAML lines for an item with the first field
 * starting with '- ' (array item syntax).
 * 
 * @param item - Object to format as YAML
 * @param baseIndent - Base indentation level for the item
 * @returns Array of formatted YAML lines
 */
function formatYamlItem(item: Record<string, unknown>, baseIndent: number): string[] {
  const indent = ' '.repeat(baseIndent);
  const lines: string[] = [];
  let first = true;
  
  for (const [key, value] of Object.entries(item)) {
    if (value === undefined || value === null) continue;
    
    const prefix = first ? `${indent}- ` : `${indent}  `;
    first = false;
    
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${prefix}${key}: [${value.join(', ')}]`);
    } else if (typeof value === 'object') {
      // Nested object - simplified handling
      lines.push(`${prefix}${key}: {}`);
    } else if (typeof value === 'number') {
      lines.push(`${prefix}${key}: ${value.toString()}`);
    } else {
      const stringValue = String(value);
      if (stringValue.includes('\n')) {
        // Multiline value - use pipe style
        const blockIndent = indent + '    ';
        lines.push(`${prefix}${key}: |`);
        const multilineValue = stringValue.split('\n')
          .map(line => blockIndent + line)
          .join('\n');
        lines.push(multilineValue);
      } else {
        const formattedValue = yamlQuote(stringValue, indent + '  ');
        lines.push(`${prefix}${key}: ${formattedValue}`);
      }
    }
  }
  
  return lines;
}

/**
 * Normalize YAML whitespace according to formatting rules:
 * 1. No whitespace between fields within the same item
 * 2. Exactly one blank line between items within the same section
 * 3. Exactly one blank line between sections (or before comments that start a section)
 * 
 * This handles piped content specially to preserve internal blank lines.
 * 
 * @param yamlContent - Raw YAML string to normalize
 * @returns Normalized YAML string
 */
export function normalizeYamlWhitespace(yamlContent: string): string {
  const lines = yamlContent.split('\n');
  const result: string[] = [];
  let previousLineType: 'empty' | 'section' | 'item' | 'field' | 'comment' | 'pipe-indicator' | 'pipe-content' | 'top-level-field' = 'empty';
  let inPipeBlock = false;
  let pipeBlockIndent = 0;
  let currentSectionIndent = -1;
  let currentItemIndent = -1;
  let pipeBlockLines: string[] = []; // Accumulate pipe block lines to trim trailing whitespace
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseLine(line);
    
    // Skip empty lines for now - we'll add them back based on rules
    if (parsed.trimmed === '') {
      // In pipe blocks, accumulate empty lines
      if (inPipeBlock) {
        pipeBlockLines.push(line);
        previousLineType = 'pipe-content';
      } else {
        previousLineType = 'empty';
      }
      continue;
    }
    
    // Check if we're in or entering a pipe block
    if (!inPipeBlock && (parsed.trimmed.endsWith('|') || parsed.trimmed.endsWith('|-') || parsed.trimmed.endsWith('|+'))) {
      inPipeBlock = true;
      pipeBlockIndent = parsed.indent;
      pipeBlockLines = []; // Start accumulating pipe block content
      
      result.push(line);
      previousLineType = 'pipe-indicator';
      continue;
    }
    
    // Check if we're still in a pipe block (indented content or empty lines)
    if (inPipeBlock) {
      if (parsed.indent > pipeBlockIndent || parsed.trimmed === '') {
        // Still in pipe block - accumulate the line
        pipeBlockLines.push(line);
        previousLineType = 'pipe-content';
        continue;
      } else {
        // Exited pipe block - trim trailing blank lines and add to result
        // Remove trailing empty lines from pipe block
        while (pipeBlockLines.length > 0 && pipeBlockLines[pipeBlockLines.length - 1].trim() === '') {
          pipeBlockLines.pop();
        }
        result.push(...pipeBlockLines);
        pipeBlockLines = [];
        inPipeBlock = false;
      }
    }
    
    // Detect line type
    type LineType = 'empty' | 'section' | 'item' | 'field' | 'comment' | 'pipe-indicator' | 'pipe-content' | 'top-level-field';
    let currentLineType: LineType = 'field';
    const previousItemIndent = currentItemIndent; // Save before updating
    
    if (parsed.trimmed.startsWith('#')) {
      currentLineType = 'comment';
      // Section-level comments reset the current section context
      if (parsed.indent === 0) {
        currentSectionIndent = -1;
        currentItemIndent = -1;
      }
    } else if (parsed.trimmed.match(/^\w+:/) && parsed.indent === 0) {
      // Top-level field or section
      // Check if the value is empty or an array indicator (section)
      if (parsed.trimmed.endsWith(':') || parsed.trimmed.endsWith(': []')) {
        currentLineType = 'section';
        currentSectionIndent = parsed.indent;
        currentItemIndent = -1;
      } else {
        currentLineType = 'top-level-field';
      }
    } else if (parsed.trimmed.startsWith('- ')) {
      // Array item
      currentLineType = 'item';
      currentItemIndent = parsed.indent;
    } else {
      // Regular field
      currentLineType = 'field';
    }
    
    // Determine if we need a blank line before this line
    let needsBlankLine = false;
    
    if (result.length === 0) {
      // First line, no blank line
      needsBlankLine = false;
    } else if (currentLineType === 'section') {
      // Blank line before sections
      // Unless the previous line is already blank OR it was a comment (comments introduce sections)
      // OR it was a top-level field (no blank line between top-level fields and sections)
      const lastResultLine = result[result.length - 1];
      const lastLineIsBlank = lastResultLine === '';
      needsBlankLine = !lastLineIsBlank && previousLineType !== 'comment' && previousLineType !== 'top-level-field';
    } else if (currentLineType === 'comment' && parsed.indent === 0) {
      // Blank line before top-level comments (they often introduce new sections)
      // UNLESS the previous line was already a blank or was a section header, top-level field, or another comment
      const lastResultLine = result[result.length - 1];
      const lastLineIsBlank = lastResultLine === '';
      needsBlankLine = !lastLineIsBlank && previousLineType !== 'section' && previousLineType !== 'top-level-field' && previousLineType !== 'comment';
    } else if (currentLineType === 'item') {
      // Blank line between items in the same section
      // But NOT before the first item in a section
      if ((previousLineType === 'item' || previousLineType === 'field' || previousLineType === 'pipe-content' || previousLineType === 'pipe-indicator' || previousLineType === 'empty') && 
          parsed.indent === previousItemIndent && previousItemIndent !== -1) {
        needsBlankLine = true;
      } else if (previousLineType === 'section' || (previousItemIndent === -1 && previousLineType !== 'empty')) {
        // First item in a section - no blank line
        needsBlankLine = false;
      }
    } else if (currentLineType === 'top-level-field') {
      // No blank line between top-level fields
      needsBlankLine = false;
    }
    
    // Add blank line if needed
    if (needsBlankLine && result.length > 0) {
      result.push('');
    }
    
    result.push(line);
    previousLineType = currentLineType;
  }
  
  // Handle case where file ends while still in a pipe block
  if (inPipeBlock && pipeBlockLines.length > 0) {
    // Trim trailing blank lines from pipe block
    while (pipeBlockLines.length > 0 && pipeBlockLines[pipeBlockLines.length - 1].trim() === '') {
      pipeBlockLines.pop();
    }
    result.push(...pipeBlockLines);
  }
  
  return result.join('\n');
}

/**
 * Simple YAML serialization for when we need to generate YAML from model
 * (e.g., after structural changes like adding/removing components).
 * Rounds all position values to integers for cleaner output.
 * 
 * @param threatModel - Threat model object to serialize
 * @returns YAML string representation
 */
export function modelToYaml(threatModel: ThreatModel): string {
  // Create a deep copy and round all position values to integers
  const cleanedModel = JSON.parse(JSON.stringify(threatModel));
  
  // Round component positions
  if (cleanedModel.components) {
    cleanedModel.components.forEach((component: { x?: number; y?: number }) => {
      if (typeof component.x === 'number') component.x = Math.round(component.x);
      if (typeof component.y === 'number') component.y = Math.round(component.y);
    });
  }
  
  // Round boundary positions and dimensions
  if (cleanedModel.boundaries) {
    cleanedModel.boundaries.forEach((boundary: { x?: number; y?: number; width?: number; height?: number }) => {
      if (typeof boundary.x === 'number') boundary.x = Math.round(boundary.x);
      if (typeof boundary.y === 'number') boundary.y = Math.round(boundary.y);
      if (typeof boundary.width === 'number') boundary.width = Math.round(boundary.width);
      if (typeof boundary.height === 'number') boundary.height = Math.round(boundary.height);
    });
  }
  
  const yamlOutput = yaml.dump(cleanedModel, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    // Use flow style (inline brackets) for arrays that are short
    flowLevel: 3, // This makes arrays at depth 3+ use flow style
    condenseFlow: true, // Condense flow collections
  });

  // Fix 'y' quoting issue that js-yaml creates
  const fixedOutput = yamlOutput.replace(/'y':/g, 'y:');
  
  // Normalize whitespace according to formatting rules
  return normalizeYamlWhitespace(fixedOutput);
}

import { describe, it, expect } from 'vitest';
import { normalizeYamlWhitespace, modelToYaml, appendYamlItem } from '../yamlParser';
import type { ThreatModel } from '../../types/threatModel';

describe('yamlParser - Whitespace Normalization', () => {
  describe('normalizeYamlWhitespace', () => {
    it('should remove whitespace between fields within the same item', () => {
      const yaml = `
components:
  - ref: api
    name: API Gateway

    type: service

    description: Main API
assets:
  - ref: data
    name: User Data
`.trim();

      const expected = `
components:
  - ref: api
    name: API Gateway
    type: service
    description: Main API

assets:
  - ref: data
    name: User Data
`.trim();

      const result = normalizeYamlWhitespace(yaml);
      expect(result).toBe(expected);
    });

    it('should ensure exactly one blank line between items in the same section', () => {
      const yaml = `
components:
  - ref: api
    name: API Gateway
  - ref: db
    name: Database


  - ref: cache
    name: Cache
`.trim();

      const expected = `
components:
  - ref: api
    name: API Gateway

  - ref: db
    name: Database

  - ref: cache
    name: Cache
`.trim();

      const result = normalizeYamlWhitespace(yaml);
      expect(result).toBe(expected);
    });

    it('should ensure exactly one blank line between sections', () => {
      const yaml = `
components:
  - ref: api
    name: API Gateway


assets:
  - ref: data
    name: User Data
threats:
  - ref: threat-1
    name: SQL Injection
`.trim();

      const expected = `
components:
  - ref: api
    name: API Gateway

assets:
  - ref: data
    name: User Data

threats:
  - ref: threat-1
    name: SQL Injection
`.trim();

      const result = normalizeYamlWhitespace(yaml);
      expect(result).toBe(expected);
    });

    it('should ensure exactly one blank line before section-level comments', () => {
      const yaml = `
components:
  - ref: api
    name: API Gateway
# Assets section
assets:
  - ref: data
    name: User Data
`.trim();

      const expected = `
components:
  - ref: api
    name: API Gateway

# Assets section
assets:
  - ref: data
    name: User Data
`.trim();

      const result = normalizeYamlWhitespace(yaml);
      expect(result).toBe(expected);
    });

    it('should preserve blank lines within piped content', () => {
      const yaml = `
threats:
  - ref: threat-1
    name: SQL Injection
    description: |
      This is a multiline description.
      
      It has blank lines in the middle.
      
      And at the end.
    risk: high
  - ref: threat-2
    name: XSS
`.trim();

      const expected = `
threats:
  - ref: threat-1
    name: SQL Injection
    description: |
      This is a multiline description.
      
      It has blank lines in the middle.
      
      And at the end.
    risk: high

  - ref: threat-2
    name: XSS
`.trim();

      const result = normalizeYamlWhitespace(yaml);
      expect(result).toBe(expected);
    });

    it('should trim trailing blank lines from piped content to prevent accumulation', () => {
      const yaml = `
threats:
  - ref: threat-1
    description: |
      This is a description.
      
      With blank lines in the middle.
      


    risk: high
`.trim();

      const expected = `
threats:
  - ref: threat-1
    description: |
      This is a description.
      
      With blank lines in the middle.
    risk: high
`.trim();

      const result = normalizeYamlWhitespace(yaml);
      expect(result).toBe(expected);
      
      // Second normalization should be idempotent (no more changes)
      const result2 = normalizeYamlWhitespace(result);
      expect(result2).toBe(result);
    });

    it('should handle mixed content with comments and multiple sections', () => {
      const yaml = `
name: Test Model
description: A test threat model


# Component Architecture
components:
  - ref: api

    name: API

  - ref: db
    name: Database


# Data Assets
assets:
  - ref: user-data
    name: User Data
`.trim();

      const expected = `
name: Test Model
description: A test threat model

# Component Architecture
components:
  - ref: api
    name: API

  - ref: db
    name: Database

# Data Assets
assets:
  - ref: user-data
    name: User Data
`.trim();

      const result = normalizeYamlWhitespace(yaml);
      expect(result).toBe(expected);
    });
  });

  describe('modelToYaml', () => {
    it('should apply normalization to generated YAML', () => {
      const model: ThreatModel = {
        schema_version: '1.0',
        name: 'Test Model',
        description: 'A test',
        components: [
          {
            ref: 'api',
            name: 'API Gateway',
            component_type: 'external_dependency',
            x: 100.7,
            y: 200.3,
          },
          {
            ref: 'db',
            name: 'Database',
            component_type: 'data_store',
            x: 300.9,
            y: 400.1,
          },
        ],
        assets: [
          {
            ref: 'data',
            name: 'User Data',
          },
        ],
      };

      const result = modelToYaml(model);
      
      // Check that positions are rounded
      expect(result).toContain('x: 101');
      expect(result).toContain('y: 200');
      expect(result).toContain('x: 301');
      expect(result).toContain('y: 400');

      // Check that there's exactly one blank line between components
      expect(result).toMatch(/- ref: api\s+name: API Gateway[^\n]*\n\s+component_type: external_dependency[^\n]*\n\s+x: 101[^\n]*\n\s+y: 200\n\n\s+- ref: db/);
      
      // Check that there's exactly one blank line between sections
      expect(result).toMatch(/y: 400\n\nassets:/);
    });
  });

  describe('appendYamlItem', () => {
    it('should apply normalization after appending', () => {
      const yaml = `
components:
  - ref: api


    name: API Gateway
assets: []
`.trim();

      const result = appendYamlItem(yaml, 'assets', {
        ref: 'data',
        name: 'User Data',
      });

      // Should have proper spacing
      expect(result).toContain('name: API Gateway\n\nassets:');
      expect(result).not.toContain('name: API Gateway\n\n\n');
    });
  });
});

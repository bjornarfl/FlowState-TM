import { describe, it, expect } from 'vitest';
import { encodeModelForUrl, decodeModelFromUrl, generateShareableUrl, getModelFromUrl } from '../urlEncoder';
import type { ThreatModel } from '../../types/threatModel';
import type { GitHubMetadata } from '../../integrations/github/types';

describe('urlEncoder', () => {
  const sampleModel: ThreatModel = {
    schema_version: '1.0',
    name: 'Test Model',
    description: 'A test threat model',
    components: [
      {
        ref: 'comp-1',
        name: 'Component 1',
        component_type: 'internal',
        description: 'Test component',
        x: 100,
        y: 200,
      },
      {
        ref: 'comp-2',
        name: 'Component 2',
        component_type: 'data_store',
        x: 300,
        y: 200,
      },
    ],
    data_flows: [
      {
        ref: 'comp-1->comp-2',
        source: 'comp-1',
        destination: 'comp-2',
        direction: 'unidirectional',
        label: 'Query',
      },
    ],
    assets: [
      {
        ref: 'asset-1',
        name: 'User Data',
        description: 'Sensitive user information',
      },
    ],
    threats: [
      {
        ref: 'threat-1',
        name: 'SQL Injection',
        description: 'Attacker injects SQL',
        affected_components: ['comp-1'],
        affected_data_flows: ['comp-1->comp-2'],
      },
    ],
    controls: [
      {
        ref: 'control-1',
        name: 'Input Validation',
        description: 'Validate all inputs',
        mitigates: ['threat-1'],
        implemented_in: ['comp-1'],
      },
    ],
    boundaries: [
      {
        ref: 'boundary-1',
        name: 'Trust Boundary',
        description: 'Internal network',
        components: ['comp-1', 'comp-2'],
        x: 50,
        y: 150,
        width: 400,
        height: 150,
      },
    ],
  };

  describe('encodeModelForUrl', () => {
    it('should encode a threat model to a URL-safe string', () => {
      const encoded = encodeModelForUrl(sampleModel);
      
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
      
      // Should be able to decode what we encode
      const { model: decoded } = decodeModelFromUrl(encoded);
      expect(decoded).toEqual(sampleModel);
    });

    it('should produce a significantly smaller output than JSON', () => {
      const encoded = encodeModelForUrl(sampleModel);
      const jsonSize = JSON.stringify(sampleModel).length;
      
      // Encoded should be smaller (at least 20% reduction with compression + compaction)
      expect(encoded.length).toBeLessThan(jsonSize * 0.8);
    });

    it('should handle models with special characters in descriptions', () => {
      const modelWithSpecialChars: ThreatModel = {
        ...sampleModel,
        description: 'Test with "quotes" and \'apostrophes\' and\nnewlines\tand tabs',
      };

      const encoded = encodeModelForUrl(modelWithSpecialChars);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });
  });

  describe('decodeModelFromUrl', () => {
    it('should decode an encoded model back to the original', () => {
      const encoded = encodeModelForUrl(sampleModel);
      const { model: decoded } = decodeModelFromUrl(encoded);
      
      expect(decoded).toEqual(sampleModel);
    });

    it('should preserve all model properties', () => {
      const encoded = encodeModelForUrl(sampleModel);
      const { model: decoded } = decodeModelFromUrl(encoded);
      
      expect(decoded.schema_version).toBe(sampleModel.schema_version);
      expect(decoded.name).toBe(sampleModel.name);
      expect(decoded.description).toBe(sampleModel.description);
      expect(decoded.components).toEqual(sampleModel.components);
      expect(decoded.data_flows).toEqual(sampleModel.data_flows);
      expect(decoded.assets).toEqual(sampleModel.assets);
      expect(decoded.threats).toEqual(sampleModel.threats);
      expect(decoded.controls).toEqual(sampleModel.controls);
      expect(decoded.boundaries).toEqual(sampleModel.boundaries);
    });

    it('should preserve visualization data (x, y, width, height)', () => {
      const encoded = encodeModelForUrl(sampleModel);
      const { model: decoded } = decodeModelFromUrl(encoded);
      
      expect(decoded.components[0].x).toBe(100);
      expect(decoded.components[0].y).toBe(200);
      expect(decoded.boundaries?.[0].width).toBe(400);
      expect(decoded.boundaries?.[0].height).toBe(150);
    });

    it('should throw error for invalid encoded string', () => {
      expect(() => decodeModelFromUrl('invalid-data')).toThrow();
    });

    it('should throw error for empty string', () => {
      expect(() => decodeModelFromUrl('')).toThrow();
    });

    it('should encode and decode GitHub metadata separately', () => {
      const githubMetadata: GitHubMetadata = {
        domain: 'github.com',
        owner: 'test-owner',
        repository: 'test-repo',
        branch: 'main',
        path: 'threat-models/test.yaml',
        sha: 'abc123def456',
        loadedAt: 1234567890,
      };

      const encoded = encodeModelForUrl(sampleModel, githubMetadata);
      const { model: decoded, githubMetadata: decodedMetadata } = decodeModelFromUrl(encoded);

      // Model should be unchanged
      expect(decoded).toEqual(sampleModel);
      
      // GitHub metadata should be present and correct
      expect(decodedMetadata).toBeDefined();
      expect(decodedMetadata).toEqual(githubMetadata);
    });

    it('should not include githubMetadata when not provided', () => {
      const encoded = encodeModelForUrl(sampleModel);
      const { model: decoded, githubMetadata } = decodeModelFromUrl(encoded);

      expect(decoded).toEqual(sampleModel);
      expect(githubMetadata).toBeUndefined();
    });

    it('should handle null githubMetadata', () => {
      const encoded = encodeModelForUrl(sampleModel, null);
      const { model: decoded, githubMetadata } = decodeModelFromUrl(encoded);

      expect(decoded).toEqual(sampleModel);
      expect(githubMetadata).toBeUndefined();
    });
  });

  describe('generateShareableUrl', () => {
    it('should generate a full URL with encoded model', () => {
      const baseUrl = 'https://example.com/app';
      const url = generateShareableUrl(sampleModel, null, baseUrl);
      
      expect(url).toContain(baseUrl);
      expect(url).toContain('?model=');
      
      // Extract and decode the model parameter
      const urlObj = new URL(url);
      const encoded = urlObj.searchParams.get('model');
      expect(encoded).toBeTruthy();
      
      if (encoded) {
        const { model: decoded } = decodeModelFromUrl(encoded);
        expect(decoded).toEqual(sampleModel);
      }
    });

    it('should work without baseUrl parameter', () => {
      const url = generateShareableUrl(sampleModel);
      
      expect(url).toContain('?model=');
    });

    it('should include GitHub metadata in shareable URL', () => {
      const githubMetadata: GitHubMetadata = {
        domain: 'github.com',
        owner: 'test-owner',
        repository: 'test-repo',
        branch: 'main',
        path: 'threat-models/test.yaml',
        sha: 'abc123def456',
        loadedAt: 1234567890,
      };

      const baseUrl = 'https://example.com/app';
      const url = generateShareableUrl(sampleModel, githubMetadata, baseUrl);
      
      const urlObj = new URL(url);
      const encoded = urlObj.searchParams.get('model');
      
      if (encoded) {
        const { model: decoded, githubMetadata: decodedMetadata } = decodeModelFromUrl(encoded);
        expect(decoded).toEqual(sampleModel);
        expect(decodedMetadata).toEqual(githubMetadata);
      }
    });
  });

  describe('getModelFromUrl', () => {
    it('should return null when no model parameter is present', () => {
      // Mock window.location.search
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { search: '' };
      
      const result = getModelFromUrl();
      expect(result).toBeNull();
      
      // Restore original location
      (window as any).location = originalLocation;
    });

    it('should extract model parameter from URL', () => {
      const encoded = encodeModelForUrl(sampleModel);
      
      // Mock window.location.search
      const originalLocation = window.location;
      delete (window as any).location;
      // URL encode the parameter properly (+ becomes %2B, etc.)
      (window as any).location = { search: `?model=${encodeURIComponent(encoded)}` };
      
      const result = getModelFromUrl();
      // getModelFromUrl should return the decoded parameter
      expect(result).toBe(encoded);
      
      // Restore original location
      (window as any).location = originalLocation;
    });
  });

  describe('compression efficiency', () => {
    it('should achieve significant compression on large models', () => {
      // Create a larger model with multiple items
      const largeModel: ThreatModel = {
        schema_version: '1.0',
        name: 'Large Threat Model',
        description: 'A comprehensive threat model with many components',
        components: Array.from({ length: 10 }, (_, i) => ({
          ref: `comp-${i}`,
          name: `Component ${i}`,
          component_type: i % 3 === 0 ? 'internal' : i % 3 === 1 ? 'external' : 'data_store',
          description: `This is component ${i} with some description text`,
          x: i * 100,
          y: i * 50,
        })) as any[],
        data_flows: Array.from({ length: 9 }, (_, i) => ({
          ref: `comp-${i}->comp-${i + 1}`,
          source: `comp-${i}`,
          destination: `comp-${i + 1}`,
          direction: 'bidirectional',
          label: 'API Call',
        })) as any[],
        assets: Array.from({ length: 5 }, (_, i) => ({
          ref: `asset-${i}`,
          name: `Asset ${i}`,
          description: `Description for asset ${i}`,
        })),
        threats: Array.from({ length: 8 }, (_, i) => ({
          ref: `threat-${i}`,
          name: `Threat ${i}`,
          description: `Description for threat ${i}`,
          affected_components: [`comp-${i}`],
        })),
        controls: Array.from({ length: 8 }, (_, i) => ({
          ref: `control-${i}`,
          name: `Control ${i}`,
          description: `Description for control ${i}`,
          mitigates: [`threat-${i}`],
          implemented_in: [`comp-${i}`],
        })),
        boundaries: [],
      };

      const encoded = encodeModelForUrl(largeModel);
      const jsonSize = JSON.stringify(largeModel).length;
      
      console.log(`Original JSON size: ${jsonSize} bytes`);
      console.log(`Encoded size: ${encoded.length} bytes`);
      console.log(`Compression ratio: ${((1 - encoded.length / jsonSize) * 100).toFixed(1)}%`);
      
      // Should achieve at least 50% compression
      expect(encoded.length).toBeLessThan(jsonSize * 0.5);
      
      // Verify it decodes correctly
      const { model: decoded } = decodeModelFromUrl(encoded);
      expect(decoded.components.length).toBe(10);
      expect(decoded.threats?.length).toBe(8);
    });
  });
});

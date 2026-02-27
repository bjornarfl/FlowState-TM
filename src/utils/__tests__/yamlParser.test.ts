import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchYamlContent,
  parseYaml,
  updateYamlField,
  updateYamlTopLevelField,
  updateYamlOptionalTopLevelField,
  modelToYaml,
  normalizeYamlLegacyValues,
} from '../yamlParser';
import type { ThreatModel } from '../../types/threatModel';

describe('yamlParser - Core Functions', () => {
  describe('fetchYamlContent', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn() as any;
    });

    it('should fetch and return YAML content', async () => {
      const mockYaml = 'name: Test Model\nversion: 1.0';
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockYaml,
      });

      const result = await fetchYamlContent('/test.yaml');
      expect(result).toBe(mockYaml);
      expect(globalThis.fetch).toHaveBeenCalledWith('/test.yaml');
    });

    it('should throw error on failed fetch', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(fetchYamlContent('/missing.yaml')).rejects.toThrow(
        'Failed to fetch YAML file: Not Found'
      );
    });
  });

  describe('parseYaml', () => {
    it('should parse valid YAML into ThreatModel', () => {
      const yamlContent = `
schema_version: '1.0'
name: Test Threat Model
description: Test description
components:
  - ref: comp-1
    name: Component 1
    component_type: internal
assets:
  - ref: asset-1
    name: Asset 1
`;

      const result = parseYaml(yamlContent);
      expect(result.name).toBe('Test Threat Model');
      expect(result.schema_version).toBe('1.0');
      expect(result.components).toHaveLength(1);
      expect(result.components[0].ref).toBe('comp-1');
      expect(result.assets).toHaveLength(1);
    });

    it('should handle empty sections', () => {
      const yamlContent = `
schema_version: '1.0'
name: Empty Model
components: []
assets: []
threats: []
`;

      const result = parseYaml(yamlContent);
      expect(result.name).toBe('Empty Model');
      expect(result.schema_version).toBe('1.0');
      expect(result.components).toEqual([]);
      expect(result.assets).toEqual([]);
      expect(result.threats).toEqual([]);
    });
  });

  describe('updateYamlField', () => {
    const basicYaml = `name: Test Model
components:
  - ref: comp-1
    name: Old Name
    type: service
    description: Old description
  - ref: comp-2
    name: Another Component
    type: database
`;

    it('should update a simple string field', () => {
      const result = updateYamlField(basicYaml, 'components', 'comp-1', 'name', 'New Name');
      expect(result).toContain('name: New Name');
      expect(result).not.toContain('name: Old Name');
      expect(result).toContain('comp-2'); // Other items preserved
    });

    it('should update a field with a number', () => {
      const yamlWithNumbers = `components:
  - ref: comp-1
    x: 100
    y: 200
`;
      const result = updateYamlField(yamlWithNumbers, 'components', 'comp-1', 'x', 150);
      expect(result).toContain('x: 150');
      expect(result).not.toContain('x: 100');
    });

    it('should update an inline array field', () => {
      const yamlWithArray = `threats:
  - ref: threat-1
    affected_components: [comp-1, comp-2]
`;
      const result = updateYamlField(
        yamlWithArray,
        'threats',
        'threat-1',
        'affected_components',
        ['comp-1', 'comp-2', 'comp-3']
      );
      expect(result).toContain('affected_components: [comp-1, comp-2, comp-3]');
    });

    it('should add a missing field to an item', () => {
      const yamlMissingField = `components:
  - ref: comp-1
    name: Component 1
`;
      const result = updateYamlField(yamlMissingField, 'components', 'comp-1', 'type', 'service');
      expect(result).toContain('type: service');
      expect(result).toContain('name: Component 1');
    });

    it('should remove a field when value is undefined', () => {
      const result = updateYamlField(basicYaml, 'components', 'comp-1', 'description', undefined);
      expect(result).not.toContain('description: Old description');
      expect(result).toContain('name: Old Name'); // Other fields preserved
    });

    it('should remove a field when value is an empty array', () => {
      const yamlWithArray = `threats:
  - ref: threat-1
    affected_components: [comp-1]
`;
      const result = updateYamlField(yamlWithArray, 'threats', 'threat-1', 'affected_components', []);
      expect(result).not.toContain('affected_components');
    });

    it('should handle fields with special characters requiring quotes', () => {
      const result = updateYamlField(
        basicYaml,
        'components',
        'comp-1',
        'description',
        'Value with: colon and # hash'
      );
      expect(result).toContain('"Value with: colon and # hash"');
    });

    it('should preserve comments and whitespace', () => {
      const yamlWithComments = `components:
  # This is a comment
  - ref: comp-1
    name: Old Name
    # Another comment
    type: service
`;
      const result = updateYamlField(yamlWithComments, 'components', 'comp-1', 'name', 'New Name');
      expect(result).toContain('# This is a comment');
      expect(result).toContain('# Another comment');
      expect(result).toContain('name: New Name');
    });

    it('should return original YAML if section not found', () => {
      const result = updateYamlField(basicYaml, 'nonexistent', 'comp-1', 'name', 'New Name');
      expect(result).toBe(basicYaml);
    });

    it('should return original YAML if item ref not found', () => {
      const result = updateYamlField(basicYaml, 'components', 'nonexistent', 'name', 'New Name');
      expect(result).toBe(basicYaml);
    });

    it('should update field in correct item when multiple items exist', () => {
      const result = updateYamlField(basicYaml, 'components', 'comp-2', 'type', 'cache');
      expect(result).toContain('comp-2');
      expect(result).toContain('type: cache');
      expect(result).toContain('comp-1'); // First item unchanged
      expect(result).toMatch(/comp-1[\s\S]*?type: service/); // comp-1 still has service
    });

    it('should quote values that look like YAML booleans', () => {
      const result = updateYamlField(basicYaml, 'components', 'comp-1', 'name', 'true');
      expect(result).toContain('name: "true"');
    });

    it('should quote values that look like YAML null', () => {
      const result = updateYamlField(basicYaml, 'components', 'comp-1', 'name', 'null');
      expect(result).toContain('name: "null"');
    });

    it('should quote empty strings', () => {
      const result = updateYamlField(basicYaml, 'components', 'comp-1', 'name', '');
      expect(result).toContain('name: ""');
    });
  });

  describe('updateYamlTopLevelField', () => {
    const topLevelYaml = `name: Old Name
version: 1.0
description: Old description
components:
  - ref: comp-1
`;

    it('should update top-level string field', () => {
      const result = updateYamlTopLevelField(topLevelYaml, 'name', 'New Name');
      expect(result).toContain('name: New Name');
      expect(result).not.toContain('name: Old Name');
    });

    it('should update description field', () => {
      const result = updateYamlTopLevelField(topLevelYaml, 'description', 'New description');
      expect(result).toContain('description: New description');
    });

    it('should quote values with special characters', () => {
      const result = updateYamlTopLevelField(topLevelYaml, 'name', 'Name: with colon');
      expect(result).toContain('name: "Name: with colon"');
    });

    it('should preserve other top-level fields', () => {
      const result = updateYamlTopLevelField(topLevelYaml, 'name', 'New Name');
      expect(result).toContain('version: 1.0');
      expect(result).toContain('description: Old description');
      expect(result).toContain('components:');
    });
  });

  describe('updateYamlOptionalTopLevelField', () => {
    const baseYaml = `schema_version: '1.0'
name: Test Model
description: Test description
components:
  - ref: comp-1
`;

    const yamlWithOptionalFields = `schema_version: '1.0'
name: Test Model
description: Test description
owner: test-owner
repository: test-repo
components:
  - ref: comp-1
`;

    it('should add field when it does not exist and value is non-empty', () => {
      const result = updateYamlOptionalTopLevelField(baseYaml, 'owner', 'new-owner');
      expect(result).toContain('owner: new-owner');
      expect(result).toContain('description: Test description');
      expect(result).toContain('components:');
      
      // Field should be added after description
      const ownerIndex = result.indexOf('owner:');
      const descIndex = result.indexOf('description:');
      expect(ownerIndex).toBeGreaterThan(descIndex);
    });

    it('should update field when it exists and value is non-empty', () => {
      const result = updateYamlOptionalTopLevelField(yamlWithOptionalFields, 'owner', 'updated-owner');
      expect(result).toContain('owner: updated-owner');
      expect(result).not.toContain('owner: test-owner');
    });

    it('should remove field when it exists and value is empty', () => {
      const result = updateYamlOptionalTopLevelField(yamlWithOptionalFields, 'owner', '');
      expect(result).not.toContain('owner:');
      expect(result).toContain('repository: test-repo');
      expect(result).toContain('description: Test description');
    });

    it('should remove field when it exists and value is whitespace-only', () => {
      const result = updateYamlOptionalTopLevelField(yamlWithOptionalFields, 'repository', '   ');
      expect(result).not.toContain('repository:');
      expect(result).toContain('owner: test-owner');
    });

    it('should do nothing when field does not exist and value is empty', () => {
      const result = updateYamlOptionalTopLevelField(baseYaml, 'owner', '');
      expect(result).toBe(baseYaml);
    });

    it('should quote values with special characters', () => {
      const result = updateYamlOptionalTopLevelField(baseYaml, 'owner', 'owner: with colon');
      expect(result).toContain('owner: "owner: with colon"');
    });

    it('should handle adding field when no description exists', () => {
      const minimalYaml = `schema_version: '1.0'
name: Test Model
components:
  - ref: comp-1
`;
      const result = updateYamlOptionalTopLevelField(minimalYaml, 'owner', 'test-owner');
      expect(result).toContain('owner: test-owner');
      
      // Field should be added after name
      const ownerIndex = result.indexOf('owner:');
      const nameIndex = result.indexOf('name:');
      expect(ownerIndex).toBeGreaterThan(nameIndex);
    });

    it('should trim whitespace from values before adding', () => {
      const result = updateYamlOptionalTopLevelField(baseYaml, 'owner', '  trimmed-owner  ');
      expect(result).toContain('owner: trimmed-owner');
      expect(result).not.toContain('  trimmed-owner  ');
    });

    it('should remove both owner and repository independently', () => {
      let result = updateYamlOptionalTopLevelField(yamlWithOptionalFields, 'owner', '');
      expect(result).not.toContain('owner:');
      expect(result).toContain('repository: test-repo');
      
      result = updateYamlOptionalTopLevelField(result, 'repository', '');
      expect(result).not.toContain('owner:');
      expect(result).not.toContain('repository:');
      expect(result).toContain('description: Test description');
    });

    it('should add multiple optional fields in sequence', () => {
      let result = updateYamlOptionalTopLevelField(baseYaml, 'owner', 'my-owner');
      result = updateYamlOptionalTopLevelField(result, 'repository', 'my-repo');
      
      expect(result).toContain('owner: my-owner');
      expect(result).toContain('repository: my-repo');
      expect(result).toContain('description: Test description');
    });
  });

  describe('modelToYaml', () => {
    it('should serialize ThreatModel to YAML', () => {
      const model: ThreatModel = {
        schema_version: '1.0',
        name: 'Test Model',
        description: 'Test description',
        components: [
          {
            ref: 'comp-1',
            name: 'Component 1',
            component_type: 'internal',
            x: 100,
            y: 200,
          },
        ],
        assets: [
          {
            ref: 'asset-1',
            name: 'Asset 1',
          },
        ],
        threats: [],
        controls: [],
        data_flows: [],
        boundaries: [],
      };

      const result = modelToYaml(model);
      expect(result).toContain('name: Test Model');
      expect(result).toContain('schema_version:');
      expect(result).toContain('components:');
      expect(result).toContain('ref: comp-1');
      expect(result).toContain('name: Component 1');
      expect(result).toContain('component_type: internal');
    });

    it('should round component positions to integers', () => {
      const model: ThreatModel = {
        schema_version: '1.0',
        name: 'Test',
        components: [
          {
            ref: 'comp-1',
            name: 'Component',
            component_type: 'internal',
            x: 123.456,
            y: 789.123,
          },
        ],
        assets: [],
        threats: [],
        controls: [],
        data_flows: [],
        boundaries: [],
      };

      const result = modelToYaml(model);
      expect(result).toContain('x: 123');
      expect(result).toContain('y: 789');
      expect(result).not.toContain('123.456');
      expect(result).not.toContain('789.123');
    });

    it('should round boundary positions and dimensions', () => {
      const model: ThreatModel = {
        schema_version: '1.0',
        name: 'Test',
        components: [],
        assets: [],
        threats: [],
        controls: [],
        data_flows: [],
        boundaries: [
          {
            ref: 'boundary-1',
            name: 'Boundary',
            x: 50.7,
            y: 100.3,
            width: 300.9,
            height: 200.1,
          },
        ],
      };

      const result = modelToYaml(model);
      expect(result).toContain('x: 51');
      expect(result).toContain('y: 100');
      expect(result).toContain('width: 301');
      expect(result).toContain('height: 200');
    });

    it('should handle empty arrays correctly', () => {
      const model: ThreatModel = {
        schema_version: '1.0',
        name: 'Empty Model',
        components: [],
        assets: [],
        threats: [],
        controls: [],
        data_flows: [],
        boundaries: [],
      };

      const result = modelToYaml(model);
      expect(result).toContain('components: []');
      expect(result).toContain('assets: []');
      expect(result).toContain('threats: []');
    });

    it('should fix y quoting issue', () => {
      const model: ThreatModel = {
        schema_version: '1.0',
        name: 'Test',
        components: [
          {
            ref: 'comp-1',
            name: 'Component',
            component_type: 'internal',
            y: 100,
          },
        ],
        assets: [],
        threats: [],
        controls: [],
        data_flows: [],
        boundaries: [],
      };

      const result = modelToYaml(model);
      expect(result).toContain('y: 100');
      expect(result).not.toContain("'y': 100");
    });

    it('should serialize inline arrays correctly', () => {
      const model: ThreatModel = {
        schema_version: '1.0',
        name: 'Test',
        components: [],
        assets: [],
        threats: [
          {
            ref: 'threat-1',
            name: 'Threat',
            affected_components: ['comp-1', 'comp-2'],
          },
        ],
        controls: [],
        data_flows: [],
        boundaries: [],
      };

      const result = modelToYaml(model);
      // Arrays should be serialized in inline format [item1,item2]
      expect(result).toContain('affected_components: [comp-1,comp-2]');
      expect(result).not.toMatch(/affected_components:\s*\n\s*- comp-1/);
    });
  });

  describe('parseYaml - numeric string handling', () => {
    it('should parse numeric strings as strings not numbers', () => {
      const yamlContent = `
schema_version: '1.0'
name: 2024
description: 123
components:
  - ref: comp-1
    name: 456
    component_type: internal
    description: 789
assets:
  - ref: asset-1
    name: 2023
    description: 999
`;

      const result = parseYaml(yamlContent);
      
      // These should all be strings, not numbers
      expect(typeof result.name).toBe('string');
      expect(result.name).toBe('2024');
      expect(typeof result.description).toBe('string');
      expect(result.description).toBe('123');
      
      expect(typeof result.components[0].name).toBe('string');
      expect(result.components[0].name).toBe('456');
      expect(typeof result.components[0].description).toBe('string');
      expect(result.components[0].description).toBe('789');
      
      expect(result.assets).toBeDefined();
      expect(typeof result.assets![0].name).toBe('string');
      expect(result.assets![0].name).toBe('2023');
      expect(typeof result.assets![0].description).toBe('string');
      expect(result.assets![0].description).toBe('999');
    });

    it('should handle mixed numeric and text values', () => {
      const yamlContent = `
schema_version: '1.0'
name: Project 2024
components:
  - ref: comp-1
    name: 100
    component_type: internal
  - ref: comp-2
    name: Component 200
    component_type: external_dependency
`;

      const result = parseYaml(yamlContent);
      expect(typeof result.components[0].name).toBe('string');
      expect(result.components[0].name).toBe('100');
      expect(typeof result.components[1].name).toBe('string');
      expect(result.components[1].name).toBe('Component 200');
    });

    it('should preserve numeric coordinates while keeping string names as strings', () => {
      const yamlContent = `
schema_version: '1.0'
name: TM Title
components:
  - ref: component-1
    name: 1
    component_type: internal
    x: 144
    y: 233
    description: 1
boundaries:
  - ref: boundary-1
    name: 1
    x: 330
    y: 267
    width: 150
    height: 75
    description: 1
`;

      const result = parseYaml(yamlContent);
      
      // Names and descriptions should be strings even when they're numeric
      expect(typeof result.name).toBe('string');
      expect(typeof result.components[0].name).toBe('string');
      expect(result.components[0].name).toBe('1');
      expect(typeof result.components[0].description).toBe('string');
      expect(result.components[0].description).toBe('1');
      
      // Coordinates should be numbers
      expect(typeof result.components[0].x).toBe('number');
      expect(result.components[0].x).toBe(144);
      expect(typeof result.components[0].y).toBe('number');
      expect(result.components[0].y).toBe(233);
      
      // Boundary dimensions should be numbers
      expect(result.boundaries).toBeDefined();
      expect(typeof result.boundaries![0].x).toBe('number');
      expect(result.boundaries![0].x).toBe(330);
      expect(typeof result.boundaries![0].width).toBe('number');
      expect(result.boundaries![0].width).toBe(150);
      expect(typeof result.boundaries![0].height).toBe('number');
      expect(result.boundaries![0].height).toBe(75);
    });
  });

  describe('legacy value normalization (backwards compatibility)', () => {
    it('should normalize external_dependency to external in parsed model', () => {
      const yamlContent = `
schema_version: '1.0'
name: Legacy Model
components:
  - ref: ext-svc
    name: External Service
    component_type: external_dependency
`;
      const result = parseYaml(yamlContent);
      expect(result.components[0].component_type).toBe('external');
    });

    it('should normalize external_dependency to external in raw YAML strings', () => {
      const yaml = `components:
  - ref: ext-svc
    name: External Service
    component_type: external_dependency
  - ref: int-svc
    name: Internal Service
    component_type: internal`;

      const normalized = normalizeYamlLegacyValues(yaml);
      expect(normalized).toContain('component_type: external');
      expect(normalized).not.toContain('external_dependency');
      expect(normalized).toContain('component_type: internal');
    });

    it('should not alter non-legacy values', () => {
      const yaml = `components:
  - ref: svc
    name: Service
    component_type: external`;

      const normalized = normalizeYamlLegacyValues(yaml);
      expect(normalized).toBe(yaml);
    });
  });
});

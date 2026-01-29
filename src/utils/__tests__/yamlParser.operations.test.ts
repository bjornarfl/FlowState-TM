import { describe, it, expect } from 'vitest';
import {
  renameDataFlowRef,
  removeRefFromArrayFields,
  appendYamlItem,
  removeYamlItem,
} from '../yamlParser';

describe('yamlParser - Item Operations', () => {
  describe('renameDataFlowRef', () => {
    it('should rename a data flow ref field', () => {
      const yaml = `data_flows:
  - ref: old-flow
    source: comp-1
    destination: comp-2
`;
      const result = renameDataFlowRef(yaml, 'old-flow', 'new-flow');
      expect(result).toContain('ref: new-flow');
      expect(result).not.toContain('ref: old-flow');
    });

    it('should rename refs in affected_data_flows inline arrays', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_data_flows: [flow-1, old-flow, flow-2]
`;
      const result = renameDataFlowRef(yaml, 'old-flow', 'new-flow');
      expect(result).toContain('affected_data_flows: [flow-1, new-flow, flow-2]');
    });

    it('should rename refs in multiline arrays', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_data_flows:
      - flow-1
      - old-flow
      - flow-2
`;
      const result = renameDataFlowRef(yaml, 'old-flow', 'new-flow');
      expect(result).toContain('- new-flow');
      expect(result).not.toContain('- old-flow');
    });

    it('should handle multiple occurrences', () => {
      const yaml = `data_flows:
  - ref: old-flow
    source: comp-1
threats:
  - ref: threat-1
    affected_data_flows: [old-flow, flow-2]
  - ref: threat-2
    affected_data_flows:
      - old-flow
`;
      const result = renameDataFlowRef(yaml, 'old-flow', 'new-flow');
      const occurrences = (result.match(/new-flow/g) || []).length;
      expect(occurrences).toBe(3);
      expect(result).not.toContain('old-flow');
    });

    it('should return unchanged YAML if old and new refs are the same', () => {
      const yaml = `data_flows:
  - ref: flow-1
`;
      const result = renameDataFlowRef(yaml, 'flow-1', 'flow-1');
      expect(result).toBe(yaml);
    });

    it('should not rename similar refs', () => {
      const yaml = `data_flows:
  - ref: flow-1
  - ref: flow-10
  - ref: flow-100
`;
      const result = renameDataFlowRef(yaml, 'flow-1', 'new-flow');
      expect(result).toContain('ref: new-flow');
      expect(result).toContain('ref: flow-10');
      expect(result).toContain('ref: flow-100');
    });

    it('should handle quoted refs', () => {
      const yaml = `data_flows:
  - ref: "old-flow"
    source: comp-1
`;
      const result = renameDataFlowRef(yaml, 'old-flow', 'new-flow');
      expect(result).toContain('ref: new-flow');
    });

    it('should preserve indentation and formatting', () => {
      const yaml = `data_flows:
  - ref: old-flow
    source: comp-1
    destination: comp-2
    label: Test Flow
`;
      const result = renameDataFlowRef(yaml, 'old-flow', 'new-flow');
      expect(result).toContain('  - ref: new-flow');
      expect(result).toContain('    source: comp-1');
    });
  });

  describe('removeRefFromArrayFields', () => {
    it('should remove ref from inline array', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: [comp-1, comp-2, comp-3]
`;
      const result = removeRefFromArrayFields(yaml, 'comp-2', ['affected_components']);
      expect(result).toContain('affected_components: [comp-1, comp-3]');
      expect(result).not.toContain('comp-2');
    });

    it('should remove entire field if array becomes empty', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: [comp-1]
`;
      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).not.toContain('affected_components');
    });

    it('should remove ref from multiline array', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components:
      - comp-1
      - comp-2
      - comp-3
`;
      const result = removeRefFromArrayFields(yaml, 'comp-2', ['affected_components']);
      expect(result).not.toContain('- comp-2');
      expect(result).toContain('- comp-1');
      expect(result).toContain('- comp-3');
    });

    it('should handle multiple field names', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: [comp-1, comp-2]
controls:
  - ref: control-1
    implemented_in: [comp-1, comp-2]
    mitigates: [threat-1]
`;
      const result = removeRefFromArrayFields(yaml, 'comp-2', [
        'affected_components',
        'implemented_in',
      ]);
      expect(result).toContain('affected_components: [comp-1]');
      expect(result).toContain('implemented_in: [comp-1]');
      expect(result).toContain('mitigates: [threat-1]'); // Not affected
    });

    it('should handle quoted refs in arrays', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: ["comp-1", "comp-2", "comp-3"]
`;
      const result = removeRefFromArrayFields(yaml, 'comp-2', ['affected_components']);
      expect(result).not.toContain('comp-2');
      expect(result).toContain('comp-1');
    });

    it('should preserve empty array notation', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: []
`;
      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).toContain('affected_components: []');
    });

    it('should not remove refs from non-matching field names', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: [comp-1]
    affected_data_flows: [comp-1]
`;
      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).not.toContain('affected_components');
      expect(result).toContain('affected_data_flows: [comp-1]');
    });
  });

  describe('appendYamlItem', () => {
    it('should append item to existing section', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
`;
      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
        component_type: 'internal',
      };
      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('ref: comp-1');
      expect(result).toContain('ref: comp-2');
      expect(result).toContain('name: Component 2');
    });

    it('should append to section with empty array notation', () => {
      const yaml = `components: []
assets:
  - ref: asset-1
`;
      const newItem = {
        ref: 'comp-1',
        name: 'Component 1',
        component_type: 'internal',
      };
      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('components:');
      expect(result).not.toContain('components: []');
      expect(result).toContain('ref: comp-1');
    });

    it('should create new section if it does not exist', () => {
      const yaml = `name: Test Model
components:
  - ref: comp-1
`;
      const newItem = {
        ref: 'threat-1',
        name: 'Threat 1',
      };
      const result = appendYamlItem(yaml, 'threats', newItem);
      expect(result).toContain('threats:');
      expect(result).toContain('ref: threat-1');
    });

    it('should maintain proper indentation', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
`;
      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
      };
      const result = appendYamlItem(yaml, 'components', newItem);
      const lines = result.split('\n');
      const comp2RefLine = lines.find(l => l.includes('ref: comp-2'));
      // eslint-disable-next-line no-regex-spaces
      expect(comp2RefLine).toMatch(/^  - ref: comp-2/);
    });

    it('should handle items with nested fields', () => {
      const yaml = `components: []
`;
      const newItem = {
        ref: 'comp-1',
        name: 'Component 1',
        component_type: 'internal',
        x: 100,
        y: 200,
      };
      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('ref: comp-1');
      expect(result).toContain('name: Component 1');
      expect(result).toContain('x: 100');
      expect(result).toContain('y: 200');
    });

    it('should handle items with array fields', () => {
      const yaml = `threats: []
`;
      const newItem = {
        ref: 'threat-1',
        name: 'Threat 1',
        affected_components: ['comp-1', 'comp-2'],
      };
      const result = appendYamlItem(yaml, 'threats', newItem);
      expect(result).toContain('ref: threat-1');
      expect(result).toContain('affected_components:');
    });

    it('should preserve existing items and comments', () => {
      const yaml = `components:
  # Main component
  - ref: comp-1
    name: Component 1
`;
      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
        component_type: 'internal',
      };
      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('# Main component');
      expect(result).toContain('ref: comp-1');
      expect(result).toContain('ref: comp-2');
    });

    it('should handle multiline values in existing items', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
    description: |
      This is a multiline
      description
`;
      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
        component_type: 'internal',
      };
      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('description: |');
      expect(result).toContain('This is a multiline');
      expect(result).toContain('ref: comp-2');
    });
  });

  describe('removeYamlItem', () => {
    it('should remove item from section', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
  - ref: comp-2
    name: Component 2
`;
      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).toContain('comp-2');
    });

    it('should remove all fields of the item', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
    component_type: internal
    x: 100
    y: 200
  - ref: comp-2
    name: Component 2
`;
      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).not.toContain('Component 1');
      expect(result).not.toContain('x: 100');
      expect(result).toContain('comp-2');
    });

    it('should preserve other sections', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
assets:
  - ref: asset-1
    name: Asset 1
`;
      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).toContain('assets:');
      expect(result).toContain('asset-1');
    });

    it('should handle removing first item', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
  - ref: comp-2
    name: Component 2
  - ref: comp-3
    name: Component 3
`;
      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).toContain('comp-2');
      expect(result).toContain('comp-3');
    });

    it('should handle removing last item', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
  - ref: comp-2
    name: Component 2
`;
      const result = removeYamlItem(yaml, 'components', 'comp-2');
      expect(result).toContain('comp-1');
      expect(result).not.toContain('comp-2');
    });

    it('should handle removing middle item', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
  - ref: comp-2
    name: Component 2
  - ref: comp-3
    name: Component 3
`;
      const result = removeYamlItem(yaml, 'components', 'comp-2');
      expect(result).toContain('comp-1');
      expect(result).not.toContain('comp-2');
      expect(result).toContain('comp-3');
    });

    it('should preserve comments', () => {
      const yaml = `components:
  # Important component
  - ref: comp-1
    name: Component 1
  - ref: comp-2
    name: Component 2
`;
      const result = removeYamlItem(yaml, 'components', 'comp-2');
      expect(result).toContain('# Important component');
      expect(result).toContain('comp-1');
    });

    it('should handle item with array fields', () => {
      const yaml = `threats:
  - ref: threat-1
    name: Threat 1
    affected_components: [comp-1, comp-2]
  - ref: threat-2
    name: Threat 2
`;
      const result = removeYamlItem(yaml, 'threats', 'threat-1');
      expect(result).not.toContain('threat-1');
      expect(result).not.toContain('affected_components');
      expect(result).toContain('threat-2');
    });

    it('should handle item with multiline values', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
    description: |
      This is a multiline
      description
  - ref: comp-2
    name: Component 2
`;
      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).not.toContain('This is a multiline');
      expect(result).toContain('comp-2');
    });

    it('should return unchanged YAML if ref not found', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
`;
      const result = removeYamlItem(yaml, 'components', 'nonexistent');
      expect(result).toBe(yaml);
    });

    it('should return unchanged YAML if section not found', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
`;
      const result = removeYamlItem(yaml, 'nonexistent', 'comp-1');
      expect(result).toBe(yaml);
    });
  });
});

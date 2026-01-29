import { describe, it, expect } from 'vitest';
import {
  appendYamlItem,
  removeYamlItem,
  renameDataFlowRef,
  removeRefFromArrayFields,
  updateYamlField,
} from '../yamlParser';

describe('yamlParser - Item Operations', () => {
  describe('appendYamlItem', () => {
    it('should append item to existing section with items', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
    type: service
assets:
  - ref: asset-1
    name: Asset 1
`;

      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
        type: 'database',
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('comp-1');
      expect(result).toContain('comp-2');
      expect(result).toContain('Component 2');
      expect(result).toContain('type: database');
      expect(result).toContain('asset-1'); // Other sections preserved
    });

    it('should append item to empty section with empty array notation', () => {
      const yaml = `name: Test
components: []
assets:
  - ref: asset-1
`;

      const newItem = {
        ref: 'comp-1',
        name: 'First Component',
        type: 'service',
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('components:');
      expect(result).not.toContain('components: []');
      expect(result).toContain('comp-1');
      expect(result).toContain('First Component');
    });

    it('should append item to section with no existing items', () => {
      const yaml = `name: Test
components:
assets:
  - ref: asset-1
`;

      const newItem = {
        ref: 'comp-1',
        name: 'Component',
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('components:');
      expect(result).toContain('comp-1');
    });

    it('should create new section if it does not exist', () => {
      const yaml = `name: Test
components:
  - ref: comp-1
`;

      const newItem = {
        ref: 'asset-1',
        name: 'Asset 1',
        classification: 'confidential',
      };

      const result = appendYamlItem(yaml, 'assets', newItem);
      expect(result).toContain('assets:');
      expect(result).toContain('asset-1');
      expect(result).toContain('Asset 1');
      expect(result).toContain('classification: confidential');
    });

    it('should handle items with array fields', () => {
      const yaml = `threats:
  - ref: threat-1
    name: Threat 1
`;

      const newItem = {
        ref: 'threat-2',
        name: 'Threat 2',
        affected_components: ['comp-1', 'comp-2'],
      };

      const result = appendYamlItem(yaml, 'threats', newItem);
      expect(result).toContain('threat-2');
      expect(result).toContain('affected_components: [comp-1, comp-2]');
    });

    it('should skip undefined and null values', () => {
      const yaml = `components:
  - ref: comp-1
`;

      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
        description: undefined,
        notes: null,
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('comp-2');
      expect(result).toContain('Component 2');
      expect(result).not.toContain('description');
      expect(result).not.toContain('notes');
    });

    it('should skip empty arrays', () => {
      const yaml = `threats:
  - ref: threat-1
`;

      const newItem = {
        ref: 'threat-2',
        name: 'Threat 2',
        affected_components: [],
      };

      const result = appendYamlItem(yaml, 'threats', newItem);
      expect(result).toContain('threat-2');
      expect(result).not.toContain('affected_components');
    });

    it('should preserve indentation of existing items', () => {
      const yaml = `  components:
    - ref: comp-1
      name: Component 1
`;

      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toMatch(/\s{4}- ref: comp-2/); // 4 spaces before dash
    });

    it('should handle numeric values', () => {
      const yaml = `components:
  - ref: comp-1
`;

      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
        x: 100,
        y: 200,
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('x: 100');
      expect(result).toContain('y: 200');
    });

    it('should handle multiline string values with pipe style', () => {
      const yaml = `components:
  - ref: comp-1
`;

      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
        description: 'Line 1\nLine 2\nLine 3',
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('description: |');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });

    it('should preserve comments in YAML', () => {
      const yaml = `# Header comment
components:
  # Section comment
  - ref: comp-1
    name: Component 1
# Footer comment
`;

      const newItem = {
        ref: 'comp-2',
        name: 'Component 2',
      };

      const result = appendYamlItem(yaml, 'components', newItem);
      expect(result).toContain('# Header comment');
      expect(result).toContain('# Section comment');
      expect(result).toContain('# Footer comment');
    });
  });

  describe('removeYamlItem', () => {
    it('should remove item from section', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
    type: service
  - ref: comp-2
    name: Component 2
    type: database
  - ref: comp-3
    name: Component 3
`;

      const result = removeYamlItem(yaml, 'components', 'comp-2');
      expect(result).toContain('comp-1');
      expect(result).toContain('comp-3');
      expect(result).not.toContain('comp-2');
      expect(result).not.toContain('Component 2');
      expect(result).not.toContain('type: database');
    });

    it('should remove item with multiline fields', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
    description: |
      Line 1
      Line 2
  - ref: comp-2
    name: Component 2
`;

      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).not.toContain('Component 1');
      expect(result).not.toContain('Line 1');
      expect(result).not.toContain('Line 2');
      expect(result).toContain('comp-2');
    });

    it('should remove item with array fields', () => {
      const yaml = `threats:
  - ref: threat-1
    name: Threat 1
    affected_components: [comp-1, comp-2, comp-3]
  - ref: threat-2
    name: Threat 2
`;

      const result = removeYamlItem(yaml, 'threats', 'threat-1');
      expect(result).not.toContain('threat-1');
      expect(result).not.toContain('affected_components');
      expect(result).toContain('threat-2');
    });

    it('should handle removing first item', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
  - ref: comp-2
    name: Component 2
`;

      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).toContain('comp-2');
      expect(result).toContain('components:');
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

    it('should remove item and associated content', () => {
      const yaml = `components:
  # Important comment
  - ref: comp-1
    name: Component 1
  # Comment to keep
  - ref: comp-2
    name: Component 2
`;

      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).toContain('comp-2');
      // Note: Comments between items may be removed with the item
    });

    it('should not affect other sections', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
assets:
  - ref: asset-1
    name: Asset 1
`;

      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).toContain('asset-1');
      expect(result).toContain('assets:');
    });

    it('should return original if item not found', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
`;

      const result = removeYamlItem(yaml, 'components', 'nonexistent');
      expect(result).toBe(yaml);
    });

    it('should return original if section not found', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
`;

      const result = removeYamlItem(yaml, 'nonexistent', 'comp-1');
      expect(result).toBe(yaml);
    });

    it('should add empty array notation when removing the only item', () => {
      const yaml = `name: Test Model
assets:
  - ref: asset-1
    name: Asset 1
    description: Only asset
threats:
  - ref: threat-1
    name: Threat 1
controls:
  - ref: control-1
    name: Control 1
`;

      // Remove the only asset
      const result = removeYamlItem(yaml, 'assets', 'asset-1');
      expect(result).not.toContain('asset-1');
      expect(result).toContain('assets: []');
      expect(result).toContain('threats:');
      expect(result).toContain('threat-1');
    });

    it('should add empty array notation when removing last remaining item', () => {
      const yaml = `components:
  - ref: comp-1
    name: Component 1
`;

      const result = removeYamlItem(yaml, 'components', 'comp-1');
      expect(result).not.toContain('comp-1');
      expect(result).toContain('components: []');
      expect(result).not.toMatch(/components:\s*$/m); // Should not have empty section
    });

    it('should preserve root-level comments after blank line when removing last item', () => {
      const yaml = `name: Test Model
assets:
  - ref: asset-1
    name: Asset 1

# This comment is after a blank line and at root level
# It should belong to the next section
threats:
  - ref: threat-1
    name: Threat 1
`;

      const result = removeYamlItem(yaml, 'assets', 'asset-1');
      expect(result).not.toContain('asset-1');
      expect(result).toContain('assets: []');
      expect(result).toContain('# This comment is after a blank line and at root level');
      expect(result).toContain('# It should belong to the next section');
      expect(result).toContain('threats:');
      expect(result).toContain('threat-1');
    });

    it('should preserve section that immediately follows when removing last item', () => {
      const yaml = `assets:
  - ref: asset-1
    name: Asset 1
threats:
  - ref: threat-1
    name: Threat 1
`;

      const result = removeYamlItem(yaml, 'assets', 'asset-1');
      expect(result).not.toContain('asset-1');
      expect(result).toContain('assets: []');
      expect(result).toContain('threats:');
      expect(result).toContain('threat-1');
    });

    it('should not accumulate whitespace after multiple add/delete cycles', () => {
      const initialYaml = `name: Test Model
components:
  - ref: comp-1
    name: Component 1
threats: []
`;

      // Add an item
      let yaml = appendYamlItem(initialYaml, 'threats', { ref: 'threat-1', name: 'Threat 1' });
      // Remove the item
      yaml = removeYamlItem(yaml, 'threats', 'threat-1');
      
      // Add again
      yaml = appendYamlItem(yaml, 'threats', { ref: 'threat-2', name: 'Threat 2' });
      // Remove again
      yaml = removeYamlItem(yaml, 'threats', 'threat-2');
      
      // After normalization, there should be exactly one blank line between sections
      // (between the components section and threats section)
      const blankLineCount = (yaml.match(/\n\n/g) || []).length;
      expect(blankLineCount).toBe(1);
      
      // The result should be stable - running it again should produce the same result
      const yaml2 = appendYamlItem(yaml, 'threats', { ref: 'threat-3', name: 'Threat 3' });
      const yaml3 = removeYamlItem(yaml2, 'threats', 'threat-3');
      expect(yaml3).toBe(yaml);
    });
  });

  describe('renameDataFlowRef', () => {
    it('should rename data flow ref in data_flows section', () => {
      const yaml = `data_flows:
  - ref: df-1
    name: Data Flow 1
    from: comp-1
    to: comp-2
  - ref: df-2
    name: Data Flow 2
`;

      const result = renameDataFlowRef(yaml, 'df-1', 'df-new');
      expect(result).toContain('ref: df-new');
      expect(result).not.toContain('ref: df-1');
      expect(result).toContain('df-2'); // Other items preserved
    });

    it('should update references in affected_data_flows inline arrays', () => {
      const yaml = `threats:
  - ref: threat-1
    name: Threat 1
    affected_data_flows: [df-1, df-2]
  - ref: threat-2
    name: Threat 2
    affected_data_flows: [df-3, df-1, df-4]
`;

      const result = renameDataFlowRef(yaml, 'df-1', 'df-new');
      expect(result).toContain('affected_data_flows: [df-new, df-2]');
      expect(result).toContain('affected_data_flows: [df-3, df-new, df-4]');
    });

    it('should update references in multiline affected_data_flows arrays', () => {
      const yaml = `threats:
  - ref: threat-1
    name: Threat 1
    affected_data_flows:
      - df-1
      - df-2
`;

      const result = renameDataFlowRef(yaml, 'df-1', 'df-new');
      expect(result).toContain('- df-new');
      expect(result).not.toMatch(/^\s*- df-1$/m);
      expect(result).toContain('- df-2');
    });

    it('should handle quoted refs', () => {
      const yaml = `data_flows:
  - ref: "df-1"
    name: Data Flow
`;

      const result = renameDataFlowRef(yaml, 'df-1', 'df-new');
      expect(result).toContain('ref: df-new');
      expect(result).not.toContain('df-1');
    });

    it('should not modify unrelated refs', () => {
      const yaml = `data_flows:
  - ref: df-1
    name: Flow 1
  - ref: df-10
    name: Flow 10
  - ref: df-100
    name: Flow 100
`;

      const result = renameDataFlowRef(yaml, 'df-1', 'df-new');
      expect(result).toContain('ref: df-new');
      expect(result).toContain('ref: df-10'); // Not affected
      expect(result).toContain('ref: df-100'); // Not affected
    });

    it('should return unchanged if old and new ref are the same', () => {
      const yaml = `data_flows:
  - ref: df-1
    name: Flow
`;

      const result = renameDataFlowRef(yaml, 'df-1', 'df-1');
      expect(result).toBe(yaml);
    });

    it('should handle refs with special characters', () => {
      const yaml = `data_flows:
  - ref: df-user:login
    name: Flow
`;

      const result = renameDataFlowRef(yaml, 'df-user:login', 'df-auth');
      expect(result).toContain('ref: df-auth');
      expect(result).not.toContain('df-user:login');
    });
  });

  describe('removeRefFromArrayFields', () => {
    it('should remove ref from inline array field', () => {
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
    name: Threat
    affected_components: [comp-1]
`;

      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).not.toContain('affected_components');
      expect(result).toContain('name: Threat');
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
      expect(result).toContain('- comp-1');
      expect(result).toContain('- comp-3');
      expect(result).not.toContain('- comp-2');
    });

    it('should handle multiple field names', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: [comp-1, comp-2]
  - ref: threat-2
    affected_data_flows: [df-1, df-2]
controls:
  - ref: ctrl-1
    implemented_in: [comp-1, comp-3]
`;

      const result = removeRefFromArrayFields(yaml, 'comp-1', [
        'affected_components',
        'implemented_in',
      ]);
      expect(result).toContain('affected_components: [comp-2]');
      expect(result).toContain('affected_data_flows: [df-1, df-2]'); // Not affected
      expect(result).toContain('implemented_in: [comp-3]');
    });

    it('should preserve empty arrays that do not contain the ref', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: []
`;

      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).toContain('affected_components: []');
    });

    it('should handle refs with quotes', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: ["comp-1", "comp-2"]
`;

      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).toContain('affected_components: [comp-2]');
    });

    it('should not modify non-array fields', () => {
      const yaml = `threats:
  - ref: threat-1
    name: comp-1
    affected_components: [comp-1, comp-2]
`;

      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).toContain('name: comp-1'); // Name field not affected
      expect(result).toContain('affected_components: [comp-2]');
    });

    it('should handle multiple occurrences across items', () => {
      const yaml = `threats:
  - ref: threat-1
    affected_components: [comp-1, comp-2]
  - ref: threat-2
    affected_components: [comp-1, comp-3]
  - ref: threat-3
    affected_components: [comp-4, comp-1]
`;

      const result = removeRefFromArrayFields(yaml, 'comp-1', ['affected_components']);
      expect(result).toContain('threat-1');
      expect(result).toContain('affected_components: [comp-2]');
      expect(result).toContain('affected_components: [comp-3]');
      expect(result).toContain('affected_components: [comp-4]');
      expect(result).not.toMatch(/affected_components:.*comp-1/);
    });
  });

  describe('updateYamlField - last item in section bug fix', () => {
    it('should add components field to last boundary without affecting other sections', () => {
      const yaml = `name: Test Model
boundaries:
  - ref: boundary-1
    name: First Boundary
    description: First
  - ref: boundary-2
    name: Second Boundary
    description: Second
  - ref: boundary-3
    name: Last Boundary
    description: Last
components:
  - ref: comp-1
    name: Component 1
assets:
  - ref: asset-1
    name: Asset 1
`;

      const result = updateYamlField(yaml, 'boundaries', 'boundary-3', 'components', ['comp-1']);
      
      // The components field should be added to boundary-3
      expect(result).toContain('boundary-3');
      expect(result).toMatch(/boundary-3[\s\S]*?components: \[comp-1\]/);
      
      // The components section should remain unchanged
      expect(result).toContain('components:');
      expect(result).toMatch(/components:\s+- ref: comp-1/);
      
      // Assets section should remain unchanged
      expect(result).toContain('assets:');
      expect(result).toContain('asset-1');
      
      // Verify the field wasn't added to the end of the file
      const lines = result.split('\n');
      const boundary3Index = lines.findIndex(line => line.includes('boundary-3'));
      const componentsFieldIndex = lines.findIndex((line, idx) => 
        idx > boundary3Index && line.includes('components: [comp-1]')
      );
      const componentsSectionIndex = lines.findIndex(line => line.match(/^components:/));
      
      // The boundary's components field should appear before the components section
      expect(componentsFieldIndex).toBeGreaterThan(boundary3Index);
      expect(componentsFieldIndex).toBeLessThan(componentsSectionIndex);
    });

    it('should update field on last boundary when other boundaries have the field', () => {
      const yaml = `boundaries:
  - ref: boundary-1
    name: First
    components: [comp-1]
  - ref: boundary-2
    name: Second
    components: [comp-2]
  - ref: boundary-3
    name: Last
components:
  - ref: comp-1
  - ref: comp-2
  - ref: comp-3
`;

      const result = updateYamlField(yaml, 'boundaries', 'boundary-3', 'components', ['comp-3']);
      
      expect(result).toContain('boundary-3');
      expect(result).toMatch(/boundary-3[\s\S]*?components: \[comp-3\]/);
      
      // Components section should still exist
      expect(result).toContain('components:');
      expect(result).toContain('comp-1');
      expect(result).toContain('comp-2');
      
      // Verify the new field is added before the components section
      const lines = result.split('\n');
      const boundary3Index = lines.findIndex(line => line.includes('boundary-3'));
      const newComponentsFieldIndex = lines.findIndex((line, idx) => 
        idx > boundary3Index && line.includes('components: [comp-3]')
      );
      const componentsSectionIndex = lines.findIndex(line => line.match(/^components:/));
      
      expect(newComponentsFieldIndex).toBeGreaterThan(boundary3Index);
      expect(newComponentsFieldIndex).toBeLessThan(componentsSectionIndex);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { reorderYamlSection } from '../yamlParser';

describe('yamlParser - reorderYamlSection', () => {
  describe('basic reordering', () => {
    it('should swap two items in a section', () => {
      const yaml = `assets:
  - ref: asset-1
    name: Asset One
  - ref: asset-2
    name: Asset Two
`;

      const result = reorderYamlSection(yaml, 'assets', ['asset-2', 'asset-1']);
      const lines = result.split('\n');
      const idx1 = lines.findIndex((l) => l.includes('ref: asset-2'));
      const idx2 = lines.findIndex((l) => l.includes('ref: asset-1'));
      expect(idx1).toBeLessThan(idx2);
      expect(result).toContain('name: Asset One');
      expect(result).toContain('name: Asset Two');
    });

    it('should reorder three items', () => {
      const yaml = `components:
  - ref: comp-a
    name: Alpha
  - ref: comp-b
    name: Bravo
  - ref: comp-c
    name: Charlie
`;

      const result = reorderYamlSection(yaml, 'components', [
        'comp-c',
        'comp-a',
        'comp-b',
      ]);
      const lines = result.split('\n');
      const idxC = lines.findIndex((l) => l.includes('ref: comp-c'));
      const idxA = lines.findIndex((l) => l.includes('ref: comp-a'));
      const idxB = lines.findIndex((l) => l.includes('ref: comp-b'));
      expect(idxC).toBeLessThan(idxA);
      expect(idxA).toBeLessThan(idxB);
    });

    it('should return unchanged YAML when order is the same', () => {
      const yaml = `assets:
  - ref: asset-1
    name: First
  - ref: asset-2
    name: Second
`;

      const result = reorderYamlSection(yaml, 'assets', ['asset-1', 'asset-2']);
      expect(result).toContain('ref: asset-1');
      expect(result).toContain('ref: asset-2');
      // asset-1 still before asset-2
      const lines = result.split('\n');
      const idx1 = lines.findIndex((l) => l.includes('ref: asset-1'));
      const idx2 = lines.findIndex((l) => l.includes('ref: asset-2'));
      expect(idx1).toBeLessThan(idx2);
    });
  });

  describe('section not found', () => {
    it('should return unchanged YAML if section does not exist', () => {
      const yaml = `assets:
  - ref: asset-1
    name: Asset One
`;
      const result = reorderYamlSection(yaml, 'nonexistent', ['asset-1']);
      expect(result).toBe(yaml);
    });
  });

  describe('single item', () => {
    it('should handle a section with only one item', () => {
      const yaml = `threats:
  - ref: threat-1
    name: Only Threat
    severity: high
`;

      const result = reorderYamlSection(yaml, 'threats', ['threat-1']);
      expect(result).toContain('ref: threat-1');
      expect(result).toContain('name: Only Threat');
      expect(result).toContain('severity: high');
    });
  });

  describe('preserving other sections', () => {
    it('should not affect sections before or after the reordered one', () => {
      const yaml = `name: My Model
description: A test model

assets:
  - ref: asset-1
    name: First Asset
  - ref: asset-2
    name: Second Asset

components:
  - ref: comp-1
    name: Component 1

threats:
  - ref: threat-1
    name: Threat 1
`;

      const result = reorderYamlSection(yaml, 'assets', ['asset-2', 'asset-1']);
      // Other sections still present and unchanged
      expect(result).toContain('name: My Model');
      expect(result).toContain('description: A test model');
      expect(result).toContain('ref: comp-1');
      expect(result).toContain('ref: threat-1');

      // Assets reordered
      const lines = result.split('\n');
      const idx2 = lines.findIndex((l) => l.includes('ref: asset-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: asset-1'));
      expect(idx2).toBeLessThan(idx1);
    });

    it('should reorder a middle section without affecting neighbours', () => {
      const yaml = `assets:
  - ref: asset-1
    name: Asset 1

components:
  - ref: comp-a
    name: Alpha
  - ref: comp-b
    name: Bravo

threats:
  - ref: threat-1
    name: Threat 1
`;

      const result = reorderYamlSection(yaml, 'components', ['comp-b', 'comp-a']);
      const lines = result.split('\n');
      const idxB = lines.findIndex((l) => l.includes('ref: comp-b'));
      const idxA = lines.findIndex((l) => l.includes('ref: comp-a'));
      expect(idxB).toBeLessThan(idxA);
      expect(result).toContain('ref: asset-1');
      expect(result).toContain('ref: threat-1');
    });
  });

  describe('multiline and pipe-block values', () => {
    it('should preserve pipe-block content when reordering', () => {
      const yaml = `threats:
  - ref: threat-1
    name: First Threat
    description: |
      This is a multiline
      description for threat 1.
  - ref: threat-2
    name: Second Threat
    description: |
      Another multiline
      description for threat 2.
`;

      const result = reorderYamlSection(yaml, 'threats', ['threat-2', 'threat-1']);
      const lines = result.split('\n');
      const idx2 = lines.findIndex((l) => l.includes('ref: threat-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: threat-1'));
      expect(idx2).toBeLessThan(idx1);
      expect(result).toContain('This is a multiline');
      expect(result).toContain('description for threat 1.');
      expect(result).toContain('Another multiline');
      expect(result).toContain('description for threat 2.');
    });

    it('should preserve pipe-strip (|-) blocks', () => {
      const yaml = `controls:
  - ref: ctrl-1
    name: Control 1
    description: |-
      Strip trailing newline
      from this block.
  - ref: ctrl-2
    name: Control 2
`;

      const result = reorderYamlSection(yaml, 'controls', ['ctrl-2', 'ctrl-1']);
      const lines = result.split('\n');
      const idx2 = lines.findIndex((l) => l.includes('ref: ctrl-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: ctrl-1'));
      expect(idx2).toBeLessThan(idx1);
      expect(result).toContain('description: |-');
      expect(result).toContain('Strip trailing newline');
    });
  });

  describe('items with many fields', () => {
    it('should preserve all fields on each item block', () => {
      const yaml = `components:
  - ref: comp-1
    name: API Gateway
    type: service
    description: Handles requests
    technology: Node.js
    controls: [ctrl-1, ctrl-2]
  - ref: comp-2
    name: Database
    type: datastore
    description: Stores data
    technology: PostgreSQL
`;

      const result = reorderYamlSection(yaml, 'components', ['comp-2', 'comp-1']);
      const lines = result.split('\n');
      const idx2 = lines.findIndex((l) => l.includes('ref: comp-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: comp-1'));
      expect(idx2).toBeLessThan(idx1);
      expect(result).toContain('technology: Node.js');
      expect(result).toContain('controls: [ctrl-1, ctrl-2]');
      expect(result).toContain('technology: PostgreSQL');
    });
  });

  describe('comment handling', () => {
    it('should not capture comments that introduce the next section', () => {
      const yaml = `assets:
  - ref: asset-1
    name: First
  - ref: asset-2
    name: Second

# Components section
components:
  - ref: comp-1
    name: Component 1
`;

      const result = reorderYamlSection(yaml, 'assets', ['asset-2', 'asset-1']);
      const lines = result.split('\n');

      // Assets should be reordered
      const idx2 = lines.findIndex((l) => l.includes('ref: asset-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: asset-1'));
      expect(idx2).toBeLessThan(idx1);

      // The comment and components section should still be after assets
      const commentIdx = lines.findIndex((l) => l.includes('# Components section'));
      const compIdx = lines.findIndex((l) => l.includes('ref: comp-1'));
      expect(commentIdx).toBeGreaterThan(idx1);
      expect(compIdx).toBeGreaterThan(commentIdx);
    });

    it('should keep inline comments within items', () => {
      const yaml = `assets:
  - ref: asset-1
    name: First  # primary asset
  - ref: asset-2
    name: Second
`;

      const result = reorderYamlSection(yaml, 'assets', ['asset-2', 'asset-1']);
      expect(result).toContain('name: First  # primary asset');
    });

    it('should handle multiple comment lines before next section', () => {
      const yaml = `assets:
  - ref: asset-1
    name: First
  - ref: asset-2
    name: Second

# ==================
# Components section
# ==================
components:
  - ref: comp-1
    name: Component 1
`;

      const result = reorderYamlSection(yaml, 'assets', ['asset-2', 'asset-1']);
      const lines = result.split('\n');

      // Comments should remain after assets
      const commentIdx = lines.findIndex((l) => l.includes('# =================='));
      const idxAsset1 = lines.findIndex((l) => l.includes('ref: asset-1'));
      expect(commentIdx).toBeGreaterThan(idxAsset1);

      // Components section still intact
      expect(result).toContain('components:');
      expect(result).toContain('ref: comp-1');
    });
  });

  describe('inline array fields', () => {
    it('should preserve inline arrays on items', () => {
      const yaml = `threats:
  - ref: threat-1
    name: Threat 1
    affected_assets: [asset-1, asset-2]
    affected_data_flows: [flow-1]
  - ref: threat-2
    name: Threat 2
    affected_assets: [asset-3]
`;

      const result = reorderYamlSection(yaml, 'threats', ['threat-2', 'threat-1']);
      expect(result).toContain('affected_assets: [asset-1, asset-2]');
      expect(result).toContain('affected_data_flows: [flow-1]');
      expect(result).toContain('affected_assets: [asset-3]');
    });
  });

  describe('edge cases', () => {
    it('should handle empty section (no items)', () => {
      const yaml = `assets:

components:
  - ref: comp-1
    name: Component 1
`;

      const result = reorderYamlSection(yaml, 'assets', []);
      // Should return unchanged since there are no item blocks
      expect(result).toContain('components:');
      expect(result).toContain('ref: comp-1');
    });

    it('should skip refs in newOrder that are not found in the YAML', () => {
      const yaml = `assets:
  - ref: asset-1
    name: First
  - ref: asset-2
    name: Second
`;

      const result = reorderYamlSection(yaml, 'assets', [
        'asset-2',
        'nonexistent',
        'asset-1',
      ]);
      const lines = result.split('\n');
      const idx2 = lines.findIndex((l) => l.includes('ref: asset-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: asset-1'));
      expect(idx2).toBeLessThan(idx1);
      expect(result).not.toContain('nonexistent');
    });

    it('should handle the last section in the file (no next section)', () => {
      const yaml = `assets:
  - ref: asset-1
    name: First
  - ref: asset-2
    name: Second
`;

      const result = reorderYamlSection(yaml, 'assets', ['asset-2', 'asset-1']);
      const lines = result.split('\n');
      const idx2 = lines.findIndex((l) => l.includes('ref: asset-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: asset-1'));
      expect(idx2).toBeLessThan(idx1);
    });

    it('should handle items with blank lines between fields (pipe blocks)', () => {
      const yaml = `controls:
  - ref: ctrl-1
    name: Control 1
    description: |
      Line one

      Line three after blank
  - ref: ctrl-2
    name: Control 2
`;

      const result = reorderYamlSection(yaml, 'controls', ['ctrl-2', 'ctrl-1']);
      const lines = result.split('\n');
      const idx2 = lines.findIndex((l) => l.includes('ref: ctrl-2'));
      const idx1 = lines.findIndex((l) => l.includes('ref: ctrl-1'));
      expect(idx2).toBeLessThan(idx1);
      expect(result).toContain('Line one');
      expect(result).toContain('Line three after blank');
    });
  });
});

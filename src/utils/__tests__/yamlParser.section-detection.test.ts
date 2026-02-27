import { describe, it, expect } from 'vitest';
import {
  appendYamlItem,
  updateYamlField,
  updateYamlTopLevelField,
  updateYamlOptionalTopLevelField,
  updateYamlTopLevelStringArray,
  removeYamlItem,
} from '../yamlParser';

/**
 * Tests for section detection and top-level field handling bugs:
 * 1. updateYamlTopLevelField should handle existing multiline/pipe-style values
 * 2. Section detection should not confuse nested fields (e.g., 'assets: [A01]'
 *    inside a component) with top-level section headers
 * 3. Asset descriptions should be saveable via updateYamlField
 */
describe('yamlParser - Section Detection', () => {
  // Realistic YAML with components that have 'assets' fields (nested inline arrays)
  // followed by a top-level 'assets:' section
  const realisticYaml = `schema_version: '1.0'
name: Test Model
description: Test description
components:
  - ref: component-1
    name: Control Panel
    component_type: internal
    x: -110
    y: -171
    assets: [A01]

  - ref: component-2
    name: Business User
    component_type: external
    x: -111
    y: -294
    assets: [A02]

assets:
  - ref: A01
    name: Business rule

  - ref: A02
    name: User credentials
`;

  describe('appendYamlItem should target correct section', () => {
    it('should append asset to the assets section, not to a component\'s assets field', () => {
      const newAsset = { ref: 'A03', name: 'New Asset' };
      const result = appendYamlItem(realisticYaml, 'assets', newAsset);

      // The new asset should appear in the assets section
      expect(result).toContain('- ref: A03');
      expect(result).toContain('name: New Asset');

      // The components section should be unchanged
      const lines = result.split('\n');
      const assetsSectionIndex = lines.findIndex(l => l.trimStart() === 'assets:');
      const newAssetIndex = lines.findIndex(l => l.includes('ref: A03'));

      // A03 should appear AFTER the top-level assets: section header
      expect(newAssetIndex).toBeGreaterThan(assetsSectionIndex);
    });

    it('should not confuse component assets field with assets section', () => {
      const newAsset = { ref: 'A03', name: 'Environment credentials' };
      const result = appendYamlItem(realisticYaml, 'assets', newAsset);

      // Component 1 should still have its original assets field
      const lines = result.split('\n');
      const comp1Index = lines.findIndex(l => l.includes('ref: component-1'));
      const comp1AssetsLine = lines.find((l, i) =>
        i > comp1Index && i < comp1Index + 10 && l.includes('assets: [A01]')
      );
      expect(comp1AssetsLine).toBeDefined();

      // The new asset should be in the assets section, not in components
      const componentsSectionIndex = lines.findIndex(l => l === 'components:');
      const assetsSectionIndex = lines.findIndex(l => l === 'assets:');
      const newAssetIndex = lines.findIndex(l => l.includes('ref: A03'));
      expect(newAssetIndex).toBeGreaterThan(assetsSectionIndex);
      expect(newAssetIndex).toBeGreaterThan(componentsSectionIndex);
    });
  });

  describe('updateYamlField should target correct section', () => {
    it('should update asset description in the assets section', () => {
      const result = updateYamlField(
        realisticYaml,
        'assets',
        'A01',
        'description',
        'Business rules configuration data'
      );

      // The description should be added to asset A01
      const lines = result.split('\n');
      const a01Index = lines.findIndex(l => l.includes('ref: A01'));
      expect(a01Index).toBeGreaterThan(-1);

      // Find the description line near the asset
      const descIndex = lines.findIndex((l, i) =>
        i > a01Index && i < a01Index + 5 && l.includes('description: Business rules')
      );
      expect(descIndex).toBeGreaterThan(-1);
    });

    it('should update asset name in the assets section, not component assets', () => {
      const result = updateYamlField(
        realisticYaml,
        'assets',
        'A02',
        'name',
        'Updated Name'
      );

      const lines = result.split('\n');
      // Find asset A02 in the assets section
      const assetsSectionIndex = lines.findIndex(l => l === 'assets:');
      const a02Index = lines.findIndex((l, i) =>
        i > assetsSectionIndex && l.includes('ref: A02')
      );
      expect(a02Index).toBeGreaterThan(assetsSectionIndex);

      // The name should be updated
      const nameIndex = lines.findIndex((l, i) =>
        i > a02Index && i < a02Index + 5 && l.includes('name: Updated Name')
      );
      expect(nameIndex).toBeGreaterThan(-1);
    });
  });

  describe('removeYamlItem should target correct section', () => {
    it('should remove asset from assets section, not affect component assets', () => {
      const result = removeYamlItem(realisticYaml, 'assets', 'A01');

      // A01 should be removed from assets section
      const lines = result.split('\n');
      const assetsSectionIndex = lines.findIndex(l => l === 'assets:');
      const a01InAssets = lines.findIndex((l, i) =>
        i > assetsSectionIndex && l.includes('ref: A01')
      );
      expect(a01InAssets).toBe(-1);

      // But component-1 should still reference A01 in its assets field
      const comp1Index = lines.findIndex(l => l.includes('ref: component-1'));
      const comp1Assets = lines.find((l, i) =>
        i > comp1Index && i < comp1Index + 10 && l.includes('assets: [A01]')
      );
      expect(comp1Assets).toBeDefined();
    });
  });
});

describe('yamlParser - Top Level Field Updates', () => {
  describe('updateYamlTopLevelField with multiline values', () => {
    it('should replace pipe-style multiline description', () => {
      const yaml = `schema_version: '1.0'
name: Test Model
description: |
  This is a long description
  that spans multiple lines
  with various details.
participants:
  - user@example.com
components:
  - ref: comp-1
    name: Component 1
    component_type: internal
`;

      const result = updateYamlTopLevelField(yaml, 'description', 'Short new description');

      // The old multiline content should be gone
      expect(result).not.toContain('This is a long description');
      expect(result).not.toContain('that spans multiple lines');
      expect(result).not.toContain('with various details.');

      // The new value should be present
      expect(result).toContain('description: Short new description');

      // Participants should be preserved and not have orphaned description lines
      expect(result).toContain('participants:');
      expect(result).toContain('- user@example.com');

      // Verify participants doesn't contain description text
      const lines = result.split('\n');
      const participantsIndex = lines.findIndex(l => l.startsWith('participants:'));
      const componentsIndex = lines.findIndex(l => l.startsWith('components:'));
      const participantsSection = lines.slice(participantsIndex, componentsIndex).join('\n');
      expect(participantsSection).not.toContain('long description');
    });

    it('should replace pipe-style description with another multiline value', () => {
      const yaml = `schema_version: '1.0'
name: Test Model
description: |
  Old line 1
  Old line 2
participants:
  - user@example.com
`;

      const result = updateYamlTopLevelField(yaml, 'description', 'New line 1\nNew line 2');

      expect(result).not.toContain('Old line 1');
      expect(result).not.toContain('Old line 2');
      expect(result).toContain('New line 1');
      expect(result).toContain('New line 2');
      expect(result).toContain('participants:');
      expect(result).toContain('- user@example.com');
    });

    it('should handle replacing simple value (not pipe-style)', () => {
      const yaml = `schema_version: '1.0'
name: Test Model
description: Old description
participants:
  - user@example.com
`;

      const result = updateYamlTopLevelField(yaml, 'description', 'New description');
      expect(result).toContain('description: New description');
      expect(result).not.toContain('Old description');
      expect(result).toContain('participants:');
    });

    it('should not affect fields below when replacing pipe-style value', () => {
      const yaml = `schema_version: '1.0'
name: Test Model
description: |
  A detailed description with URLs
  https://example.com/page
  More text here.
participants:
  - alice@example.com
  - bob@example.com
components:
  - ref: comp-1
    name: Component 1
    component_type: internal
`;

      const result = updateYamlTopLevelField(yaml, 'description', 'Updated description');

      // Verify the description was updated
      expect(result).toContain('description: Updated description');
      expect(result).not.toContain('A detailed description');
      expect(result).not.toContain('https://example.com/page');
      expect(result).not.toContain('More text here.');

      // Verify participants are intact
      expect(result).toContain('- alice@example.com');
      expect(result).toContain('- bob@example.com');

      // Verify components are intact
      expect(result).toContain('- ref: comp-1');
      expect(result).toContain('name: Component 1');
    });

    it('should handle pipe-style with trailing newline indicator (|+)', () => {
      const yaml = `schema_version: '1.0'
name: Test
description: |+
  Content with trailing newlines


participants:
  - user@example.com
`;

      const result = updateYamlTopLevelField(yaml, 'description', 'No more pipe');
      expect(result).toContain('description: No more pipe');
      expect(result).not.toContain('Content with trailing newlines');
      expect(result).toContain('participants:');
    });
  });
});

describe('yamlParser - Inserting fields after pipe-style description', () => {
  describe('updateYamlTopLevelStringArray inserting after pipe-style description', () => {
    it('should insert participants after pipe-style description without corrupting it', () => {
      // This simulates: user sets description to multiline, then adds a participant
      const yaml = `schema_version: '1.0'
name: Test Model
description: |
  hello

  hello
components:
  - ref: comp-1
    name: Component 1
    component_type: internal
`;

      const result = updateYamlTopLevelStringArray(yaml, 'participants', ['hi']);

      // Participants should be a proper section AFTER description, not inside it
      expect(result).toContain('participants:');
      expect(result).toContain('- hi');

      // The description pipe content should remain intact
      const lines = result.split('\n');
      const descIndex = lines.findIndex(l => l.startsWith('description:'));
      const participantsIndex = lines.findIndex(l => l.startsWith('participants:'));

      // participants: must come AFTER description and all its continuation lines
      expect(participantsIndex).toBeGreaterThan(descIndex);

      // The pipe content should not appear after participants
      const afterParticipants = lines.slice(participantsIndex).join('\n');
      expect(afterParticipants).not.toContain('hello');

      // Components should still be intact
      expect(result).toContain('- ref: comp-1');
    });

    it('should insert participants after simple description normally', () => {
      const yaml = `schema_version: '1.0'
name: Test Model
description: Simple description
components:
  - ref: comp-1
    name: Component 1
    component_type: internal
`;

      const result = updateYamlTopLevelStringArray(yaml, 'participants', ['user@example.com']);

      expect(result).toContain('participants:');
      expect(result).toContain('- user@example.com');

      const lines = result.split('\n');
      const descIndex = lines.findIndex(l => l.startsWith('description:'));
      const participantsIndex = lines.findIndex(l => l.startsWith('participants:'));
      expect(participantsIndex).toBe(descIndex + 1);
    });

    it('should handle the exact user-reported scenario: multiline description then add participant', () => {
      // Exact reproduction: description: "hello\n\nhello", then participants: ["hi"]
      // First set the description
      let yaml = `schema_version: '1.0'
name: Test Model
description: ''
components:
  - ref: comp-1
    name: Component 1
    component_type: internal
`;

      yaml = updateYamlTopLevelField(yaml, 'description', 'hello\n\nhello');
      // Now add a participant
      yaml = updateYamlTopLevelStringArray(yaml, 'participants', ['hi']);

      // Verify correct structure
      const lines = yaml.split('\n');
      const descIndex = lines.findIndex(l => l.startsWith('description:'));
      const participantsIndex = lines.findIndex(l => l.startsWith('participants:'));
      const componentsIndex = lines.findIndex(l => l.startsWith('components:'));

      // Correct ordering: description < participants < components
      expect(descIndex).toBeGreaterThan(-1);
      expect(participantsIndex).toBeGreaterThan(descIndex);
      expect(componentsIndex).toBeGreaterThan(participantsIndex);

      // Participant value should only contain "hi", not description content
      const participantItems = lines.filter(l => l.match(/^\s+-\s/));
      const hiItems = participantItems.filter(l => l.includes('hi'));
      expect(hiItems.length).toBe(1);

      // Description content should not appear in participants section
      const participantsSection = lines.slice(participantsIndex, componentsIndex).join('\n');
      expect(participantsSection).not.toContain('hello');
    });
  });

  describe('updateYamlOptionalTopLevelField inserting after pipe-style description', () => {
    it('should insert optional field after pipe-style description correctly', () => {
      const yaml = `schema_version: '1.0'
name: Test Model
description: |
  Multi-line content
  with details
components:
  - ref: comp-1
    name: Component 1
    component_type: internal
`;

      const result = updateYamlOptionalTopLevelField(yaml, 'owner', 'test-owner');

      const lines = result.split('\n');
      const descIndex = lines.findIndex(l => l.startsWith('description:'));
      const ownerIndex = lines.findIndex(l => l.startsWith('owner:'));
      const componentsIndex = lines.findIndex(l => l.startsWith('components:'));

      // owner should be after description content, before components
      expect(ownerIndex).toBeGreaterThan(descIndex);
      expect(componentsIndex).toBeGreaterThan(ownerIndex);

      // Description content should be intact above the owner field
      expect(result).toContain('Multi-line content');
      expect(result).toContain('with details');
    });
  });
});

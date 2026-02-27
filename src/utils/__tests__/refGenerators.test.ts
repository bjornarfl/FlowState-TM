import { describe, it, expect } from 'vitest';
import { slugify, regenerateAllRefs } from '../refGenerators';

describe('refGenerators', () => {
  describe('slugify', () => {
    it('should convert text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('My Component Name')).toBe('my-component-name');
    });

    it('should handle underscores', () => {
      expect(slugify('user_authentication_service')).toBe('user-authentication-service');
    });

    it('should trim leading and trailing spaces', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(slugify('-Hello-World-')).toBe('hello-world');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle numeric values', () => {
      expect(slugify(1)).toBe('1');
      expect(slugify(2024)).toBe('2024');
      expect(slugify(123)).toBe('123');
    });
  });

  describe('regenerateAllRefs', () => {
    it('should regenerate component refs based on names', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp1
    name: API Gateway
    component_type: internal
  - ref: comp2
    name: Database Server
    component_type: data_store
`;

      const result = regenerateAllRefs(input);
      
      expect(result).toContain('ref: api-gateway');
      expect(result).toContain('ref: database-server');
      expect(result).not.toContain('ref: comp1');
      expect(result).not.toContain('ref: comp2');
    });

    it('should handle duplicate names by appending numbers', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp1
    name: API Server
    component_type: internal
  - ref: comp2
    name: API Server
    component_type: internal
  - ref: comp3
    name: API Server
    component_type: internal
`;

      const result = regenerateAllRefs(input);
      
      expect(result).toContain('ref: api-server');
      expect(result).toContain('ref: api-server-2');
      expect(result).toContain('ref: api-server-3');
    });

    it('should update references in data flows', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: OLD_API
    name: API Gateway
    component_type: internal
  - ref: OLD_DB
    name: Database
    component_type: data_store
data_flows:
  - ref: flow1
    source: OLD_API
    destination: OLD_DB
    direction: unidirectional
    label: Query Data
  - ref: flow2
    source: OLD_API
    destination: OLD_DB
    direction: bidirectional
`;

      const result = regenerateAllRefs(input);
      
      expect(result).toContain('source: api-gateway');
      expect(result).toContain('destination: database');
      // Both flows use arrow format with new component refs
      expect(result).toContain('ref: api-gateway->database');
      expect(result).toContain('ref: api-gateway<->database');
    });

    it('should update references in boundaries', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: OLD_API
    name: API Gateway
    component_type: internal
boundaries:
  - ref: OLD_BOUNDARY
    name: DMZ Zone
    components:
      - OLD_API
`;

      const result = regenerateAllRefs(input);
      
      expect(result).toContain('ref: dmz-zone');
      expect(result).toContain('- api-gateway');
    });

    it('should update references in threats', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: OLD_API
    name: API Gateway
    component_type: internal
assets:
  - ref: OLD_ASSET
    name: User Credentials
threats:
  - ref: OLD_THREAT
    name: SQL Injection
    affected_components:
      - OLD_API
    affected_assets:
      - OLD_ASSET
`;

      const result = regenerateAllRefs(input);
      
      expect(result).toContain('ref: sql-injection');
      expect(result).toContain('- api-gateway');
      expect(result).toContain('- user-credentials');
    });

    it('should update references in controls', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: OLD_API
    name: API Gateway
    component_type: internal
threats:
  - ref: OLD_THREAT
    name: SQL Injection
controls:
  - ref: OLD_CONTROL
    name: Input Validation
    mitigates:
      - OLD_THREAT
    implemented_in:
      - OLD_API
`;

      const result = regenerateAllRefs(input);
      
      expect(result).toContain('ref: input-validation');
      expect(result).toContain('- sql-injection');
      expect(result).toContain('- api-gateway');
    });

    it('should maintain uniqueness across all entity types', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp1
    name: Database
    component_type: data_store
assets:
  - ref: asset1
    name: Database
threats:
  - ref: threat1
    name: Database
`;

      const result = regenerateAllRefs(input);
      
      expect(result).toContain('ref: database');
      expect(result).toContain('ref: database-2');
      expect(result).toContain('ref: database-3');
    });

    it('should handle numeric names', () => {
      const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp1
    name: 1
    component_type: internal
  - ref: comp2
    name: 2024
    component_type: external
assets:
  - ref: asset1
    name: 123
boundaries:
  - ref: boundary1
    name: 456
`;

      const result = regenerateAllRefs(input);
      
      // Numeric names should be converted to slugs
      expect(result).toContain('ref: 1');
      expect(result).toContain('ref: 2024');
      expect(result).toContain('ref: 123');
      expect(result).toContain('ref: 456');
    });
  });
});

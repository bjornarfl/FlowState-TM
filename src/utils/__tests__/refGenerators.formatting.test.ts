import { describe, it, expect } from 'vitest';
import { regenerateAllRefs } from '../refGenerators';

describe('refGenerators - formatting preservation', () => {
  it('should preserve comments and whitespace', () => {
    const input = `schema_version: "1.0"
name: Test Model

# This is a comment about components
components:
  - ref: OLD_API  # inline comment
    name: API Gateway
    component_type: internal
    # another comment
  - ref: OLD_DB
    name: Database
    component_type: data_store

# Comment about data flows
data_flows:
  - ref: flow1
    source: OLD_API
    destination: OLD_DB
    direction: unidirectional
    label: Query Data
`;

    const result = regenerateAllRefs(input);
    
    // Should contain comments
    expect(result).toContain('# This is a comment about components');
    expect(result).toContain('# inline comment');
    expect(result).toContain('# another comment');
    expect(result).toContain('# Comment about data flows');
    
    // Should preserve blank lines
    expect(result).toMatch(/name: Test Model\n\n#/);
    
    // Should have new refs
    expect(result).toContain('ref: api-gateway');
    expect(result).toContain('ref: database');
    expect(result).toContain('ref: api-gateway->database'); // Arrow format, not label
    
    // Should update references
    expect(result).toContain('source: api-gateway');
    expect(result).toContain('destination: database');
  });

  it('should preserve inline arrays', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: API
    name: API Gateway
    component_type: internal
    assets: [A01, A02, A03]
assets:
  - ref: A01
    name: User Data
  - ref: A02
    name: Session Data
  - ref: A03
    name: Config Data
`;

    const result = regenerateAllRefs(input);
    
    // Should preserve inline array format
    expect(result).toContain('assets: [user-data, session-data, config-data]');
    expect(result).not.toContain('assets:\n      - user-data');
  });

  it('should preserve multi-line arrays', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: API
    name: API Gateway
    component_type: internal
assets:
  - ref: A01
    name: User Data
threats:
  - ref: T01
    name: SQL Injection
    affected_components:
      - API
    affected_assets:
      - A01
`;

    const result = regenerateAllRefs(input);
    
    // Should keep multi-line array format
    expect(result).toContain('affected_components:\n      - api-gateway');
    expect(result).toContain('affected_assets:\n      - user-data');
  });

  it('should not break on special characters in names', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp1
    name: API (v2.0) Gateway!
    component_type: internal
  - ref: comp2
    name: User's Database
    component_type: data_store
`;

    const result = regenerateAllRefs(input);
    
    // Should create valid slugs
    expect(result).toContain('ref: api-v20-gateway');
    expect(result).toContain('ref: users-database');
  });

  it('should handle data flow direction arrows', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: API
    name: API Gateway
    component_type: internal
  - ref: DB
    name: Database
    component_type: data_store
data_flows:
  - ref: API->DB
    source: API
    destination: DB
    direction: unidirectional
    label: Write Data
  - ref: API<->DB
    source: API
    destination: DB
    direction: bidirectional
`;

    const result = regenerateAllRefs(input);
    
    // Both flows should use arrow format with new component refs
    expect(result).toContain('ref: api-gateway->database');
    expect(result).toContain('ref: api-gateway<->database');
    
    // Direction fields preserved
    expect(result).toContain('direction: unidirectional');
    expect(result).toContain('direction: bidirectional');
    
    // Should update source and destination to new component refs
    expect(result).toContain('source: api-gateway');
    expect(result).toContain('destination: database');
  });

  it('should handle "y" and "n" values correctly', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp1
    name: Component Y
    component_type: internal
    x: 100
    y: 200
`;

    const result = regenerateAllRefs(input);
    
    // Should preserve y coordinate as number, not string
    expect(result).toContain('y: 200');
    expect(result).not.toContain("y: '200'");
    expect(result).not.toContain('y: "200"');
  });
});

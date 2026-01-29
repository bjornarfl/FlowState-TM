import { describe, it, expect } from 'vitest';
import { regenerateAllRefs } from '../refGenerators';

describe('refGenerators - user reported issues', () => {
  it('should preserve comments and whitespace (not remove them)', () => {
    const input = `schema_version: "1.0"
name: Test Model

# Important comment
components:
  - ref: OLD_REF
    name: My Component  # inline comment
    component_type: internal
    
    # More whitespace below
`;

    const result = regenerateAllRefs(input);
    
    // All comments should be preserved
    expect(result).toContain('# Important comment');
    expect(result).toContain('# inline comment');
    expect(result).toContain('# More whitespace below');
    
    // Whitespace should be preserved (double newline after "Test Model")
    expect(result).toMatch(/name: Test Model\n\n#/);
  });

  it('should NOT show y coordinates as quoted strings like \'y\'', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp1
    name: My Component
    component_type: internal
    x: 100
    y: 200
`;

    const result = regenerateAllRefs(input);
    
    // y should remain as unquoted number
    expect(result).toContain('y: 200');
    
    // y should NOT be quoted
    expect(result).not.toContain("y: '200'");
    expect(result).not.toContain('y: "200"');
    expect(result).not.toContain("y: 'y'");
  });

  it('should preserve data flow directionality (-> and <->)', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: A
    name: Component A
    component_type: internal
  - ref: B
    name: Component B
    component_type: internal
data_flows:
  - ref: A->B
    source: A
    destination: B
    direction: unidirectional
    label: One Way
  - ref: A<->B
    source: A
    destination: B
    direction: bidirectional
`;

    const result = regenerateAllRefs(input);
    
    // Direction field should be preserved
    expect(result).toContain('direction: unidirectional');
    expect(result).toContain('direction: bidirectional');
    
    // Both flows should use arrow format with NEW component refs (labels ignored)
    expect(result).toContain('ref: component-a->component-b');
    expect(result).toContain('ref: component-a<->component-b');
  });

  it('should preserve inline array format [item1, item2] not convert to multi-line', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: API
    name: API Gateway
    component_type: internal
    assets: [ASSET1, ASSET2, ASSET3]
assets:
  - ref: ASSET1
    name: User Data
  - ref: ASSET2
    name: Session Tokens
  - ref: ASSET3
    name: API Keys
`;

    const result = regenerateAllRefs(input);
    
    // Should remain as inline array
    expect(result).toContain('assets: [user-data, session-tokens, api-keys]');
    
    // Should NOT be converted to multi-line format
    expect(result).not.toContain('assets:\n      - user-data\n      - session-tokens');
  });

  it('comprehensive test: all issues combined', () => {
    const input = `schema_version: "1.0"
name: Production System

# Component definitions
components:
  - ref: WEB_APP
    name: Web Application  # Main app
    component_type: internal
    assets: [DATA_01, DATA_02]
    x: 100
    y: 250

  - ref: DB_SERVER
    name: Database Server
    component_type: data_store
    x: 300
    y: 250

# Assets
assets:
  - ref: DATA_01
    name: User Credentials
  - ref: DATA_02
    name: Session Data

# Data flows with different directions
data_flows:
  - ref: WEB_APP->DB_SERVER
    source: WEB_APP
    destination: DB_SERVER
    direction: unidirectional
    label: Query Database
    
  - ref: WEB_APP<->DB_SERVER_SYNC
    source: WEB_APP
    destination: DB_SERVER
    direction: bidirectional

# End of file
`;

    const result = regenerateAllRefs(input);
    
    // 1. Comments preserved
    expect(result).toContain('# Component definitions');
    expect(result).toContain('# Main app');
    expect(result).toContain('# Assets');
    expect(result).toContain('# Data flows with different directions');
    expect(result).toContain('# End of file');
    
    // 2. y coordinates not quoted
    expect(result).toContain('y: 250');
    expect(result).not.toContain("y: '250'");
    
    // 3. Direction preserved
    expect(result).toContain('direction: unidirectional');
    expect(result).toContain('direction: bidirectional');
    
    // 4. Inline arrays preserved
    expect(result).toContain('assets: [user-credentials, session-data]');
    expect(result).not.toContain('assets:\n      - user-credentials');
    
    // 5. Refs regenerated correctly
    expect(result).toContain('ref: web-application');
    expect(result).toContain('ref: database-server');
    expect(result).toContain('ref: web-application->database-server');
    expect(result).toContain('ref: web-application<->database-server');
    
    // 6. References updated
    expect(result).toContain('source: web-application');
    expect(result).toContain('destination: database-server');
  });
});

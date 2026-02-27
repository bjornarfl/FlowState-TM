import { describe, it, expect } from 'vitest';
import { regenerateAllRefs } from '../refGenerators';

describe('refGenerators - data flow refs with arrows', () => {
  it('should create proper data flow refs with arrows based on new component refs', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: component-1
    name: hello
    component_type: internal
    x: 0
    y: 0

  - ref: component-2
    name: hello
    component_type: internal
    x: 4
    y: -106

  - ref: component-3
    name: Hi
    component_type: external
    x: -6
    y: 72

# Data Flows - Represents connections between components with data flowing between them
data_flows:
  - ref: component-2->component-1
    source: component-2
    destination: component-1
    source_point: bottom-2
    destination_point: top-2
    direction: unidirectional

  - ref: component-1->component-3
    source: component-1
    destination: component-3
    source_point: bottom-2
    destination_point: top-2
    direction: unidirectional
`;

    const result = regenerateAllRefs(input);
    
    // Components should be renamed
    expect(result).toContain('ref: hello');
    expect(result).toContain('ref: hello-2');
    expect(result).toContain('ref: hi');
    
    // Data flow refs should use NEW component refs with arrows
    expect(result).toContain('ref: hello-2->hello');
    expect(result).toContain('ref: hello->hi');
    
    // Data flow refs should NOT use old component refs
    expect(result).not.toContain('ref: component-2->component-1');
    expect(result).not.toContain('ref: component-1->component-3');
    expect(result).not.toContain('ref: component-2-component-1');
    expect(result).not.toContain('ref: component-1-component-3');
    
    // Source and destination should be updated
    expect(result).toContain('source: hello-2');
    expect(result).toContain('destination: hello');
    expect(result).toContain('source: hello');
    expect(result).toContain('destination: hi');
    
    // Direction should be preserved
    expect(result).toContain('direction: unidirectional');
    
    // Other fields should be preserved
    expect(result).toContain('source_point: bottom-2');
    expect(result).toContain('destination_point: top-2');
    expect(result).toContain('# Data Flows - Represents connections between components with data flowing between them');
  });

  it('should handle bidirectional data flows with <-> arrows', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: comp-a
    name: Service A
    component_type: internal
  - ref: comp-b
    name: Service B
    component_type: internal
data_flows:
  - ref: comp-a<->comp-b
    source: comp-a
    destination: comp-b
    direction: bidirectional
`;

    const result = regenerateAllRefs(input);
    
    // Components renamed
    expect(result).toContain('ref: service-a');
    expect(result).toContain('ref: service-b');
    
    // Data flow ref should use <-> for bidirectional
    expect(result).toContain('ref: service-a<->service-b');
    expect(result).not.toContain('ref: service-a->service-b');
  });

  it('should always use arrow format for data flow refs, ignoring labels', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: api
    name: API Gateway
    component_type: internal
  - ref: db
    name: Database
    component_type: data_store
data_flows:
  - ref: api->db
    source: api
    destination: db
    direction: unidirectional
    label: Write Data
  - ref: api<->db
    source: api
    destination: db
    direction: bidirectional
`;

    const result = regenerateAllRefs(input);
    
    // Both flows should use arrow format with new component refs (labels ignored)
    expect(result).toContain('ref: api-gateway->database');
    expect(result).toContain('ref: api-gateway<->database');
    
    // Labels should still be preserved in the output, just not used for refs
    expect(result).toContain('label: Write Data');
  });

  it('should handle multiple data flows with same components by making refs unique', () => {
    const input = `schema_version: "1.0"
name: Test Model
components:
  - ref: api
    name: API
    component_type: internal
  - ref: db
    name: DB
    component_type: data_store
data_flows:
  - ref: api->db_1
    source: api
    destination: db
    direction: unidirectional
  - ref: api->db_2
    source: api
    destination: db
    direction: unidirectional
  - ref: api->db_3
    source: api
    destination: db
    direction: unidirectional
`;

    const result = regenerateAllRefs(input);
    
    // All three flows should get unique refs
    expect(result).toContain('ref: api->db');
    expect(result).toContain('ref: api->db-2');
    expect(result).toContain('ref: api->db-3');
  });
});

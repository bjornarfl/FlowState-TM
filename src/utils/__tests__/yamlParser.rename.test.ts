import { describe, it, expect } from 'vitest';
import {
  renameRef,
  renameComponentRef,
  renameAssetRef,
  renameBoundaryRef,
  renameThreatRef,
  renameControlRef,
  renameDataFlowRef,
} from '../yamlParser';

describe('yamlParser - Rename Ref Functions', () => {
  describe('renameRef', () => {
    it('should rename a ref and update it in inline arrays', () => {
      const yaml = `components:
  - ref: api-server
    name: API Server
threats:
  - ref: t1
    name: Threat 1
    affected_components: [api-server, database]
  - ref: t2
    name: Threat 2
    affected_components: [api-server]
`;

      const result = renameRef(yaml, 'api-server', 'api-gateway', {
        arrayFields: ['affected_components'],
      });

      expect(result.yamlContent).toContain('ref: api-gateway');
      expect(result.yamlContent).not.toContain('ref: api-server');
      expect(result.yamlContent).toContain('affected_components: [api-gateway, database]');
      expect(result.yamlContent).toContain('affected_components: [api-gateway]');
      expect(result.actualRef).toBe('api-gateway');
    });

    it('should rename a ref in multi-line arrays', () => {
      const yaml = `components:
  - ref: db-server
    name: Database
threats:
  - ref: t1
    name: Threat 1
    affected_components:
      - db-server
      - api-server
`;

      const result = renameRef(yaml, 'db-server', 'postgres-db', {
        arrayFields: ['affected_components'],
      });

      expect(result.yamlContent).toContain('ref: postgres-db');
      expect(result.yamlContent).not.toContain('ref: db-server');
      expect(result.yamlContent).toContain('- postgres-db');
      expect(result.yamlContent).toContain('- api-server');
      expect(result.actualRef).toBe('postgres-db');
    });

    it('should make ref unique if it already exists', () => {
      const yaml = `components:
  - ref: api-server
    name: API Server
  - ref: api-gateway
    name: Existing Gateway
`;

      const result = renameRef(yaml, 'api-server', 'api-gateway', {
        arrayFields: [],
        ensureUnique: true,
      });

      expect(result.actualRef).toBe('api-gateway-1');
      expect(result.yamlContent).toContain('ref: api-gateway-1');
      expect(result.yamlContent).toContain('ref: api-gateway');
      expect(result.yamlContent).not.toContain('ref: api-server');
    });

    it('should increment counter if multiple variants exist', () => {
      const yaml = `components:
  - ref: api-server
    name: API Server
  - ref: api-gateway
    name: Gateway 1
  - ref: api-gateway-1
    name: Gateway 2
  - ref: api-gateway-2
    name: Gateway 3
`;

      const result = renameRef(yaml, 'api-server', 'api-gateway', {
        arrayFields: [],
        ensureUnique: true,
      });

      expect(result.actualRef).toBe('api-gateway-3');
      expect(result.yamlContent).toContain('ref: api-gateway-3');
    });

    it('should not modify ref if old and new are the same', () => {
      const yaml = `components:
  - ref: api-server
    name: API Server
`;

      const result = renameRef(yaml, 'api-server', 'api-server', {
        arrayFields: [],
      });

      expect(result.yamlContent).toBe(yaml);
      expect(result.actualRef).toBe('api-server');
    });

    it('should not replace partial matches (substring issue)', () => {
      const yaml = `components:
  - ref: api
    name: API
  - ref: api-server
    name: API Server
  - ref: api-gateway
    name: API Gateway
threats:
  - ref: t1
    name: Threat 1
    affected_components: [api, api-server, api-gateway]
`;

      const result = renameRef(yaml, 'api', 'service', {
        arrayFields: ['affected_components'],
      });

      // Should rename 'api' to 'service'
      expect(result.yamlContent).toContain('ref: service');
      expect(result.yamlContent).not.toContain('ref: api\n');
      
      // Should NOT affect 'api-server' or 'api-gateway'
      expect(result.yamlContent).toContain('ref: api-server');
      expect(result.yamlContent).toContain('ref: api-gateway');
      
      // Array should have 'service' instead of 'api', but keep others
      expect(result.yamlContent).toContain('[service, api-server, api-gateway]');
    });

    it('should throw error if old ref does not exist', () => {
      const yaml = `components:
  - ref: api-server
    name: API Server
`;

      expect(() => {
        renameRef(yaml, 'non-existent', 'new-name', {
          arrayFields: [],
        });
      }).toThrow("Reference 'non-existent' not found in document");
    });

    it('should handle refs with special characters', () => {
      const yaml = `components:
  - ref: api-server-v2.0
    name: API Server v2
threats:
  - ref: t1
    name: Threat 1
    affected_components: [api-server-v2.0]
`;

      const result = renameRef(yaml, 'api-server-v2.0', 'api-server-v3.0', {
        arrayFields: ['affected_components'],
      });

      expect(result.yamlContent).toContain('ref: api-server-v3.0');
      expect(result.yamlContent).toContain('affected_components: [api-server-v3.0]');
    });

    it('should handle multiple array fields', () => {
      const yaml = `components:
  - ref: db
    name: Database
threats:
  - ref: t1
    name: Threat 1
    affected_components: [db]
controls:
  - ref: c1
    name: Control 1
    implemented_in: [db]
`;

      const result = renameRef(yaml, 'db', 'postgres', {
        arrayFields: ['affected_components', 'implemented_in'],
      });

      expect(result.yamlContent).toContain('ref: postgres');
      expect(result.yamlContent).toContain('affected_components: [postgres]');
      expect(result.yamlContent).toContain('implemented_in: [postgres]');
    });

    it('should exclude old ref from uniqueness check', () => {
      const yaml = `components:
  - ref: api-server
    name: Server 1
  - ref: new-name
    name: Server 2
`;

      const result = renameRef(yaml, 'api-server', 'new-name', {
        arrayFields: [],
        ensureUnique: true,
      });

      // Since api-server is being renamed, it should be excluded from uniqueness check
      // But new-name already exists, so it should get -1 appended
      expect(result.actualRef).toBe('new-name-1');
      expect(result.yamlContent).toContain('ref: new-name-1');
      // Should still have the original new-name
      expect(result.yamlContent).toContain('ref: new-name');
      const matches = result.yamlContent.match(/ref: new-name/g);
      expect(matches?.length).toBe(2); // Both the old one and a substring match in new-name-1
    });
  });

  describe('renameComponentRef', () => {
    it('should rename component and update all references', () => {
      const yaml = `components:
  - ref: api-server
    name: API Server
boundaries:
  - ref: b1
    name: Boundary 1
    components: [api-server, database]
threats:
  - ref: t1
    name: Threat 1
    affected_components: [api-server]
controls:
  - ref: c1
    name: Control 1
    implemented_in: [api-server]
`;

      const result = renameComponentRef(yaml, 'api-server', 'api-gateway');

      expect(result.yamlContent).toContain('ref: api-gateway');
      expect(result.yamlContent).toContain('components: [api-gateway, database]');
      expect(result.yamlContent).toContain('affected_components: [api-gateway]');
      expect(result.yamlContent).toContain('implemented_in: [api-gateway]');
      expect(result.actualRef).toBe('api-gateway');
    });

    it('should update data-flow source/destination and regenerate refs', () => {
      const yaml = `components:
  - ref: api
    name: API
  - ref: database
    name: Database
data_flows:
  - ref: api->database
    source: api
    destination: database
  - ref: database->api
    source: database
    destination: api
`;

      const result = renameComponentRef(yaml, 'api', 'api-gateway');

      expect(result.yamlContent).toContain('ref: api-gateway');
      expect(result.yamlContent).toContain('ref: api-gateway->database');
      expect(result.yamlContent).toContain('source: api-gateway');
      expect(result.yamlContent).toContain('ref: database->api-gateway');
      expect(result.yamlContent).toContain('destination: api-gateway');
      expect(result.actualRef).toBe('api-gateway');
    });

    it('should handle bidirectional data-flows when renaming components', () => {
      const yaml = `components:
  - ref: frontend
    name: Frontend
  - ref: backend
    name: Backend
data_flows:
  - ref: frontend<->backend
    source: frontend
    destination: backend
    direction: bidirectional
`;

      const result = renameComponentRef(yaml, 'frontend', 'web-ui');

      expect(result.yamlContent).toContain('ref: web-ui');
      expect(result.yamlContent).toContain('ref: web-ui<->backend');
      expect(result.yamlContent).toContain('source: web-ui');
      expect(result.actualRef).toBe('web-ui');
    });

    it('should handle multiple data-flows with the same component', () => {
      const yaml = `components:
  - ref: api
    name: API
  - ref: db1
    name: Database 1
  - ref: db2
    name: Database 2
data_flows:
  - ref: api->db1
    source: api
    destination: db1
  - ref: api->db2
    source: api
    destination: db2
  - ref: db1->api
    source: db1
    destination: api
`;

      const result = renameComponentRef(yaml, 'api', 'rest-api');

      expect(result.yamlContent).toContain('ref: rest-api');
      expect(result.yamlContent).toContain('ref: rest-api->db1');
      expect(result.yamlContent).toContain('ref: rest-api->db2');
      expect(result.yamlContent).toContain('ref: db1->rest-api');
      expect(result.yamlContent).toContain('source: rest-api');
      expect(result.yamlContent).toContain('destination: rest-api');
      
      // Check both source and destination were updated correctly
      const lines = result.yamlContent.split('\n');
      const sourceCount = lines.filter(l => l.includes('source: rest-api')).length;
      const destCount = lines.filter(l => l.includes('destination: rest-api')).length;
      expect(sourceCount).toBe(2); // api->db1 and api->db2
      expect(destCount).toBe(1);   // db1->api
    });
  });

  describe('renameAssetRef', () => {
    it('should rename asset and update all references', () => {
      const yaml = `assets:
  - ref: user-data
    name: User Data
components:
  - ref: api
    name: API
    assets: [user-data, config]
threats:
  - ref: t1
    name: Threat 1
    affected_assets: [user-data]
`;

      const result = renameAssetRef(yaml, 'user-data', 'customer-data');

      expect(result.yamlContent).toContain('ref: customer-data');
      expect(result.yamlContent).toContain('assets: [customer-data, config]');
      expect(result.yamlContent).toContain('affected_assets: [customer-data]');
      expect(result.actualRef).toBe('customer-data');
    });
  });

  describe('renameBoundaryRef', () => {
    it('should rename boundary ref', () => {
      const yaml = `boundaries:
  - ref: dmz
    name: DMZ
    components: [api-server]
`;

      const result = renameBoundaryRef(yaml, 'dmz', 'external-zone');

      expect(result.yamlContent).toContain('ref: external-zone');
      expect(result.actualRef).toBe('external-zone');
    });
  });

  describe('renameThreatRef', () => {
    it('should rename threat and update references in controls', () => {
      const yaml = `threats:
  - ref: t1
    name: SQL Injection
controls:
  - ref: c1
    name: Input Validation
    mitigates: [t1, t2]
  - ref: c2
    name: Parameterized Queries
    mitigates: [t1]
`;

      const result = renameThreatRef(yaml, 't1', 'threat-sql-injection');

      expect(result.yamlContent).toContain('ref: threat-sql-injection');
      expect(result.yamlContent).toContain('mitigates: [threat-sql-injection, t2]');
      expect(result.yamlContent).toContain('mitigates: [threat-sql-injection]');
      expect(result.actualRef).toBe('threat-sql-injection');
    });
  });

  describe('renameControlRef', () => {
    it('should rename control ref', () => {
      const yaml = `controls:
  - ref: c1
    name: Firewall
    description: Network firewall
`;

      const result = renameControlRef(yaml, 'c1', 'control-firewall');

      expect(result.yamlContent).toContain('ref: control-firewall');
      expect(result.actualRef).toBe('control-firewall');
    });
  });

  describe('renameDataFlowRef (backward compatibility)', () => {
    it('should work as before without auto-uniquing', () => {
      const yaml = `data_flows:
  - ref: df1
    source: api
    destination: db
threats:
  - ref: t1
    name: Threat 1
    affected_data_flows: [df1]
`;

      const result = renameDataFlowRef(yaml, 'df1', 'api-to-db');

      expect(result).toContain('ref: api-to-db');
      expect(result).toContain('affected_data_flows: [api-to-db]');
    });

    it('should allow duplicate refs for backward compatibility', () => {
      const yaml = `data_flows:
  - ref: df1
    source: api
    destination: db
  - ref: api-to-db
    source: api2
    destination: db2
`;

      // This should NOT auto-unique for backward compatibility
      const result = renameDataFlowRef(yaml, 'df1', 'api-to-db');

      // Will create duplicate, but that's the old behavior
      const matches = result.match(/ref: api-to-db/g);
      expect(matches?.length).toBe(2);
    });
  });
});

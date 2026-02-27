/**
 * TypeScript type definitions for the threat model data structure
 * Based on threat_model.schema.json
 */

export type ComponentType = 'internal' | 'external' | 'data_store';

/** @deprecated Use 'external' instead. Kept for backwards compatibility with existing YAML files. */
export type LegacyComponentType = ComponentType | 'external_dependency';
export type Direction = 'unidirectional' | 'bidirectional';

export interface Asset {
  ref: string;
  name: string;
  description?: string;
}

export interface Component {
  ref: string;
  name: string;
  component_type: ComponentType;
  description?: string;
  assets?: string[];
  x?: number;
  y?: number;
}

export interface DataFlow {
  ref: string;
  source: string;
  destination: string;
  source_point?: string;
  destination_point?: string;
  direction?: Direction;
  label?: string;
}

export interface Boundary {
  ref: string;
  name: string;
  description?: string;
  components?: string[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface Threat {
  ref: string;
  name: string;
  description?: string;
  affected_components?: string[];
  affected_data_flows?: string[];
  affected_assets?: string[];
  status?: ThreatStatus;
  status_link?: string;
  status_note?: string;
}

export type ThreatStatus = 'Mitigate' | 'Accept' | 'Dismiss' | 'Evaluate';

export type ControlStatus = 'To Do' | 'In Progress' | 'Done' | 'Cancelled';

export interface Control {
  ref: string;
  name: string;
  description?: string;
  mitigates?: string[];
  implemented_in?: string[];
  status?: ControlStatus;
  status_link?: string;
  status_note?: string;
}

export interface ThreatModel {
  schema_version: string;
  name: string;
  description?: string;
  participants?: string[];
  assets?: Asset[];
  components: Component[];
  data_flows?: DataFlow[];
  boundaries?: Boundary[];
  threats?: Threat[];
  controls?: Control[];
}

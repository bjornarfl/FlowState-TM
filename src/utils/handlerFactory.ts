/**
 * Factory for creating generic field update handlers
 * Eliminates repetitive handler code for updating threat model fields
 */

import React from 'react';
import { produce } from 'immer';
import type { ThreatModel } from '../types/threatModel';

export type Section = 'components' | 'assets' | 'threats' | 'controls' | 'boundaries' | 'data_flows';

/**
 * Create a simple field update handler that updates both state and YAML
 * @param section - The section of the threat model to update
 * @param field - The field name to update
 * @returns Handler function that takes (ref, newValue)
 */
export function createSimpleFieldHandler<T extends string | number>(
  section: Section,
  field: string,
  setThreatModel: React.Dispatch<React.SetStateAction<ThreatModel | null>>,
  updateYaml: (updater: (content: string) => string) => void,
  updateYamlField: (yamlContent: string, section: string, ref: string, field: string, newValue: any) => string
) {
  return (ref: string, newValue: T): void => {
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        const items = draft[section] as any[];
        if (!items) return;
        
        const item = items.find((i: any) => i.ref === ref);
        if (item) {
          item[field] = newValue;
        }
      })
    );

    updateYaml((content) => updateYamlField(content, section, ref, field, newValue));
  };
}

/**
 * Create an array field update handler
 * @param section - The section of the threat model to update
 * @param field - The field name to update
 * @returns Handler function that takes (ref, newArray)
 */
export function createArrayFieldHandler(
  section: Section,
  field: string,
  setThreatModel: React.Dispatch<React.SetStateAction<ThreatModel | null>>,
  updateYaml: (updater: (content: string) => string) => void,
  updateYamlField: (yamlContent: string, section: string, ref: string, field: string, newValue: any) => string
) {
  return (ref: string, newArray: string[]): void => {
    setThreatModel(
      produce((draft) => {
        if (!draft) return;
        const items = draft[section] as any[];
        if (!items) return;
        
        const item = items.find((i: any) => i.ref === ref);
        if (item) {
          item[field] = newArray.length > 0 ? newArray : undefined;
        }
      })
    );

    updateYaml(
      (content) => updateYamlField(content, section, ref, field, newArray.length > 0 ? newArray : undefined)
    );
  };
}

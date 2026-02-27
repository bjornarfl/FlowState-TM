/**
 * Utility functions for generating GitHub issue content
 */

import type { Control, Threat, ThreatModel } from '../../../types/threatModel';
import type { GitHubMetadata, GitHubDomain } from '../types';

interface GitHubIssueUrlParams {
  control?: Control;
  threat?: Threat;
  threatModel: ThreatModel;
  metadata?: GitHubMetadata;
}

interface GitHubIssueContent {
  title: string;
  body: string;
  labels: string[];
}

/**
 * Generates a GitHub issue creation URL with pre-populated fields
 * This opens the GitHub new issue page for manual creation
 * @param params - Control or threat, threat model, and GitHub metadata
 * @returns GitHub issue URL or null if no metadata is available
 */
export function generateGitHubIssueUrl(params: GitHubIssueUrlParams): string | null {
  const { control, threat, threatModel, metadata } = params;

  // Return null if no GitHub metadata is available
  if (!metadata) {
    return null;
  }

  // Must have either control or threat
  if (!control && !threat) {
    return null;
  }

  const title = control
    ? `Implement threat model control: ${control.name}`
    : `Address threat: ${threat!.name}`;
  const body = control
    ? buildControlIssueBody(control, threatModel)
    : buildThreatIssueBody(threat!, threatModel);

  // Construct the URL with query parameters
  const baseUrl = `https://${metadata.domain}/${metadata.owner}/${metadata.repository}/issues/new`;
  const urlParams = new URLSearchParams({
    title,
    body,
    labels: 'security,threat-model',
  });

  return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Generates the content for a GitHub issue to be created via API
 * @param params - Control or threat and threat model data
 * @returns Issue content object ready for API
 */
export function generateGitHubIssueContent(
  params: { control?: Control; threat?: Threat; threatModel: ThreatModel }
): GitHubIssueContent {
  const { control, threat, threatModel } = params;
  
  if (control) {
    return {
      title: `Implement threat model control: ${control.name}`,
      body: buildControlIssueBody(control, threatModel),
      labels: ['security', 'threat-model'],
    };
  } else if (threat) {
    return {
      title: `Address threat: ${threat.name}`,
      body: buildThreatIssueBody(threat, threatModel),
      labels: ['security', 'threat-model', 'threat'],
    };
  }
  
  throw new Error('Either control or threat must be provided');
}

/**
 * Build the base URL for the GitHub instance
 */
export function getGitHubBaseUrl(domain: GitHubDomain): string {
  return `https://${domain}`;
}

/**
 * Builds the markdown body for a control GitHub issue
 */
function buildControlIssueBody(control: Control, threatModel: ThreatModel): string {
  const sections: string[] = [];

  // Description section
  sections.push('## Description\n');
  sections.push(control.description || 'No description provided.');
  sections.push('\n');

  // Control details section
  sections.push('## Control Details\n');
  sections.push(`**Control Ref:** ${control.ref}`);
  sections.push(`**Status:** ${control.status || 'Not set'}`);
  if (control.status_note) {
    sections.push(`**Status Note:** ${control.status_note}`);
  }
  sections.push('\n');

  // Mitigates section
  if (control.mitigates && control.mitigates.length > 0) {
    sections.push('## Mitigates Threats\n');
    control.mitigates.forEach((threatRef) => {
      const threat = threatModel.threats?.find((t) => t.ref === threatRef);
      if (threat) {
        sections.push(`- **${threat.name}** (${threat.ref})`);
        if (threat.description) {
          // Add first line of threat description
          const firstLine = threat.description.split('\n')[0].trim();
          sections.push(`  - ${firstLine}`);
        }
      } else {
        sections.push(`- ${threatRef}`);
      }
    });
    sections.push('\n');
  }

  // Implementation components section
  if (control.implemented_in && control.implemented_in.length > 0) {
    sections.push('## Implementation Components\n');
    control.implemented_in.forEach((componentRef) => {
      const component = threatModel.components?.find((c) => c.ref === componentRef);
      if (component) {
        sections.push(`- **${component.name}** (${component.component_type})`);
        if (component.description) {
          sections.push(`  - ${component.description}`);
        }
      } else {
        sections.push(`- ${componentRef}`);
      }
    });
    sections.push('\n');
  }

  // Requirements/Implementation notes section
  sections.push('## Implementation Notes\n');
  sections.push('- [ ] Review control requirements and acceptance criteria');
  sections.push('- [ ] Implement control in affected components');
  sections.push('- [ ] Add tests to verify control effectiveness');
  sections.push('- [ ] Update threat model status once complete');
  sections.push('\n');

  // Footer with threat model reference
  sections.push('---');
  sections.push(`*This issue was generated from threat model: ${threatModel.name}*`);

  return sections.join('\n');
}

/**
 * Builds the markdown body for a threat GitHub issue
 */
function buildThreatIssueBody(threat: Threat, threatModel: ThreatModel): string {
  const sections: string[] = [];

  // Description section
  sections.push('## Threat Description\n');
  sections.push(threat.description || 'No description provided.');
  sections.push('\n');

  // Threat details section
  sections.push('## Threat Details\n');
  sections.push(`**Threat Ref:** ${threat.ref}`);
  sections.push(`**Status:** ${threat.status || 'Not set'}`);
  if (threat.status_note) {
    sections.push(`**Status Note:** ${threat.status_note}`);
  }
  sections.push('\n');

  // Affected components section
  if (threat.affected_components && threat.affected_components.length > 0) {
    sections.push('## Affected Components\n');
    threat.affected_components.forEach((componentRef) => {
      const component = threatModel.components?.find((c) => c.ref === componentRef);
      if (component) {
        sections.push(`- **${component.name}** (${component.component_type})`);
        if (component.description) {
          sections.push(`  - ${component.description}`);
        }
      } else {
        sections.push(`- ${componentRef}`);
      }
    });
    sections.push('\n');
  }

  // Affected data flows section
  if (threat.affected_data_flows && threat.affected_data_flows.length > 0) {
    sections.push('## Affected Data Flows\n');
    threat.affected_data_flows.forEach((dataFlowRef) => {
      const dataFlow = threatModel.data_flows?.find((df) => df.ref === dataFlowRef);
      if (dataFlow) {
        const sourceComp = threatModel.components?.find((c) => c.ref === dataFlow.source);
        const destComp = threatModel.components?.find((c) => c.ref === dataFlow.destination);
        const flowLabel = `${sourceComp?.name || dataFlow.source} → ${destComp?.name || dataFlow.destination}`;
        sections.push(`- **${flowLabel}** (${dataFlow.ref})`);
        if (dataFlow.label) {
          sections.push(`  - ${dataFlow.label}`);
        }
      } else {
        sections.push(`- ${dataFlowRef}`);
      }
    });
    sections.push('\n');
  }

  // Affected assets section
  if (threat.affected_assets && threat.affected_assets.length > 0) {
    sections.push('## Affected Assets\n');
    threat.affected_assets.forEach((assetRef) => {
      const asset = threatModel.assets?.find((a) => a.ref === assetRef);
      if (asset) {
        sections.push(`- **${asset.name}**`);
        if (asset.description) {
          sections.push(`  - ${asset.description}`);
        }
      } else {
        sections.push(`- ${assetRef}`);
      }
    });
    sections.push('\n');
  }

  // Existing controls section
  const relatedControls = threatModel.controls?.filter((c) => 
    c.mitigates?.includes(threat.ref)
  );
  if (relatedControls && relatedControls.length > 0) {
    sections.push('## Related Controls\n');
    relatedControls.forEach((control) => {
      sections.push(`- **${control.name}** (${control.ref}) - ${control.status || 'No status'}`);
      if (control.description) {
        const firstLine = control.description.split('\n')[0].trim();
        sections.push(`  - ${firstLine}`);
      }
    });
    sections.push('\n');
  }

  // Action items section based on status
  sections.push('## Action Items\n');
  const status = threat.status;
  if (status === 'Evaluate') {
    sections.push('- [ ] Analyze threat likelihood and impact');
    sections.push('- [ ] Determine if threat is applicable to this system');
    sections.push('- [ ] Decide on mitigation strategy (Mitigate, Accept, or Dismiss)');
    sections.push('- [ ] Update threat status in threat model');
  } else if (status === 'Mitigate') {
    sections.push('- [ ] Design appropriate security controls');
    sections.push('- [ ] Implement controls in affected components');
    sections.push('- [ ] Test control effectiveness');
    sections.push('- [ ] Update threat model with control references');
  } else if (status === 'Accept') {
    sections.push('- [ ] Document risk acceptance rationale');
    sections.push('- [ ] Get approval from stakeholders');
    sections.push('- [ ] Define monitoring strategy');
    sections.push('- [ ] Update threat model with acceptance note');
  } else if (status === 'Dismiss') {
    sections.push('- [ ] Document why threat is not applicable');
    sections.push('- [ ] Update threat model with dismissal rationale');
  } else {
    sections.push('- [ ] Review threat details');
    sections.push('- [ ] Determine appropriate response');
    sections.push('- [ ] Update threat model status');
  }
  sections.push('\n');

  // Footer with threat model reference
  sections.push('---');
  sections.push(`*This issue was generated from threat model: ${threatModel.name}*`);

  return sections.join('\n');
}

/**
 * Utility functions for generating GitHub issue content
 */

import type { Control, ThreatModel } from '../types/threatModel';
import type { GitHubMetadata, GitHubDomain } from '../components/integrations/github/types';

interface GitHubIssueUrlParams {
  control: Control;
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
 * @param params - Control, threat model, and GitHub metadata
 * @returns GitHub issue URL or null if no metadata is available
 */
export function generateGitHubIssueUrl(params: GitHubIssueUrlParams): string | null {
  const { control, threatModel, metadata } = params;

  // Return null if no GitHub metadata is available
  if (!metadata) {
    return null;
  }

  const title = `Implement threat model control: ${control.name}`;
  const body = buildIssueBody(control, threatModel);

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
 * @param params - Control and threat model data
 * @returns Issue content object ready for API
 */
export function generateGitHubIssueContent(
  control: Control,
  threatModel: ThreatModel
): GitHubIssueContent {
  return {
    title: `Implement threat model control: ${control.name}`,
    body: buildIssueBody(control, threatModel),
    labels: ['security', 'threat-model'],
  };
}

/**
 * Build the base URL for the GitHub instance
 */
export function getGitHubBaseUrl(domain: GitHubDomain): string {
  return `https://${domain}`;
}

/**
 * Builds the markdown body for the GitHub issue
 */
function buildIssueBody(control: Control, threatModel: ThreatModel): string {
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

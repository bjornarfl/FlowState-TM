/**
 * Utility functions for generating HTML formatted content for Confluence
 * Modern Confluence accepts HTML when pasting content
 */

import type { ThreatModel } from '../types/threatModel';
import type { GitHubMetadata } from '../components/integrations/github/types';
import { generateShareableUrl } from './urlEncoder';

/**
 * Escape HTML special characters and convert newlines to <br> tags
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

/**
 * Generate HTML documentation from the threat model for Confluence
 */
export function generateConfluenceMarkup(
  threatModel: ThreatModel,
  githubMetadata?: GitHubMetadata | null
): string {
  const html: string[] = [];
  
  // Start HTML document
  html.push('<html><body>');
  
  // Add expandable block with useful links at the top
  html.push('<div class="ak-editor-expand" data-node-type="expand" data-title="Made with FlowState TM">');
  html.push('<div class="ak-editor-expand__title-container">');
  html.push('</div>');
  html.push('<div class="ak-editor-expand__content">');
  html.push('<p>');
  
  // Generate shareable URL for editing the threat model
  const editUrl = generateShareableUrl(threatModel, githubMetadata);
  
  html.push('- <a href="#">Learn more about FlowState</a>');
  html.push('<br>');
  html.push(`- <a href="${editUrl}">Open/Edit this Threat Model</a>`);
  
  if (githubMetadata) {
    const sourceUrl = `https://${githubMetadata.domain}/${githubMetadata.owner}/${githubMetadata.repository}/blob/${githubMetadata.branch}/${githubMetadata.path}`;
    html.push('<br>');
    html.push(`- <a href="${sourceUrl}">See Source File in GitHub</a>`);
  }
  
  html.push('</p>');
  html.push('</div>');
  html.push('</div>');
  
  // Title and description
  html.push('<h1>What are we working on?</h1>');
  html.push(`<h2>${escapeHtml(threatModel.name)}</h2>`);
  
  if (threatModel.description) {
    html.push(`<p>${escapeHtml(threatModel.description)}</p>`);
  }

  // Note about diagram in Confluence info panel format
  html.push('<h2>Data-Flow Diagram</h2>');
  html.push('<div class="ak-editor-panel" data-panel-type="info">');
  html.push('<div class="ak-editor-panel__icon" data-panel-type="info">');
  html.push('<span role="img" aria-label="info panel">');
  html.push('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">');
  html.push('<path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C9.34784 22 6.8043 20.9464 4.92893 19.0711C3.05357 17.1957 2 14.6522 2 12C2 9.34784 3.05357 6.8043 4.92893 4.92893C6.8043 3.05357 9.34784 2 12 2C14.6522 2 17.1957 3.05357 19.0711 4.92893C20.9464 6.8043 22 9.34784 22 12C22 14.6522 20.9464 17.1957 19.0711 19.0711C17.1957 20.9464 14.6522 22 12 22V22ZM12 11.375C11.6685 11.375 11.3505 11.5067 11.1161 11.7411C10.8817 11.9755 10.75 12.2935 10.75 12.625V15.75C10.75 16.0815 10.8817 16.3995 11.1161 16.6339C11.3505 16.8683 11.6685 17 12 17C12.3315 17 12.6495 16.8683 12.8839 16.6339C13.1183 16.3995 13.25 16.0815 13.25 15.75V12.625C13.25 12.2935 13.1183 11.9755 12.8839 11.7411C12.6495 11.5067 12.3315 11.375 12 11.375ZM12 9.96875C12.4558 9.96875 12.893 9.78767 13.2153 9.46534C13.5377 9.14301 13.7188 8.70584 13.7188 8.25C13.7188 7.79416 13.5377 7.35699 13.2153 7.03466C12.893 6.71233 12.4558 6.53125 12 6.53125C11.5442 6.53125 11.107 6.71233 10.7847 7.03466C10.4623 7.35699 10.2812 7.79416 10.2812 8.25C10.2812 8.70584 10.4623 9.14301 10.7847 9.46534C11.107 9.78767 11.5442 9.96875 12 9.96875Z" fill="currentColor"></path>');
  html.push('</svg>');
  html.push('</span>');
  html.push('</div>');
  html.push('<div class="ak-editor-panel__content">');
  html.push('<p>To include the data-flow diagram, use the "copy DFD as image" button and paste it here.</p>');
  html.push('</div>');
  html.push('</div>');
  html.push('<p> </p>')

  // Assets
  if (threatModel.assets && threatModel.assets.length > 0) {
    html.push('<h2>Assets</h2>');
    html.push('<table border="1" cellpadding="8" cellspacing="0" style="width: 100%;">');
    html.push('<thead><tr>');
    html.push('<th style="background-color: #FFFAE6; text-align: left;" data-cell-background="#fffae6" colorname="Light yellow" data-colwidth="200"><b>Asset Name</b></th>');
    html.push('<th style="background-color: #FFFAE6; text-align: left;" data-cell-background="#fffae6" colorname="Light yellow" data-colwidth="600"><b>Asset Description</b></th>');
    html.push('</tr></thead>');
    html.push('<tbody>');
    threatModel.assets.forEach((asset) => {
      const description = asset.description || '';
      html.push('<tr>');
      html.push(`<td><b>${escapeHtml(asset.name)}</b></td>`);
      html.push(`<td>${escapeHtml(description)}</td>`);
      html.push('</tr>');
    });
    html.push('</tbody></table>');
  }

  // Threats
  if (threatModel.threats && threatModel.threats.length > 0) {
    html.push('<h1>What can go wrong?</h1>');
    html.push('<h2>Threats</h2>');
    html.push('<table border="1" cellpadding="8" cellspacing="0" style="width: 100%;">');
    html.push('<thead><tr>');
    html.push('<th style="background-color: #FFEBE6; text-align: left;" data-cell-background="#ffebe6" colorname="Light red" data-colwidth="200"><b>Threat Name</b></th>');
    html.push('<th style="background-color: #FFEBE6; text-align: left;" data-cell-background="#ffebe6" colorname="Light red" data-colwidth="600"><b>Threat Description</b></th>');
    html.push('</tr></thead>');
    html.push('<tbody>');
    threatModel.threats.forEach((threat) => {
      const description = threat.description || '';
      html.push('<tr>');
      html.push(`<td><b>${escapeHtml(threat.name)}</b></td>`);
      html.push(`<td>${escapeHtml(description)}</td>`);
      html.push('</tr>');
    });
    html.push('</tbody></table>');
  }

  // Controls
  if (threatModel.controls && threatModel.controls.length > 0) {
    html.push('<h1>What are we going to do about it?</h1>');
    html.push('<h2>Controls</h2>');
    html.push('<table border="1" cellpadding="8" cellspacing="0" style="width: 100%;">');
    html.push('<thead><tr>');
    html.push('<th style="background-color: #E3FCEF; text-align: left;" data-cell-background="#e3fcef" colorname="Light green" data-colwidth="200"><b>Control Name</b></th>');
    html.push('<th style="background-color: #E3FCEF; text-align: left;" data-cell-background="#e3fcef" colorname="Light green" data-colwidth="400"><b>Control Description</b></th>');
    html.push('<th style="background-color: #E3FCEF; text-align: left;" data-cell-background="#e3fcef" colorname="Light green" data-colwidth="200"><b>Mitigates</b></th>');
    html.push('</tr></thead>');
    html.push('<tbody>');
    threatModel.controls.forEach((control) => {
      const description = control.description || '';     
      const mitigates = control.mitigates
        ? control.mitigates
            .map((threatRef) => {
              const threat = threatModel.threats?.find((t) => t.ref === threatRef);
              return threat?.name || threatRef;
            })
            .join(', ')
        : '';
      html.push('<tr>');
      html.push(`<td><b>${escapeHtml(control.name)}</b></td>`);
      html.push(`<td>${escapeHtml(description)}</td>`);
      html.push(`<td>${escapeHtml(mitigates)}</td>`);
      html.push('</tr>');
    });
    html.push('</tbody></table>');
  }

  // Close HTML document
  html.push('</body></html>');

  return html.join('');
}

/**
 * Copy HTML content to clipboard with both HTML and plain text fallback
 */
export async function copyConfluenceToClipboard(
  htmlContent: string
): Promise<void> {
  // Create a blob with HTML content
  const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
  
  // Also create a plain text version as fallback
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  const textBlob = new Blob([textContent], { type: 'text/plain' });
  
  // Use the ClipboardItem API to write both formats
  const clipboardItem = new ClipboardItem({
    'text/html': htmlBlob,
    'text/plain': textBlob,
  });
  
  await navigator.clipboard.write([clipboardItem]);
}
/**
 * Custom hook for diagram export functionality
 * Handles capturing the diagram and exporting to various formats
 */

import { useCallback } from 'react';
import { toSvg } from 'html-to-image';
import JSZip from 'jszip';
import type { ThreatModel } from '../types/threatModel';
import type { GitHubMetadata } from '../components/integrations/github/types';
import { generateConfluenceMarkup, copyConfluenceToClipboard } from '../utils/confluenceFormatter';

/**
 * Generate markdown documentation from the threat model
 * @param includePngReference - If true, includes a reference to a PNG file. If false, embeds diagram as Mermaid.
 */
function generateMarkdown(
  threatModel: ThreatModel,
  modelName?: string,
  githubMetadata?: GitHubMetadata | null,
  includePngReference: boolean = true
): string {
  const lines: string[] = [];
  lines.push(`# What are we working on?`);
  lines.push(`## ${threatModel.name}`);
  lines.push('');
  if (threatModel.description) {
    lines.push(threatModel.description);
    lines.push('');
  }

  // Include diagram
  const fileName = (modelName || threatModel.name || 'threat_model').replace(/\s+/g, '_').toLowerCase();
  lines.push('## Data-Flow Diagram');
  lines.push('');
  
  if (includePngReference && modelName) {
    // Scenario 1: Link to PNG file (for zip downloads)
    lines.push(`![Threat Model Diagram](${fileName}_diagram.png)`);
    lines.push('');
  } else {
    // Scenario 2: Embed diagram as Mermaid (for copy to clipboard)
    lines.push('```mermaid');
    lines.push('graph LR');
    
    // Build a map of component ref to index for easy lookup
    const componentRefToIdx = new Map<string, number>();
    threatModel.components?.forEach((component, idx) => {
      componentRefToIdx.set(component.ref, idx);
    });
    
    // Helper function to generate component node
    const generateComponentNode = (component: typeof threatModel.components[0], idx: number, indent: string = '    ') => {
      const nodeId = `C${idx}`;
      const nodeName = component.name.replace(/["\[\]]/g, '');
      
      // Different shapes for different component types
      if (component.component_type === 'data_store') {
        lines.push(`${indent}${nodeId}[(${nodeName})]`);
      } else if (component.component_type === 'external_dependency') {
        lines.push(`${indent}${nodeId}[${nodeName}]`);
      } else {
        lines.push(`${indent}${nodeId}(${nodeName})`);
      }
    };
    
    // Check if any component belongs to multiple boundaries
    const componentBoundaryCount = new Map<string, number>();
    
    if (threatModel.boundaries && threatModel.boundaries.length > 0) {
      threatModel.boundaries.forEach((boundary) => {
        if (boundary.components && boundary.components.length > 0) {
          boundary.components.forEach((componentRef) => {
            const count = componentBoundaryCount.get(componentRef) || 0;
            componentBoundaryCount.set(componentRef, count + 1);
          });
        }
      });
    }
    
    // Check if there are any overlapping boundaries
    const hasOverlappingBoundaries = Array.from(componentBoundaryCount.values()).some(count => count > 1);
    
    // Generate boundaries as subgraphs only if there are no overlapping boundaries
    if (!hasOverlappingBoundaries && threatModel.boundaries && threatModel.boundaries.length > 0) {
      const componentsInBoundaries = new Set<string>();
      
      threatModel.boundaries.forEach((boundary, boundaryIdx) => {
        const boundaryName = boundary.name.replace(/["\[\]]/g, '');
        
        if (boundary.components && boundary.components.length > 0) {
          lines.push(`    subgraph B${boundaryIdx}["${boundaryName}"]`);
          
          boundary.components.forEach((componentRef) => {
            const idx = componentRefToIdx.get(componentRef);
            if (idx !== undefined) {
              const component = threatModel.components[idx];
              generateComponentNode(component, idx, '        ');
              componentsInBoundaries.add(componentRef);
            }
          });
          
          lines.push('    end');
        }
      });
      lines.push('');
      
      // Generate nodes for components not in any boundary
      if (threatModel.components && threatModel.components.length > 0) {
        const unboundedComponents = threatModel.components.filter(
          (component) => !componentsInBoundaries.has(component.ref)
        );
        
        if (unboundedComponents.length > 0) {
          unboundedComponents.forEach((component) => {
            const idx = componentRefToIdx.get(component.ref);
            if (idx !== undefined) {
              generateComponentNode(component, idx);
            }
          });
          lines.push('');
        }
      }
    } else {
      // No boundaries or overlapping boundaries - render all components without subgraphs
      if (threatModel.components && threatModel.components.length > 0) {
        threatModel.components.forEach((component) => {
          const idx = componentRefToIdx.get(component.ref);
          if (idx !== undefined) {
            generateComponentNode(component, idx);
          }
        });
        lines.push('');
      }
    }
    
    // Generate Mermaid edges for data flows
    if (threatModel.data_flows && threatModel.data_flows.length > 0) {
      threatModel.data_flows.forEach((flow) => {
        const sourceIdx = componentRefToIdx.get(flow.source);
        const targetIdx = componentRefToIdx.get(flow.destination);
        
        if (sourceIdx !== undefined && targetIdx !== undefined) {
          const sourceId = `C${sourceIdx}`;
          const targetId = `C${targetIdx}`;
          const label = flow.label ? flow.label.replace(/["\[\]]/g, '') : '';
          
          if (flow.direction === 'bidirectional') {
            lines.push(`    ${sourceId} <-->|${label}| ${targetId}`);
          } else {
            lines.push(`    ${sourceId} -->|${label}| ${targetId}`);
          }
        }
      });
    }
    
    lines.push('```');
    lines.push('');
  }

  // Assets
  if (threatModel.assets && threatModel.assets.length > 0) {
    lines.push('## Assets');
    lines.push('');
    lines.push('| Name | Description |');
    lines.push('|------|-------------|');
    threatModel.assets.forEach((asset) => {
      const description = asset.description || '';
      const escapedDescription = description.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| ${asset.name} | ${escapedDescription} |`);
    });
    lines.push('');
  }

  // Components
  if (threatModel.components && threatModel.components.length > 0) {
    lines.push('## Components');
    lines.push('');
    lines.push('| Name | Type | Description | Assets |');
    lines.push('|------|------|-------------|--------|');
    threatModel.components.forEach((component) => {
      const description = component.description || '';
      const escapedDescription = description.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const assets = component.assets
        ? component.assets
            .map((assetRef) => {
              const asset = threatModel.assets?.find((a) => a.ref === assetRef);
              return asset?.name || assetRef;
            })
            .join(', ')
        : '';
      lines.push(`| ${component.name} | ${component.component_type} | ${escapedDescription} | ${assets} |`);
    });
    lines.push('');
  }

  // Threats
  if (threatModel.threats && threatModel.threats.length > 0) {
    lines.push('# What can go wrong?');
    lines.push('## Threats');
    lines.push('');
    lines.push('| Name | Description | Affected Components | Affected Assets |');
    lines.push('|------|-------------|---------------------|-----------------|');
    threatModel.threats.forEach((threat) => {
      const description = threat.description || '';
      const escapedDescription = description.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const components = threat.affected_components
        ? threat.affected_components
            .map((compRef) => {
              const comp = threatModel.components?.find((c) => c.ref === compRef);
              return comp?.name || compRef;
            })
            .join(', ')
        : '';
      const assets = threat.affected_assets
        ? threat.affected_assets
            .map((assetRef) => {
              const asset = threatModel.assets?.find((a) => a.ref === assetRef);
              return asset?.name || assetRef;
            })
            .join(', ')
        : '';
      lines.push(`| ${threat.name} | ${escapedDescription} | ${components} | ${assets} |`);
    });
    lines.push('');
  }

  // Controls
  if (threatModel.controls && threatModel.controls.length > 0) {
    lines.push('# What are we going to do about it?');
    lines.push('## Controls');
    lines.push('');
    lines.push('| Name | Description | Mitigates | Implemented In |');
    lines.push('|------|-------------|-----------|----------------|');
    threatModel.controls.forEach((control) => {
      const description = control.description || '';
      const escapedDescription = description.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const mitigates = control.mitigates
        ? control.mitigates
            .map((threatRef) => {
              const threat = threatModel.threats?.find((t) => t.ref === threatRef);
              return threat?.name || threatRef;
            })
            .join(', ')
        : '';
      const implemented = control.implemented_in
        ? control.implemented_in
            .map((compRef) => {
              const comp = threatModel.components?.find((c) => c.ref === compRef);
              return comp?.name || compRef;
            })
            .join(', ')
        : '';
      lines.push(`| ${control.name} | ${escapedDescription} | ${mitigates} | ${implemented} |`);
    });
    lines.push('');
  }

  // Footer with FlowState TM link
  lines.push('---');
  lines.push('');
  if (githubMetadata) {
    const url = `https://${window.location.host}/github/${githubMetadata.owner}/${githubMetadata.repository}/${githubMetadata.path}?branch=${githubMetadata.branch}`;
    const url2 = `https://${githubMetadata.domain}/${githubMetadata.owner}/${githubMetadata.repository}/blob/${githubMetadata.branch}/.threat-models/${githubMetadata.path}`;
    lines.push(`[Made with FlowState TM](https://github.com/bjornarfl/FlowState-TM) - [See Source File on GitHub](${url2}) - Edit source file [here](${url})`);
  } else {
    lines.push('[Made with FlowState TM](https://github.com/bjornarfl/FlowState-TM)');
  }

  return lines.join('\n');
}

/**
 * Export the generateMarkdown function for use in other components
 */
export { generateMarkdown };

export function useDiagramExport(
  threatModel: ThreatModel | null,
  isDarkMode: boolean,
  githubMetadata?: GitHubMetadata | null
) {
  /**
   * Capture the diagram as an image
   * @param scale - Scale factor for the image (1 = normal, 3 = high resolution)
   * @returns Data URL of the captured image
   */
  const captureDiagram = useCallback(async (scale: number = 1): Promise<string | undefined> => {
    try {
      const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
      if (!reactFlowElement) return undefined;

      // Determine colors based on theme
      const edgeColor = isDarkMode ? '#ffffff' : '#000000';
      const backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff';

      // Get the viewport element that contains all nodes and edges
      const viewport = reactFlowElement.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) return undefined;

      // Hide controls, minimap, and background for clean export
      const controls = reactFlowElement.querySelector('.react-flow__controls') as HTMLElement;
      const minimap = reactFlowElement.querySelector('.react-flow__minimap') as HTMLElement;
      const background = reactFlowElement.querySelector('.react-flow__background') as HTMLElement;
      
      if (controls) controls.style.display = 'none';
      if (minimap) minimap.style.display = 'none';
      if (background) background.style.display = 'none';
      
      // Hide animated edge dots
      const animatedDots = reactFlowElement.querySelectorAll('.react-flow__edge circle');
      animatedDots.forEach((dot) => {
        (dot as HTMLElement).style.display = 'none';
      });
      
      // Temporarily add explicit inline styles to edge paths for export
      const edgePaths = reactFlowElement.querySelectorAll('.react-flow__edge path');
      const originalStyles: { element: Element; style: string }[] = [];
      edgePaths.forEach((path) => {
        const pathEl = path as SVGPathElement;
        originalStyles.push({ element: pathEl, style: pathEl.getAttribute('style') || '' });
        pathEl.style.stroke = edgeColor;
        pathEl.style.strokeWidth = '2';
        pathEl.style.fill = 'none';
      });
      
      // Copy marker definitions into the ReactFlow SVG
      const edgesSvg = reactFlowElement.querySelector('.react-flow__edges svg, .react-flow__viewport svg');
      const markerDefs = document.querySelector('svg > defs');
      let clonedDefs: Node | null = null;
      if (edgesSvg && markerDefs) {
        clonedDefs = markerDefs.cloneNode(true);
        const polygons = (clonedDefs as Element).querySelectorAll('polygon');
        polygons.forEach((polygon) => {
          polygon.setAttribute('fill', edgeColor);
        });
        edgesSvg.insertBefore(clonedDefs, edgesSvg.firstChild);
      }

      // Calculate the bounding box of all nodes using their actual positions
      const nodes = viewport.querySelectorAll('.react-flow__node');
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      // Parse viewport transform to get current pan/zoom
      const transform = viewport.style.transform;
      const transformMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/);
      const viewportX = transformMatch ? parseFloat(transformMatch[1]) : 0;
      const viewportY = transformMatch ? parseFloat(transformMatch[2]) : 0;
      const viewportZoom = transformMatch ? parseFloat(transformMatch[3]) : 1;
      
      nodes.forEach((node) => {
        const nodeElement = node as HTMLElement;
        // ReactFlow stores actual node positions in data attributes or we can parse from transform
        const nodeTransform = nodeElement.style.transform;
        const nodeMatch = nodeTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        
        if (nodeMatch) {
          const x = parseFloat(nodeMatch[1]);
          const y = parseFloat(nodeMatch[2]);
          const width = nodeElement.offsetWidth;
          const height = nodeElement.offsetHeight;
          
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + width);
          maxY = Math.max(maxY, y + height);
        }
      });

      // Add padding around the diagram
      const padding = 40;
      const contentX = minX - padding;
      const contentY = minY - padding;
      const contentWidth = maxX - minX + (padding * 2);
      const contentHeight = maxY - minY + (padding * 2);
      
      // Convert viewport to SVG with proper dimensions
      const svgDataUrl = await toSvg(viewport, {
        filter: () => true,
        backgroundColor,
        width: contentWidth,
        height: contentHeight,
        style: {
          transform: `translate(${-contentX}px, ${-contentY}px) scale(1)`,
          transformOrigin: 'top left',
        },
      });
      
      // Remove the cloned defs
      if (clonedDefs && clonedDefs.parentNode) {
        clonedDefs.parentNode.removeChild(clonedDefs);
      }
      
      // Restore original styles
      originalStyles.forEach(({ element, style }) => {
        if (style) {
          element.setAttribute('style', style);
        } else {
          element.removeAttribute('style');
        }
      });
      
      // Convert SVG to PNG with proper dimensions
      const img: HTMLImageElement = new (window.Image as any)();
      img.src = svgDataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      
      const canvas = document.createElement('canvas');
      canvas.width = contentWidth * scale;
      canvas.height = contentHeight * scale;
      const ctx = canvas.getContext('2d');
      let diagramImage: string | undefined;
      if (ctx) {
        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the diagram
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        diagramImage = canvas.toDataURL('image/png');
      }
      
      // Restore controls, minimap, background, and animated dots
      if (controls) controls.style.display = '';
      if (minimap) minimap.style.display = '';
      if (background) background.style.display = '';
      animatedDots.forEach((dot) => {
        (dot as HTMLElement).style.display = '';
      });
      
      return diagramImage;
    } catch (err) {
      console.error('Failed to capture diagram:', err);
      return undefined;
    }
  }, [isDarkMode]);

  const handleDownloadMarkdown = useCallback(async (): Promise<void> => {
    if (threatModel) {
      const modelName = threatModel.name || 'threat_model';
      
      const markdown = generateMarkdown(threatModel, modelName, githubMetadata, false);
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${modelName.replace(/\s+/g, '_').toLowerCase()}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [threatModel, captureDiagram, githubMetadata]);

  const handleDownloadPng = useCallback(async (): Promise<void> => {
    const modelName = threatModel?.name || 'threat_model';
    const diagramImage = await captureDiagram(3); // 3x scale for high resolution
    
    if (diagramImage) {
      const link = document.createElement('a');
      link.href = diagramImage;
      link.download = `${modelName.replace(/\s+/g, '_').toLowerCase()}_diagram.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [threatModel?.name, captureDiagram]);

  const handleDownloadFolder = useCallback(async (yamlContent: string): Promise<void> => {
    if (!threatModel) {
      return;
    }

    const modelName = threatModel.name || 'threat_model';
    const folderName = modelName.replace(/\s+/g, '_').toLowerCase();

    try {
      const zip = new JSZip();
      const folder = zip.folder(folderName);
      if (!folder) {
        throw new Error('Failed to create folder in zip');
      }

      // Add YAML file
      folder.file(`${folderName}.yaml`, yamlContent);

      // Add Markdown file (with PNG reference since PNG is in the same folder)
      const markdown = generateMarkdown(threatModel, modelName, githubMetadata, true);
      folder.file(`${folderName}.md`, markdown);

      // Add PNG diagram
      const pngImage = await captureDiagram(3); // 3x scale for high resolution
      if (pngImage) {
        // Convert data URL to blob
        const base64Data = pngImage.split(',')[1];
        folder.file(`${folderName}_diagram.png`, base64Data, { base64: true });
      }

      // Generate zip and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to create downloadable folder:', error);
    }
  }, [threatModel, captureDiagram, githubMetadata]);

  const handleCopyToConfluence = useCallback(async (): Promise<boolean> => {
    if (!threatModel) {
      return false;
    }

    try {
      const confluenceMarkup = generateConfluenceMarkup(threatModel, githubMetadata);
      await copyConfluenceToClipboard(confluenceMarkup);
      return true;
    } catch (error) {
      console.error('Failed to copy Confluence markup to clipboard:', error);
      return false;
    }
  }, [threatModel, githubMetadata]);

  const handleCopyDiagramToClipboard = useCallback(async (): Promise<boolean> => {
    try {
      const diagramImage = await captureDiagram(3); // 3x scale for high resolution
      
      if (!diagramImage) {
        return false;
      }

      // Convert data URL to blob without using fetch (to avoid CSP issues)
      const base64Data = diagramImage.split(',')[1];
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      
      // Write image to clipboard
      const clipboardItem = new ClipboardItem({
        'image/png': blob,
      });
      
      await navigator.clipboard.write([clipboardItem]);
      return true;
    } catch (error) {
      console.error('Failed to copy diagram to clipboard:', error);
      return false;
    }
  }, [captureDiagram]);

  return {
    captureDiagram,
    handleDownloadMarkdown,
    handleDownloadPng,
    handleDownloadFolder,
    handleCopyToConfluence,
    handleCopyDiagramToClipboard,
  };
}

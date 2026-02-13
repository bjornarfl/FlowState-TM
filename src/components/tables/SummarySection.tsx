import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Target, Database, GitBranch, Box, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ThreatModel, DataFlow, Threat, Control } from '../../types/threatModel';
import type { ThreatsTableRef } from './ThreatsTable';
import type { ControlsTableRef } from './ControlsTable';
import './SummarySection.css';

interface SummarySectionProps {
  threatModel: ThreatModel | null;
  threatsTableRef?: React.RefObject<ThreatsTableRef | null>;
  controlsTableRef?: React.RefObject<ControlsTableRef | null>;
  onExpandThreatsSection?: () => void;
  onExpandControlsSection?: () => void;
}

const SummarySection: React.FC<SummarySectionProps> = ({ 
  threatModel, 
  threatsTableRef,
  controlsTableRef,
  onExpandThreatsSection,
  onExpandControlsSection,
}) => {
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

  if (!threatModel) {
    return (
      <div className="summary-section">
        <p className="summary-empty-state">No threat model data available.</p>
      </div>
    );
  }

  // Helper function to get progress bar color class
  const getProgressBarClass = (percentage: number): string => {
    if (percentage >= 100) return 'summary-progress-fill-complete';
    if (percentage < 25) return 'summary-progress-fill-warning';
    return 'summary-progress-fill';
  };

  const toggleMetric = (metricId: string) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metricId)) {
        next.delete(metricId);
      } else {
        next.add(metricId);
      }
      return next;
    });
  };

  const handleThreatClick = (threat: Threat) => {
    if (onExpandThreatsSection) {
      onExpandThreatsSection();
    }
    // Small delay to allow section to expand before focusing
    setTimeout(() => {
      if (threatsTableRef?.current && threatModel?.threats) {
        const rowIndex = threatModel.threats.findIndex(t => t.ref === threat.ref);
        if (rowIndex !== -1) {
          threatsTableRef.current.focusCellByColumn('name', rowIndex);
        }
      }
    }, 100);
  };

  const handleControlClick = (control: Control) => {
    if (onExpandControlsSection) {
      onExpandControlsSection();
    }
    // Small delay to allow section to expand before focusing
    setTimeout(() => {
      if (controlsTableRef?.current && threatModel?.controls) {
        const rowIndex = threatModel.controls.findIndex(c => c.ref === control.ref);
        if (rowIndex !== -1) {
          controlsTableRef.current.focusCellByColumnIndex(0, rowIndex); // 0 = name column
        }
      }
    }, 100);
  };

  const components = threatModel.components || [];
  const assets = threatModel.assets || [];
  const dataflows = threatModel.data_flows || [];
  const boundaries = threatModel.boundaries || [];
  const threats = threatModel.threats || [];
  const controls = threatModel.controls || [];

  // Calculate threat status distribution
  const threatStatusCounts = {
    evaluate: threats.filter(t => t.status === 'Evaluate').length,
    mitigate: threats.filter(t => t.status === 'Mitigate').length,
    accept: threats.filter(t => t.status === 'Accept').length,
    dismiss: threats.filter(t => t.status === 'Dismiss').length,
    noStatus: threats.filter(t => !t.status).length,
  };

  // Calculate control status distribution
  const controlStatusCounts = {
    toDo: controls.filter(c => c.status === 'To Do').length,
    inProgress: controls.filter(c => c.status === 'In Progress').length,
    done: controls.filter(c => c.status === 'Done').length,
    cancelled: controls.filter(c => c.status === 'Cancelled').length,
    noStatus: controls.filter(c => !c.status).length,
  };

  // Calculate coverage metrics
  const threatsWithControlsList = threats.filter(threat => {
    return controls.some(control => control.mitigates?.includes(threat.ref) && control.status !== 'Cancelled');
  });
  const threatsWithoutControlsList = threats.filter(threat => {
    return !controls.some(control => control.mitigates?.includes(threat.ref) && control.status !== 'Cancelled');
  });
  const threatsWithControls = threatsWithControlsList.length;

  const unmitigatedThreatsList = threats.filter(threat => {
    const hasNonCancelledControls = controls.some(
      control => control.mitigates?.includes(threat.ref) && control.status !== 'Cancelled'
    );
    const isResolved = threat.status === 'Accept' || threat.status === 'Dismiss';
    return !hasNonCancelledControls && !isResolved;
  });

  const threatsInEvaluateList = threats.filter(t => t.status === 'Evaluate');

  const orphanedControlsList = controls.filter(control => {
    return !control.mitigates || control.mitigates.length === 0;
  });

  // Calculate DFD validation warnings
  const componentsInDataflows = new Set<string>();
  dataflows.forEach((df: DataFlow) => {
    if (df.source) componentsInDataflows.add(df.source);
    if (df.destination) componentsInDataflows.add(df.destination);
  });
  const isolatedComponents = components.filter(c => !componentsInDataflows.has(c.ref)).length;

  const emptyBoundaries = boundaries.filter(b => !b.components || b.components.length === 0).length;

  // Calculate completion percentages
  // For threats with "Mitigate" status, only count as resolved if they have at least one control
  // and all related controls are "Done"
  const resolvedThreatsList = threats.filter(threat => {
    if (threat.status === 'Accept' || threat.status === 'Dismiss') {
      return true;
    }
    if (threat.status === 'Mitigate') {
      const relatedControls = controls.filter(control => control.mitigates?.includes(threat.ref));
      if (relatedControls.length === 0) {
        return false; // No controls, so not resolved
      }
      // All related controls must be "Done"
      return relatedControls.every(control => control.status === 'Done');
    }
    return false;
  });
  const unresolvedThreatsList = threats.filter(threat => !resolvedThreatsList.includes(threat));
  const resolvedThreats = resolvedThreatsList.length;

  const threatResolutionRate = threats.length > 0 
    ? (resolvedThreats / threats.length) * 100 
    : 0;

  const controlCompletionRate = controls.length > 0 
    ? ((controlStatusCounts.done + controlStatusCounts.cancelled) / controls.length) * 100 
    : 0;

  const implementedControlsList = controls.filter(c => c.status === 'Done' || c.status === 'Cancelled');
  const notImplementedControlsList = controls.filter(c => c.status !== 'Done' && c.status !== 'Cancelled');

  const threatCoverageRate = threats.length > 0 
    ? (threatsWithControls / threats.length) * 100 
    : 0;

  // Determine if we have critical action items
  const hasActionItems = unmitigatedThreatsList.length > 0 || threatsInEvaluateList.length > 0 || orphanedControlsList.length > 0 || isolatedComponents > 0 || emptyBoundaries > 0;

  return (
    <div className="summary-section">
      {/* Action Items - only show if there are issues */}
      {hasActionItems && (
        <div className="summary-subsection summary-action-items">
          <h3 className="summary-subsection-title">
            <AlertCircle size={16} />
            <span>Action Items</span>
          </h3>
          <div className="summary-action-list">
            {unmitigatedThreatsList.length > 0 && (
              <div className="summary-action-item">
                <AlertTriangle size={14} className="summary-action-icon" />
                <div className="summary-action-content">
                  <span className="summary-action-text">
                    <strong>{unmitigatedThreatsList.length}</strong> {unmitigatedThreatsList.length === 1 ? 'threat has' : 'threats have'} no mitigating controls and {unmitigatedThreatsList.length === 1 ? 'is' : 'are'} not accepted or dismissed:
                  </span>
                  <ul className="summary-action-items-list">
                    {unmitigatedThreatsList.map(threat => (
                      <li key={threat.ref} className="summary-clickable-item" onClick={() => handleThreatClick(threat)}>{threat.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {threatsInEvaluateList.length > 0 && (
              <div className="summary-action-item">
                <AlertCircle size={14} className="summary-action-icon" />
                <div className="summary-action-content">
                  <span className="summary-action-text">
                    <strong>{threatsInEvaluateList.length}</strong> {threatsInEvaluateList.length === 1 ? 'threat needs' : 'threats need'} evaluation:
                  </span>
                  <ul className="summary-action-items-list">
                    {threatsInEvaluateList.map(threat => (
                      <li key={threat.ref} className="summary-clickable-item" onClick={() => handleThreatClick(threat)}>{threat.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {orphanedControlsList.length > 0 && (
              <div className="summary-action-item">
                <Shield size={14} className="summary-action-icon" />
                <div className="summary-action-content">
                  <span className="summary-action-text">
                    <strong>{orphanedControlsList.length}</strong> {orphanedControlsList.length === 1 ? 'control is' : 'controls are'} not mitigating any threats:
                  </span>
                  <ul className="summary-action-items-list">
                    {orphanedControlsList.map(control => (
                      <li key={control.ref} className="summary-clickable-item" onClick={() => handleControlClick(control)}>{control.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {isolatedComponents > 0 && (
              <div className="summary-action-item">
                <Box size={14} className="summary-action-icon" />
                <span className="summary-action-text">
                  <strong>{isolatedComponents}</strong> {isolatedComponents === 1 ? 'component is' : 'components are'} not connected to any data flows
                </span>
              </div>
            )}
            {emptyBoundaries > 0 && (
              <div className="summary-action-item">
                <GitBranch size={14} className="summary-action-icon" />
                <span className="summary-action-text">
                  <strong>{emptyBoundaries}</strong> {emptyBoundaries === 1 ? 'boundary has' : 'boundaries have'} no components
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Core Completeness */}
      <div className="summary-subsection">
        <h3 className="summary-subsection-title">
          <Target size={16} />
          <span>Core Completeness</span>
        </h3>
        <div className="summary-stats-grid">
          <div className="summary-stat-card">
            <Box size={14} className="summary-stat-icon" />
            <div className="summary-stat-label">Components</div>
            <div className={`summary-stat-value ${components.length === 0 ? 'summary-stat-warning' : ''}`}>{components.length}</div>
          </div>
          <div className="summary-stat-card">
            <Database size={14} className="summary-stat-icon" />
            <div className="summary-stat-label">Assets</div>
            <div className={`summary-stat-value ${assets.length === 0 ? 'summary-stat-warning' : ''}`}>{assets.length}</div>
          </div>
          <div className="summary-stat-card">
            <GitBranch size={14} className="summary-stat-icon" />
            <div className="summary-stat-label">Data Flows</div>
            <div className={`summary-stat-value ${dataflows.length === 0 ? 'summary-stat-warning' : ''}`}>{dataflows.length}</div>
          </div>
          <div className="summary-stat-card">
            <AlertTriangle size={14} className="summary-stat-icon" />
            <div className="summary-stat-label">Threats</div>
            <div className={`summary-stat-value ${threats.length === 0 ? 'summary-stat-warning' : ''}`}>{threats.length}</div>
          </div>
          <div className="summary-stat-card">
            <Shield size={14} className="summary-stat-icon" />
            <div className="summary-stat-label">Controls</div>
            <div className={`summary-stat-value ${controls.length === 0 ? 'summary-stat-warning' : ''}`}>{controls.length}</div>
          </div>
        </div>
      </div>

      {/* Coverage & Mitigation */}
      <div className="summary-subsection">
        <h3 className="summary-subsection-title">
          <Shield size={16} />
          <span>Coverage & Mitigation</span>
        </h3>
        <div className="summary-metrics">
          <div className="summary-metric-row">
            <div 
              className="summary-metric-header summary-metric-expandable"
              onClick={() => toggleMetric('threatCoverage')}
            >
              <div className="summary-metric-header-content">
                {expandedMetrics.has('threatCoverage') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div className="summary-metric-label">Threats with Controls</div>
              </div>
              <div className="summary-metric-value">
                <span className="summary-metric-main">{threatsWithControls} of {threats.length}</span>
                {threats.length > 0 && (
                  <span className="summary-metric-percentage">({threatCoverageRate.toFixed(0)}%)</span>
                )}
              </div>
            </div>
            {threats.length > 0 && (
              <div className="summary-progress-bar">
                <div 
                  className={getProgressBarClass(threatCoverageRate)}
                  style={{ width: `${threatCoverageRate}%` }}
                />
              </div>
            )}
            {expandedMetrics.has('threatCoverage') && (
              <div className="summary-metric-details">
                {threatsWithControlsList.length > 0 && (
                  <div className="summary-metric-detail-section">
                    <div className="summary-metric-detail-header">With Controls ({threatsWithControlsList.length}):</div>
                    <ul className="summary-metric-items-list">
                      {threatsWithControlsList.map(threat => (
                        <li key={threat.ref} className="summary-clickable-item" onClick={() => handleThreatClick(threat)}>{threat.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {threatsWithoutControlsList.length > 0 && (
                  <div className="summary-metric-detail-section">
                    <div className="summary-metric-detail-header">Without Controls ({threatsWithoutControlsList.length}):</div>
                    <ul className="summary-metric-items-list">
                      {threatsWithoutControlsList.map(threat => (
                        <li key={threat.ref} className="summary-clickable-item" onClick={() => handleThreatClick(threat)}>{threat.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="summary-metric-row">
            <div 
              className="summary-metric-header summary-metric-expandable"
              onClick={() => toggleMetric('threatResolution')}
            >
              <div className="summary-metric-header-content">
                {expandedMetrics.has('threatResolution') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div className="summary-metric-label">Threat Resolution</div>
              </div>
              <div className="summary-metric-value">
                <span className="summary-metric-main">
                  {resolvedThreats} of {threats.length}
                </span>
                {threats.length > 0 && (
                  <span className="summary-metric-percentage">({threatResolutionRate.toFixed(0)}%)</span>
                )}
              </div>
            </div>
            {threats.length > 0 && (
              <div className="summary-progress-bar">
                <div 
                  className={getProgressBarClass(threatResolutionRate)}
                  style={{ width: `${threatResolutionRate}%` }}
                />
              </div>
            )}
            {expandedMetrics.has('threatResolution') && (
              <div className="summary-metric-details">
                {resolvedThreatsList.length > 0 && (
                  <div className="summary-metric-detail-section">
                    <div className="summary-metric-detail-header">Resolved ({resolvedThreatsList.length}):</div>
                    <ul className="summary-metric-items-list">
                      {resolvedThreatsList.map(threat => (
                        <li key={threat.ref} className="summary-clickable-item" onClick={() => handleThreatClick(threat)}>{threat.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {unresolvedThreatsList.length > 0 && (
                  <div className="summary-metric-detail-section">
                    <div className="summary-metric-detail-header">Not Resolved ({unresolvedThreatsList.length}):</div>
                    <ul className="summary-metric-items-list">
                      {unresolvedThreatsList.map(threat => (
                        <li key={threat.ref} className="summary-clickable-item" onClick={() => handleThreatClick(threat)}>{threat.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="summary-metric-row">
            <div 
              className="summary-metric-header summary-metric-expandable"
              onClick={() => toggleMetric('controlImplementation')}
            >
              <div className="summary-metric-header-content">
                {expandedMetrics.has('controlImplementation') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div className="summary-metric-label">Control Implementation</div>
              </div>
              <div className="summary-metric-value">
                <span className="summary-metric-main">
                  {controlStatusCounts.done + controlStatusCounts.cancelled} of {controls.length}
                </span>
                {controls.length > 0 && (
                  <span className="summary-metric-percentage">({controlCompletionRate.toFixed(0)}%)</span>
                )}
              </div>
            </div>
            {controls.length > 0 && (
              <div className="summary-progress-bar">
                <div 
                  className={getProgressBarClass(controlCompletionRate)}
                  style={{ width: `${controlCompletionRate}%` }}
                />
              </div>
            )}
            {expandedMetrics.has('controlImplementation') && (
              <div className="summary-metric-details">
                {implementedControlsList.length > 0 && (
                  <div className="summary-metric-detail-section">
                    <div className="summary-metric-detail-header">Implemented ({implementedControlsList.length}):</div>
                    <ul className="summary-metric-items-list">
                      {implementedControlsList.map(control => (
                        <li key={control.ref} className="summary-clickable-item" onClick={() => handleControlClick(control)}>{control.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {notImplementedControlsList.length > 0 && (
                  <div className="summary-metric-detail-section">
                    <div className="summary-metric-detail-header">Not Implemented ({notImplementedControlsList.length}):</div>
                    <ul className="summary-metric-items-list">
                      {notImplementedControlsList.map(control => (
                        <li key={control.ref} className="summary-clickable-item" onClick={() => handleControlClick(control)}>{control.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="summary-subsection">
        <h3 className="summary-subsection-title">
          <CheckCircle size={16} />
          <span>Status Distribution</span>
        </h3>
        <div className="summary-distribution-grid">
          <div className="summary-distribution-card">
            <div className="summary-distribution-header">Threats</div>
            <div className="summary-distribution-items">
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-evaluate">Evaluate</span>
                <span className="summary-distribution-count">{threatStatusCounts.evaluate}</span>
              </div>
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-mitigate">Mitigate</span>
                <span className="summary-distribution-count">{threatStatusCounts.mitigate}</span>
              </div>
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-accept">Accept</span>
                <span className="summary-distribution-count">{threatStatusCounts.accept}</span>
              </div>
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-dismiss">Dismiss</span>
                <span className="summary-distribution-count">{threatStatusCounts.dismiss}</span>
              </div>
              {threatStatusCounts.noStatus > 0 && (
                <div className="summary-distribution-item">
                  <span className="summary-status-badge summary-status-none">No Status</span>
                  <span className="summary-distribution-count">{threatStatusCounts.noStatus}</span>
                </div>
              )}
            </div>
          </div>
          <div className="summary-distribution-card">
            <div className="summary-distribution-header">Controls</div>
            <div className="summary-distribution-items">
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-todo">To Do</span>
                <span className="summary-distribution-count">{controlStatusCounts.toDo}</span>
              </div>
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-inprogress">In Progress</span>
                <span className="summary-distribution-count">{controlStatusCounts.inProgress}</span>
              </div>
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-done">Done</span>
                <span className="summary-distribution-count">{controlStatusCounts.done}</span>
              </div>
              <div className="summary-distribution-item">
                <span className="summary-status-badge summary-status-cancelled">Cancelled</span>
                <span className="summary-distribution-count">{controlStatusCounts.cancelled}</span>
              </div>
              {controlStatusCounts.noStatus > 0 && (
                <div className="summary-distribution-item">
                  <span className="summary-status-badge summary-status-none">No Status</span>
                  <span className="summary-distribution-count">{controlStatusCounts.noStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};

export default SummarySection;

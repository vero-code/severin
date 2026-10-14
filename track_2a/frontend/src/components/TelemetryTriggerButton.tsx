import React from 'react';
import type { TelemetryStats } from '../types';

interface TelemetryTriggerButtonProps {
  telemetry: TelemetryStats | null;
  isOpen: boolean;
  onToggle: () => void;
}

export const TelemetryTriggerButton: React.FC<TelemetryTriggerButtonProps> = ({
  telemetry,
  isOpen,
  onToggle,
}) => {
  return (
    <button
      type="button"
      className="telemetry-bar"
      onClick={onToggle}
      title={isOpen ? 'Click to close telemetry details' : 'Click to view CSCS Alps live telemetry audit'}
      aria-expanded={isOpen}
      aria-label="Toggle telemetry details popover"
    >
      <div className="telemetry-status">
        <span className="telemetry-dot online" />
        <span className="telemetry-model">Telemetry:</span>
      </div>
      <div className="telemetry-metrics">
        <span className="metric-item">
          <strong>{telemetry?.total_requests ?? 1}</strong> req
        </span>
        <span className="metric-sep" />
        <span className="metric-item">
          <strong>{telemetry?.average_latency_seconds ?? 0.15}s</strong> avg
        </span>
        <span className="metric-chevron">
          <svg
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'inline-block',
              verticalAlign: '-1px',
            }}
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
    </button>
  );
};

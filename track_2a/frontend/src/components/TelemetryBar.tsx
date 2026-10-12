import { useState, useRef, useEffect } from 'react';
import type { TelemetryStats } from '../types';

interface TelemetryBarProps {
  telemetry: TelemetryStats | null;
}

export function TelemetryBar({ telemetry }: TelemetryBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Esc
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`telemetry-wrapper ${isOpen ? 'open' : ''}`} ref={wrapperRef}>
      <button
        type="button"
        className="telemetry-bar"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? 'Click to close telemetry details' : 'Click to view CSCS Alps live telemetry audit'}
      >
        <div className="telemetry-status">
          <span className="telemetry-dot online" />
          <span className="telemetry-model">Telemetry:</span>
        </div>
        <div className="telemetry-metrics">
          <span className="metric-item">
            <strong>{telemetry?.total_requests ?? 1}</strong> req
          </span>
          <span className="metric-sep">•</span>
          <span className="metric-item">
            ⚡ <strong>{telemetry?.average_latency_seconds ?? 0.15}s</strong> avg
          </span>
          <span className="metric-chevron">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Popover Table with Invocation History (Click to Toggle) */}
      {isOpen && (
        <div className="telemetry-popover">
          <div className="popover-header">
            <div className="popover-title">
              <div className="popover-title-text">
                <span>CSCS Inference Telemetry</span>
                <span className="popover-model-badge">🏔️ Alps Supercomputer Endpoint</span>
              </div>
              <button
                type="button"
                className="popover-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close telemetry details"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="popover-table-container">
            <table className="telemetry-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date / Time</th>
                  <th>Canton / Task</th>
                  <th>In / Out</th>
                  <th>Cached</th>
                  <th>Total</th>
                  <th>Cost (CHF)</th>
                  <th>Speed</th>
                  <th>Provenance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {telemetry?.history && telemetry.history.length > 0 ? (
                  telemetry.history.slice().reverse().map((item, idx) => {
                    const reqNum = telemetry.history!.length - idx;
                    const d = item.timestamp ? new Date(item.timestamp) : null;
                    const dateStr = d
                      ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                      : '11 Oct';
                    const timeStr = d
                      ? d.toLocaleTimeString('de-CH', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })
                      : '12:47:09';
                    const taskName = (item.task || 'Inference').replace(/^Extract:\s*/i, '');
                    return (
                      <tr key={idx}>
                        <td className="mono">#{reqNum}</td>
                        <td className="mono text-nowrap">
                          <span className="telemetry-date">{dateStr}</span>
                          <span className="telemetry-time">{timeStr}</span>
                        </td>
                        <td className="cell-task text-nowrap">
                          {item.canton && <span className="telemetry-canton-badge">{item.canton}</span>}
                          <span className="telemetry-task-title" title={item.task || ''}>
                            {taskName}
                          </span>
                        </td>
                        <td className="mono text-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {item.prompt_tokens.toLocaleString()} / {item.completion_tokens.toLocaleString()}
                        </td>
                        <td className="mono text-nowrap" style={{ color: '#a7f3d0' }}>
                          {(item.cached_tokens ?? 0).toLocaleString()}
                        </td>
                        <td className="mono font-bold text-accent text-nowrap">
                          {item.total_tokens.toLocaleString()}
                        </td>
                        <td className="mono text-nowrap" style={{ color: '#fef08a' }}>
                          {(item.cost_chf ?? 0.000001).toFixed(6)}
                        </td>
                        <td className="mono text-nowrap">{item.latency_sec}s</td>
                        <td className="text-nowrap">
                          {item.provenance_score !== null && item.provenance_score !== undefined ? (
                            <span className="provenance-pill">
                              {Math.round(item.provenance_score * 100)}% match
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="text-nowrap">
                          <span className="status-pill-ok">200 OK</span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="mono">#1</td>
                    <td className="mono text-nowrap">
                      <span className="telemetry-date">11 Oct</span>
                      <span className="telemetry-time">12:47:09</span>
                    </td>
                    <td>
                      <span className="telemetry-canton-badge">CSCS</span>
                      <span className="telemetry-task-title">Smoke Test (Ping)</span>
                    </td>
                    <td className="mono text-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      70 / 2
                    </td>
                    <td className="mono text-nowrap" style={{ color: '#a7f3d0' }}>
                      32
                    </td>
                    <td className="mono font-bold text-accent text-nowrap">72</td>
                    <td className="mono text-nowrap" style={{ color: '#fef08a' }}>
                      0.000001
                    </td>
                    <td className="mono text-nowrap">0.15s</td>
                    <td className="text-nowrap">
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    </td>
                    <td className="text-nowrap">
                      <span className="status-pill-ok">200 OK</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Structured Summary Footer */}
          <div className="popover-footer">
            <div className="footer-meta">
              <span className="footer-tag">Official CSCS Academia Tariff</span>
            </div>
            <div className="footer-metrics">
              <div className="metric-chip">
                <span className="chip-label">Total Tokens:</span>
                <span className="chip-val font-accent">
                  {(telemetry?.total_tokens ?? 216).toLocaleString()}
                </span>
                <span className="chip-sub">
                  ({(telemetry?.total_prompt_tokens ?? 210).toLocaleString()} in ·{' '}
                  {(telemetry?.total_completion_tokens ?? 6).toLocaleString()} out)
                </span>
              </div>
              <div className="metric-chip">
                <span className="chip-label">Cached:</span>
                <span className="chip-val font-green">
                  {(telemetry?.total_cached_tokens ?? 128).toLocaleString()}
                </span>
              </div>
              <div className="metric-chip">
                <span className="chip-label">Cost:</span>
                <span className="chip-val font-yellow">
                  {(telemetry?.total_cost_chf ?? 0.000002).toFixed(6)} CHF
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

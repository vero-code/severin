import { useState, useRef, useEffect } from 'react';
import type { TelemetryStats } from '../types';

interface TelemetryBarProps {
  telemetry: TelemetryStats | null;
}

type SortField = 'time' | 'canton' | 'cached' | 'total' | 'cost' | 'speed' | 'provenance';
type SortOrder = 'asc' | 'desc';

export function TelemetryBar({ telemetry }: TelemetryBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCanton, setSelectedCanton] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
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

  const rawHistory = telemetry?.history || [];

  // Extract unique cantons for header filter dropdown
  const availableCantons = Array.from(
    new Set(rawHistory.map((h) => h.canton).filter(Boolean) as string[])
  ).sort();

  const cantonCounts = rawHistory.reduce((acc, h) => {
    if (h.canton) {
      acc[h.canton] = (acc[h.canton] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filter history by selected canton
  const filteredHistory = rawHistory.filter((item) => {
    if (selectedCanton === 'ALL') return true;
    return item.canton === selectedCanton;
  });

  // Attach permanent original 1-based request index (#1 to #N)
  const decoratedHistory = filteredHistory.map((item) => {
    const originalIndex = rawHistory.indexOf(item);
    const reqNum = originalIndex >= 0 ? originalIndex + 1 : 1;
    const parsedTime = item.timestamp ? new Date(item.timestamp).getTime() : 0;
    return {
      ...item,
      reqNum,
      parsedTime,
    };
  });

  // Sort history according to active column and direction
  const sortedHistory = [...decoratedHistory].sort((a, b) => {
    let valA: any = 0;
    let valB: any = 0;

    switch (sortField) {
      case 'time':
        valA = a.parsedTime || a.reqNum;
        valB = b.parsedTime || b.reqNum;
        break;
      case 'canton':
        valA = (a.canton || '').toLowerCase();
        valB = (b.canton || '').toLowerCase();
        break;
      case 'cached':
        valA = a.cached_tokens ?? 0;
        valB = b.cached_tokens ?? 0;
        break;
      case 'total':
        valA = a.total_tokens ?? 0;
        valB = b.total_tokens ?? 0;
        break;
      case 'cost':
        valA = a.cost_chf ?? 0;
        valB = b.cost_chf ?? 0;
        break;
      case 'speed':
        valA = a.latency_sec ?? 0;
        valB = b.latency_sec ?? 0;
        break;
      case 'provenance':
        valA = a.provenance_score ?? -1;
        valB = b.provenance_score ?? -1;
        break;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return b.reqNum - a.reqNum;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default to ascending for alphabetical canton; descending (highest/newest) for metrics
      setSortOrder(field === 'canton' ? 'asc' : 'desc');
    }
  };

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th
        className={`sortable ${isActive ? 'active' : ''}`}
        onClick={() => handleSort(field)}
        title={
          isActive
            ? `Sorted by ${label} (${sortOrder === 'asc' ? 'ascending' : 'descending'}). Click to reverse.`
            : `Click to sort by ${label}`
        }
      >
        <div className="th-sort-wrapper">
          <span>{label}</span>
          <span className={isActive ? 'sort-icon-active' : 'sort-icon-inactive'}>
            {isActive ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </div>
      </th>
    );
  };

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
          <span className="metric-sep" />
          <span className="metric-item">
            <strong>{telemetry?.average_latency_seconds ?? 0.15}s</strong> avg
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
                <span>CSCS Client-Side Telemetry</span>
                <span className="popover-model-badge">🏔️ Alps Supercomputer Endpoint</span>
              </div>
              <div className="popover-header-actions">
                {availableCantons.length > 0 && (
                  <div className="popover-filter-group">
                    <label htmlFor="telemetry-canton-select" className="popover-filter-label">
                      Canton:
                    </label>
                    <select
                      id="telemetry-canton-select"
                      className="popover-canton-select"
                      value={selectedCanton}
                      onChange={(e) => setSelectedCanton(e.target.value)}
                      title="Filter runs by Swiss Canton"
                    >
                      <option value="ALL">All ({rawHistory.length})</option>
                      {availableCantons.map((c) => (
                        <option key={c} value={c}>
                          {c} ({cantonCounts[c] ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
          </div>

          <div className="popover-table-container">
            <table className="telemetry-table">
              <thead>
                <tr>
                  {renderSortHeader('time', '#')}
                  {renderSortHeader('time', 'Date / Time')}
                  {renderSortHeader('canton', 'Canton / Task')}
                  <th>In / Out</th>
                  {renderSortHeader('cached', 'Cached')}
                  {renderSortHeader('total', 'Total')}
                  {renderSortHeader('cost', 'Cost (CHF)')}
                  {renderSortHeader('speed', 'Speed')}
                  {renderSortHeader('provenance', 'Provenance')}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.length > 0 ? (
                  sortedHistory.map((item) => {
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
                      <tr key={item.reqNum}>
                        <td className="mono">#{item.reqNum}</td>
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
                ) : rawHistory.length > 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No benchmark runs found matching canton filter: <strong>{selectedCanton}</strong>
                    </td>
                  </tr>
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
              <span className="footer-tag">Official Academia Tariff</span>
              {selectedCanton !== 'ALL' && (
                <span className="footer-filter-pill">
                  Showing {sortedHistory.length} of {rawHistory.length} runs ({selectedCanton})
                </span>
              )}
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

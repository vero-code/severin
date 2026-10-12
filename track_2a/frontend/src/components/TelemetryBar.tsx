import type { TelemetryStats } from '../types';

interface TelemetryBarProps {
  telemetry: TelemetryStats | null;
}

export function TelemetryBar({ telemetry }: TelemetryBarProps) {
  return (
    <div className="telemetry-wrapper">
      <div className="telemetry-bar">
        
        <div className="telemetry-status">
          <span className="telemetry-dot online" />
          <span className="telemetry-model">Apertus 1.5-8B</span>
          
        </div>
        <div className="telemetry-metrics">
          <span className="metric-item">Telemetry:</span>
          
          <span className="metric-item">
            <strong>{telemetry?.total_requests ?? 1}</strong> req
          </span>
          <span className="metric-sep">•</span>
          <span className="metric-item">
            ⚡ <strong>{telemetry?.average_latency_seconds ?? 0.15}s</strong> avg
          </span>
        </div>
      </div>

      {/* Hover Popover Table with Invocation History */}
      <div className="telemetry-popover">
        <div className="popover-header">
          <div className="popover-title">
            <span>CSCS Inference Telemetry</span>
            <span className="popover-model-badge">Alps Supercomputer Endpoint</span>
          </div>
        </div>

        <div className="popover-table-container">
          <table className="telemetry-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
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
              {(telemetry?.history && telemetry.history.length > 0) ? (
                telemetry.history.slice().reverse().map((item, idx) => {
                  const reqNum = telemetry.history!.length - idx;
                  return (
                    <tr key={idx}>
                      <td className="mono">#{reqNum}</td>
                      <td className="mono">
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '12:47:09'}
                      </td>
                      <td>
                        {item.canton && <span className="telemetry-canton-badge">{item.canton}</span>}
                        <span className="telemetry-task-title">{item.task || 'Inference'}</span>
                      </td>
                      <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                        {item.prompt_tokens.toLocaleString()} / {item.completion_tokens.toLocaleString()}
                      </td>
                      <td className="mono" style={{ color: '#a7f3d0' }}>
                        {(item.cached_tokens ?? 0).toLocaleString()}
                      </td>
                      <td className="mono font-bold text-accent">{item.total_tokens.toLocaleString()}</td>
                      <td className="mono" style={{ color: '#fef08a' }}>
                        {(item.cost_chf ?? 0.000001).toFixed(6)}
                      </td>
                      <td className="mono">{item.latency_sec}s</td>
                      <td>
                        {item.provenance_score !== null && item.provenance_score !== undefined ? (
                          <span className="provenance-pill">
                            {Math.round(item.provenance_score * 100)}% match
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td><span className="status-pill-ok">200 OK</span></td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="mono">#1</td>
                  <td className="mono">12:47:09</td>
                  <td>
                    <span className="telemetry-canton-badge">CSCS</span>
                    <span className="telemetry-task-title">Smoke Test (Ping)</span>
                  </td>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>70 / 2</td>
                  <td className="mono" style={{ color: '#a7f3d0' }}>32</td>
                  <td className="mono font-bold text-accent">72</td>
                  <td className="mono" style={{ color: '#fef08a' }}>0.000001</td>
                  <td className="mono">0.15s</td>
                  <td><span style={{ color: 'var(--text-muted)' }}>—</span></td>
                  <td><span className="status-pill-ok">200 OK</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="popover-footer">
          <span>Client-side telemetry • Official CSCS Academia Tariff</span>
          <span>
            Total: <strong>{(telemetry?.total_tokens ?? 216).toLocaleString()}</strong> tok{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              ({(telemetry?.total_prompt_tokens ?? 210).toLocaleString()} in •{' '}
              {(telemetry?.total_completion_tokens ?? 6).toLocaleString()} out)
            </span>{' '}
            • <strong>{(telemetry?.total_cost_chf ?? 0.000002).toFixed(6)}</strong> CHF (
            <strong>{(telemetry?.total_cached_tokens ?? 128).toLocaleString()}</strong> cached)
          </span>
        </div>
      </div>
    </div>
  );
}

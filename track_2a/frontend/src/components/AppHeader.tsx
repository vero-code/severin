import React from 'react';
import severinLogo from '../assets/logo.png';
import { TelemetryBar } from './TelemetryBar';
import { GuideTriggerButton } from './GuideTriggerButton';
import type { TelemetryStats } from '../types';

interface AppHeaderProps {
  telemetry: TelemetryStats | null;
  onOpenGuide: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ telemetry, onOpenGuide }) => {
  return (
    <header className="app-header">
      <div className="brand">
        <img src={severinLogo} alt="SEVERIN Logo" className="brand-logo" />
        <div className="brand-titles">
          <h1>SEVERIN</h1>
          <p>Swiss Parliamentary Affairs Extraction Platform</p>
        </div>
      </div>

      <div className="header-actions">
        <TelemetryBar telemetry={telemetry} />
        <GuideTriggerButton onClick={onOpenGuide} />
      </div>
    </header>
  );
};

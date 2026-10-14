import React from 'react';
import type { ExtractedAffair } from '../../types';

interface ExtractionJsonInspectorProps {
  extractedAffair: ExtractedAffair;
}

export const ExtractionJsonInspector: React.FC<ExtractionJsonInspectorProps> = ({ extractedAffair }) => {
  const [copiedJson, setCopiedJson] = React.useState(false);

  const handleCopyJson = async () => {
    const jsonStr = JSON.stringify(extractedAffair, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonStr);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = jsonStr;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  return (
    <div className="json-inspector-container">
      <div className="json-inspector-toolbar">
        <div className="json-toolbar-title">
          <span className="json-meta-hint">Unified Representation Schema</span>
        </div>
        <button
          type="button"
          className={`btn-copy-icon ${copiedJson ? 'copied' : ''}`}
          onClick={handleCopyJson}
          title={copiedJson ? 'Copied to clipboard!' : 'Copy JSON'}
          aria-label="Copy JSON"
        >
          {copiedJson ? (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <pre className="json-inspector-pre">
        {JSON.stringify(extractedAffair, null, 2)}
      </pre>
    </div>
  );
};

import React from 'react';

interface GuideTriggerButtonProps {
  onClick: () => void;
}

export const GuideTriggerButton: React.FC<GuideTriggerButtonProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      className="btn-faq-trigger"
      onClick={onClick}
      title="Open Platform Guide & Architecture FAQ"
      aria-label="Open Platform Guide and FAQ"
    >
      <span className="faq-trigger-icon" aria-hidden="true">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <span className="faq-trigger-text">Guide</span>
    </button>
  );
};

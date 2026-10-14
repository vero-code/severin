import React from 'react';

interface FaqModalFooterProps {
  onClose: () => void;
}

export const FaqModalFooter: React.FC<FaqModalFooterProps> = ({ onClose }) => {
  return (
    <div className="faq-modal-footer">
      <div className="faq-footer-note">
        <span>
          Hack Apertus 2026 (Track 2A: Academia Challenges → OpenParlData)
        </span>
        <span className="faq-note-dot" />
        <span>
          Developed by{' '}
          <a
            href="https://github.com/vero-code"
            target="_blank"
            rel="noopener noreferrer"
            className="faq-link"
          >
            Veronika Kashtanova
          </a>
        </span>
      </div>
      <button type="button" className="btn-primary faq-close-btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
};

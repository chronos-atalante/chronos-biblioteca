import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { DONATION_LABEL, DONATION_URL } from '@zero/renderer/donations';
import { useMessages } from '@zero/renderer/i18n';

interface DonateModalProps {
  onClose: () => void;
}

/** Em runtime o clipboard pode não existir (jsdom, contextos inseguros). */
function getClipboard(): Clipboard | undefined {
  return navigator.clipboard;
}

export default function DonateModal({ onClose }: DonateModalProps): JSX.Element {
  const m = useMessages();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const copyLink = (): void => {
    const clipboard = getClipboard();
    if (clipboard === undefined) return;
    clipboard
      .writeText(DONATION_URL)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => undefined);
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={m.donate.ariaLabel}>
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-heart donate-heart" /> {m.donate.title}
          </h2>
          <button className="modal-close" onClick={onClose} title={m.common.close}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">
            <i className="fa-solid fa-mug-saucer" /> {m.donate.banner}
          </div>
          <p className="donate-text">{m.donate.text1}</p>
          <p className="donate-text">{m.donate.text2}</p>
          <p className="donate-text">{m.donate.text3}</p>
          <p className="donate-text">{m.donate.text4}</p>

          <div className="donate-box">
            <span className="donate-link">{DONATION_LABEL}</span>
            <div className="donate-actions">
              <a
                className="btn primary"
                href={DONATION_URL}
                target="_blank"
                rel="noreferrer"
                title={m.donate.openTitle}
              >
                <i className="fa-solid fa-hand-holding-heart" /> {m.donate.donateNow}
              </a>
              <button className="btn ghost" onClick={copyLink} title={m.donate.copyTitle}>
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
                {copied ? m.donate.copied : m.donate.copyLink}
              </button>
            </div>
          </div>

          <p className="donate-thanks">
            <i className="fa-solid fa-book-open" /> {m.donate.thanks}
          </p>
        </div>

        <div className="modal-footer">
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            <i className="fa-solid fa-check" /> {m.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}

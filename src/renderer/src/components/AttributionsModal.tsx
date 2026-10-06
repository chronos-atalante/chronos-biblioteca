import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ATTRIBUTIONS } from '@zero/renderer/attributions';
import { richText, useMessages } from '@zero/renderer/i18n';

interface AttributionsModalProps {
  onClose: () => void;
}

export default function AttributionsModal({ onClose }: AttributionsModalProps): JSX.Element {
  const m = useMessages();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const togglePaused = (): void => {
    setPaused((current) => !current);
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal wide credits-modal"
        role="dialog"
        aria-modal="true"
        aria-label={m.attributions.ariaLabel}
      >
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-clapperboard" /> {m.attributions.title}
          </h2>
          <button className="modal-close" onClick={onClose} title={m.common.close}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">
            <strong>{m.attributions.bannerTitle}</strong> {richText(m.attributions.bannerBody)}
          </div>

          <div className="credits-controls">
            <button className="btn small ghost" onClick={togglePaused}>
              <i className={`fa-solid ${paused ? 'fa-play' : 'fa-pause'}`} />
              {paused ? m.attributions.resume : m.attributions.pause}
            </button>
            <span className="help">{m.attributions.hoverHint}</span>
          </div>

          <div className="credits-viewport" tabIndex={0} aria-label={m.attributions.creditsAria}>
            <div className={`credits-track${paused ? ' paused' : ''}`}>
              {[false, true].map((hidden) => (
                <div
                  key={hidden ? 'copy' : 'original'}
                  className="credits-half"
                  aria-hidden={hidden ? 'true' : undefined}
                >
                  <p className="credits-title">Chronos Biblioteca</p>
                  <p className="credits-subtitle">{m.attributions.creditsSubtitle}</p>
                  {ATTRIBUTIONS.map((item) => (
                    <article key={`${hidden ? 'copy-' : ''}${item.name}`} className="credits-item">
                      <h3>{item.name}</h3>
                      <span className="credit-license">{item.license}</span>
                      <p>{item.description}</p>
                      <span className="credit-url">{item.url}</span>
                    </article>
                  ))}
                  <p className="credits-title">{m.attributions.creditsEnd}</p>
                  <p className="credits-subtitle">{m.attributions.creditsLoop}</p>
                </div>
              ))}
            </div>
          </div>
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

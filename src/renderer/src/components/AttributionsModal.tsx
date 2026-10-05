import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ATTRIBUTIONS } from '@zero/renderer/attributions';

interface AttributionsModalProps {
  onClose: () => void;
}

export default function AttributionsModal({ onClose }: AttributionsModalProps): JSX.Element {
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
        aria-label="Atribuições"
      >
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-clapperboard" /> Atribuições
          </h2>
          <button className="modal-close" onClick={onClose} title="Fechar">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">
            <strong>Créditos do projeto.</strong> Estas são as dependências de código aberto usadas
            no Chronos Biblioteca todas com licenças permissivas aprovadas pela OSI. As versões
            exatas estão em <code>package.json</code> / <code>package-lock.json</code>.
          </div>

          <div className="credits-controls">
            <button className="btn small ghost" onClick={togglePaused}>
              <i className={`fa-solid ${paused ? 'fa-play' : 'fa-pause'}`} />
              {paused ? 'Continuar' : 'Pausar'}
            </button>
            <span className="help">Passe o mouse sobre os créditos para pausar.</span>
          </div>

          <div className="credits-viewport" tabIndex={0} aria-label="Créditos em rolagem">
            <div className={`credits-track${paused ? ' paused' : ''}`}>
              {[false, true].map((hidden) => (
                <div
                  key={hidden ? 'copy' : 'original'}
                  className="credits-half"
                  aria-hidden={hidden ? 'true' : undefined}
                >
                  <p className="credits-title">Chronos Biblioteca</p>
                  <p className="credits-subtitle">agradece a estas dependências</p>
                  {ATTRIBUTIONS.map((item) => (
                    <article key={`${hidden ? 'copy-' : ''}${item.name}`} className="credits-item">
                      <h3>{item.name}</h3>
                      <span className="credit-license">{item.license}</span>
                      <p>{item.description}</p>
                      <span className="credit-url">{item.url}</span>
                    </article>
                  ))}
                  <p className="credits-title">Fim</p>
                  <p className="credits-subtitle">os créditos recomeçam em loop</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            <i className="fa-solid fa-check" /> Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { DONATION_LABEL, DONATION_URL } from '@zero/renderer/donations';

interface DonateModalProps {
  onClose: () => void;
}

/** Em runtime o clipboard pode não existir (jsdom, contextos inseguros). */
function getClipboard(): Clipboard | undefined {
  return navigator.clipboard;
}

export default function DonateModal({ onClose }: DonateModalProps): JSX.Element {
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
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Doações">
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-heart donate-heart" /> Apoie o projeto
          </h2>
          <button className="modal-close" onClick={onClose} title="Fechar">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">
            <i className="fa-solid fa-mug-saucer" /> Se cada leitor pagasse um cafezinho, a revisão
            de produção do app no Dropbox saía antes do próximo capítulo.
          </div>
          <p className="donate-text">
            Esse projeto nasceu para a comunidade otaku: um lugar para salvarmos nossas leituras e
            não ficarmos perdidos caso percamos acesso às nossas plataformas de leitura favoritas.
          </p>
          <p className="donate-text">
            Querendo ou não, eu tô mais quebrado que arroz de quinta e o backup em nuvem depende do
            Dropbox: enquanto o app não passar pela revisão de produção, depois das primeiras 50
            contas conectadas ele ganha um relógio de 2 semanas para ser aprovado — senão para de
            aceitar gente nova. Sua doação ajuda a manter o app (e a paciência) no ar.
          </p>
          <p className="donate-text">
            A verdade é que esse projeto é pessoal, para eu acompanhar minhas leituras. Porque você,
            como um otaku inveterado como eu, sabe o que é ver sua plataforma favorita ir de Vasco e
            perder todo o progresso das suas leituras.
          </p>
          <p className="donate-text">
            Mas se por algum milagre esse projeto vier a receber doações, vou fazer o meu melhor
            para que ele seja o mais completo possível para que possamos dormir tranquilos, sem medo
            de acordar no outro dia e ver que seu histórico no reader foi de Vasco.
          </p>

          <div className="donate-box">
            <span className="donate-link">{DONATION_LABEL}</span>
            <div className="donate-actions">
              <a
                className="btn primary"
                href={DONATION_URL}
                target="_blank"
                rel="noreferrer"
                title="Abre a página de doação no navegador"
              >
                <i className="fa-solid fa-hand-holding-heart" /> Doar agora
              </a>
              <button className="btn ghost" onClick={copyLink} title="Copia o link de doação">
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>

          <p className="donate-thanks">
            <i className="fa-solid fa-book-open" /> Valeu por manter a biblioteca viva e boa
            leitura!
          </p>
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

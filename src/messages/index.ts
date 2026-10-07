import type { Language } from '@zero/types';
import { en } from '@zero/messages/en';
import { ko } from '@zero/messages/ko';
import { ptBR } from '@zero/messages/pt-BR';
import { zhCN } from '@zero/messages/zh-CN';
import type { Messages } from '@zero/messages/pt-BR';

export type { Messages };

/** Idiomas suportados, na ordem de exibição. */
export const LANGUAGES: readonly Language[] = ['pt-BR', 'en', 'ko', 'zh-CN'];

/** Nome nativo de cada idioma (não se traduz: aparece assim em qualquer idioma). */
export const LANGUAGE_LABELS: Record<Language, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  ko: '한국어',
  'zh-CN': '简体中文',
};

const BUNDLES: Record<Language, Messages> = { 'pt-BR': ptBR, en, ko, 'zh-CN': zhCN };

/** Mensagens do idioma pedido. */
export function messages(language: Language): Messages {
  return BUNDLES[language];
}

export { en, ko, ptBR, zhCN };

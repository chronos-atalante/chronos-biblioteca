export type Language = 'pt-BR' | 'en' | 'ko' | 'zh-CN';

export interface AppSettings {
  /** App key alternativa do Dropbox: '' usa a chave embutida (override, sem UI). */
  driveClientId: string;
  driveClientSecret: string;
  drivePassphrase: string;
  /** Idioma da interface e das mensagens do app. */
  language: Language;
}

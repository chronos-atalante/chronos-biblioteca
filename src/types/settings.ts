export type Language = 'pt-BR' | 'en';

export interface AppSettings {
  driveClientId: string;
  driveClientSecret: string;
  drivePassphrase: string;
  /** Idioma da interface e das mensagens do app. */
  language: Language;
}

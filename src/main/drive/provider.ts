import type { BackupProviderId, BackupProviderInfo } from '@zero/types';
import type { Messages } from '@zero/messages';
import { currentMessages } from '@zero/main/i18n';
import { dropboxProvider } from '@zero/main/drive/providers/dropbox';
import { googleDriveProvider } from '@zero/main/drive/providers/google-drive';
import type { RemoteFile } from '@zero/main/drive/rest';

export type { RemoteFile };

/**
 * Contrato de um provedor de backup em nuvem.
 *
 * O núcleo do backup (`backup.ts`), a criptografia (`crypto.ts`) e a orquestração
 * são genéricos: eles conversam com a nuvem só por este contrato. Cada provedor
 * implementa as 4 operações de arquivo mais a autorização; OAuth, REST e forma
 * dos tokens vivem em `src/main/drive/providers/<provedor>/` (hoje em módulos
 * irmãos, já que só o Dropbox tem implementação).
 *
 * Textos da UI ficam em `describe(messages)` (idioma corrente em cada chamada);
 * `label` é o nome da marca, que não se traduz. O catálogo (`listProviders`)
 * formata tudo de uma vez no idioma vigente.
 *
 * Estado ainda é único (sem provedor por sessão): `state.tokens` descreve a
 * sessão do provedor atual. Isso muda quando um segundo provedor ficar operante
 * (ver `docs/backup-providers.md`).
 */
export interface BackupProvider {
  readonly id: BackupProviderId;
  /** Nome da marca, fixo entre idiomas ("Dropbox", "Google Drive"). */
  readonly label: string;
  readonly operational: boolean;
  readonly storageHidden: boolean;
  /** Dados de UI localizados; também é o que `drive.providers()` devolve. */
  describe(messages: Messages): BackupProviderInfo;
  authorize(): Promise<{ ok: boolean; error?: string }>;
  listAppFiles(): Promise<RemoteFile[]>;
  uploadFile(name: string, buffer: Buffer): Promise<void>;
  downloadFile(fileId: string): Promise<Buffer>;
  deleteFile(fileId: string): Promise<void>;
}

/** Registro de todos os provedores catalogados, por id fechado. */
const REGISTRY: Record<BackupProviderId, BackupProvider> = {
  dropbox: dropboxProvider,
  'google-drive': googleDriveProvider,
};

/** Catálogo de provedores na ordem de exibição (UI e documentação). */
export function listProviders(): BackupProviderInfo[] {
  const m = currentMessages();
  return Object.values(REGISTRY).map((provider) => provider.describe(m));
}

export function getProvider(id: BackupProviderId): BackupProvider {
  return REGISTRY[id];
}

/**
 * Provedor usado nas operações de backup.
 *
 * Hoje só o Dropbox é operante (`operational` no catálogo), então ele é a
 * escolha fixa. A seleção entre provedores passa a existir quando um segundo
 * ficar operante, momento em que a escolha do usuário também deve valer para
 * `state.tokens`.
 */
export function currentProvider(): BackupProvider {
  return REGISTRY.dropbox;
}

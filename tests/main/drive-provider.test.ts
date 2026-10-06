import { describe, expect, it } from 'vitest';
import { currentProvider, getProvider, listProviders } from '@zero/main/drive/provider';
import { messages } from '@zero/messages';

const m = messages('pt-BR');

describe('catálogo de provedores de backup', () => {
  it('lista o Dropbox operante e o Google Drive como não operante', () => {
    const [dropbox, google] = listProviders();
    expect(dropbox).toEqual({
      id: 'dropbox',
      label: 'Dropbox',
      operational: true,
      unavailableReason: null,
      storageTarget: m.providers.dropboxStorageTarget,
      storageHidden: false,
    });
    expect(google).toEqual({
      id: 'google-drive',
      label: 'Google Drive',
      operational: false,
      unavailableReason: m.providers.googleUnavailable,
      storageTarget: m.providers.googleStorageTarget,
      storageHidden: true,
    });
  });

  it('explica ao usuário por que o Google Drive ainda não está operante', () => {
    const info = getProvider('google-drive').describe(m);
    expect(info.operational).toBe(false);
    expect(info.unavailableReason ?? '').toContain('não está operante');
    expect(info.unavailableReason ?? '').toContain('exigências do Google');
    expect(info.unavailableReason ?? '').toContain('backup usa o Dropbox');
  });

  it('grava o backup do Google Drive em pasta oculta (appDataFolder)', () => {
    const info = getProvider('google-drive').describe(m);
    expect(info.storageHidden).toBe(true);
    expect(info.storageTarget).toContain('appDataFolder');
    expect(info.storageTarget).toContain('não aparece na interface do Google Drive');
    // O Dropbox continua com pasta visível em /Apps/.
    expect(getProvider('dropbox').describe(m).storageHidden).toBe(false);
  });

  it('recusa toda operação do Google Drive com o mesmo motivo da interface', async () => {
    const provider = getProvider('google-drive');
    await expect(provider.authorize()).resolves.toEqual({
      ok: false,
      error: m.providers.googleUnavailable,
    });
    await expect(provider.listAppFiles()).rejects.toThrow(m.providers.googleUnavailable);
    await expect(provider.uploadFile('nome', Buffer.alloc(0))).rejects.toThrow(
      m.providers.googleUnavailable,
    );
    await expect(provider.downloadFile('id')).rejects.toThrow(m.providers.googleUnavailable);
    await expect(provider.deleteFile('id')).rejects.toThrow(m.providers.googleUnavailable);
  });

  it('usa o Dropbox como provedor atual das operações', () => {
    const provider = currentProvider();
    expect(provider.id).toBe('dropbox');
    expect(provider.operational).toBe(true);
    expect(getProvider(provider.id).describe(m)).toEqual(provider.describe(m));
  });
});

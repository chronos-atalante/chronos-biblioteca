/**
 * Mensagens em português (Brasil): canônico de todas as chaves e assinaturas.
 *
 * Cada idioma é um objeto com a mesma forma (`Messages = typeof ptBR`); o
 * TypeScript aponta qualquer chave ou parâmetro faltando no `en.ts`. Strings
 * com parâmetro são funções. Marcadores de formatação rica (só na UI):
 * `**negrito**` e `` `código` ``. Regras e mais detalhes: `docs/messages.md`.
 */
export const ptBR = {
  common: {
    close: 'Fechar',
    cancel: 'Cancelar',
    save: 'Salvar',
    saving: 'Salvando…',
    loading: 'Carregando…',
    select: 'Selecione',
    none: 'Nenhuma',
    notFound: 'Não encontrado',
    searchOptions: 'Digite para filtrar…',
    clearSearch: 'Limpar busca',
    noOptionsFound: 'Nenhuma opção encontrada',
  },

  dialogs: {
    pickCover: 'Escolher imagem da capa',
    imageFilter: 'Imagens',
  },

  app: {
    headerStats: (total: number, average: number): string =>
      `${total} obra(s) · progresso médio ${average}%`,
    searchPlaceholder: 'Buscar por título…',
    openSettingsTitle: 'Configurações do backup no Dropbox',
    openAttributionsTitle: 'Ver atribuições e licenças das dependências',
    openDonateTitle: 'Apoie o projeto com uma doação',
    settingsTitle: 'Configurações',
    attributionsLabel: 'Atribuições',
    donateLabel: 'Doar',
    newWork: 'Nova obra',
    filters: {
      todos: 'Todos',
      lendo: 'Lendo',
      planejado: 'Planejados',
      pausado: 'Pausados',
      concluido: 'Concluídos',
      cancelado: 'Cancelados',
    },
    stats: {
      total: 'Total de obras',
      reading: 'Lendo',
      done: 'Concluídas',
      planned: 'Planejadas',
      paused: 'Pausadas',
      cancelled: 'Canceladas',
      average: 'Progresso médio',
    },
    loadingLibrary: 'Carregando biblioteca…',
    emptyFoundTitle: 'Nenhuma obra encontrada',
    emptyFoundText: 'Tente outro filtro ou termo de busca.',
    emptyLibraryTitle: 'Sua biblioteca está vazia',
    emptyLibraryText: 'Adicione a sua primeira obra com capa e título e acompanhe o progresso.',
    addFirstWork: 'Adicionar primeira obra',
    drivePill: {
      syncing: 'Sincronizando…',
      connected: 'Dropbox conectado',
      off: 'Dropbox desconectado',
    },
    toastSaveError: 'Não foi possível salvar a obra.',
    toastSaved: 'Obra salva.',
    toastRemoved: 'Obra removida.',
  },

  settings: {
    title: 'Configurações',
    bannerTitle: 'Backup no Dropbox.',
    bannerBody:
      'Sua biblioteca é gravada na pasta reservada do app (dentro de `/Apps/` na sua conta): ' +
      'pela API, só este aplicativo enxerga essa pasta, e o resto do seu Dropbox nem aparece ' +
      'para ele. Como a pasta é visível para você, todo arquivo sobe com nome ilegível e ' +
      'conteúdo criptografado (AES-256-GCM), então defina a senha de criptografia abaixo ' +
      'antes do primeiro backup.',
    keyringWarning:
      'Cofre do sistema indisponível: a senha do backup será guardada sem a proteção ' +
      'extra do chaveiro (o arquivo continua com acesso só seu). Se puder, ative o ' +
      'chaveiro do sistema (GNOME Keyring, KWallet, Keychain ou DPAPI).',
    languageLabel: 'Idioma',
    providersLabel: 'Provedores de backup',
    hiddenFolder: 'Pasta oculta',
    operational: 'Operante',
    notOperational: 'Não operante',
    backupIn: (target: string): string => `Backup em ${target}`,
    passphraseLabel: 'Senha de criptografia do backup',
    passphrasePlaceholder: 'Usada para criptografar o backup no Dropbox',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    accountFallback: 'Conta Dropbox',
    lastBackup: 'Último backup',
    inDropboxBackup: 'No backup do Dropbox',
    worksInBackup: (works: number): string => `${works} obra(s)`,
    syncingBanner: 'Sincronizando com o Dropbox…',
    disconnectTitle: 'Desconecta a conta Dropbox deste aplicativo',
    disconnectAction: 'Desconectar',
    authorizing: 'Autorizando…',
    connectAction: 'Conectar ao Dropbox',
    restoreTitle: 'Baixa o backup do Dropbox e substitui a biblioteca atual',
    restoreAction: 'Restaurar',
    restoring: 'Restaurando…',
    backupAction: 'Fazer backup agora',
    sending: 'Enviando…',
    toastSaved: 'Configurações salvas.',
    toastAuthFailed: 'Falha na autorização.',
    toastConnected: 'Conta Dropbox conectada com sucesso.',
    toastBackupFailed: 'Falha no backup.',
    toastBackupDone: 'Backup concluído na pasta do app no Dropbox.',
    toastRestoreFailed: 'Falha ao restaurar.',
    toastRestored: (works: number): string => `Backup restaurado com ${works} obra(s).`,
    toastDisconnected: 'Conta Dropbox desconectada.',
    translationNotice: {
      title: 'Aviso sobre traduções',
      text: 'Eu não falo nenhum desses idiomas com exceção do português, e toda a tradução é feita por IA. Como tudo nesse mundo, pode haver falhas, então peço um pouco de paciência.',
      translationNotice2:
        'Se você quiser ajudar a melhorar a tradução, abra uma issue no repositório do projeto.',
    },
  },

  restore: {
    title: 'Senha do backup',
    banner:
      'Informe a senha de criptografia usada ao **fazer o backup** no Dropbox. ' +
      'Ela é obrigatória para decifrar os arquivos baixados.',
    passphraseLabel: 'Senha de criptografia',
    passphrasePlaceholder: 'Senha usada no backup',
    action: 'Restaurar',
  },

  workModal: {
    newTitle: 'Nova obra',
    editTitle: 'Editar obra',
    titleRequired: 'Informe o título da obra.',
    saveError: 'Falha ao salvar.',
    coverAlt: 'Prévia da capa',
    coverHelp:
      'Adicione a imagem da capa da obra (JPG, PNG, WebP…). A imagem é copiada para a ' +
      'biblioteca local.',
    chooseImage: 'Escolher imagem',
    removeCover: 'Remover capa',
    titleLabel: 'Título',
    titlePlaceholder: 'Ex.: Solo Leveling',
    synopsisLabel: 'Descrição',
    synopsisPlaceholder: 'Escreva a descrição da obra…',
    typeLabel: 'Tipo',
    statusLabel: 'Status',
    categoryLabel: 'Categoria',
    markerLabel: 'Marcação (opcional)',
    markerPlaceholder: 'Cap. 45 / Vol. 3',
    progressLabel: 'Progresso da leitura',
    decrease10: 'Diminuir 10',
    increase10: 'Aumentar 10',
    progressValue: (progress: number): string => `Cap. ${progress}`,
    finish: 'Concluir',
    reset: 'Zerar',
    confirmDelete: 'Confirmar exclusão?',
    deleteAction: 'Excluir',
  },

  workCard: {
    coverOf: (title: string): string => `Capa de ${title}`,
    untitled: 'Sem título',
    progress: 'Progresso',
    progressValue: (progress: number): string => `Cap. ${progress}`,
    increase1: 'Aumentar 1',
    decrease1: 'Diminuir 1',
    reopen: 'Reabrir',
    resume: 'Retomar',
    finish: 'Concluir',
    pause: 'Pausar',
    cancel: 'Cancelar',
  },

  attributions: {
    ariaLabel: 'Atribuições',
    title: 'Atribuições',
    bannerTitle: 'Créditos do projeto.',
    bannerBody:
      'Estas são as dependências de código aberto usadas no Chronos Biblioteca, todas com ' +
      'licenças permissivas aprovadas pela OSI. As versões exatas estão em ' +
      '`package.json` / `package-lock.json`.',
    pause: 'Pausar',
    resume: 'Continuar',
    hoverHint: 'Passe o mouse sobre os créditos para pausar.',
    creditsAria: 'Créditos em rolagem',
    creditsSubtitle: 'agradece a estas dependências',
    creditsEnd: 'Fim',
    creditsLoop: 'os créditos recomeçam em loop',
  },

  donate: {
    ariaLabel: 'Doações',
    title: 'Apoie o projeto',
    banner:
      'Se cada leitor pagasse um cafezinho, a revisão de produção do app no Dropbox saía ' +
      'antes do próximo capítulo.',
    text1:
      'Esse projeto nasceu para a comunidade otaku: um lugar para salvarmos nossas leituras ' +
      'e não ficarmos perdidos caso percamos acesso às nossas plataformas de leitura ' +
      'favoritas.',
    text2:
      'Querendo ou não, eu tô mais quebrado que arroz de quinta, e o backup em nuvem depende ' +
      'do Dropbox: enquanto o app não passar pela revisão de produção, depois das primeiras ' +
      '50 contas conectadas ele tem 2 semanas para ser aprovado. Caso contrário, para de ' +
      'aceitar gente nova. Sua doação ajuda a manter o app (e a minha paciência) no ar.',
    text3:
      'A verdade é que esse projeto é pessoal, para eu acompanhar minhas leituras. Porque ' +
      'você, um otaku inveterado como eu, sabe o que é ver sua plataforma favorita ir ' +
      'de Vasco e perder todo o progresso das suas leituras.',
    text4:
      'Mas se por algum milagre esse projeto vier a receber doações, vou fazer o meu melhor ' +
      'para que ele seja o mais completo possível, assim podemos dormir tranquilos, sem ' +
      'medo de acordar no outro dia e ver que o seu histórico de leitura foi de Vasco.',
    openTitle: 'Abre a página de doação no navegador',
    donateNow: 'Doar agora',
    copyTitle: 'Copia o link de doação',
    copyLink: 'Copiar link',
    copied: 'Copiado!',
    thanks: 'Valeu por manter a biblioteca viva e boa leitura!',
  },

  workTypes: {
    webtoon: 'Webtoon',
    manhwa: 'Manhwa',
    manhua: 'Manhua',
    manga: 'Mangá',
    livro: 'Livro',
    outro: 'Outro',
  },

  workStatus: {
    planejado: 'Planejado',
    lendo: 'Lendo',
    pausado: 'Pausado',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  },

  providers: {
    dropboxStorageTarget: '/Apps/Chronos Biblioteca (pasta visível na sua conta)',
    googleStorageTarget: 'appDataFolder (pasta oculta, não aparece na interface do Google Drive)',
    googleUnavailable:
      'O Google Drive ainda não está operante: a integração só será ativada quando o ' +
      'Chronos atender às exigências do Google (verificação do app, tela de ' +
      'consentimento e revisão dos escopos). Enquanto isso, o backup usa o Dropbox.',
  },

  driveErrors: {
    notEncrypted: 'Não é um backup criptografado.',
    truncated: 'Backup truncado ou corrompido.',
    definePassphrase: 'Defina uma senha de criptografia do backup nas configurações.',
    needsPassphrase: 'Este backup está criptografado. Informe a senha de criptografia.',
    wrongPassphrase: 'Senha de criptografia incorreta ou backup corrompido.',
    invalidManifest: 'Manifesto do backup inválido.',
    syncInProgress: 'Sincronização já em andamento.',
    connectFirst: (provider: string): string => `Conecte a conta ${provider} primeiro.`,
    emptyLibrary: 'Nenhuma biblioteca local para backup. Adicione ao menos uma obra.',
    noBackupFound: (provider: string): string =>
      `Nenhum backup encontrado na pasta do app no ${provider}.`,
    invalidLibrary: 'Backup inválido (library.json corrompido).',
    invalidListResponse: 'Resposta inválida da API do Dropbox (listagem de arquivos).',
    tokenTimeout: 'Tempo esgotado aguardando autorização.',
    authCancelled: 'Autorização cancelada.',
    tokenFailed: (status: number): string => `Falha ao obter tokens (${status}).`,
    invalidTokenResponse: (status: number): string => `Resposta de tokens inválida (${status}).`,
    configureAppKey: 'Configure a chave do aplicativo Dropbox nas Configurações.',
    sessionExpired: 'Sessão expirada. Conecte a conta Dropbox novamente.',
    refreshFailed: 'Não foi possível renovar a sessão do Dropbox.',
    noAccount: 'Nenhuma conta Dropbox conectada.',
    permissionsUpdated: 'Permissões do Dropbox atualizadas. Reconecte a conta Dropbox.',
    missingScopes:
      'Faltam permissões no app Dropbox. Marque todos os escopos na aba Permissions ' +
      'do App Console, desconecte e conecte de novo.',
    missingScopesList: (missing: string): string =>
      `Faltam permissões no app Dropbox (${missing}). ` +
      'Marque todos os escopos na aba Permissions do App Console, desconecte e conecte de novo.',
    dropboxHttp: (status: number, response: string): string =>
      response === ''
        ? `Erro do Dropbox (HTTP ${status}).`
        : `Erro do Dropbox (HTTP ${status}). Resposta: ${response}`,
    restoreLocked: (seconds: number): string =>
      seconds < 60
        ? `Muitas tentativas de restauração com senha errada. Tente novamente em ${seconds} segundos.`
        : `Muitas tentativas de restauração com senha errada. Tente novamente em ${Math.ceil(seconds / 60)} minutos.`,
  },

  /** Erros do domínio de obras (a UI só exibe a mensagem vinda do main). */
  libraryErrors: {
    invalidId: 'Identificador de obra inválido.',
  },

  /** Cofre de segredos: modal, badges da UI e erros do domínio. */
  vault: {
    createTitle: 'Criar o cofre de segredos',
    unlockTitle: 'Desbloquear o cofre',
    createBody:
      'Crie uma senha mestra para proteger os segredos do app (tokens do Dropbox e senha do ' +
      'backup) neste computador. Se você esquecer a senha, não há como recuperá-los.',
    unlockBody: 'Informe a senha mestra para liberar o acesso aos segredos guardados.',
    passwordLabel: 'Senha mestra',
    confirmLabel: 'Confirmar a senha',
    createAction: 'Criar cofre',
    unlockAction: 'Desbloquear',
    hint: 'Use pelo menos 12 caracteres, sem sequências nem repetições óbvias.',
    mismatch: 'As senhas não coincidem.',
    strength: {
      weak: 'Fraca',
      fair: 'Razoável',
      strong: 'Forte',
    },
    createHint: 'Crie um cofre com senha mestra para guardar os segredos do app.',
    closeVault: 'Fechar cofre',
    autoLocked: 'O cofre fechou sozinho por inatividade.',
    badge: {
      open: 'Cofre aberto',
      closed: 'Cofre fechado',
      none: 'Sem cofre',
    },
    lockout: (seconds: number): string =>
      seconds < 60
        ? `Aguarde ${seconds} segundos para tentar de novo.`
        : `Aguarde ${Math.ceil(seconds / 60)} minuto(s) para tentar de novo.`,
    errors: {
      vaultExists: 'Já existe um cofre neste computador.',
      vaultMissing: 'Nenhum cofre encontrado.',
      vaultLocked: 'O cofre está fechado.',
      vaultLockedOut: 'Muitas tentativas de desbloqueio. Aguarde antes de tentar de novo.',
      vaultWrongPassword: 'Senha mestra incorreta.',
      vaultTampered: 'O cofre está danificado ou foi alterado.',
      vaultWeakPassword: 'Senha previsível. Escolha algo menos óbvio.',
    },
  },

  /** Página HTML que o loopback do OAuth mostra na aba do navegador. */
  oauthPage: {
    deniedTitle: 'Autorização recusada',
    doneTitle: 'Autorização concluída',
    deniedBody: 'Você pode fechar esta aba.',
    doneBody: 'Pode fechar esta aba e voltar para o aplicativo.',
  },
};

/** Forma canônica: todo idioma deve ter exatamente estas chaves e assinaturas. */
export type Messages = typeof ptBR;

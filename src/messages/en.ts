import type { Messages } from '@zero/messages/pt-BR';

/** Mensagens em inglês. A forma é conferida contra `Messages` pelo TypeScript. */
export const en: Messages = {
  common: {
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    loading: 'Loading…',
    select: 'Select',
    none: 'None',
    notFound: 'Not found',
    searchOptions: 'Type to filter…',
    clearSearch: 'Clear search',
    noOptionsFound: 'No options found',
  },

  dialogs: {
    pickCover: 'Choose cover image',
    imageFilter: 'Images',
  },

  app: {
    headerStats: (total: number, average: number): string =>
      `${total} work(s) · average progress ${average}%`,
    searchPlaceholder: 'Search by title…',
    openSettingsTitle: 'Dropbox backup settings',
    openAttributionsTitle: 'View dependency credits and licenses',
    openDonateTitle: 'Support the project with a donation',
    settingsTitle: 'Settings',
    attributionsLabel: 'Attributions',
    donateLabel: 'Donate',
    newWork: 'New work',
    filters: {
      todos: 'All',
      lendo: 'Reading',
      planejado: 'Planned',
      pausado: 'Paused',
      concluido: 'Completed',
      cancelado: 'Cancelled',
    },
    stats: {
      total: 'Total works',
      reading: 'Reading',
      done: 'Completed',
      planned: 'Planned',
      paused: 'Paused',
      cancelled: 'Cancelled',
      average: 'Average progress',
    },
    loadingLibrary: 'Loading library…',
    emptyFoundTitle: 'No works found',
    emptyFoundText: 'Try another filter or search term.',
    emptyLibraryTitle: 'Your library is empty',
    emptyLibraryText: 'Add your first work with a cover and title, and track your progress.',
    addFirstWork: 'Add your first work',
    drivePill: {
      syncing: 'Syncing…',
      connected: 'Dropbox connected',
      off: 'Dropbox disconnected',
    },
    toastSaveError: 'Could not save the work.',
    toastSaved: 'Work saved.',
    toastRemoved: 'Work removed.',
    startupFailed: (detail: string): string =>
      `Could not start Chronos Biblioteca.\n\nTechnical details: ${detail}`,
  },

  settings: {
    title: 'Settings',
    bannerTitle: 'Dropbox backup.',
    bannerBody:
      'Your library is written to the app’s reserved folder (inside `/Apps/` in your ' +
      'account): through the API, only this application can see that folder, and the rest ' +
      'of your Dropbox is not even visible to it. Since the folder is visible to you, every ' +
      'file is uploaded with an unreadable name and encrypted content (AES-256-GCM), so set ' +
      'the encryption password below before the first backup.',
    languageLabel: 'Language',
    providersLabel: 'Backup providers',
    hiddenFolder: 'Hidden folder',
    operational: 'Operational',
    notOperational: 'Not operational',
    backupIn: (target: string): string => `Backup in ${target}`,
    passphraseLabel: 'Backup encryption password',
    passphrasePlaceholder: 'Used to encrypt the backup on Dropbox',
    connected: 'Connected',
    disconnected: 'Disconnected',
    accountFallback: 'Dropbox account',
    lastBackup: 'Last backup',
    inDropboxBackup: 'In the Dropbox backup',
    worksInBackup: (works: number): string => `${works} work(s)`,
    syncingBanner: 'Syncing with Dropbox…',
    disconnectTitle: 'Disconnects the Dropbox account from this application',
    disconnectAction: 'Disconnect',
    authorizing: 'Authorizing…',
    connectAction: 'Connect to Dropbox',
    restoreTitle: 'Downloads the Dropbox backup and replaces the current library',
    restoreAction: 'Restore',
    restoring: 'Restoring…',
    backupAction: 'Back up now',
    sending: 'Uploading…',
    toastSaved: 'Settings saved.',
    toastAuthFailed: 'Authorization failed.',
    toastConnected: 'Dropbox account connected successfully.',
    toastBackupFailed: 'Backup failed.',
    toastBackupDone: 'Backup finished in the app folder on Dropbox.',
    toastRestoreFailed: 'Restore failed.',
    toastRestored: (works: number): string => `Backup restored: ${works} work(s).`,
    toastDisconnected: 'Dropbox account disconnected.',
    translationNotice: {
      title: 'Translation notice',
      text: "I don't speak any of these languages except Portuguese, and all translations are done by AI. Like everything in this world, there may be errors, so please have a little patience.",
      translationNotice2:
        'If you would like to help improve the translation, please open an issue on the project repository.',
    },
  },

  restore: {
    title: 'Backup password',
    banner:
      'Enter the encryption password used when you **backed up** to Dropbox. ' +
      'It is required to decrypt the downloaded files.',
    passphraseLabel: 'Encryption password',
    passphrasePlaceholder: 'Password used in the backup',
    action: 'Restore',
  },

  workModal: {
    newTitle: 'New work',
    editTitle: 'Edit work',
    titleRequired: 'Enter the work title.',
    saveError: 'Failed to save.',
    coverAlt: 'Cover preview',
    coverHelp:
      'Add the work cover image (JPG, PNG, WebP…). The image is copied to the local ' + 'library.',
    chooseImage: 'Choose image',
    removeCover: 'Remove cover',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. Solo Leveling',
    synopsisLabel: 'Description',
    synopsisPlaceholder: 'Write the work description…',
    typeLabel: 'Type',
    statusLabel: 'Status',
    categoryLabel: 'Category',
    markerLabel: 'Marker (optional)',
    markerPlaceholder: 'Ch. 45 / Vol. 3',
    progressLabel: 'Reading progress',
    decrease10: 'Decrease 10',
    increase10: 'Increase 10',
    progressValue: (progress: number): string => `Ch. ${progress}`,
    finish: 'Complete',
    reset: 'Reset',
    confirmDelete: 'Confirm deletion?',
    deleteAction: 'Delete',
  },

  workCard: {
    coverOf: (title: string): string => `Cover of ${title}`,
    untitled: 'Untitled',
    progress: 'Progress',
    progressValue: (progress: number): string => `Ch. ${progress}`,
    increase1: 'Increase 1',
    decrease1: 'Decrease 1',
    reopen: 'Reopen',
    resume: 'Resume',
    finish: 'Complete',
    pause: 'Pause',
    cancel: 'Cancel',
  },

  attributions: {
    ariaLabel: 'Attributions',
    title: 'Attributions',
    bannerTitle: 'Project credits.',
    bannerBody:
      'These are the open source dependencies used in Chronos Biblioteca, all under ' +
      'OSI-approved permissive licenses. Exact versions are in ' +
      '`package.json` / `package-lock.json`.',
    pause: 'Pause',
    resume: 'Resume',
    hoverHint: 'Hover over the credits to pause.',
    creditsAria: 'Scrolling credits',
    creditsSubtitle: 'thanks these dependencies',
    creditsEnd: 'End',
    creditsLoop: 'the credits restart in a loop',
  },

  donate: {
    ariaLabel: 'Donations',
    title: 'Support the project',
    banner:
      'If every reader bought a small coffee, the production review of the app on Dropbox ' +
      'would land before the next chapter.',
    text1:
      'This project was born for the otaku community: a place to save our readings and not ' +
      'get lost if we lose access to our favorite reading platforms.',
    text2:
      'Like it or not, I am more broke than week-old rice and cloud backup depends on ' +
      'Dropbox: until the app passes production review, after the first 50 connected ' +
      'accounts it gets a 2-week clock to be approved or it stops accepting new people. ' +
      'Your donation helps keep the app (and my patience) up.',
    text3:
      'The truth is this project is personal, for me to track my own readings. Because you, ' +
      'a hardened otaku like me, know what it is to watch your favorite platform go down ' +
      'the drain and lose every bit of your reading progress.',
    text4:
      'But if by some miracle this project ever receives donations, I will do my best to ' +
      'make it as complete as possible so we can sleep soundly, without fear of waking up ' +
      'the next day and finding that your reader history went down the drain.',
    openTitle: 'Opens the donation page in the browser',
    donateNow: 'Donate now',
    copyTitle: 'Copies the donation link',
    copyLink: 'Copy link',
    copied: 'Copied!',
    thanks: 'Thanks for keeping the library alive, happy reading!',
  },

  workTypes: {
    webtoon: 'Webtoon',
    manhwa: 'Manhwa',
    manhua: 'Manhua',
    manga: 'Manga',
    livro: 'Book',
    outro: 'Other',
  },

  workStatus: {
    planejado: 'Planned',
    lendo: 'Reading',
    pausado: 'Paused',
    concluido: 'Completed',
    cancelado: 'Cancelled',
  },

  providers: {
    dropboxStorageTarget: '/Apps/Chronos Biblioteca (folder visible in your account)',
    googleStorageTarget:
      'appDataFolder (hidden folder, does not appear in the Google Drive interface)',
    googleUnavailable:
      'Google Drive is not operational yet: the integration will only be enabled once ' +
      'Chronos meets Google’s requirements (app verification, consent screen and scope ' +
      'review). In the meantime, backups use Dropbox.',
  },

  driveErrors: {
    notEncrypted: 'This is not an encrypted backup.',
    truncated: 'Backup truncated or corrupted.',
    definePassphrase: 'Set a backup encryption password in Settings.',
    needsPassphrase: 'This backup is encrypted. Enter the encryption password.',
    wrongPassphrase: 'Incorrect encryption password or corrupted backup.',
    invalidManifest: 'Invalid backup manifest.',
    syncInProgress: 'Sync already in progress.',
    connectFirst: (provider: string): string => `Connect the ${provider} account first.`,
    emptyLibrary: 'No local library to back up. Add at least one work.',
    noBackupFound: (provider: string): string =>
      `No backup found in the app folder on ${provider}.`,
    invalidLibrary: 'Invalid backup (library.json corrupted).',
    invalidListResponse: 'Invalid Dropbox API response (file listing).',
    tokenTimeout: 'Timed out waiting for authorization.',
    authCancelled: 'Authorization cancelled.',
    tokenFailed: (status: number): string => `Failed to obtain tokens (${status}).`,
    invalidTokenResponse: (status: number): string => `Invalid token response (${status}).`,
    configureAppKey: 'Configure the Dropbox app key in Settings.',
    sessionExpired: 'Session expired. Connect the Dropbox account again.',
    refreshFailed: 'Could not refresh the Dropbox session.',
    noAccount: 'No Dropbox account connected.',
    permissionsUpdated: 'Dropbox permissions updated. Reconnect the Dropbox account.',
    missingScopes:
      'Permissions missing in the Dropbox app. Check every scope in the Permissions tab ' +
      'of the App Console, then disconnect and reconnect.',
    missingScopesList: (missing: string): string =>
      `Permissions missing in the Dropbox app (${missing}). ` +
      'Check every scope in the Permissions tab of the App Console, then disconnect and reconnect.',
    dropboxHttp: (status: number, response: string): string =>
      response === ''
        ? `Dropbox error (HTTP ${status}).`
        : `Dropbox error (HTTP ${status}). Response: ${response}`,
    restoreLocked: (seconds: number): string =>
      seconds < 60
        ? `Too many failed restore attempts with the wrong password. Try again in ${seconds} seconds.`
        : `Too many failed restore attempts with the wrong password. Try again in ${Math.ceil(seconds / 60)} minutes.`,
  },

  /** Erros do domínio de obras (a UI só exibe a mensagem vinda do main). */
  libraryErrors: {
    invalidId: 'Invalid work identifier.',
  },

  /** Secrets vault: modal, UI badges and domain errors. */
  vault: {
    createTitle: 'Create the secrets vault',
    unlockTitle: 'Unlock the vault',
    createBody:
      'Create a master password to protect the app secrets (Dropbox tokens and backup ' +
      'password) on this computer. If you forget it, the secrets cannot be recovered.',
    unlockBody: 'Enter the master password to access the stored secrets.',
    passwordLabel: 'Master password',
    confirmLabel: 'Confirm password',
    createAction: 'Create vault',
    unlockAction: 'Unlock',
    hint: 'Use at least 12 characters, without obvious sequences or repetitions.',
    mismatch: 'The passwords do not match.',
    strength: {
      weak: 'Weak',
      fair: 'Fair',
      strong: 'Strong',
    },
    createHint: 'Create a master-password vault to store the app secrets.',
    closeVault: 'Lock vault',
    autoLocked: 'The vault locked itself after a period of inactivity.',
    badge: {
      open: 'Vault open',
      closed: 'Vault locked',
      none: 'No vault',
    },
    lockout: (seconds: number): string =>
      seconds < 60
        ? `Wait ${seconds} seconds before trying again.`
        : `Wait ${Math.ceil(seconds / 60)} minute(s) before trying again.`,
    errors: {
      vaultExists: 'A vault already exists on this computer.',
      vaultMissing: 'No vault found.',
      vaultLocked: 'The vault is locked.',
      vaultLockedOut: 'Too many unlock attempts. Wait before trying again.',
      vaultWrongPassword: 'Incorrect master password.',
      vaultTampered: 'The vault is damaged or was altered.',
      vaultWeakPassword: 'Predictable password. Choose something less obvious.',
      vaultDirUnavailable: 'Could not create the vault folder. Check the permissions.',
      vaultAuthCancelled: 'Creating the vault folder was cancelled.',
    },
  },

  /** HTML page the OAuth loopback shows in the browser tab. */
  oauthPage: {
    deniedTitle: 'Authorization denied',
    doneTitle: 'Authorization complete',
    deniedBody: 'You can close this tab.',
    doneBody: 'You can close this tab and return to the application.',
  },
};

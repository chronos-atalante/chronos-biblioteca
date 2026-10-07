import type { Messages } from '@zero/messages/pt-BR';

/** 日本語メッセージ。型は `Messages` で担保し、各文字列は pt-BR と対応する。 */
export const ja: Messages = {
  common: {
    close: '閉じる',
    cancel: 'キャンセル',
    save: '保存',
    saving: '保存中…',
    loading: '読み込み中…',
    select: '選択',
    none: 'なし',
    notFound: '見つかりません',
    searchOptions: '入力して絞り込み…',
    clearSearch: '検索をクリア',
    noOptionsFound: '該当する選択肢がありません',
  },

  dialogs: {
    pickCover: 'カバー画像を選択',
    imageFilter: '画像',
  },

  app: {
    headerStats: (total: number, average: number): string => `${total} 件 · 平均進捗 ${average}%`,
    searchPlaceholder: 'タイトルで検索…',
    openSettingsTitle: 'Dropbox バックアップ設定',
    openAttributionsTitle: '依存ライブラリの帰属表示とライセンスを見る',
    openDonateTitle: 'プロジェクトを寄付で支援',
    settingsTitle: '設定',
    attributionsLabel: '帰属表示',
    donateLabel: '寄付',
    newWork: '新しい作品',
    filters: {
      todos: 'すべて',
      lendo: '読書中',
      planejado: '予定',
      pausado: '一時停止',
      concluido: '完了',
      cancelado: 'キャンセル',
    },
    stats: {
      total: '作品数',
      reading: '読書中',
      done: '完了',
      planned: '予定',
      paused: '一時停止',
      cancelled: 'キャンセル',
      average: '平均進捗',
    },
    loadingLibrary: 'ライブラリを読み込み中…',
    emptyFoundTitle: '作品が見つかりません',
    emptyFoundText: '別のフィルターや検索語をお試しください。',
    emptyLibraryTitle: 'ライブラリは空です',
    emptyLibraryText: '最初の作品を追加しましょう。カバー、タイトル、進捗を記録できます。',
    addFirstWork: '最初の作品を追加',
    drivePill: {
      syncing: '同期中…',
      connected: 'Dropbox 接続済み',
      off: 'Dropbox オフ',
    },
    toastSaveError: '作品を保存できませんでした。',
    toastSaved: '作品を保存しました。',
    toastRemoved: '作品を削除しました。',
  },

  settings: {
    title: '設定',
    bannerTitle: 'Dropbox バックアップ。',
    bannerBody:
      'ライブラリはアプリ専用フォルダに保存されます（Dropbox の `/Apps/` 以下）。' +
      'API としてはこのアプリだけがそのフォルダを読み書きでき、他の領域は表示されません。' +
      'フォルダはあなたのアカウントに可視なので、すべてのファイルは解読不能な名前と ' +
      '暗号化された内容でアップロードされます (AES-256-GCM)。最初のバックアップ前に ' +
      '以下の暗号化パスフレーズを設定してください。',
    keyringWarning:
      'システム鍵ストレージが利用できません。バックアップパスフレーズは鍵ストレージによる ' +
      '追加保護なしで保存されます（ファイル自体はあなた専用のアクセス権のままです）。' +
      '可能であればシステム鍵ストレージを有効にしてください (GNOME Keyring / KWallet / Keychain / DPAPI)。',
    languageLabel: '言語',
    providersLabel: 'バックアップ先',
    hiddenFolder: '非公開フォルダ',
    operational: '利用可能',
    notOperational: '未対応',
    backupIn: (target: string): string => `${target} にバックアップ`,
    passphraseLabel: 'バックアップ暗号化パスフレーズ',
    passphrasePlaceholder: 'Dropbox バックアップの暗号化に使用',
    connected: '接続済み',
    disconnected: '切断',
    accountFallback: 'Dropbox アカウント',
    lastBackup: '最終バックアップ',
    inDropboxBackup: 'Dropbox バックアップ内',
    translationNotice: {
      title: 'Translation Notice',
      text: 'これらの言語の中でポルトガル語以外は話せません。すべての翻訳はAIによって行われています。世の中のすべてと同じように、間違いがあるかもしれません。少しの寛容をお願いいたします。',
      translationNotice2:
        '翻訳の改善にご協力いただける場合は、プロジェクトのリポジトリで Issue を作成してください。',
    },
    worksInBackup: (works: number): string => `${works} 件`,
    syncingBanner: 'Dropbox と同期中…',
    disconnectTitle: 'このアプリから Dropbox アカウントの接続を解除します',
    disconnectAction: '切断',
    authorizing: '認証中…',
    connectAction: 'Dropbox に接続',
    restoreTitle: 'Dropbox のバックアップをダウンロードし、現在のライブラリを置き換えます',
    restoreAction: '復元',
    restoring: '復元中…',
    backupAction: '今すぐバックアップ',
    sending: '送信中…',
    toastSaved: '設定を保存しました。',
    toastAuthFailed: '認証に失敗しました。',
    toastConnected: 'Dropbox アカウントに接続しました。',
    toastBackupFailed: 'バックアップに失敗しました。',
    toastBackupDone: 'Dropbox のアプリフォルダにバックアップを完了しました。',
    toastRestoreFailed: '復元に失敗しました。',
    toastRestored: (works: number): string => `${works} 件の作品を復元しました。`,
    toastDisconnected: 'Dropbox アカウントの接続を解除しました。',
  },

  restore: {
    title: 'バックアップパスフレーズ',
    banner:
      'Dropbox で **バックアップを作成** したときに使った暗号化パスフレーズを入力してください。' +
      'ダウンロードしたファイルを復元するには必須です。',
    passphraseLabel: '暗号化パスフレーズ',
    passphrasePlaceholder: 'バックアップ時に使用したパスフレーズ',
    action: '復元',
  },

  workModal: {
    newTitle: '新しい作品',
    editTitle: '作品を編集',
    titleRequired: '作品のタイトルを入力してください。',
    saveError: '保存に失敗しました。',
    coverAlt: 'カバーのプレビュー',
    coverHelp:
      '作品のカバー画像 (JPG, PNG, WebP など) を追加してください。画像はアプリの ' +
      'ローカルライブラリにコピーされます。',
    chooseImage: '画像を選択',
    removeCover: 'カバーを削除',
    titleLabel: 'タイトル',
    titlePlaceholder: '例: Solo Leveling',
    synopsisLabel: '概要',
    synopsisPlaceholder: '作品の概要を書いてください…',
    typeLabel: '種類',
    statusLabel: '状態',
    categoryLabel: 'カテゴリ',
    markerLabel: '位置メモ (任意)',
    markerPlaceholder: '第45話 / 第3巻',
    progressLabel: '読書進捗',
    decrease10: '10 減らす',
    increase10: '10 増やす',
    progressValue: (progress: number): string => `第${progress}話`,
    finish: '完結にする',
    reset: 'リセット',
    confirmDelete: '削除を確認しますか？',
    deleteAction: '削除',
  },

  workCard: {
    coverOf: (title: string): string => `${title} のカバー`,
    untitled: 'タイトルなし',
    progress: '進捗',
    progressValue: (progress: number): string => `第${progress}話`,
    increase1: '1 増やす',
    decrease1: '1 減らす',
    reopen: '未完了に戻す',
    resume: '再開',
    finish: '完了にする',
    pause: '一時停止',
    cancel: 'キャンセル',
  },

  attributions: {
    ariaLabel: 'ライセンス帰属',
    title: 'ライセンス帰属',
    bannerTitle: 'プロジェクトのクレジット。',
    bannerBody:
      'Chronos Biblioteca で使用しているオープンソース依存の一覧です。すべて OSI 承認の ' +
      '許可リストライセンスです。具体的なバージョンは `package.json` / `package-lock.json` ' +
      'を参照してください。',
    pause: '一時停止',
    resume: '再開',
    hoverHint: 'クレジットにマウスを重ねると一時停止します。',
    creditsAria: 'スクロールするクレジット',
    creditsSubtitle: 'がこれらの依存に感謝しています',
    creditsEnd: '終わり',
    creditsLoop: 'クレジットはループで再生されます',
  },

  donate: {
    ariaLabel: '寄付',
    title: 'プロジェクトを支援',
    banner:
      '読者一人ひとりがコーヒー一杯ずつ出してくれたら、本番環境での Dropbox 審査も ' +
      '次の章の前には終わるはずです。',
    text1:
      'このプロジェクトはオタクコミュニティのために生まれました。自分の読書を記録して、' +
      '好きなプラットフォームにアクセスできなくなったときに困らないようにするための ' +
      '場所です。',
    text2:
      '現状は本当に金欠状態で、クラウドバックアップは Dropbox に依存しています。' +
      'アプリが本番審査を通過するまで、最初の 50 件の接続を超えると 2 週間の期限付き' +
      'レビューに入るため、期限内に許可されなければ新規受付を停止します。' +
      'あなたの寄付がアプリ（と忍耐）を継続させます。',
    text3:
      '正直なところ、このプロジェクトは私自身の読書管理のための個人的なものです。' +
      'あなたも筋金入りのオタクなら、好きなプラットフォームが「極」から「可」に ' +
      '転落したときに読む物語の進捗を全部失う怖さがわかるはずです。',
    text4:
      'それでも万が一このプロジェクトに寄付が集まるなら、より完全なものになるよう ' +
      '全力を尽くし、明日起きてみたらリーダーの履歴が「安・瓶」状態という不安から ' +
      '遠ざかれるようにします。',
    openTitle: 'ブラウザで寄付ページを開く',
    donateNow: '今すぐ寄付',
    copyTitle: '寄付リンクをコピー',
    copyLink: 'リンクをコピー',
    copied: 'コピーしました！',
    thanks: 'ライブラリを支えてくれてありがとう。よい読書を！',
  },

  workTypes: {
    webtoon: 'Webtoon',
    manhwa: 'マンファ',
    manhua: 'マンホア',
    manga: '漫画',
    livro: '書籍',
    outro: 'その他',
  },

  workStatus: {
    planejado: '予定',
    lendo: '読書中',
    pausado: '一時停止',
    concluido: '完了',
    cancelado: 'キャンセル',
  },

  providers: {
    dropboxStorageTarget: '/Apps/Chronos Biblioteca (アカウント内で可視なフォルダ)',
    googleStorageTarget: 'appDataFolder (非公開フォルダ。Google ドライブの UI には表示されません)',
    googleUnavailable:
      'Google ドライブはまだ利用できません。Google の要件 (アプリ検証、同意画面、' +
      'スコープ審査) が整い次第有効化されます。それまでは Dropbox がバックアップ先です。',
  },

  driveErrors: {
    notEncrypted: '暗号化されたバックアップではありません。',
    truncated: 'バックアップが切れているか壊れています。',
    definePassphrase: '設定でバックアップ用の暗号化パスフレーズを設定してください。',
    needsPassphrase: 'このバックアップは暗号化されています。暗号化パスフレーズを入力してください。',
    wrongPassphrase: '暗号化パスフレーズが違うか、バックアップが壊れています。',
    invalidManifest: 'バックアップのマニフェストが無効です。',
    syncInProgress: '同期がすでに進行中です。',
    connectFirst: (provider: string): string => `先に ${provider} アカウントを接続してください。`,
    emptyLibrary:
      'バックアップ対象のローカルライブラリがありません。少なくとも 1 件追加してください。',
    noBackupFound: (provider: string): string =>
      `${provider} のアプリフォルダにバックアップが見つかりません。`,
    invalidLibrary: 'バックアップが壊れています (library.json が不正)。',
    invalidListResponse: 'Dropbox API の応答が不正です (ファイル一覧)。',
    tokenTimeout: '認証の待機がタイムアウトしました。',
    authCancelled: '認証がキャンセルされました。',
    tokenFailed: (status: number): string => `トークンの取得に失敗しました (${status})。`,
    invalidTokenResponse: (status: number): string => `トークン応答が不正です (${status})。`,
    configureAppKey: '設定で Dropbox アプリキーを設定してください。',
    sessionExpired: 'セッションが期限切れです。Dropbox アカウントを再接続してください。',
    refreshFailed: 'Dropbox セッションを更新できませんでした。',
    noAccount: 'Dropbox アカウントが接続されていません。',
    permissionsUpdated: 'Dropbox の権限が更新されました。Dropbox アカウントを再接続してください。',
    missingScopes:
      'Dropbox アプリの権限が不足しています。App Console の Permissions で全スコープを有効にし、' +
      '切断してから接続し直してください。',
    missingScopesList: (missing: string): string =>
      `Dropbox アプリの権限が不足しています (${missing})。` +
      'App Console の Permissions で全スコープを有効にし、再接続してください。',
    dropboxHttp: (status: number, response: string): string =>
      response === ''
        ? `Dropbox エラー (HTTP ${status})。`
        : `Dropbox エラー (HTTP ${status})。応答: ${response}`,
    restoreLocked: (seconds: number): string =>
      seconds < 60
        ? `パスフレーズ誤りの復元試行が多すぎます。${seconds} 秒後に再試行してください。`
        : `パスフレーズ誤りの復元試行が多すぎます。${Math.ceil(seconds / 60)} 分後に再試行してください。`,
  },

  /** Erros do domínio de obras (a UI só exibe a mensagem vinda do main). */
  libraryErrors: {
    invalidId: '作品の ID が無効です。',
  },

  /** Página HTML que o loopback do OAuth mostra na aba do navegador. */
  oauthPage: {
    deniedTitle: '認証が拒否されました',
    doneTitle: '認証が完了しました',
    deniedBody: 'このタブは閉じて構いません。',
    doneBody: 'このタブを閉じて、アプリケーションに戻ってください。',
  },
};

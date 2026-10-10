import type { Messages } from '@zero/messages/pt-BR';

/** Mensagens em chinês simplificado. A forma é conferida contra `Messages` pelo TypeScript. */
export const zhCN: Messages = {
  common: {
    close: '关闭',
    cancel: '取消',
    save: '保存',
    saving: '保存中…',
    loading: '加载中…',
    select: '请选择',
    none: '无',
    notFound: '未找到',
    searchOptions: '输入以筛选…',
    clearSearch: '清除搜索',
    noOptionsFound: '没有找到选项',
  },

  dialogs: {
    pickCover: '选择封面图片',
    imageFilter: '图片',
  },

  app: {
    headerStats: (total: number, average: number): string =>
      `${total} 部作品 · 平均进度 ${average}%`,
    searchPlaceholder: '按标题搜索…',
    openSettingsTitle: 'Dropbox备份设置',
    openAttributionsTitle: '查看依赖项致谢与许可证',
    openDonateTitle: '捐赠以支持本项目',
    settingsTitle: '设置',
    attributionsLabel: '致谢',
    donateLabel: '捐赠',
    newWork: '新作品',
    filters: {
      todos: '全部',
      lendo: '在读',
      planejado: '计划',
      pausado: '已暂停',
      concluido: '已完结',
      cancelado: '已弃',
    },
    stats: {
      total: '作品总数',
      reading: '在读',
      done: '已完结',
      planned: '计划',
      paused: '已暂停',
      cancelled: '已弃',
      average: '平均进度',
    },
    loadingLibrary: '正在加载书库…',
    emptyFoundTitle: '没有找到作品',
    emptyFoundText: '换个筛选条件或搜索词试试。',
    emptyLibraryTitle: '书库是空的',
    emptyLibraryText: '为第一部作品添加封面和标题，并跟踪阅读进度。',
    addFirstWork: '添加第一部作品',
    drivePill: {
      syncing: '同步中…',
      connected: 'Dropbox已连接',
      off: 'Dropbox未连接',
    },
    toastSaveError: '无法保存作品。',
    toastSaved: '作品已保存。',
    toastRemoved: '作品已删除。',
    startupFailed: (detail: string): string =>
      `无法启动 Chronos Biblioteca。\n\n技术详情：${detail}`,
  },

  settings: {
    title: '设置',
    bannerTitle: 'Dropbox备份。',
    bannerBody:
      '书库保存在应用专属文件夹中（您账号下的`/Apps/`内）：通过API，只有本应用能看到' +
      '这个文件夹，Dropbox的其余部分对它完全不可见。该文件夹在您的账号内可见，所有文件都以' +
      '不可读的文件名和加密内容（AES-256-GCM）上传，因此请在首次备份前在下方设置加密密码。',
    languageLabel: '语言',
    providersLabel: '备份服务商',
    hiddenFolder: '隐藏文件夹',
    operational: '可用',
    notOperational: '不可用',
    backupIn: (target: string): string => `备份至${target}`,
    passphraseLabel: '备份加密密码',
    passphrasePlaceholder: '用于加密Dropbox中的备份',
    connected: '已连接',
    disconnected: '未连接',
    accountFallback: 'Dropbox账号',
    lastBackup: '上次备份',
    inDropboxBackup: 'Dropbox备份中',
    worksInBackup: (works: number): string => `${works} 部作品`,
    syncingBanner: '正在与Dropbox同步…',
    disconnectTitle: '断开本应用的Dropbox账号',
    disconnectAction: '断开连接',
    authorizing: '授权中…',
    connectAction: '连接Dropbox',
    restoreTitle: '下载Dropbox备份并替换当前书库',
    restoreAction: '恢复',
    restoring: '恢复中…',
    backupAction: '立即备份',
    sending: '上传中…',
    toastSaved: '设置已保存。',
    toastAuthFailed: '授权失败。',
    toastConnected: 'Dropbox账号连接成功。',
    toastBackupFailed: '备份失败。',
    toastBackupDone: '已备份到Dropbox的应用文件夹。',
    toastRestoreFailed: '恢复失败。',
    toastRestored: (works: number): string => `已恢复备份，共${works} 部作品。`,
    toastDisconnected: 'Dropbox账号已断开。',
    translationNotice: {
      title: '翻译提示',
      text: '这些语言中只有葡萄牙语我会说，所有翻译都是由AI完成的。像世间万物一样，可能会有错误，请多包涵。',
      translationNotice2: '如果您想帮助改进翻译，请在项目仓库中提交 issue。',
    },
  },

  restore: {
    title: '备份密码',
    banner: '请输入**备份时**在Dropbox中使用的加密密码。' + '解密下载的文件必须提供该密码。',
    passphraseLabel: '加密密码',
    passphrasePlaceholder: '备份时使用的密码',
    action: '恢复',
  },

  workModal: {
    newTitle: '新作品',
    editTitle: '编辑作品',
    titleRequired: '请输入作品标题。',
    saveError: '保存失败。',
    coverAlt: '封面预览',
    coverHelp: '添加作品封面图片（JPG、PNG、WebP…）。图片将复制到本地书库。',
    chooseImage: '选择图片',
    removeCover: '移除封面',
    titleLabel: '标题',
    titlePlaceholder: '例如：我独自升级',
    synopsisLabel: '简介',
    synopsisPlaceholder: '写下作品简介…',
    typeLabel: '类型',
    statusLabel: '状态',
    categoryLabel: '分类',
    markerLabel: '标记（可选）',
    markerPlaceholder: '第45话 / 第3卷',
    progressLabel: '阅读进度',
    decrease10: '减10',
    increase10: '加10',
    progressValue: (progress: number): string => `第${progress}话`,
    finish: '完结',
    reset: '清零',
    confirmDelete: '确认删除？',
    deleteAction: '删除',
  },

  workCard: {
    coverOf: (title: string): string => `${title}的封面`,
    untitled: '无标题',
    progress: '进度',
    progressValue: (progress: number): string => `第${progress}话`,
    increase1: '加1',
    decrease1: '减1',
    reopen: '重开',
    resume: '继续',
    finish: '完结',
    pause: '暂停',
    cancel: '放弃',
  },

  attributions: {
    ariaLabel: '致谢',
    title: '致谢',
    bannerTitle: '项目致谢。',
    bannerBody:
      '以下是Chronos Biblioteca使用的开源依赖，全部采用OSI认可的宽松许可证。确切版本见' +
      '`package.json` / `package-lock.json`。',
    pause: '暂停',
    resume: '继续',
    hoverHint: '将鼠标悬停在致谢名单上可暂停滚动。',
    creditsAria: '滚动致谢',
    creditsSubtitle: '感谢以下依赖项',
    creditsEnd: '完',
    creditsLoop: '致谢将循环重新开始',
  },

  donate: {
    ariaLabel: '捐赠',
    title: '支持本项目',
    banner: '如果每位读者请喝一杯咖啡，Dropbox上应用的正式审核就能在下一话之前通过。',
    text1:
      '本项目为御宅族社区而生：一个保存我们阅读记录的地方，即使失去喜爱的阅读平台的访问权限也不会迷失。',
    text2:
      '不管愿不愿意，我穷得叮当响，而云备份依赖Dropbox：在应用通过正式审核之前，连接满50个账号后，它只有2周时间获批，否则就不再接受新用户。您的捐赠有助于让应用（和我的耐心）继续运转。',
    text3:
      '说实话，这个项目起初只是我个人的追更记录。因为您，和我一样的资深御宅族，懂得看着喜爱的平台倒闭、阅读进度全部丢失是什么滋味。',
    text4:
      '但如果奇迹发生、本项目真的收到捐赠，我会尽力把它做到最完善，让我们能安心睡觉，不用担心一觉醒来发现阅读器里的历史记录没了。',
    openTitle: '在浏览器中打开捐赠页面',
    donateNow: '立即捐赠',
    copyTitle: '复制捐赠链接',
    copyLink: '复制链接',
    copied: '已复制！',
    thanks: '感谢您让书库延续，阅读愉快！',
  },

  workTypes: {
    webtoon: 'Webtoon',
    manhwa: 'Manhwa',
    manhua: 'Manhua',
    manga: '漫画',
    livro: '书',
    outro: '其他',
  },

  workStatus: {
    planejado: '计划',
    lendo: '在读',
    pausado: '已暂停',
    concluido: '已完结',
    cancelado: '已弃',
  },

  providers: {
    dropboxStorageTarget: '/Apps/Chronos Biblioteca（您账号中可见的文件夹）',
    googleStorageTarget: 'appDataFolder（隐藏文件夹，不显示在Google云端硬盘界面中）',
    googleUnavailable:
      'Google云端硬盘暂不可用：只有当Chronos满足Google的要求（应用验证、同意屏幕、' +
      '范围审核）后才会启用集成。在此之前，备份使用Dropbox。',
  },

  driveErrors: {
    notEncrypted: '不是加密备份。',
    truncated: '备份被截断或已损坏。',
    definePassphrase: '请在设置中设置备份加密密码。',
    needsPassphrase: '此备份已加密。请输入加密密码。',
    wrongPassphrase: '加密密码错误或备份已损坏。',
    invalidManifest: '备份清单无效。',
    syncInProgress: '同步已在进行中。',
    connectFirst: (provider: string): string => `请先连接${provider}账号。`,
    emptyLibrary: '没有可备份的本地书库。请至少添加一部作品。',
    noBackupFound: (provider: string): string => `在${provider}的应用文件夹中没有找到备份。`,
    invalidLibrary: '备份无效（library.json已损坏）。',
    invalidListResponse: 'Dropbox API 返回无效的响应（文件列表）。',
    tokenTimeout: '等待授权超时。',
    authCancelled: '授权已取消。',
    tokenFailed: (status: number): string => `获取令牌失败（${status}）。`,
    invalidTokenResponse: (status: number): string => `令牌响应无效（${status}）。`,
    configureAppKey: '请在设置中配置Dropbox应用密钥。',
    sessionExpired: '会话已过期。请重新连接Dropbox账号。',
    refreshFailed: '无法刷新Dropbox会话。',
    noAccount: '未连接Dropbox账号。',
    permissionsUpdated: 'Dropbox权限已更新。请重新连接Dropbox账号。',
    missingScopes:
      'Dropbox应用缺少权限。请在App Console的Permissions选项卡中勾选所有范围，然后断开并重新连接。',
    missingScopesList: (missing: string): string =>
      `Dropbox应用缺少权限（${missing}）。` +
      '请在App Console的Permissions选项卡中勾选所有范围，然后重新连接。',
    dropboxHttp: (status: number, response: string): string =>
      response === ''
        ? `Dropbox错误（HTTP ${status}）。`
        : `Dropbox错误（HTTP ${status}）。响应：${response}`,
    restoreLocked: (seconds: number): string =>
      seconds < 60
        ? `恢复时密码错误尝试次数过多，请在 ${seconds} 秒后重试。`
        : `恢复时密码错误尝试次数过多，请在 ${Math.ceil(seconds / 60)} 分钟后重试。`,
  },

  /** Erros do domínio de obras (a UI só exibe a mensagem vinda do main). */
  libraryErrors: {
    invalidId: '作品标识符无效。',
  },

  /** 密码库：模态框、界面标识和领域错误。 */
  vault: {
    createTitle: '创建密码库',
    unlockTitle: '解锁密码库',
    createBody:
      '创建一个主密码，用来保护本机上的应用机密（Dropbox 令牌和备份密码）。' +
      '如果忘记密码，这些机密将无法恢复。',
    unlockBody: '输入主密码以访问已保存的机密。',
    passwordLabel: '主密码',
    confirmLabel: '确认密码',
    createAction: '创建密码库',
    unlockAction: '解锁',
    hint: '至少 12 个字符，不要使用明显的序列或重复。',
    mismatch: '两次输入的密码不一致。',
    strength: {
      weak: '弱',
      fair: '一般',
      strong: '强',
    },
    createHint: '创建一个由主密码保护的密码库来保存应用机密。',
    closeVault: '锁定密码库',
    autoLocked: '密码库因长时间无操作已自动锁定。',
    badge: {
      open: '密码库已打开',
      closed: '密码库已锁定',
      none: '无密码库',
    },
    lockout: (seconds: number): string =>
      seconds < 60
        ? `请等待 ${seconds} 秒后重试。`
        : `请等待 ${Math.ceil(seconds / 60)} 分钟后重试。`,
    errors: {
      vaultExists: '此计算机上已存在密码库。',
      vaultMissing: '未找到密码库。',
      vaultLocked: '密码库已锁定。',
      vaultLockedOut: '解锁尝试次数过多，请稍候再试。',
      vaultWrongPassword: '主密码不正确。',
      vaultTampered: '密码库已损坏或被篡改。',
      vaultWeakPassword: '密码过于常见，请换一个更难猜的。',
      vaultDirUnavailable: '无法创建保管库文件夹，请检查权限。',
      vaultAuthCancelled: '已取消创建保管库文件夹。',
    },
  },

  /** OAuth回环在浏览器选项卡中显示的HTML页面。 */
  oauthPage: {
    deniedTitle: '授权被拒绝',
    doneTitle: '授权完成',
    deniedBody: '您可以关闭此选项卡。',
    doneBody: '可以关闭此选项卡并返回应用。',
  },
};

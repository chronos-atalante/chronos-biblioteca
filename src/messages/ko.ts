import type { Messages } from '@zero/messages/pt-BR';

/** Mensagens em coreano. A forma é conferida contra `Messages` pelo TypeScript. */
export const ko: Messages = {
  common: {
    close: '닫기',
    cancel: '취소',
    save: '저장',
    saving: '저장 중…',
    loading: '불러오는 중…',
    select: '선택',
    none: '없음',
    notFound: '찾을 수 없음',
    searchOptions: '입력하여 필터링…',
    clearSearch: '검색 지우기',
    noOptionsFound: '일치하는 항목 없음',
  },

  dialogs: {
    pickCover: '표지 이미지 선택',
    imageFilter: '이미지',
  },

  app: {
    headerStats: (total: number, average: number): string =>
      `${total}개 작품 · 평균 진행률 ${average}%`,
    searchPlaceholder: '제목으로 검색…',
    openSettingsTitle: 'Dropbox 백업 설정',
    openAttributionsTitle: '의존성 크레딧 및 라이선스 보기',
    openDonateTitle: '후원으로 프로젝트 지원하기',
    settingsTitle: '설정',
    attributionsLabel: '크레딧',
    donateLabel: '후원',
    newWork: '새 작품',
    filters: {
      todos: '전체',
      lendo: '읽는 중',
      planejado: '예정',
      pausado: '일시정지',
      concluido: '완독',
      cancelado: '중단',
    },
    stats: {
      total: '전체 작품',
      reading: '읽는 중',
      done: '완독',
      planned: '예정',
      paused: '일시정지',
      cancelled: '중단',
      average: '평균 진행률',
    },
    loadingLibrary: '라이브러리를 불러오는 중…',
    emptyFoundTitle: '작품을 찾을 수 없습니다',
    emptyFoundText: '다른 필터나 검색어로 시도해 보세요.',
    emptyLibraryTitle: '라이브러리가 비어 있습니다',
    emptyLibraryText: '첫 작품을 추가하세요: 표지, 제목, 그리고 진행률을 기록하세요.',
    addFirstWork: '첫 작품 추가하기',
    drivePill: {
      syncing: '동기화 중…',
      connected: 'Dropbox 연결됨',
      off: 'Dropbox 꺼짐',
    },
    toastSaveError: '작품을 저장할 수 없습니다.',
    toastSaved: '작품이 저장되었습니다.',
    toastRemoved: '작품이 삭제되었습니다.',
  },

  settings: {
    title: '설정',
    bannerTitle: 'Dropbox 백업.',
    bannerBody:
      '라이브러리는 앱 전용 폴더에 저장됩니다(계정의 `/Apps/` 안): API를 통해 이 ' +
      '앱만 그 폴더를 볼 수 있으며, 나머지 Dropbox는 이 앱에 보이지도 않습니다. 폴더는 ' +
      '회원님께 보이므로, 모든 파일은 알아볼 수 없는 이름과 암호화된 내용(AES-256-GCM)으로 ' +
      '업로드됩니다. 첫 백업 전에 아래에서 암호화 비밀번호를 설정하세요.',
    languageLabel: '언어',
    providersLabel: '백업 제공업체',
    hiddenFolder: '숨김 폴더',
    operational: '사용 가능',
    notOperational: '사용 불가',
    backupIn: (target: string): string => `${target}에 백업`,
    passphraseLabel: '백업 암호화 비밀번호',
    passphrasePlaceholder: 'Dropbox 백업 암호화에 사용',
    connected: '연결됨',
    disconnected: '연결 해제됨',
    accountFallback: 'Dropbox 계정',
    lastBackup: '마지막 백업',
    inDropboxBackup: 'Dropbox 백업 내',
    worksInBackup: (works: number): string => `${works}개 작품`,
    syncingBanner: 'Dropbox와 동기화하는 중…',
    disconnectTitle: '이 앱에서 Dropbox 계정 연결 해제',
    disconnectAction: '연결 해제',
    authorizing: '인증 중…',
    connectAction: 'Dropbox에 연결',
    restoreTitle: 'Dropbox 백업을 내려받아 현재 라이브러리를 교체',
    restoreAction: '복원',
    restoring: '복원 중…',
    backupAction: '지금 백업하기',
    sending: '업로드 중…',
    toastSaved: '설정이 저장되었습니다.',
    toastAuthFailed: '인증에 실패했습니다.',
    toastConnected: 'Dropbox 계정이 연결되었습니다.',
    toastBackupFailed: '백업에 실패했습니다.',
    toastBackupDone: 'Dropbox 앱 폴더에 백업이 완료되었습니다.',
    toastRestoreFailed: '복원에 실패했습니다.',
    toastRestored: (works: number): string => `백업에서 ${works}개 작품을 복원했습니다.`,
    toastDisconnected: 'Dropbox 계정 연결이 해제되었습니다.',
  },

  restore: {
    title: '백업 비밀번호',
    banner:
      'Dropbox에 **백업할 때** 사용한 암호화 비밀번호를 입력하세요. ' +
      '내려받은 파일의 암호를 푸는 데 필요합니다.',
    passphraseLabel: '암호화 비밀번호',
    passphrasePlaceholder: '백업에 사용한 비밀번호',
    action: '복원',
  },

  workModal: {
    newTitle: '새 작품',
    editTitle: '작품 편집',
    titleRequired: '작품 제목을 입력하세요.',
    saveError: '저장에 실패했습니다.',
    coverAlt: '표지 미리보기',
    coverHelp:
      '작품 표지 이미지를 추가하세요(JPG, PNG, WebP…). 이미지는 로컬 라이브러리에 ' + '복사됩니다.',
    chooseImage: '이미지 선택',
    removeCover: '표지 제거',
    titleLabel: '제목',
    titlePlaceholder: '예: 나 혼자만 레벨업',
    synopsisLabel: '설명',
    synopsisPlaceholder: '작품 설명을 작성하세요...',
    typeLabel: '종류',
    statusLabel: '상태',
    categoryLabel: '카테고리',
    markerLabel: '표시 (선택 사항)',
    markerPlaceholder: '45화 / 3권',
    progressLabel: '읽기 진행률',
    decrease10: '10 감소',
    increase10: '10 증가',
    progressValue: (progress: number): string => `${progress}화`,
    finish: '완독',
    reset: '초기화',
    confirmDelete: '삭제하시겠습니까?',
    deleteAction: '삭제',
  },

  workCard: {
    coverOf: (title: string): string => `${title} 표지`,
    untitled: '제목 없음',
    progress: '진행률',
    progressValue: (progress: number): string => `${progress}화`,
    increase1: '1 증가',
    decrease1: '1 감소',
    reopen: '다시 열기',
    resume: '계속 읽기',
    finish: '완독',
    pause: '일시정지',
    cancel: '취소',
  },

  attributions: {
    ariaLabel: '크레딧',
    title: '크레딧',
    bannerTitle: '프로젝트 크레딧.',
    bannerBody:
      'Chronos Biblioteca에 사용된 오픈 소스 의존성 목록이며, 모두 OSI 승인 허용 ' +
      '라이선스입니다. 정확한 버전은 `package.json` / `package-lock.json`에 있습니다.',
    pause: '일시정지',
    resume: '계속',
    hoverHint: '크레딧 위에 마우스를 올리면 멈춥니다.',
    creditsAria: '스크롤 크레딧',
    creditsSubtitle: '다음 의존성에 감사드립니다',
    creditsEnd: '끝',
    creditsLoop: '크레딧이 반복됩니다',
  },

  donate: {
    ariaLabel: '후원',
    title: '프로젝트 후원하기',
    banner:
      '독자 한 분 한 분이 커피 한 잔 값을 내주신다면, Dropbox 앱의 정식 심사가 다음 ' +
      '화보다 먼저 끝날 텐데요.',
    text1:
      '이 프로젝트는 오타쿠 커뮤니티를 위해 태어났습니다: 좋아하는 읽기 플랫폼에 ' +
      '접근하지 못하게 되더라도 헤매지 않도록, 우리의 읽기를 저장하는 곳입니다.',
    text2:
      '좋든 싫든 저는 정말 빈털터리이고, 클라우드 백업은 Dropbox에 달려 있습니다: 앱이 ' +
      '정식 심사를 통과하기 전까지는 처음 50개 계정이 연결된 뒤 2주 안에 승인받지 못하면 ' +
      '신규 가입을 받지 못합니다. 여러분의 후원이 앱(과 제 인내심)을 유지하는 데 도움이 ' +
      '됩니다.',
    text3:
      '사실 이 프로젝트는 제 읽기를 기록하기 위한 개인 프로젝트입니다. 저처럼 단련된 ' +
      '오타쿠라면 아실 겁니다, 좋아하던 플랫폼이 망해서 읽기 기록을 몽땅 날려버리는 게 ' +
      '어떤 기분인지.',
    text4:
      '하지만 기적처럼 이 프로젝트에 후원이 들어온다면, 다음 날 아침에 일어나 리더 ' +
      '기록이 사라진 걸 보지 않고 편히 잠들 수 있도록, 최대한 완벽하게 만들겠습니다.',
    openTitle: '브라우저에서 후원 페이지 열기',
    donateNow: '지금 후원하기',
    copyTitle: '후원 링크 복사',
    copyLink: '링크 복사',
    copied: '복사됨!',
    thanks: '라이브러리를 살려주셔서 감사합니다. 즐거운 독서 되세요!',
  },

  workTypes: {
    webtoon: 'Webtoon',
    manhwa: 'Manhwa',
    manhua: 'Manhua',
    manga: 'Manga',
    livro: '책',
    outro: '기타',
  },

  workStatus: {
    planejado: '예정',
    lendo: '읽는 중',
    pausado: '일시정지',
    concluido: '완독',
    cancelado: '중단',
  },

  providers: {
    dropboxStorageTarget: '/Apps/Chronos Biblioteca (계정에 보이는 폴더)',
    googleStorageTarget: 'appDataFolder (숨김 폴더, Google Drive 화면에 나타나지 않음)',
    googleUnavailable:
      'Google Drive는 아직 사용할 수 없습니다: Chronos가 Google 요구사항(앱 확인, 동의 ' +
      '화면, 범위 심사)을 충족해야 통합이 활성화됩니다. 그때까지 백업은 Dropbox를 ' +
      '사용합니다.',
  },

  driveErrors: {
    notEncrypted: '암호화된 백업이 아닙니다.',
    truncated: '백업이 잘렸거나 손상되었습니다.',
    definePassphrase: '설정에서 백업 암호화 비밀번호를 설정하세요.',
    needsPassphrase: '이 백업은 암호화되어 있습니다. 암호화 비밀번호를 입력하세요.',
    wrongPassphrase: '암호화 비밀번호가 틀렸거나 백업이 손상되었습니다.',
    invalidManifest: '백업 매니페스트가 유효하지 않습니다.',
    syncInProgress: '동기화가 이미 진행 중입니다.',
    connectFirst: (provider: string): string => `먼저 ${provider} 계정을 연결하세요.`,
    emptyLibrary: '백업할 로컬 라이브러리가 없습니다. 작품을 하나 이상 추가하세요.',
    noBackupFound: (provider: string): string =>
      `${provider}의 앱 폴더에서 백업을 찾을 수 없습니다.`,
    invalidLibrary: '백업이 유효하지 않습니다(library.json 손상).',
    invalidListResponse: 'Dropbox API 응답이 유효하지 않습니다(파일 목록).',
    tokenTimeout: '인증 대기 시간이 초과되었습니다.',
    authCancelled: '인증이 취소되었습니다.',
    tokenFailed: (status: number): string => `토큰을 가져오지 못했습니다(${status}).`,
    invalidTokenResponse: (status: number): string => `토큰 응답이 유효하지 않습니다(${status}).`,
    configureAppKey: '설정에서 Dropbox 앱 키를 설정하세요.',
    sessionExpired: '세션이 만료되었습니다. Dropbox 계정을 다시 연결하세요.',
    refreshFailed: 'Dropbox 세션을 새로고침할 수 없습니다.',
    noAccount: '연결된 Dropbox 계정이 없습니다.',
    permissionsUpdated: 'Dropbox 권한이 업데이트되었습니다. Dropbox 계정을 다시 연결하세요.',
    missingScopes:
      'Dropbox 앱에 권한이 부족합니다. App Console의 Permissions 탭에서 모든 범위를 ' +
      '선택한 뒤 연결 해제 후 다시 연결하세요.',
    missingScopesList: (missing: string): string =>
      `Dropbox 앱에 권한이 부족합니다(${missing}). ` +
      'App Console의 Permissions 탭에서 모든 범위를 선택한 뒤 다시 연결하세요.',
    dropboxHttp: (status: number, response: string): string =>
      response === ''
        ? `Dropbox 오류(HTTP ${status}).`
        : `Dropbox 오류(HTTP ${status}). 응답: ${response}`,
  },

  /** HTML page the OAuth loopback shows in the browser tab. */
  oauthPage: {
    deniedTitle: '인증 거부됨',
    doneTitle: '인증 완료',
    deniedBody: '이 탭을 닫으셔도 됩니다.',
    doneBody: '이 탭을 닫고 앱으로 돌아가세요.',
  },
};

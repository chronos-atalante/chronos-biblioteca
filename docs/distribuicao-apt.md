# Distribuição: download direto e instalação via APT

Este guia registra o caminho completo até a distribuição atual do Chronos
Biblioteca. O resultado final é simples para quem usa o app: o usuário final
configura o repositório APT **uma vez** com `curl` e `gpg` e, a partir daí,
instala ou atualiza com `sudo apt update` e `sudo apt upgrade`. Aqui ficam o
motivo de cada escolha, o passo a passo da implantação, as lições dos erros
que apareceram no caminho e as regras que não podem ser quebradas.

## Resultado final (o que o usuário faz)

Configuração única, feita uma só vez:

```bash
curl -fsSL https://github.com/chronos-atalante/chronos-biblioteca/releases/latest/download/public.key | sudo gpg --dearmor --yes -o /usr/share/keyrings/chronos.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/chronos.gpg] https://github.com/chronos-atalante/chronos-biblioteca/releases/latest/download/ ./" | sudo tee /etc/apt/sources.list.d/chronos.list
```

Instalação da primeira vez e atualizações seguintes:

```bash
sudo apt update && sudo apt install chronos-biblioteca   # primeira vez
sudo apt update && sudo apt upgrade                      # cada nova versão
```

Tudo aponta para um endereço só, o da última Release:

`https://github.com/chronos-atalante/chronos-biblioteca/releases/latest/download/`

## Motivo da escolha: um repo só, sem estourar os limites

A decisão precisia satisfazer duas exigências ao mesmo tempo: **não deixar o
projeto fragmentado em vários repositórios** e **não estourar os limites de
tamanho do GitHub**. As contas são estas:

- O git **bloqueia arquivos acima de 100 MiB** por blob. O `.deb` do Chronos
  está com cerca de 99 MB e cresce a cada release, então versioná-lo no git
  é uma falha garantida no horizonte.
- O plano gratuito da **Vercel limita arquivos a 100 MB**, então a landing
  page não pode hospedar o binário.
- As **GitHub Releases aceitam até 2 GiB por asset**, não têm limite de
  transferência e o endereço `…/releases/latest/download/<nome>` redireciona
  sempre para o arquivo mais recente. É o lugar natural tanto para o `.deb`
  quanto para os índices do APT.

O desenho antigo usava um segundo repositório (`repo-apt`, GitHub Pages com
`reprepro`). Funcionava, mas tinha problemas:

- dois repositórios para manter em sincronia (versão, índices, chave);
- histórico inflado até 879 MB guardando `.deb` versionados;
- e, mesmo limpando o histórico, o limite de 100 MiB por blob continuaria
  perseguindo o projeto a cada release maior.

Comparação dos caminhos avaliados:

| Caminho avaliado                                | Repositórios              | Situação                                                                 |
| ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `.deb` versionado no git + GitHub Pages         | 2 (Biblioteca + repo-apt) | Descartado: fragmentação, histórico gigante e limite de 100 MiB por blob |
| Binário hospedado na Vercel junto com a landing | 1                         | Descartado: limite de 100 MB por arquivo no plano Hobby                  |
| Repo APT flat publicado como assets da Release  | 1                         | **Adotado**: nada de binário no git, sem repositório extra               |

> Regra de ouro: o `.deb` **nunca** é commitado em repositório algum. Ele
> vive apenas na GitHub Release da tag `v<versão>`.

## Arquitetura atual

```mermaid
flowchart TD
    A["push na main (versão nova) / tag v*"] --> B0["job Verificar versão: package.json vs Releases"]
    B0 -->|"Release ainda não existe"| B["publish.yml: gera e anexa os assets"]
    B0 -->|"Release já existe"| P["fim: execução verde e rápida"]
    B --> C["Release: .deb com versão + alias chronos-biblioteca_amd64.deb"]
    B --> D["Índices assinados: Packages, Packages.gz, Release, Release.gpg, InRelease, public.key"]
    C --> E["releases/latest/download/ (suite ./)"]
    D --> E
    E --> F["sources.list do usuário → apt update / apt upgrade"]
    B --> G["Deploy Hook da Vercel"]
    G --> H["build da landing: fetch-release.mjs lê releases/latest"]
    H --> I["release-info.json → botão Baixar .deb + seção APT"]
```

Onde vive cada parte:

- `Biblioteca/.github/workflows/publish.yml`: decide se há versão nova,
  gera o `.deb`, anexa os assets da Release, monta e assina o repo APT flat
  e dispara o redeploy da landing.
- `Biblioteca/build/after-pack.cjs`: slim do pacote (idiomas e SwiftShader).
- `Landing page/scripts/fetch-release.mjs`: lê a Release a cada build e grava
  `src/app/release-info.json` (`version`, `fileName`, `debUrl`), com
  fallback commitado para builds sem rede.
- `Landing page/src/app/page.tsx`: constante `APT_BASE` com a base dos
  comandos APT e o botão de download.

## Passo a passo da implantação

### 1. Encerrar o fluxo antigo (repo-apt)

- O script `bin/publicar-apt` e a seção correspondente do `CONTRIBUTING.md`
  foram removidos (`chore: remove o fluxo de distribuição APT`).
- O repositório local `repo-apt` foi apagado (879 MB liberados) e o repositório
  remoto foi deletado pelo dono no GitHub.
- Nenhum `.deb` é mais versionado em git; o `release/` do build continua no
  `.gitignore`.

### 2. Landing passa a ler a Release

- `fetch-release.mjs` consulta
  `GET /repos/chronos-atalante/chronos-biblioteca/releases/latest` em cada
  `npm run build` do Vercel e grava `src/app/release-info.json`.
- A página ganhou o botão **Baixar .deb** (mostra a versão viva) e a seção
  **Instalação (APT)** com os comandos desta página, incluindo aviso para
  quem tinha o `sources.list` do repo antigo (o arquivo novo sobrescreve o
  antigo).
- Se a API falhar (rede fora), o build usa o `release-info.json` commitado e
  não quebra.

### 3. publish.yml passa a gerar o repo APT flat

Depois de anexar o `.deb` versionado, o workflow executa o passo **Gerar repo
APT flat assinado (assets estáveis)**:

1. Copia o `.deb` para a árvore `apt/` com o **nome estável**
   `chronos-biblioteca_amd64.deb` (sem versão, obrigatório para
   `releases/latest/download/`, que só redireciona nomes exatos).
2. Gera `Packages` com `dpkg-scanpackages` e corrige o campo `Filename:` para
   ser o nome puro do arquivo (caminho absoluto ou `./` dá 404 no download).
3. Gera `Packages.gz` e o `Release` com `apt-ftparchive`, sempre **fora** da
   árvore e só depois movido para dentro, para não hashear a si mesmo nem o
   `.raw` intermediário.
4. Assina com GPG: `InRelease` (clearsign), `Release.gpg` (assinatura
   destacada) e `public.key` (chave pública exportada).
5. Anexa tudo à mesma Release (foram 8 assets na v1.1.1).

O endereço base usado pela landing e pelos comandos é fixo:

`…/releases/latest/download/` com suite `./`.

### 4. Segredos do GPG no Actions

Em **Settings → Secrets and variables → Actions** do repositório da
Biblioteca:

| Secret            | Conteúdo                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GPG_PRIVATE_KEY` | Bloco armoured completo da chave, **com** as linhas `-----BEGIN PGP PRIVATE KEY BLOCK-----` e `-----END PGP PRIVATE KEY BLOCK-----` |
| `GPG_PASSPHRASE`  | Senha da chave (a chave `F2B0A3843C9FF986` tem senha)                                                                               |

Se algo faltar, esse passo do workflow falha com diagnóstico explícito
(`::error::` legível na página da execução): chave incompleta, passphrase
errada ou secret ausente.

### 5. Validação local sem sudo

Para testar o APT sem tocar no sistema, o teste usa diretórios próprios:

```bash
BASE=https://github.com/chronos-atalante/chronos-biblioteca/releases/latest/download
D=/tmp/apt-test
mkdir -p "$D/empty.d" "$D/lists/partial" "$D/cache/archives/partial"
curl -fsSL "$BASE/public.key" | gpg --dearmor -o "$D/repo.gpg"
echo "deb [signed-by=$D/repo.gpg] $BASE ./" > "$D/sources.list"
apt-get update \
  -o Dir::Etc::sourcelist="$D/sources.list" -o Dir::Etc::sourceparts="$D/empty.d" \
  -o Dir::Etc::trusted=/dev/null -o Dir::Etc::trustedparts=/dev/null \
  -o Dir::State::lists="$D/lists/" -o Dir::Cache="$D/cache"
apt-cache -o Dir::State::lists="$D/lists/" policy chronos-biblioteca
```

O `apt-cache policy` precisa mostrar a versão da Release como candidata com
prioridade 500 e a assinatura precisa passar sem avisos.

### 6. Publicação

O push na `main` dispara o workflow **Publicar .deb**, que no job
**Verificar versão** lê `package.json` e checa se já existe Release para
`v<versão>`: se existe, encerra ali (execução verde e rápida); se não
existe, cria a tag, compila, anexa o `.deb` e o repo APT flat assinado e
dispara o Deploy Hook da Vercel. O build da landing então lê a Release nova
e publica a versão atualizada. O ciclo é:

```text
push na main (versão nova) → Verificar versão (package.json vs Releases) → cria tag → .deb + APT assinados na Release → deploy hook → build da landing → versão nova no site
```

A tag é criada **pelo próprio CI, no commit do push**, então o workflow que
roda é o da `main` e a tag nunca aponta para um commit antigo (lição da
v1.1.1, abaixo). Como o push de tag sai do `GITHUB_TOKEN` da mesma execução,
ele não dispara um segundo run: não há loop nem build duplicado.

## Publicação de uma nova versão (fluxo semanal)

Desde a remoção do release-please (motivo na próxima seção), o bump de
versão é manual e a **publicação é automática**:

1. Bump em `Biblioteca/package.json` → `version` e entrada nova no
   `CHANGELOG.md`. Os Conventional Commits desde a última release indicam se
   sobe MINOR ou PATCH.
2. Commit (`chore: release x.y.z`) e push na `main`.
3. O workflow **Verificar versão** detecta que `v<versão>` ainda não tem
   Release e publica sozinho (cria a tag, compila, anexa, assina, notifica o
   Vercel). Sem bump, ele só confirma que a Release já existe e sai verde.
4. Aguardar o workflow ficar verde.
5. Conferir a sincronia das quatro vias:
   `package.json` (`version`) ≡ tag `v*` ≡ `Packages` (`Version:`) ≡
   `Landing page/src/app/release-info.json` (`version`).
6. Pedir aos usuários que rodem `sudo apt update && sudo apt upgrade`.

Casos de exceção (o mesmo workflow, sem checar a versão):

- `workflow_dispatch` na UI do Actions: reanexa os assets de uma Release
  que falhou no meio do caminho;
- `git tag vX.Y.Z && git push origin vX.Y.Z`: publica uma tag criada à mão
  (o job avisa, como `::warning::`, se a tag não bater com o
  `package.json`);
- Release criada na UI do GitHub (`release: published`).

## Lições da implantação (o que deu errado no caminho)

- **A tag apontava para o commit antigo.** O Actions executa o workflow que
  está na _ref_ do evento, ou seja, dentro da tag. Enquanto a tag `v1.1.1`
  apontava para um commit anterior ao workflow novo, rodou a versão antiga
  (sem passo de APT). Correção: reempurrar a tag para o commit correto da
  `main`.
- **O secret da chave vinha sem os marcadores BEGIN/END.** Sem o cabeçalho
  armoured, `gpg --import` falha com exit 2 e nada explica o motivo. O
  workflow agora valida a importação e a passphrase antes de gerar os
  índices e emite `::error::` com a causa exata.
- **O release-please foi removido.** Ele falhava com
  `403 Resource not accessible by integration` ao criar a Release porque a
  plataforma rejeita `target_commitish` com SHA para `GITHUB_TOKEN`
  (bug conhecido, `cli/cli#9514`). Nada de configuração local resolve; a
  solução foi o bump manual de versão com publicação automática pelo
  `publish.yml` (descrito acima); ele cria a **tag via `git push`** antes
  de chamar a API da Release, então o `target_commitish` nunca é preciso.
- **A v1.1.1 não abria (só o ícone).** O `after-pack.cjs` removia o
  `libffmpeg.so`, mas o binário do Electron o declara como `DT_NEEDED` e o
  loader exige o arquivo na hora do exec. Corrigido na v1.1.2: o slim só
  remove locales, SwiftShader e Vulkan.
- **Incidentes do GitHub Actions (05/10/2026)** derrubaram runs do
  release-please e do Dependabot com "job was not acquired by Runner". Em
  incidente de plataforma a solução é reexecutar depois; não há erro de
  configuração para corrigir.

## Regras inegociáveis

1. **Nunca renomear os assets estáveis** da Release
   (`Packages`, `Packages.gz`, `Release`, `Release.gpg`, `InRelease`,
   `public.key` e `chronos-biblioteca_amd64.deb`): o APT resolve o
   `Filename` contra `releases/latest/download/` por nome exato.
2. **`Filename` no `Packages` é relativo** (só o nome do arquivo). Caminho
   absoluto ou `./` quebra o download.
3. **`.deb` nunca entra no git** (limite de 100 MiB por blob). Nem na
   landing nem na Biblioteca.
4. **Segredos nunca aparecem no repositório**: chave e senha vivem só nos
   secrets do Actions.
5. **O `after-pack.cjs` não pode remover bibliotecas com `DT_NEEDED`** no
   binário do Electron (`readelf -d` para conferir).
6. O site nunca hospeda binário; ele só aponta para a Release.

## Verificação rápida de sanidade

```bash
BASE=https://github.com/chronos-atalante/chronos-biblioteca/releases/latest/download
curl -fsSL -o Packages "$BASE/Packages"         # índices acessíveis
curl -fsSL -o InRelease "$BASE/InRelease"       # baixa assinatura
curl -fsSL -o public.key "$BASE/public.key"     # baixa chave
gpg --dearmor -o repo.gpg public.key            # chave em keyring
gpg --no-default-keyring --keyring "$(pwd)/repo.gpg" --verify InRelease
grep -E '^(Version|Filename):' Packages         # versão nova e nome correto
```

Se tudo passar, `sudo apt update` do usuário final enxerga a versão nova e
`sudo apt upgrade` instala.

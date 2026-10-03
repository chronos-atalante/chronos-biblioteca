# AGENTS.md

Diretrizes para agentes e contribuidores deste repositório.

## Qualidade de código

- Seguir as melhores práticas de design patterns (separação de responsabilidades, baixo acoplamento, alta coesão).
- Evitar arquivos monolíticos: ao atingir ~500 linhas, refatorar extraindo módulos/componentes.
- Type safety rigoroso: sem `any` implícito, evitar casts; preferir tipos/interfaces bem definidos e `unknown` quando necessário.

## Dependências

- Usar apenas dependências com licenças permissivas (MIT, Apache-2.0, BSD, ISC). Sem copyleft forte (GPL, AGPL, LGPL em dependências obrigatórias).
- Antes de adicionar uma dependência, verificar a licença e preferir alternativas já presentes no projeto.

## Comandos

- `npm run check` — typecheck + lint + format + auditoria de segurança (OSV). Deve passar antes de concluir mudanças.
- `npm run security:audit` — verifica vulnerabilidades nas dependências via OSV Scanner.
- `npm run dev` / `npm run build` / `npm run dist` — desenvolvimento, build e empacotamento.

## Segurança

- Vulnerabilidades sem fix upstream só podem ser ignoradas com justificativa em `.osv-scanner.toml` (com data de revisão).

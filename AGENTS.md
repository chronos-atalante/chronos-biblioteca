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

## Documentação

- Manter a documentação alinhada com o código **a cada mudança**: qualquer alteração de comportamento, fluxo, configuração, caminhos, mensagens exibidas ou dependências deve atualizar `README.md` e/ou `docs/*.md` na **mesma** mudança (nunca deixar para depois).
- Ao alterar um documento, revisar também os diagramas Mermaid, as tabelas de sintoma/causa e os exemplos de comando — eles costumam quebrar em silêncio.
- Documentação nova (guias, troubleshooting, arquitetura) vai em `docs/`; manter o `README.md` como índice que aponte para ela.
- Verificação: após `npm run check`, reler os trechos de doc afetados pela mudança.

## Segurança

- Vulnerabilidades sem fix upstream só podem ser ignoradas com justificativa em `.osv-scanner.toml` (com data de revisão).

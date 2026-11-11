# Organização da plataforma

Referência: spec fornecido em 11/11/2026. Adotados e-mail, conclusão manual e separação entre Administrador e Super Admin; decisões sujeitas à validação da escola.

- `src/domain/school.ts`: conceitos, contratos, progresso e validação de links. Independente de React e Supabase.
- `src/features/`: apresentação por funcionalidade. Tokens compartilhados em `src/index.css`.
- `src/infrastructure/school.ts`: adapter Supabase, sessão, consultas e persistência. Falhas não viram resultados fictícios.
- `supabase/functions/manage-account`: módulo de aplicação no servidor para provisionamento e gestão de perfis. Seu interface exige autenticação; a chave privilegiada fica no servidor.
- `supabase/schemas`: RLS por estado atual do cadastro. O seam entre navegador e dados não confia nos controles visuais.

O módulo de acesso concentra decisões que mudam juntas (locality). A leverage vem da autorização compartilhada por todas as consultas. O deletion test não justificou wrappers de uma linha sobre o SDK: o adapter já esconde autenticação, persistência e falhas. Um segundo adapter pode justificar outro contrato; hoje seria um hypothetical seam.

Não existiam Git, GLOSSARY.md, ADRs, consumidores externos nem contratos anteriores de UI. O relatório exploratório está no diretório temporário, fora do projeto. As skills auxiliares codebase-design, grilling e domain-modeling não estavam instaladas.

## Verificação

`npm test` executa schema e seed em PostgreSQL WASM (PGlite), com schemas mínimos de Auth/Storage e papéis reais de banco. Cobre isolamento entre alunos, progresso, revogação e reativação, coral, primeiro acesso, suspensão, gestão administrativa e trigger de provisionamento.

Isso não substitui homologação de Auth, gateway de Edge Functions, Storage HTTP, YouTube e leitores nativos de PDF. A função passa por `deno check`; testes de ponta a ponta dependem de ambiente configurado.

## Registro de verificação

- A compilação encontrou inferência incompatível no SDK para persistência de tabelas com IDs numéricos e UUIDs. Normalizado o payload no adapter; o compilador verifica essa classe de falha. Nenhuma nova regra de produto necessária.
- O lint detectou constante exportada junto dos elementos de apresentação. A constante agora é interna ao módulo.

## Direção visual

Branco, vermelho litúrgico, vinho, cinza e prata do brasão. Libre Caslon Display nos títulos e DM Sans no texto e controles. Alinhamento à esquerda; arco da fotografia como destaque. Sem estatísticas ou registros institucionais inventados. Fotografia de concerto ilustrativa, a substituir por imagem aprovada antes do lançamento.

## Correção: entrada administrativa separada

O painel era escolhido somente pelo perfil na página inicial. Agora `/admin` possui entrada própria e verifica o perfil antes de carregar conteúdo protegido. A entrada pública aceita alunos; a administrativa aceita Administrador e Super Admin. Primeiro acesso e suspensão continuam obrigatórios. `tests/routes.test.mjs` cobre a separação de caminhos e perfis; os testes de RLS continuam cobrindo autorização dos dados.

## Correção: metadados de Auth posteriores à criação

Na verificação remota, Auth criou a identidade antes de gravar os metadados administrativos, portanto o trigger somente de INSERT não encontrou `school_profile`. O trigger agora também observa UPDATE de `raw_app_meta_data`; a inserção do perfil é idempotente por UUID e não altera permissões de perfis existentes. O teste reproduz as duas etapas e confirma que repetir a atualização não redefine o primeiro acesso nem o estado ativo. A migração corretiva está versionada e aplicada no mesmo destino remoto.

## Correção: administrador na página pública

A separação entre as entradas havia tratado a landing page como área restrita a alunos, substituindo-a por uma mensagem para administradores autenticados. A seleção de conteúdo público agora é independente da autorização do espaço de alunos: visitantes e administradores veem a landing em `/`, inclusive antes de concluir o primeiro acesso administrativo; `/admin` preserva os bloqueios de perfil, suspensão e troca de senha. Os links de início do painel levam a `/`, e o site oferece retorno à administração mantendo a sessão. O teste de regressão cobre Administrador, Super Admin, conta inativa e primeiro acesso pendente.

## Professores e autorização por curso

Novo perfil `teacher`, com entrada `/professor`. O Administrador cria as contas e controla os vínculos `course_teachers`; o professor gerencia somente aulas e partituras desses cursos. O módulo de contas mantém a mesma interface autenticada e a autorização compartilhada em `supabase/functions/_shared/permissions.ts`. Nenhum novo poder foi concedido ao Super Admin.

Partituras receberam `course_id` anulável para preservar o acervo existente. Novos PDFs usam prefixo do curso; o predicado de autorização atual verifica também a conta ativa e o primeiro acesso. O seam com Storage protege o objeto, além da listagem. Professores não recebem DELETE nem UPDATE de objetos: substituições geram um novo caminho. As políticas do aluno do coral continuam válidas.

Verificação local: isolamento por curso, metadados, arquivos, atribuição de curso, revogação, suspensão e primeiro acesso. Verificação remota: contas temporárias exercitaram a função de criação, Auth, Data API e Storage HTTP; identidades, rascunhos e arquivos foram removidos ao final.

Duas falhas apareceram apenas na integração real: após troca de senha pelo servidor, a sessão antiga retornou 401; o frontend agora autentica novamente com a nova senha antes de recarregar o perfil. Após revogação de curso, uma solicitação de um PDF já baixado retornou a resposta anterior; o download agora usa `cacheNonce` e `cache: no-store`, e uploads privados usam `cacheControl: 0`. O teste remoto passou com a mesma sessão após revogação e suspensão. A regressão fica registrada no script de verificação remota.

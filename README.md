# Escola Paráclito

React, TypeScript e Vite para a formação musical litúrgica da Diocese de Barretos.

## Executar

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
```

Sem variáveis, a página pública usa conteúdo inicial de apresentação. Não há login fictício nem senha padrão. Copie `.env.example` para `.env.local` e configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca coloque segredos de servidor em variáveis `VITE_`.

## Entrega

Página institucional, cinco cursos, galeria, contato condicionado a WhatsApp válido, temas claro/escuro, login e primeiro acesso. Área do aluno com aulas, progresso manual e PDFs privados do coral. Painel para alunos, matrículas, cursos, aulas, partituras, galeria e conteúdo institucional. Super Admin gerencia administradores; seus poderes não incluem a administração escolar nesta versão.

## Configurar Supabase

O banco usa schema declarativo em `supabase/schemas/001_school.sql`. As migrações foram aplicadas em 11/11/2026 no projeto remoto `escola_paraclito` (`bxnlawrzadhjkhceobpx`). O seed contém catálogo e texto inicial, sem vídeos, contas, PDFs ou telefones fictícios.

1. Configure uma CLI compatível e um banco local. Descubra comandos e opções via `supabase --help` e o `--help` de cada grupo/comando; a CLI v3 mudou a escolha de destino.
2. Gere a migração a partir do schema declarativo e do `schema_paths` configurado. Revise o resultado, inclusive buckets, grants, trigger de Auth e RLS. Versione a migração gerada em `supabase/migrations/`.
3. Recrie um banco vazio, carregue o seed separadamente e rode os advisors. Homologue com dados fictícios antes de produção.
4. Implante a função `manage-account`. Configure `APP_ORIGIN` com a origem exata do frontend. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são segredos exclusivos do runtime da função. Ela valida usuário no Auth e autorização pelo perfil atual no banco.
5. Desative cadastro público no Auth, configure URLs autorizadas e expiração de sessão. Confira exposição das tabelas na Data API e os grants explícitos.
6. Crie a primeira conta de Super Admin por procedimento protegido no dashboard/servidor, sem endpoint público. Cadastre a linha correspondente em `profiles`: UUID do Auth, nome, e-mail, WhatsApp internacional, `role='super_admin'`, `active=true`, `choir=false`, `must_change_password=true`. Entregue a senha temporária fora de URLs e logs. Não use `user_metadata` para atribuir privilégios.
7. Configure as variáveis do frontend, faça o build e publique `dist`. Cadastre administrador, conteúdo aprovado, WhatsApp e aulas reais.

O provisionamento usa uma chave de tentativa. O trigger sincroniza o perfil na inserção ou na atualização dos metadados administrativos de Auth; o perfil fica inativo até concluir as matrículas. Retentar o mesmo formulário recupera a tentativa sem duplicar aluno. A senha temporária só é retornada em memória e descartada ao fechar o diálogo. O link WhatsApp nunca contém essa senha. A mensagem é enviada manualmente pelo administrador no próprio WhatsApp.

## Validação de lançamento

Execute em Supabase real com visitante, aluno, coral, Administrador e Super Admin: login, primeiro acesso, recuperação, falha e nova tentativa de cadastro, escalada de perfil pela API, matrícula/revogação com sessão aberta, suspensão, aulas não publicadas, progresso em outro dispositivo, PDFs por acesso direto e após retirada do coral. Verifique vídeos e leitura/download/impressão de PDF em celular e desktop, teclado e ambos os temas.

`npm test` testa schema e RLS em PostgreSQL em memória (PGlite), com schemas mínimos simulando Auth e Storage. Não substitui testes dos serviços Supabase. `deno check supabase/functions/manage-account/index.ts` verifica os tipos do servidor.

## Backup e restauração

Exporte regularmente o banco e planeje a recuperação de identidades Auth por procedimento protegido. O backup do banco inclui metadados do Storage, mas não os binários: copie separadamente os objetos de `institutional` e `scores`, preservando caminhos. Guarde os backups criptografados fora do projeto.

Na restauração, recrie schema/políticas, preserve UUIDs das identidades e vínculos de matrículas/progresso, e copie objetos para os mesmos buckets e caminhos. Confira contagens, hashes e referências e execute os cenários de aceite em homologação. Mudança de fornecedor exige decisão específica sobre credenciais e sessões.

Arquivos substituídos recebem caminhos novos; objetos antigos não são apagados automaticamente. Inclua revisão de objetos órfãos na manutenção.

Veja [arquitetura](docs/architecture.md). A logo fornecida está em `public/images/logo.jpeg`. A fotografia é ilustrativa (Unsplash), não um registro institucional. As fontes usam Google Fonts. Revise e aprove os recursos ou hospede-os localmente antes do lançamento. O texto inicial também precisa de aprovação da escola.

## Entrada administrativa

Administradores e Super Admin acessam `/admin` (também aceita `/admin/`). A página tem login próprio e não aparece na navegação pública. Alunos entram pelo site da escola. Perfis administrativos não abrem o painel pela entrada de alunos; alunos não abrem a área administrativa. Uma tentativa de login pela entrada incorreta é encerrada sem carregar dados protegidos. Administradores autenticados podem visitar a landing page em `/` sem encerrar a sessão; o cabeçalho oferece retorno para `/admin`. Alunos continuam sem acesso ao painel administrativo.

O servidor de hospedagem deve reescrever rotas da SPA, incluindo `/admin` e seus subcaminhos, para `index.html` (HTTP 200). O Vite já faz isso em desenvolvimento. A separação de URLs organiza os acessos; a autorização continua nas políticas RLS e na função do servidor.

## Comandos para o banco remoto

A CLI está fixada em 3.1.0. Nessa versão, vincular um projeto não muda o destino padrão dos comandos de banco: sem `--remote`, a CLI procura o PostgreSQL local em `127.0.0.1:54322`. Não é necessário iniciar Docker para consultar ou aplicar migrações no projeto hospedado.

```sh
npm run db:status
npm run db:query -- --read-only "select current_database();"
npm run db:migrate -- --yes
npm run db:seed -- --yes
npm run db:advisors
```

Esses scripts apontam explicitamente para `bxnlawrzadhjkhceobpx`. Com a CLI diretamente, use `npx supabase db query --remote=bxnlawrzadhjkhceobpx --read-only "select current_database();"`. Não use `supabase start` como correção para operações destinadas ao remoto.

A migração inicial foi criada pela CLI e preenchida a partir do schema declarativo validado, porque a geração pg-delta exigiu Docker indisponível. A segunda migração corrige a sincronização de perfis quando Auth grava `school_profile` após inserir a identidade. O teste PostgreSQL cobre metadados posteriores e repetição sem reativar nem redefinir um perfil existente.

Referência: https://supabase.com/changelog/supabase-cli-v3

## Telefones e senhas

Os campos de WhatsApp começam com `+55`. Números brasileiros com DDD podem ser digitados sem o código do país; a aplicação acrescenta `55` antes de salvar. Números internacionais podem informar o código explicitamente com `+`. O contato institucional vazio ou apenas `+55` oculta o botão de contato. A normalização é compartilhada com a função do servidor.

Novas senhas exigem no mínimo 8 e no máximo 128 caracteres. O mínimo está alinhado entre formulário, função de primeiro acesso e Supabase Auth remoto. A mudança não redefine senhas existentes.

## Configurar site e contato

No painel do Administrador, **Configurar site** reúne **Quem somos**, **Contato** e **Galeria**. Em Contato, informe o WhatsApp da escola e salve. O link **Testar WhatsApp configurado** permite conferir o destino sem enviar mensagens automaticamente.

A landing page tem uma seção Contato, acessível pela navegação, com o botão **Conversar no WhatsApp** quando há um número válido. Sem número configurado, a seção informa que o canal estará disponível em breve e não mostra um link inválido. O número institucional é independente dos telefones dos alunos e administradores.

## Imagem inicial

Em **Configurar site → Imagem inicial**, o Administrador pode enviar ou substituir a fotografia de destaque (JPG, PNG ou WebP, até 10 MB), conferir a prévia e informar texto alternativo obrigatório. A imagem fica no bucket público `institutional`; caminho e descrição ficam em `site_settings`.

**Usar imagem padrão** remove a referência da configuração e restaura a fotografia original. A mesma fotografia é usada se a imagem cadastrada falhar ao carregar. Arquivos antigos não são apagados automaticamente do Storage. A migração `20261111221312_configurable_hero_image.sql` adiciona os campos sem alterar o conteúdo institucional existente.

## Professores

O Administrador cadastra professores em **Professores → Novo professor**, informando nome, e-mail, WhatsApp e os cursos que cada um leciona. Também pode suspender a conta, redefinir acesso e conceder ou revogar cursos pelo cadastro. O Super Admin continua responsável exclusivamente pelas contas administrativas.

Professores entram em `/professor`, trocam a senha temporária no primeiro acesso e podem cadastrar, editar e publicar aulas e partituras apenas dos cursos atribuídos. Não podem criar/editar cursos, gerenciar contas, alterar matrículas ou configurar o site. Não há exclusão definitiva de conteúdo por esse perfil. Professores também podem visitar a landing page mantendo a sessão.

`course_teachers` registra os vínculos. As verificações RLS usam o estado atual da conta e do vínculo, inclusive na mesma sessão. Novas partituras exigem curso e seus PDFs são enviados para `<course_id>/<arquivo>.pdf` no bucket privado `scores`. PDFs e aulas sem vínculo ativo ficam inacessíveis ao professor, mesmo por requisição direta.

Partituras antigas sem curso permanecem no acervo geral do Administrador. O acesso dos alunos às partituras publicadas continua restrito a alunos ativos do coral, sem ampliar permissões de professores por participação no coral.

`npm run test:remote:teachers` verifica Auth, provisionamento pela função, primeiro acesso, isolamento de aulas, upload/download de PDF, bloqueio de outro curso, revogação e suspensão no projeto remoto fixado nos scripts. Usa contas e conteúdo de rascunho temporários, removidos ao final. Exige a sessão administrativa da CLI com acesso às chaves do projeto; nenhuma chave ou senha é gravada ou exibida.

Downloads autenticados de partituras usam uma URL com nonce por solicitação e `cache: no-store`, e novos PDFs usam `cacheControl: 0`. Isso evita reutilizar uma resposta antiga após revogação. Uma cópia já baixada pelo usuário permanece no dispositivo.

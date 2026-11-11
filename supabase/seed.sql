-- Initial catalogue only: no fictional lessons, accounts, PDFs or telephone numbers.
insert into public.courses(id,title,description,published) values
('10000000-0000-4000-8000-000000000001','Violão','Acordes que acolhem e conduzem o canto da comunidade.',true),
('10000000-0000-4000-8000-000000000002','Órgão','A tradição e a beleza do instrumento na liturgia.',true),
('10000000-0000-4000-8000-000000000003','Canto','A voz como expressão de fé e instrumento de serviço.',true),
('10000000-0000-4000-8000-000000000004','Teoria musical','Os fundamentos para compreender a linguagem da música.',true),
('10000000-0000-4000-8000-000000000005','Solfejo','Educar a escuta. Ler, perceber e cantar a música.',true)
on conflict(id) do nothing;
insert into public.site_settings(id,about,whatsapp) values (1,'A Escola Paráclito é um espaço de formação musical a serviço da liturgia na Diocese de Barretos. Aqui, técnica e sensibilidade caminham com a fé, preparando músicos para servir à comunidade com beleza e propósito.','') on conflict(id) do nothing;

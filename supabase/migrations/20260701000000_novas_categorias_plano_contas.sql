-- Novas categorias de despesa
INSERT INTO public.plano_contas (codigo, nome, tipo, parent_id, ativo, ordem) VALUES
('4.11', 'Aluguel', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 11),
('4.12', 'Materiais', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 12),
('4.13', 'Licenças', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 13),
('4.14', 'SIMPLES', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 14),
('4.15', 'INSS', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 15),
('4.16', 'Alimentação', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 16),
('4.17', 'Condomínio', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 17),
('4.18', 'Energia', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 18),
('4.19', 'Internet (whatsapp)', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 19),
('4.20', 'Internet (consultório)', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 20),
('4.21', 'Contabilidade', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 21),
('4.22', 'Lembrancinhas', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 22),
('4.23', 'Sala sublocada (pago a terceiros)', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 23),
('4.24', 'Estacionamento', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 24),
('4.25', 'Combustível', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 25),
('4.26', 'Google', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 26),
('4.27', 'Zoom', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 27),
('4.28', 'Internet Vivo', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 28),
('4.29', 'Testes / Protocolos', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 29),
('4.30', 'Endereço Fiscal', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 30),
('4.31', 'Afinando o cérebro', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 31),
('4.32', 'Nesplora', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 32),
('4.33', 'Pro-labore', 'despesa', '0c4a7514-7795-4fa7-8d37-4994bc649484', true, 33);

-- Novas categorias de receita
INSERT INTO public.plano_contas (codigo, nome, tipo, parent_id, ativo, ordem) VALUES
('3.3', 'Mensalidade', 'receita', '5d64be6e-e604-4954-938a-0c88254adfb9', true, 3),
('3.4', 'Sessão avulsa', 'receita', '5d64be6e-e604-4954-938a-0c88254adfb9', true, 4),
('3.5', 'Pacote mensal', 'receita', '5d64be6e-e604-4954-938a-0c88254adfb9', true, 5),
('3.6', 'Avaliação', 'receita', '5d64be6e-e604-4954-938a-0c88254adfb9', true, 6),
('3.7', 'Infoproduto', 'receita', '5d64be6e-e604-4954-938a-0c88254adfb9', true, 7),
('3.8', 'Sublocação (recebida)', 'receita', '5d64be6e-e604-4954-938a-0c88254adfb9', true, 8),
('3.10', 'Mentoria', 'receita', '5d64be6e-e604-4954-938a-0c88254adfb9', true, 10);

CREATE OR REPLACE VIEW detalhes_funcionarios_view AS
SELECT f.id, f.nome, f.login, f.cargo_id, c.nome AS perfil,
       c.nome AS cargo_nome, f.ativo, f.created_at, f.updated_at
FROM funcionarios f
JOIN cargos c ON c.id = f.cargo_id;

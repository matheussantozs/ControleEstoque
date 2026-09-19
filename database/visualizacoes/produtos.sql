CREATE OR REPLACE VIEW detalhes_produtos_view AS
SELECT p.id, p.codigo, p.nome, p.categoria_id, c.nome AS categoria,
       p.preco, p.quantidade, p.limite_minimo, p.ativo,
       p.created_at, p.updated_at
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id;

CREATE OR REPLACE VIEW movimentacoes_view AS
SELECT m.id, m.produto_id, p.codigo, p.nome AS produto,
       m.funcionario_id, f.nome AS funcionario, m.venda_id,
       m.tipo, m.quantidade, m.observacao, m.created_at
FROM movimentacoes m
JOIN produtos p ON p.id = m.produto_id
JOIN funcionarios f ON f.id = m.funcionario_id;

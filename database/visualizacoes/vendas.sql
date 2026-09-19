CREATE OR REPLACE VIEW detalhes_vendas_view AS
SELECT v.id, v.funcionario_id, f.nome AS funcionario_nome,
       v.forma_pagamento_id, fp.nome AS forma_pagamento,
       v.observacao, v.created_at, v.finalizada, v.finalizada_at,
       COALESCE(SUM(vi.quantidade * vi.preco_unitario), 0) AS valor_total
FROM vendas v
JOIN funcionarios f ON f.id = v.funcionario_id
LEFT JOIN formas_pagamento fp ON fp.id = v.forma_pagamento_id
LEFT JOIN venda_item vi ON vi.venda_id = v.id
GROUP BY v.id, v.funcionario_id, f.nome, v.forma_pagamento_id,
         fp.nome, v.observacao, v.created_at, v.finalizada, v.finalizada_at;

CREATE OR REPLACE VIEW venda_item_view AS
SELECT vi.venda_id, vi.produto_id, p.nome AS produto_nome,
       p.codigo AS produto_codigo, c.nome AS categoria_nome,
       vi.quantidade, vi.preco_unitario,
       vi.quantidade * vi.preco_unitario AS subtotal,
       vi.created_at
FROM venda_item vi
JOIN produtos p ON p.id = vi.produto_id
JOIN categorias c ON c.id = p.categoria_id;

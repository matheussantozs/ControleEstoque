const express = require('express');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');
const { validDate, positiveInt, money } = require('../utils');
const router = express.Router();
router.use(auth);

function validatePeriod(inicio, fim) {
    return validDate(inicio) && validDate(fim) && inicio <= fim;
}

function periodParams(req, res) {
    const { inicio, fim } = req.query;
    if (!validatePeriod(inicio, fim)) {
        res.status(400).json({ error: 'Informe início e fim válidos no formato YYYY-MM-DD.' });
        return null;
    }
    return { inicio, fim };
}

router.get('/estoque', async (req, res, next) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
        const categoriaId = req.query.categoria_id ? positiveInt(req.query.categoria_id) : null;
        const status = req.query.status || 'todos';
        if (req.query.categoria_id && !categoriaId) return res.status(400).json({ error: 'Categoria inválida.' });
        if (!['todos', 'baixo', 'normal'].includes(status)) return res.status(400).json({ error: 'Status de estoque inválido.' });
        let sql = `SELECT p.id,p.codigo,p.nome,c.nome AS categoria,p.preco,p.quantidade,p.limite_minimo,
                          (p.quantidade*p.preco) AS valor_estoque
                   FROM produtos p JOIN categorias c ON c.id=p.categoria_id WHERE p.ativo=TRUE`;
        const args = [];
        if (q) { sql += ' AND (p.codigo LIKE ? OR p.nome LIKE ?)'; args.push(`%${q}%`, `%${q}%`); }
        if (categoriaId) { sql += ' AND p.categoria_id=?'; args.push(categoriaId); }
        if (status === 'baixo') sql += ' AND p.quantidade <= p.limite_minimo';
        if (status === 'normal') sql += ' AND p.quantidade > p.limite_minimo';
        sql += ' ORDER BY p.nome';
        const [rows] = await pool.execute(sql, args);
        const resumo = rows.reduce((acc, row) => {
            acc.produtos += 1;
            acc.unidades += Number(row.quantidade);
            acc.valor += Number(row.valor_estoque);
            if (Number(row.quantidade) <= Number(row.limite_minimo)) acc.baixo += 1;
            return acc;
        }, { produtos: 0, unidades: 0, valor: 0, baixo: 0 });
        res.json({ rows, resumo });
    } catch (e) { next(e); }
});

router.get('/movimentacoes', async (req, res, next) => {
    try {
        const period = periodParams(req, res);
        if (!period) return;
        const tipo = req.query.tipo || null;
        const produtoId = req.query.produto_id ? positiveInt(req.query.produto_id) : null;
        if (tipo && !['ENTRADA', 'SAIDA'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });
        if (req.query.produto_id && !produtoId) return res.status(400).json({ error: 'Produto inválido.' });
        let sql = `SELECT DATE(m.created_at) AS data,m.tipo,SUM(m.quantidade) AS quantidade,COUNT(*) AS registros,
                          COUNT(DISTINCT m.produto_id) AS produtos,
                          COALESCE(SUM(CASE WHEN m.tipo='ENTRADA' THEN m.quantidade ELSE 0 END),0) AS entradas,
                          COALESCE(SUM(CASE WHEN m.tipo='SAIDA' THEN m.quantidade ELSE 0 END),0) AS saidas
                   FROM movimentacoes m
                   WHERE m.created_at>=? AND m.created_at<DATE_ADD(?,INTERVAL 1 DAY)`;
        const args = [`${period.inicio} 00:00:00`, `${period.fim} 00:00:00`];
        if (tipo) { sql += ' AND m.tipo=?'; args.push(tipo); }
        if (produtoId) { sql += ' AND m.produto_id=?'; args.push(produtoId); }
        sql += ' GROUP BY DATE(m.created_at),m.tipo ORDER BY data DESC,m.tipo';
        const [rows] = await pool.execute(sql, args);

        let detailSql = `SELECT m.id,m.created_at,m.tipo,m.quantidade,m.observacao,m.venda_id,
                                p.codigo,p.nome AS produto,f.nome AS funcionario
                         FROM movimentacoes m
                         JOIN produtos p ON p.id=m.produto_id
                         JOIN funcionarios f ON f.id=m.funcionario_id
                         WHERE m.created_at>=? AND m.created_at<DATE_ADD(?,INTERVAL 1 DAY)`;
        const detailArgs = [`${period.inicio} 00:00:00`, `${period.fim} 00:00:00`];
        if (tipo) { detailSql += ' AND m.tipo=?'; detailArgs.push(tipo); }
        if (produtoId) { detailSql += ' AND m.produto_id=?'; detailArgs.push(produtoId); }
        detailSql += ' ORDER BY m.created_at DESC,m.id DESC LIMIT 1000';
        const [detalhes] = await pool.execute(detailSql, detailArgs);
        const resumo = detalhes.reduce((acc, row) => {
            acc.registros += 1;
            if (row.tipo === 'ENTRADA') acc.entradas += Number(row.quantidade);
            else acc.saidas += Number(row.quantidade);
            return acc;
        }, { registros: 0, entradas: 0, saidas: 0 });
        res.json({ rows, detalhes, resumo });
    } catch (e) { next(e); }
});

router.get('/vendas', async (req, res, next) => {
    try {
        const period = periodParams(req, res);
        if (!period) return;
        const funcionarioId = req.query.funcionario_id ? positiveInt(req.query.funcionario_id) : null;
        const pagamentoId = req.query.forma_pagamento_id ? positiveInt(req.query.forma_pagamento_id) : null;
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
        if ((req.query.funcionario_id && !funcionarioId) || (req.query.forma_pagamento_id && !pagamentoId)) return res.status(400).json({ error: 'Filtro inválido.' });

        let sql = `SELECT v.id,v.created_at,v.finalizada_at,f.nome AS funcionario,
                          fp.nome AS forma_pagamento,
                          COALESCE(SUM(vi.quantidade),0) AS itens,
                          COALESCE(SUM(vi.quantidade*vi.preco_unitario),0) AS valor_total
                   FROM vendas v
                   JOIN funcionarios f ON f.id=v.funcionario_id
                   LEFT JOIN formas_pagamento fp ON fp.id=v.forma_pagamento_id
                   LEFT JOIN venda_item vi ON vi.venda_id=v.id
                   WHERE v.finalizada=TRUE AND v.finalizada_at>=? AND v.finalizada_at<DATE_ADD(?,INTERVAL 1 DAY)`;
        const args = [`${period.inicio} 00:00:00`, `${period.fim} 00:00:00`];
        if (funcionarioId) { sql += ' AND v.funcionario_id=?'; args.push(funcionarioId); }
        if (pagamentoId) { sql += ' AND v.forma_pagamento_id=?'; args.push(pagamentoId); }
        if (q) { sql += ' AND (CAST(v.id AS CHAR) LIKE ? OR f.nome LIKE ?)'; args.push(`%${q}%`, `%${q}%`); }
        sql += ` GROUP BY v.id,v.created_at,v.finalizada_at,f.nome,fp.nome ORDER BY v.finalizada_at DESC,v.id DESC LIMIT 1000`;
        const [rows] = await pool.execute(sql, args);
        const resumo = rows.reduce((acc, row) => {
            acc.vendas += 1;
            acc.itens += Number(row.itens);
            acc.faturamento += Number(row.valor_total);
            return acc;
        }, { vendas: 0, itens: 0, faturamento: 0 });

        const [porPagamento] = await pool.execute(
            `SELECT COALESCE(fp.nome,'Sem pagamento') AS forma_pagamento,
                    COUNT(*) AS vendas,
                    COALESCE(SUM(vi.quantidade*vi.preco_unitario),0) AS total
             FROM vendas v
             LEFT JOIN formas_pagamento fp ON fp.id=v.forma_pagamento_id
             LEFT JOIN venda_item vi ON vi.venda_id=v.id
             WHERE v.finalizada=TRUE AND v.finalizada_at>=? AND v.finalizada_at<DATE_ADD(?,INTERVAL 1 DAY)
             GROUP BY fp.id,fp.nome ORDER BY total DESC`,
            [`${period.inicio} 00:00:00`, `${period.fim} 00:00:00`],
        );
        res.json({ rows, resumo, porPagamento });
    } catch (e) { next(e); }
});

module.exports = router;

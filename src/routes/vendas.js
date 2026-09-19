const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { auth, managerOnly } = require('../middleware/auth');
const { positiveInt, text } = require('../utils');
const router = express.Router();
router.use(auth);

router.get('/formas-pagamento/todos', managerOnly, async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`SELECT fp.id,fp.nome,fp.ativo,
            (SELECT COUNT(*) FROM vendas v WHERE v.forma_pagamento_id=fp.id) AS vendas_count
            FROM formas_pagamento fp ORDER BY fp.ativo DESC,fp.id`);
        res.json(rows);
    } catch (e) { next(e); }
});

router.post('/formas-pagamento', managerOnly, async (req, res, next) => {
    try {
        const nome = text(req.body?.nome, { min: 2, max: 120 });
        if (!nome) return res.status(400).json({ error: 'Nome da forma de pagamento inválido.' });
        const [r] = await pool.execute('INSERT INTO formas_pagamento(nome,ativo) VALUES(?,TRUE)', [nome]);
        res.status(201).json({ id: r.insertId, message: 'Forma de pagamento cadastrada.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma forma de pagamento com esse nome.' });
        next(e);
    }
});

router.put('/formas-pagamento/:id', managerOnly, async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        const nome = text(req.body?.nome, { min: 2, max: 120 });
        if (!id || !nome) return res.status(400).json({ error: 'Dados inválidos.' });
        const [r] = await pool.execute('UPDATE formas_pagamento SET nome=? WHERE id=?', [nome, id]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
        res.json({ message: 'Forma de pagamento atualizada.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma forma de pagamento com esse nome.' });
        next(e);
    }
});

router.delete('/formas-pagamento/:id', managerOnly, async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Forma de pagamento inválida.' });
        const [[payment]] = await pool.execute('SELECT id,nome,ativo FROM formas_pagamento WHERE id=?', [id]);
        if (!payment) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
        const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM vendas WHERE forma_pagamento_id=?', [id]);
        if (Number(count.total) > 0) return res.status(409).json({ error: `Esta forma possui ${count.total} venda(s) registrada(s). Ela não pode ser excluída; desative-a para preservar o histórico.` });
        await pool.execute('UPDATE formas_pagamento SET ativo=FALSE WHERE id=?', [id]);
        res.json({ message: 'Forma de pagamento desativada.' });
    } catch (e) { next(e); }
});

router.patch('/formas-pagamento/:id/reativar', managerOnly, async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Forma de pagamento inválida.' });
        const [r] = await pool.execute('UPDATE formas_pagamento SET ativo=TRUE WHERE id=?', [id]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
        res.json({ message: 'Forma de pagamento reativada.' });
    } catch (e) { next(e); }
});

router.get('/formas-pagamento', async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT id,nome FROM formas_pagamento WHERE ativo=TRUE ORDER BY id');
        res.json(rows);
    } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
        const [rows] = await pool.execute(
            `SELECT v.id,v.created_at,v.finalizada,v.finalizada_at,f.nome AS funcionario,
                    fp.nome AS forma_pagamento,
                    COALESCE(SUM(vi.quantidade*vi.preco_unitario),0) AS valor_total,
                    COALESCE(SUM(vi.quantidade),0) AS itens
             FROM vendas v JOIN funcionarios f ON f.id=v.funcionario_id
             LEFT JOIN formas_pagamento fp ON fp.id=v.forma_pagamento_id
             LEFT JOIN venda_item vi ON vi.venda_id=v.id
             WHERE v.finalizada=TRUE
             GROUP BY v.id,v.created_at,v.finalizada,v.finalizada_at,f.nome,fp.nome
             ORDER BY v.id DESC LIMIT ?`,
            [limit],
        );
        res.json(rows);
    } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Venda inválida.' });
        const [[sale]] = await pool.execute(
            `SELECT v.id,v.created_at,v.finalizada,v.finalizada_at,v.observacao,
                    f.nome AS funcionario,fp.nome AS forma_pagamento,
                    COALESCE(SUM(vi.quantidade*vi.preco_unitario),0) AS valor_total
             FROM vendas v JOIN funcionarios f ON f.id=v.funcionario_id
             LEFT JOIN formas_pagamento fp ON fp.id=v.forma_pagamento_id
             LEFT JOIN venda_item vi ON vi.venda_id=v.id WHERE v.id=?
             GROUP BY v.id,v.created_at,v.finalizada,v.finalizada_at,v.observacao,f.nome,fp.nome`,
            [id],
        );
        if (!sale) return res.status(404).json({ error: 'Venda não encontrada.' });
        const [items] = await pool.execute(
            `SELECT vi.produto_id,p.codigo,p.nome,vi.quantidade,vi.preco_unitario,
                    vi.quantidade*vi.preco_unitario AS subtotal
             FROM venda_item vi JOIN produtos p ON p.id=vi.produto_id WHERE vi.venda_id=? ORDER BY p.nome`,
            [id],
        );
        res.json({ ...sale, items });
    } catch (e) { next(e); }
});

router.post('/finalizar', async (req, res, next) => {
    const key = typeof req.get('Idempotency-Key') === 'string' ? req.get('Idempotency-Key').trim() : '';
    if (!key || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
        return res.status(400).json({ error: 'Idempotency-Key inválida.' });
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const paymentId = positiveInt(req.body?.forma_pagamento_id);
    const observacao = req.body?.observacao ? text(req.body.observacao, { min: 1, max: 255 }) : null;
    if (!paymentId || !rawItems.length || rawItems.length > 100 || (req.body?.observacao && !observacao)) {
        return res.status(400).json({ error: 'Informe itens, forma de pagamento e dados válidos.' });
    }

    const merged = new Map();
    for (const item of rawItems) {
        const produtoId = positiveInt(item?.produto_id);
        const quantidade = positiveInt(item?.quantidade);
        if (!produtoId || !quantidade) return res.status(400).json({ error: 'Itens da venda inválidos.' });
        const previous = merged.get(produtoId) || 0;
        const total = previous + quantidade;
        if (!Number.isSafeInteger(total) || total <= 0) return res.status(400).json({ error: 'Quantidade do item inválida.' });
        merged.set(produtoId, total);
    }
    const items = [...merged.entries()].sort((a, b) => a[0] - b[0]).map(([produto_id, quantidade]) => ({ produto_id, quantidade }));
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ items, paymentId, observacao: observacao || null })).digest('hex');

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        try {
            await conn.execute(
                `INSERT INTO idempotency_keys(usuario_id,chave,request_hash) VALUES(?,?,?)`,
                [req.user.id, key, requestHash],
            );
        } catch (e) {
            if (e.code !== 'ER_DUP_ENTRY') throw e;
            const [[existing]] = await conn.execute(
                `SELECT request_hash,status_code,response_json FROM idempotency_keys WHERE usuario_id=? AND chave=? FOR UPDATE`,
                [req.user.id, key],
            );
            await conn.rollback();
            if (!existing) return res.status(409).json({ error: 'Chave de idempotência em conflito.' });
            if (existing.request_hash !== requestHash) return res.status(409).json({ error: 'A mesma Idempotency-Key foi usada para uma requisição diferente.' });
            if (existing.status_code > 0) return res.status(existing.status_code).json(existing.response_json || { error: 'Operação já processada.' });
            return res.status(409).json({ error: 'Operação idêntica está em processamento. Tente novamente.' });
        }

        const [[payment]] = await conn.execute('SELECT id,nome FROM formas_pagamento WHERE id=? AND ativo=TRUE', [paymentId]);
        if (!payment) {
            await conn.rollback();
            return res.status(400).json({ error: 'Forma de pagamento inválida.' });
        }

        const [saleResult] = await conn.execute(
            'INSERT INTO vendas(funcionario_id,forma_pagamento_id,observacao,finalizada) VALUES(?,?,?,FALSE)',
            [req.user.id, paymentId, observacao],
        );
        const saleId = saleResult.insertId;
        const lockedProducts = new Map();

        for (const item of items) {
            const [[product]] = await conn.execute(
                `SELECT id,codigo,nome,preco,quantidade,ativo FROM produtos WHERE id=? FOR UPDATE`,
                [item.produto_id],
            );
            if (!product || !product.ativo) {
                await conn.rollback();
                return res.status(404).json({ error: `Produto ${item.produto_id} não encontrado ou inativo.` });
            }
            if (Number(product.quantidade) < item.quantidade) {
                await conn.rollback();
                return res.status(409).json({ error: `Estoque insuficiente para ${product.nome}. Disponível: ${product.quantidade}.` });
            }
            lockedProducts.set(product.id, product);
        }

        for (const item of items) {
            const product = lockedProducts.get(item.produto_id);
            await conn.execute(
                `INSERT INTO venda_item(venda_id,produto_id,quantidade,preco_unitario) VALUES(?,?,?,?)`,
                [saleId, product.id, item.quantidade, product.preco],
            );
            await conn.execute('UPDATE produtos SET quantidade=quantidade-? WHERE id=?', [item.quantidade, product.id]);
            await conn.execute(
                `INSERT INTO movimentacoes(produto_id,funcionario_id,venda_id,tipo,quantidade,observacao)
                 VALUES(?,?,?,'SAIDA',?,?)`,
                [product.id, req.user.id, saleId, item.quantidade, `Venda #${String(saleId).padStart(7, '0')}`],
            );
        }

        await conn.execute('UPDATE vendas SET finalizada=TRUE,finalizada_at=CURRENT_TIMESTAMP WHERE id=?', [saleId]);
        const [[sale]] = await conn.execute(
            `SELECT v.id,v.created_at,v.finalizada,v.finalizada_at,f.nome AS funcionario,
                    fp.nome AS forma_pagamento,
                    COALESCE(SUM(vi.quantidade*vi.preco_unitario),0) AS valor_total
             FROM vendas v JOIN funcionarios f ON f.id=v.funcionario_id
             LEFT JOIN formas_pagamento fp ON fp.id=v.forma_pagamento_id
             LEFT JOIN venda_item vi ON vi.venda_id=v.id
             WHERE v.id=? GROUP BY v.id,v.created_at,v.finalizada,v.finalizada_at,f.nome,fp.nome`,
            [saleId],
        );
        const response = { message: 'Venda finalizada com sucesso.', sale };
        await conn.execute(
            `UPDATE idempotency_keys SET status_code=201,response_json=? WHERE usuario_id=? AND chave=?`,
            [JSON.stringify(response), req.user.id, key],
        );
        await conn.commit();
        res.status(201).json(response);
    } catch (e) {
        try { await conn.rollback(); } catch {}
        next(e);
    } finally { conn.release(); }
});

module.exports = router;

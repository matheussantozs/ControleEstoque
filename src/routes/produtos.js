const express = require('express');
const pool = require('../db/pool');
const { auth, managerOnly } = require('../middleware/auth');
const { text, positiveInt, nonNegativeInt, money } = require('../utils');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res, next) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
        const params = [];
        let sql = `SELECT p.id,p.codigo,p.nome,p.categoria_id,c.nome AS categoria,p.preco,p.quantidade,
                          p.limite_minimo,p.ativo,p.created_at,p.updated_at
                   FROM produtos p JOIN categorias c ON c.id=p.categoria_id
                   WHERE p.ativo=TRUE`;
        if (q) {
            sql += ' AND (p.codigo LIKE ? OR p.nome LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }
        sql += ' ORDER BY p.nome LIMIT 500';
        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (e) { next(e); }
});

router.get('/baixo', async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT p.id,p.codigo,p.nome,c.nome AS categoria,p.preco,p.quantidade,p.limite_minimo
             FROM produtos p JOIN categorias c ON c.id=p.categoria_id
             WHERE p.ativo=TRUE AND p.quantidade <= p.limite_minimo
             ORDER BY p.quantidade ASC,p.nome`,
        );
        res.json(rows);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
        const codigo = text(req.body?.codigo, { min: 1, max: 50 });
        const nome = text(req.body?.nome, { min: 2, max: 150 });
        const categoriaId = positiveInt(req.body?.categoria_id);
        const preco = money(req.body?.preco);
        const quantidade = nonNegativeInt(req.body?.quantidade ?? 0);
        if (!codigo || !nome || !categoriaId || preco === null || quantidade === null) {
            return res.status(400).json({ error: 'Código, nome, categoria, preço e quantidade inicial são obrigatórios e devem ser válidos.' });
        }

        await conn.beginTransaction();
        const [[category]] = await conn.execute('SELECT id FROM categorias WHERE id=? AND ativo=TRUE', [categoriaId]);
        if (!category) {
            await conn.rollback();
            return res.status(400).json({ error: 'Categoria não encontrada.' });
        }
        const [r] = await conn.execute(
            `INSERT INTO produtos(codigo,nome,categoria_id,preco,quantidade,limite_minimo)
             VALUES(?,?,?,?,?,0)`,
            [codigo, nome, categoriaId, preco, quantidade],
        );
        if (quantidade > 0) {
            await conn.execute(
                `INSERT INTO movimentacoes(produto_id,funcionario_id,tipo,quantidade,observacao)
                 VALUES(?,?, 'ENTRADA', ?, 'Estoque inicial')`,
                [r.insertId, req.user.id, quantidade],
            );
        }
        await conn.commit();
        res.status(201).json({ id: r.insertId, message: 'Produto cadastrado.' });
    } catch (e) {
        await conn.rollback();
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Código de produto já utilizado.' });
        next(e);
    } finally { conn.release(); }
});

router.put('/:id', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        const codigo = text(req.body?.codigo, { min: 1, max: 50 });
        const nome = text(req.body?.nome, { min: 2, max: 150 });
        const categoriaId = positiveInt(req.body?.categoria_id);
        const preco = money(req.body?.preco);
        if (!id || !codigo || !nome || !categoriaId || preco === null) return res.status(400).json({ error: 'Dados inválidos.' });

        const [[category]] = await pool.execute('SELECT id FROM categorias WHERE id=? AND ativo=TRUE', [categoriaId]);
        if (!category) return res.status(400).json({ error: 'Categoria não encontrada.' });
        const [r] = await pool.execute(
            `UPDATE produtos SET codigo=?,nome=?,categoria_id=?,preco=? WHERE id=? AND ativo=TRUE`,
            [codigo, nome, categoriaId, preco, id],
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Produto não encontrado ou inativo.' });
        res.json({ message: 'Produto atualizado.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Código de produto já utilizado.' });
        next(e);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Produto inválido.' });
        const [r] = await pool.execute('UPDATE produtos SET ativo=FALSE WHERE id=? AND ativo=TRUE', [id]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Produto não encontrado.' });
        res.json({ message: 'Produto excluído.' });
    } catch (e) { next(e); }
});

router.patch('/:id/limite', managerOnly, async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        const limite = nonNegativeInt(req.body?.limite_minimo);
        if (!id || limite === null) return res.status(400).json({ error: 'Limite mínimo inválido.' });
        const [r] = await pool.execute('UPDATE produtos SET limite_minimo=? WHERE id=? AND ativo=TRUE', [limite, id]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Produto não encontrado.' });
        res.json({ message: 'Limite mínimo atualizado.' });
    } catch (e) { next(e); }
});

module.exports = router;

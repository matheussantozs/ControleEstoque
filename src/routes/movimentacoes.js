const express = require('express');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');
const { positiveInt, text, validDate } = require('../utils');
const router = express.Router();
router.use(auth);

router.post('/', async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
        const produtoId = positiveInt(req.body?.produto_id);
        const tipo = req.body?.tipo;
        const quantidade = positiveInt(req.body?.quantidade);
        const observacao = req.body?.observacao ? text(req.body.observacao, { min: 1, max: 255 }) : null;
        if (!produtoId || !['ENTRADA', 'SAIDA'].includes(tipo) || !quantidade || (req.body?.observacao && !observacao)) {
            return res.status(400).json({ error: 'Produto, tipo e quantidade válida são obrigatórios.' });
        }

        await conn.beginTransaction();
        const [products] = await conn.execute(
            'SELECT id,quantidade,ativo FROM produtos WHERE id=? FOR UPDATE',
            [produtoId],
        );
        const product = products[0];
        if (!product || !product.ativo) {
            await conn.rollback();
            return res.status(404).json({ error: 'Produto não encontrado ou inativo.' });
        }
        const atual = Number(product.quantidade);
        if (tipo === 'SAIDA' && quantidade > atual) {
            await conn.rollback();
            return res.status(409).json({ error: `Estoque insuficiente. Disponível: ${atual}.` });
        }
        const nova = tipo === 'ENTRADA' ? atual + quantidade : atual - quantidade;
        await conn.execute('UPDATE produtos SET quantidade=? WHERE id=?', [nova, produtoId]);
        await conn.execute(
            `INSERT INTO movimentacoes(produto_id,funcionario_id,tipo,quantidade,observacao)
             VALUES(?,?,?,?,?)`,
            [produtoId, req.user.id, tipo, quantidade, observacao],
        );
        await conn.commit();
        res.status(201).json({ message: `${tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada.`, quantidade: nova });
    } catch (e) {
        await conn.rollback();
        next(e);
    } finally { conn.release(); }
});

router.get('/', async (req, res, next) => {
    try {
        const inicio = req.query.inicio || null;
        const fim = req.query.fim || null;
        const tipo = req.query.tipo || null;
        const produtoId = req.query.produto_id ? positiveInt(req.query.produto_id) : null;
        if (inicio && !validDate(inicio)) return res.status(400).json({ error: 'Data inicial inválida.' });
        if (fim && !validDate(fim)) return res.status(400).json({ error: 'Data final inválida.' });
        if (inicio && fim && inicio > fim) return res.status(400).json({ error: 'Período inválido.' });
        if (tipo && !['ENTRADA', 'SAIDA'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });
        if (req.query.produto_id && !produtoId) return res.status(400).json({ error: 'Produto inválido.' });

        let sql = `SELECT m.id,m.tipo,m.quantidade,m.observacao,m.created_at,
                          m.venda_id,p.codigo,p.nome AS produto,f.nome AS funcionario
                   FROM movimentacoes m
                   JOIN produtos p ON p.id=m.produto_id
                   JOIN funcionarios f ON f.id=m.funcionario_id WHERE 1=1`;
        const args = [];
        if (inicio) { sql += ' AND m.created_at >= ?'; args.push(`${inicio} 00:00:00`); }
        if (fim) { sql += ' AND m.created_at < DATE_ADD(?, INTERVAL 1 DAY)'; args.push(`${fim} 00:00:00`); }
        if (tipo) { sql += ' AND m.tipo=?'; args.push(tipo); }
        if (produtoId) { sql += ' AND m.produto_id=?'; args.push(produtoId); }
        sql += ' ORDER BY m.created_at DESC, m.id DESC LIMIT 1000';
        const [rows] = await pool.execute(sql, args);
        res.json(rows);
    } catch (e) { next(e); }
});

module.exports = router;

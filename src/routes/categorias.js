const express = require('express');
const pool = require('../db/pool');
const { auth, managerOnly } = require('../middleware/auth');
const { text, positiveInt } = require('../utils');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res, next) => {
    try {
        const includeInactive = req.query.inativos === 'true' && ['GERENTE', 'ADMIN'].includes(req.user.perfil);
        const [rows] = await pool.execute(
            `SELECT c.id,c.nome,c.descricao,c.ativo,
                    (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id=c.id AND p.ativo=TRUE) AS produtos_count
             FROM categorias c ${includeInactive ? '' : 'WHERE c.ativo=TRUE'} ORDER BY c.ativo DESC,c.nome`,
        );
        res.json(rows);
    } catch (e) { next(e); }
});

router.post('/', managerOnly, async (req, res, next) => {
    try {
        const nome = text(req.body?.nome, { min: 2, max: 120 });
        const descricao = req.body?.descricao ? text(req.body.descricao, { min: 1, max: 255 }) : null;
        if (!nome || (req.body?.descricao && !descricao)) return res.status(400).json({ error: 'Nome e descrição devem ser válidos.' });
        const [r] = await pool.execute('INSERT INTO categorias(nome,descricao,ativo) VALUES(?,?,TRUE)', [nome, descricao]);
        res.status(201).json({ id: r.insertId, message: 'Categoria cadastrada.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
        next(e);
    }
});

router.put('/:id', managerOnly, async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        const nome = text(req.body?.nome, { min: 2, max: 120 });
        const descricao = req.body?.descricao ? text(req.body.descricao, { min: 1, max: 255 }) : null;
        if (!id || !nome || (req.body?.descricao && !descricao)) return res.status(400).json({ error: 'Dados inválidos.' });
        const [r] = await pool.execute('UPDATE categorias SET nome=?,descricao=? WHERE id=?', [nome, descricao, id]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Categoria não encontrada.' });
        res.json({ message: 'Categoria atualizada.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
        next(e);
    }
});

router.delete('/:id', managerOnly, async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Categoria inválida.' });
        const [[category]] = await pool.execute('SELECT id,nome,ativo FROM categorias WHERE id=?', [id]);
        if (!category) return res.status(404).json({ error: 'Categoria não encontrada.' });
        const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM produtos WHERE categoria_id=? AND ativo=TRUE', [id]);
        if (Number(count.total) > 0) return res.status(409).json({ error: `A categoria possui ${count.total} produto(s) ativo(s). Reclassifique os produtos antes de desativá-la.` });
        await pool.execute('UPDATE categorias SET ativo=FALSE WHERE id=?', [id]);
        res.json({ message: 'Categoria desativada.' });
    } catch (e) { next(e); }
});

router.patch('/:id/reativar', managerOnly, async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Categoria inválida.' });
        const [r] = await pool.execute('UPDATE categorias SET ativo=TRUE WHERE id=?', [id]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Categoria não encontrada.' });
        res.json({ message: 'Categoria reativada.' });
    } catch (e) { next(e); }
});

module.exports = router;

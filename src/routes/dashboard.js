const express = require('express');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');
const router = express.Router();
router.use(auth);

router.get('/', async (req, res, next) => {
    try {
        const [[totais]] = await pool.query(
            `SELECT COUNT(*) AS produtos,
                    COALESCE(SUM(quantidade),0) AS unidades,
                    COALESCE(SUM(quantidade*preco),0) AS valor
             FROM produtos WHERE ativo=TRUE`,
        );
        const [[baixo]] = await pool.query('SELECT COUNT(*) AS n FROM produtos WHERE ativo=TRUE AND quantidade <= limite_minimo');
        const [[entradas]] = await pool.query("SELECT COALESCE(SUM(quantidade),0) AS n FROM movimentacoes WHERE tipo='ENTRADA' AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY");
        const [[saidas]] = await pool.query("SELECT COALESCE(SUM(quantidade),0) AS n FROM movimentacoes WHERE tipo='SAIDA' AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY");
        const [[vendas]] = await pool.query("SELECT COUNT(DISTINCT v.id) AS n, COALESCE(SUM(vi.quantidade * vi.preco_unitario),0) AS valor FROM vendas v LEFT JOIN venda_item vi ON vi.venda_id=v.id WHERE v.finalizada=TRUE AND v.finalizada_at >= CURDATE() AND v.finalizada_at < CURDATE() + INTERVAL 1 DAY");
        res.json({ ...totais, estoque_baixo: baixo.n, entradas_hoje: entradas.n, saidas_hoje: saidas.n, vendas_hoje: vendas.n, faturamento_hoje: vendas.valor });
    } catch (e) { next(e); }
});
module.exports = router;

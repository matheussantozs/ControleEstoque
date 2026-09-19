const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
require('dotenv').config();

async function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = req.cookies?.estoque_token || bearer;
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const [rows] = await pool.execute(`SELECT f.id,f.nome,f.login,f.ativo,c.nome AS perfil FROM funcionarios f JOIN cargos c ON c.id=f.cargo_id WHERE f.id=? LIMIT 1`, [payload.sub]);
        const user = rows[0];
        if (!user || !user.ativo) return res.status(401).json({ error: 'Sessão inválida.' });
        req.user = user;
        next();
    } catch { return res.status(401).json({ error: 'Sessão inválida ou expirada.' }); }
}

function roleOnly(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user?.perfil)) return res.status(403).json({ error: `Acesso permitido apenas para: ${roles.join(', ')}.` });
        next();
    };
}

const managerOnly = roleOnly('GERENTE', 'ADMIN');
const adminOnly = roleOnly('ADMIN');
const managerOrAdmin = managerOnly;
module.exports = { auth, roleOnly, managerOnly, adminOnly, managerOrAdmin };

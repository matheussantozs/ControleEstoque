const jwt = require('jsonwebtoken');
require('dotenv').config();

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

function managerOnly(req, res, next) {
  if (req.user?.perfil !== 'GERENTE') return res.status(403).json({ error: 'Apenas gerentes podem realizar esta operação.' });
  next();
}
module.exports = { auth, managerOnly };

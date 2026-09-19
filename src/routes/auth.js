const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');
const { text } = require('../utils');
require('dotenv').config();

const router = express.Router();
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function clientKey(req) {
    return req.ip || req.socket.remoteAddress || 'unknown';
}

function isBlocked(key) {
    const item = attempts.get(key);
    if (!item) return false;
    if (Date.now() - item.first > WINDOW_MS) {
        attempts.delete(key);
        return false;
    }
    return item.failures >= MAX_FAILURES;
}

function failed(key) {
    const now = Date.now();
    const item = attempts.get(key);
    if (!item || now - item.first > WINDOW_MS) {
        attempts.set(key, { first: now, failures: 1 });
    } else {
        item.failures += 1;
    }
}

function clearFailures(key) {
    attempts.delete(key);
}

function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/',
    };
}

router.post('/login', async (req, res, next) => {
    const key = clientKey(req);
    if (isBlocked(key)) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }

    try {
        const login = text(req.body?.login, { min: 3, max: 60 })?.toLowerCase();
        const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
        if (!login || senha.length < 1 || senha.length > 200) {
            failed(key);
            return res.status(400).json({ error: 'Login e senha são obrigatórios.' });
        }

        const [rows] = await pool.execute(
            `SELECT f.id, f.nome, f.login, f.senha, f.ativo, c.nome AS perfil
             FROM funcionarios f
             JOIN cargos c ON c.id = f.cargo_id
             WHERE f.login = ? LIMIT 1`,
            [login],
        );
        const u = rows[0];
        const passwordOk = await bcrypt.compare(senha, u?.senha || DUMMY_HASH);

        if (!u || !u.ativo || !passwordOk) {
            failed(key);
            return res.status(401).json({ error: 'Login ou senha incorretos.' });
        }

        clearFailures(key);
        const token = jwt.sign({ sub: u.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.cookie('estoque_token', token, cookieOptions());
        res.json({
            user: { id: u.id, nome: u.nome, login: u.login, perfil: u.perfil },
        });
    } catch (e) {
        next(e);
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('estoque_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
    res.status(204).end();
});

router.get('/me', auth, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve possuir pelo menos 32 caracteres.');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json({ limit: '1mb', strict: true }));

app.use((req, res, next) => {
    const raw = req.headers.cookie || '';
    req.cookies = Object.fromEntries(raw.split(';').map(part => {
        const index = part.indexOf('=');
        if (index < 0) return ['', ''];
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        try { return [key, decodeURIComponent(value)]; }
        catch { return ['', '']; }
    }).filter(([k]) => k));
    next();
});

app.use(express.static(path.join(__dirname, '../public'), {
    index: 'index.html',
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/movimentacoes', require('./routes/movimentacoes'));
app.use('/api/funcionarios', require('./routes/funcionarios'));
app.use('/api/relatorios', require('./routes/relatorios'));
app.use('/api/vendas', require('./routes/vendas'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Servidor: http://localhost:${PORT}`));

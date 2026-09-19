const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    let conn;
    try {
        if (!process.env.DB_HOST || !process.env.DB_USER || process.env.DB_NAME === undefined) {
            throw new Error('Configure DB_HOST, DB_USER e DB_NAME no arquivo .env.');
        }
        conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            multipleStatements: true,
            charset: 'utf8mb4',
        });
        const sql = fs.readFileSync(path.join(__dirname, '../database.sql'), 'utf8');
        await conn.query(sql);
        console.log(`Banco '${process.env.DB_NAME}' inicializado/atualizado com sucesso.`);
        console.log('Agora execute: npm run seed && npm start');
    } catch (error) {
        console.error('Falha na inicialização do banco:', error.message);
        console.error('Verifique se o MySQL está em execução e se as credenciais do .env estão corretas.');
        process.exitCode = 1;
    } finally { if (conn) await conn.end(); }
})();

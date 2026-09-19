const bcrypt = require('bcryptjs');
const pool = require('./db/pool');

(async () => {
    try {
        const [[adminCargo]] = await pool.execute("SELECT id FROM cargos WHERE nome='ADMIN' LIMIT 1");
        if (!adminCargo) throw new Error('Execute npm run setup antes do seed.');

        const [[existing]] = await pool.execute("SELECT id, cargo_id FROM funcionarios WHERE login='admin' LIMIT 1");
        const hash = await bcrypt.hash('admin123', 12);
        if (!existing) {
            await pool.execute(
                'INSERT INTO funcionarios(nome,login,senha,cargo_id,ativo) VALUES(?,?,?,?,TRUE)',
                ['Administrador', 'admin', hash, adminCargo.id],
            );
            console.log('Usuário inicial criado: admin / admin123');
        } else {
            await pool.execute('UPDATE funcionarios SET cargo_id=?, ativo=TRUE WHERE id=?', [adminCargo.id, existing.id]);
            console.log('Usuário admin já existia e foi vinculado ao perfil ADMIN.');
        }
    } catch (e) {
        console.error('Seed:', e.message);
        process.exitCode = 1;
    } finally { await pool.end(); }
})();

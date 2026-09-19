const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { auth, managerOrAdmin } = require('../middleware/auth');
const { text, positiveInt } = require('../utils');

const router = express.Router();
router.use(auth, managerOrAdmin);

async function cargoIdByPerfil(perfil) {
    const [rows] = await pool.execute('SELECT id FROM cargos WHERE nome=? LIMIT 1', [perfil]);
    return rows[0]?.id || null;
}

async function getFuncionario(id) {
    const [[row]] = await pool.execute(`SELECT f.id,f.nome,f.login,f.ativo,c.nome AS perfil,
        (SELECT COUNT(*) FROM vendas v WHERE v.funcionario_id=f.id) AS vendas_count
        FROM funcionarios f JOIN cargos c ON c.id=f.cargo_id WHERE f.id=?`, [id]);
    return row || null;
}

router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`SELECT f.id,f.nome,f.login,c.nome AS perfil,f.ativo,f.created_at,f.updated_at,
            (SELECT COUNT(*) FROM vendas v WHERE v.funcionario_id=f.id) AS vendas_count
            FROM funcionarios f JOIN cargos c ON c.id=f.cargo_id
            ORDER BY f.ativo DESC, FIELD(c.nome,'ADMIN','GERENTE','FUNCIONARIO'),f.nome`);
        res.json(rows);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const nome = text(req.body?.nome, { min: 2, max: 120 });
        const login = text(req.body?.login, { min: 3, max: 60 })?.toLowerCase();
        const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
        const perfil = ['GERENTE','FUNCIONARIO'].includes(req.body?.perfil) ? req.body.perfil : null;
        if (!nome || !login || senha.length < 6 || senha.length > 200 || !perfil) return res.status(400).json({ error: 'Preencha nome, login, senha (mínimo 6 caracteres) e um perfil válido.' });
        if (req.user.perfil !== 'ADMIN' && perfil !== 'FUNCIONARIO') return res.status(403).json({ error: 'Gerentes só podem cadastrar funcionários.' });
        const cargoId = await cargoIdByPerfil(perfil);
        if (!cargoId) return res.status(500).json({ error: 'Cargo do usuário não configurado.' });
        const hash = await bcrypt.hash(senha, 12);
        const [r] = await pool.execute('INSERT INTO funcionarios(nome,login,senha,cargo_id) VALUES(?,?,?,?)', [nome,login,hash,cargoId]);
        res.status(201).json({ id:r.insertId, message:'Funcionário cadastrado.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error:'Login já cadastrado.' });
        next(e);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const id = positiveInt(req.params.id);
        if (!id) return res.status(400).json({ error:'Funcionário inválido.' });
        const target = await getFuncionario(id);
        if (!target) return res.status(404).json({ error:'Funcionário não encontrado.' });
        const isSelf = target.id === req.user.id;
        if (req.user.perfil !== 'ADMIN' && !isSelf && target.perfil !== 'FUNCIONARIO') return res.status(403).json({ error:'Gerentes só podem alterar funcionários.' });

        const nome = text(req.body?.nome, { min:2,max:120 });
        const login = text(req.body?.login, { min:3,max:60 })?.toLowerCase();
        const perfil = ['ADMIN','GERENTE','FUNCIONARIO'].includes(req.body?.perfil) ? req.body.perfil : null;
        const senha = req.body?.senha;
        const ativo = req.body?.ativo !== false;
        if (!nome || !login || !perfil || (senha !== undefined && (typeof senha !== 'string' || (senha && senha.length < 6) || senha.length > 200))) return res.status(400).json({ error:'Dados inválidos.' });
        if (req.user.perfil !== 'ADMIN' && (isSelf ? perfil !== target.perfil : perfil !== 'FUNCIONARIO')) return res.status(403).json({ error:'Gerentes não podem alterar perfis de gerente ou administrador.' });
        if (target.id === req.user.id && !ativo) return res.status(400).json({ error:'Não é permitido desativar o próprio usuário.' });

        const cargoId = await cargoIdByPerfil(perfil);
        if (!cargoId) return res.status(500).json({ error:'Cargo do usuário não configurado.' });
        let sql='UPDATE funcionarios SET nome=?,login=?,cargo_id=?,ativo=?';
        const args=[nome,login,cargoId,ativo?1:0];
        if (senha) { sql+=',senha=?'; args.push(await bcrypt.hash(senha,12)); }
        sql+=' WHERE id=?'; args.push(id);
        const [r]=await pool.execute(sql,args);
        if (!r.affectedRows) return res.status(404).json({ error:'Funcionário não encontrado.' });
        res.json({ message:'Funcionário atualizado.' });
    } catch(e) {
        if(e.code==='ER_DUP_ENTRY') return res.status(409).json({ error:'Login já cadastrado.' });
        next(e);
    }
});

router.delete('/:id', async (req,res,next)=>{
    try {
        const id=positiveInt(req.params.id);
        if(!id) return res.status(400).json({error:'Funcionário inválido.'});
        if(id===req.user.id) return res.status(400).json({error:'Não é permitido excluir o próprio usuário.'});
        const target=await getFuncionario(id);
        if(!target) return res.status(404).json({error:'Funcionário não encontrado.'});
        if(target.perfil==='ADMIN') return res.status(403).json({error:'Administradores não podem ser excluídos.'});
        if(req.user.perfil!=='ADMIN' && target.perfil!=='FUNCIONARIO') return res.status(403).json({error:'Gerentes não podem excluir gerentes.'});
        if(Number(target.vendas_count)>0) return res.status(409).json({error:`Este funcionário possui ${target.vendas_count} venda(s) registrada(s) e não pode ser excluído. Desative o acesso em vez de excluir.`});
        await pool.execute('UPDATE funcionarios SET ativo=FALSE WHERE id=? AND ativo=TRUE',[id]);
        res.json({message:'Funcionário excluído.'});
    } catch(e){next(e);}
});
module.exports=router;

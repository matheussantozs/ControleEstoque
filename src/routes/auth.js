const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');
require('dotenv').config();
const router = express.Router();

router.post('/login', async (req,res,next)=>{
  try {
    const { login, senha } = req.body;
    if (!login || !senha) return res.status(400).json({error:'Login e senha são obrigatórios.'});
    const [rows] = await pool.query('SELECT id,nome,login,senha,perfil,ativo FROM funcionarios WHERE login=? LIMIT 1',[login]);
    const u=rows[0];
    if (!u || !u.ativo || !(await bcrypt.compare(senha,u.senha))) return res.status(401).json({error:'Login ou senha incorretos.'});
    const token=jwt.sign({id:u.id,nome:u.nome,login:u.login,perfil:u.perfil},process.env.JWT_SECRET,{expiresIn:'8h'});
    res.json({token,user:{id:u.id,nome:u.nome,login:u.login,perfil:u.perfil}});
  } catch(e){next(e)}
});
router.get('/me',auth,async(req,res)=>res.json({user:req.user}));
module.exports=router;

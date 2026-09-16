const express=require('express');const cors=require('cors');const helmet=require('helmet');const path=require('path');require('dotenv').config();
const app=express();
app.use(helmet({contentSecurityPolicy:false}));app.use(cors({origin:process.env.CORS_ORIGIN||'http://localhost:3000'}));app.use(express.json());
app.use(express.static(path.join(__dirname,'../public')));
app.use('/api/auth',require('./routes/auth'));app.use('/api/funcionarios',require('./routes/funcionarios'));app.use('/api/produtos',require('./routes/produtos'));app.use('/api/movimentacoes',require('./routes/movimentacoes'));app.use('/api/relatorios',require('./routes/relatorios'));app.use('/api/dashboard',require('./routes/dashboard'));
app.get('/api/health',(req,res)=>res.json({status:'ok'}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../public/index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Erro interno do servidor.'})});
const PORT=Number(process.env.PORT||3000);app.listen(PORT,()=>console.log(`Servidor: http://localhost:${PORT}`));

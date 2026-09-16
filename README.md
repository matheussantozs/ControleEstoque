# Estoque Fácil — Sistema de Gerenciamento de Estoque

Projeto baseado no documento de requisitos do sistema de gerenciamento de estoque do IFAL.

## Tecnologias
- HTML5, CSS3 e JavaScript puro no frontend
- Node.js + Express na API REST
- MySQL + mysql2
- JWT para autenticação
- bcryptjs para senhas
- CORS e Helmet

## Requisitos
Node.js 18+ e MySQL 8+.

## Instalação
1. Crie o banco executando `database.sql` no MySQL.
2. Copie `.env.example` para `.env` e ajuste usuário, senha e banco.
3. Execute `npm install`.
4. Execute `npm run seed` para criar o usuário inicial.
5. Execute `npm start`.
6. Acesse `http://localhost:3000`.

Usuário inicial: `admin` / `admin123`.

## Funcionalidades
- Login por perfil GERENTE/FUNCIONARIO.
- CRUD de funcionários (gerente).
- CRUD de produtos.
- Entrada e saída com transação e bloqueio de saída acima do estoque.
- Histórico de movimentações.
- Alerta de estoque baixo.
- Definição de limite mínimo por gerente.
- Relatórios de estoque e movimentações por período.
- Dashboard com indicadores.

## Observação
O documento de requisitos determina que somente o gerente pode cadastrar/alterar/excluir funcionários e definir limites mínimos. Produtos e movimentações são acessíveis ao funcionário autenticado, conforme os casos de uso fornecidos.

# PDV Nexus — Controle de vendas, estoque e caixa

Sistema web de controle de vendas, estoque, caixa, funcionários e relatórios para um pequeno estabelecimento comercial. A interface do PDV foi construída tomando como referência a tela fornecida no projeto, mas sem manter funcionalidades que não existem no domínio definido, como cadastro de cliente.

## Stack

- Frontend: HTML5, CSS3 e JavaScript puro.
- Backend: Node.js + Express.
- Banco: MySQL 8+ / InnoDB.
- Driver: mysql2/promise.
- Autenticação: JWT em cookie HttpOnly, SameSite=Strict.
- Segurança: Helmet, CORS configurável, bcrypt, validação de entrada, queries parametrizadas e idempotência.

## Perfis

- **ADMIN** — administração completa de usuários.
- **GERENTE** — gestão operacional e de funcionários comuns.
- **FUNCIONARIO** — operação de caixa, produtos, estoque e consultas.

Regras importantes:

- gerente não pode criar ADMIN;
- gerente não pode apagar ou alterar outro gerente;
- gerente não pode apagar a própria conta;
- administrador não pode apagar a própria conta;
- funcionário com vendas registradas não pode ser excluído;
- exclusão funcional é feita por desativação para preservar histórico.

## Inicialização recomendada

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o ambiente

```bash
cp .env.example .env
```

No `.env`, informe as credenciais do MySQL e substitua `JWT_SECRET` por uma chave aleatória com pelo menos 32 caracteres.

### 3. Inicialize o banco

```bash
npm run setup
```

O script conecta ao servidor MySQL, executa o `database.sql` e cria/verifica o schema necessário.

### 4. Crie o usuário administrativo inicial

```bash
npm run seed
```

Credenciais iniciais:

```text
login: admin
senha: admin123
perfil: ADMIN
```

Troque a senha depois do primeiro acesso.

### Inicialização em um comando

Depois de configurar o `.env`, também é possível usar:

```bash
npm run bootstrap
```

Esse comando executa `setup` e `seed` em sequência.

### Executar o sistema

```bash
npm start
```

Desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Estrutura

```text
ControleEstoque/
├── database.sql
├── database/
│   ├── tabelas/
│   ├── visualizacoes/
│   ├── funcoes/
│   └── tudo.sql
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── src/
│   ├── db/pool.js
│   ├── middleware/auth.js
│   ├── routes/
│   ├── seed.js
│   ├── setup.js
│   ├── server.js
│   └── utils.js
├── .env.example
├── requisitos.md
└── package.json
```

## Integridade da venda

A finalização de uma venda ocorre em uma única transação:

```text
PDV
 ↓
validação
 ↓
INSERT da chave de idempotência
 ↓
lock dos produtos (FOR UPDATE)
 ↓
conferência de estoque
 ↓
criação da venda
 ↓
criação dos itens
 ↓
baixa do estoque
 ↓
registro das movimentações
 ↓
commit
```

Se qualquer etapa falhar, o rollback desfaz a operação inteira.

A `Idempotency-Key` impede que um duplo clique ou reenvio da mesma requisição gere duas vendas.

## Estoque

A quantidade do produto não pode ser alterada pela edição cadastral. Alterações de estoque passam por movimentações ou pelo fechamento de uma venda.

Isso preserva o histórico e evita que uma simples alteração de cadastro apague a origem de uma diferença no estoque.

## Relatórios

O relatório de estoque permite pesquisar por:

- código/nome;
- categoria;
- estoque baixo;
- estoque acima do mínimo.

O relatório de movimentações permite pesquisar por:

- período;
- produto;
- tipo de movimentação.

As datas da interface utilizam `dd/mm/aaaa`.

## Banco existente

O `database.sql` utiliza comandos idempotentes para criação do schema e inclui o novo cargo `ADMIN`. Se você já possui um banco criado pela versão anterior, execute novamente:

```bash
npm run setup
npm run seed
```

O seed também atualiza o usuário `admin` existente para o perfil `ADMIN`.

## Verificação

```bash
npm run check
```

Esse comando verifica a sintaxe dos arquivos JavaScript do backend.

## Documentação

A especificação funcional e técnica completa está em [`requisitos.md`](requisitos.md).

# Documento de Requisitos — PDV Nexus

## 1. Identificação

**Sistema:** PDV Nexus — Controle de Vendas, Estoque e Caixa  
**Objetivo:** fornecer a um pequeno estabelecimento um sistema web para controlar produtos, estoque, movimentações, vendas, formas de pagamento, usuários e relatórios operacionais.

A especificação abaixo representa o comportamento implementado no projeto e substitui descrições antigas que não correspondiam mais ao sistema.

## 2. Escopo

O sistema contempla:

- autenticação de usuários;
- controle de acesso por perfil;
- cadastro e manutenção de funcionários;
- cadastro, consulta, alteração e exclusão lógica de produtos;
- categorias de produtos;
- controle de estoque;
- movimentações de entrada e saída;
- alerta de estoque baixo;
- operação de caixa/PDV;
- finalização de vendas com diferentes formas de pagamento;
- histórico de vendas;
- relatórios de estoque e movimentações;
- proteção de operações críticas contra concorrência e repetição de requisições.

O sistema não possui cadastro de clientes. No PDV, a venda é registrada diretamente para o consumidor sem identificação de cliente.

## 3. Perfis e permissões

### 3.1 Administrador (ADMIN)

Possui acesso à administração do sistema e ao gerenciamento completo de funcionários, incluindo criação e alteração de administradores, gerentes e funcionários.

Restrições:

- não pode excluir a própria conta;
- a operação de exclusão não permite remover administradores;
- pode desativar outros usuários conforme as regras do sistema.

### 3.2 Gerente (GERENTE)

Pode:

- operar o caixa;
- cadastrar e alterar produtos;
- registrar movimentações;
- consultar relatórios;
- definir o limite mínimo de estoque;
- cadastrar funcionários;
- alterar funcionários comuns;
- consultar a equipe.

Restrições:

- não pode criar administrador;
- não pode promover um funcionário a administrador ou gerente;
- não pode alterar outro gerente;
- não pode excluir outro gerente;
- não pode excluir a própria conta;
- não pode desativar a própria conta.

### 3.3 Funcionário (FUNCIONARIO)

Pode:

- operar o caixa;
- consultar e manter produtos conforme as permissões da aplicação;
- registrar entradas e saídas de estoque;
- consultar movimentações;
- consultar relatórios;
- visualizar produtos com estoque baixo.

Não possui acesso ao gerenciamento de funcionários nem à alteração do limite mínimo de estoque.

## 4. Requisitos funcionais

### RF01 — Autenticação

O sistema deve permitir login por usuário e senha.

O sistema deve manter a sessão autenticada por cookie `HttpOnly`, com validade limitada e proteção `SameSite`.

O sistema deve consultar o estado atual do funcionário no banco durante a autenticação de cada requisição protegida. Usuários inativos não podem continuar utilizando a aplicação.

### RF02 — Controle de acesso

Cada rota protegida deve validar o perfil do usuário no servidor.

A interface pode ocultar funcionalidades não autorizadas, mas a autorização efetiva deve ocorrer no backend.

### RF03 — Cadastro de funcionários

Administradores podem criar usuários com os perfis ADMIN, GERENTE ou FUNCIONARIO.

Gerentes podem criar apenas usuários FUNCIONARIO.

O login deve ser único.

A senha deve ser armazenada somente como hash utilizando bcrypt.

### RF04 — Alteração de funcionários

Administradores podem alterar dados e perfil dos usuários conforme as regras de segurança.

Gerentes podem alterar funcionários comuns e os próprios dados permitidos, mas não podem alterar outros gerentes nem alterar perfis para GERENTE ou ADMIN.

Um usuário não pode desativar a própria conta.

### RF05 — Exclusão de funcionários

A exclusão funcional é realizada por desativação do cadastro para preservar histórico.

O sistema deve impedir a exclusão do próprio usuário.

O sistema deve impedir a exclusão de administradores.

Gerentes não podem excluir gerentes.

Um funcionário que possua qualquer venda registrada não pode ser excluído. Nesse caso, seu acesso deve ser desativado em vez de remover o cadastro.

### RF06 — Produtos

O sistema deve permitir cadastrar produtos com:

- código;
- nome;
- categoria;
- preço;
- quantidade inicial;
- limite mínimo.

O código do produto deve ser único.

A alteração cadastral do produto não pode alterar diretamente sua quantidade em estoque.

### RF07 — Categorias

Produtos devem possuir uma categoria existente e ativa.

A relação deve ser implementada por chave estrangeira no banco.

### RF08 — Estoque

O sistema deve impedir estoque negativo.

Entradas e saídas devem ser registradas como movimentações.

Saídas manuais não podem exceder o estoque disponível.

Vendas também devem reduzir o estoque por meio de uma operação transacional.

### RF09 — Movimentações

Cada movimentação deve registrar:

- produto;
- funcionário responsável;
- tipo ENTRADA ou SAIDA;
- quantidade;
- data/hora;
- observação opcional;
- venda relacionada, quando a movimentação for originada pelo PDV.

A consulta deve permitir filtros por produto, tipo e período.

### RF10 — Estoque baixo

O sistema deve identificar produtos cujo estoque seja menor ou igual ao limite mínimo configurado.

### RF11 — PDV

O caixa deve permitir localizar produtos por código ou nome e adicionar itens à venda.

O operador deve poder:

- aumentar ou reduzir quantidades;
- remover item;
- limpar a venda;
- selecionar forma de pagamento;
- finalizar a venda.

A interface deve disponibilizar atalhos:

- F2 — nova venda;
- F3 — foco na pesquisa de produto;
- F6 — pagamento;
- F8 — finalização.

O PDV não deve exibir nem solicitar cadastro de cliente.

### RF12 — Finalização de venda

A finalização deve:

1. validar a forma de pagamento;
2. validar os produtos;
3. bloquear os registros de produto envolvidos;
4. conferir o estoque disponível;
5. criar a venda;
6. criar os itens da venda;
7. reduzir o estoque;
8. registrar as movimentações de saída;
9. concluir a venda;
10. confirmar a transação.

Se qualquer etapa falhar, todas as alterações devem ser revertidas.

A operação deve usar `Idempotency-Key` para impedir duplicação causada por reenvio ou duplo clique.

### RF13 — Formas de pagamento

O sistema deve manter formas de pagamento ativas e permitir a seleção de uma delas no fechamento da venda.

### RF14 — Histórico de vendas

O sistema deve armazenar o funcionário responsável, itens, preços praticados, forma de pagamento, data e estado da venda.

Os preços dos itens devem ser copiados para `venda_item.preco_unitario`, preservando o histórico mesmo que o preço atual do produto seja alterado posteriormente.

### RF15 — Relatório de estoque

O relatório deve permitir pesquisar por:

- código ou nome;
- categoria;
- situação do estoque: todos, estoque baixo ou acima do mínimo.

O resultado deve apresentar preço, quantidade, limite mínimo e valor do estoque.

### RF16 — Relatório de movimentações

O relatório deve permitir filtrar por:

- data inicial;
- data final;
- produto;
- tipo de movimentação.

As datas apresentadas ao usuário devem utilizar o padrão brasileiro `dd/mm/aaaa`.

O relatório deve permitir impressão.

### RF17 — Dashboard

O sistema deve apresentar indicadores consolidados de:

- produtos ativos;
- unidades em estoque;
- produtos em estoque baixo;
- valor do estoque;
- entradas do dia;
- saídas do dia;
- vendas do dia;
- faturamento do dia.

Também deve apresentar as vendas finalizadas mais recentes.

## 5. Requisitos não funcionais

### RNF01 — Segurança

- Senhas devem utilizar bcrypt.
- Sessões devem utilizar JWT armazenado em cookie `HttpOnly`.
- Cookies devem utilizar `SameSite=Strict`.
- Em produção, cookies devem utilizar `Secure`.
- Consultas ao banco devem utilizar parâmetros, evitando concatenação de entrada do usuário.
- O servidor deve utilizar Helmet.
- O backend deve validar todas as entradas relevantes.
- Operações críticas devem ser autorizadas no servidor.

### RNF02 — Integridade de dados

O banco deve utilizar MySQL 8+ com InnoDB, chaves estrangeiras, índices, restrições e transações.

Histórico de vendas e movimentações não deve depender da permanência do usuário ativo.

Por isso, funcionários referenciados por vendas ou movimentações não são fisicamente removidos.

### RNF03 — Concorrência

A finalização de venda deve bloquear os produtos envolvidos com `SELECT ... FOR UPDATE` dentro da transação.

Os produtos devem ser bloqueados em ordem determinística para reduzir o risco de deadlock.

### RNF04 — Idempotência

Uma mesma chave de idempotência só pode representar uma requisição para determinado usuário.

Se a mesma chave for reutilizada com outro conteúdo, o sistema deve rejeitar a operação.

### RNF05 — Usabilidade

A interface deve ser responsiva e utilizar linguagem em português brasileiro.

Campos de data voltados ao usuário devem seguir `dd/mm/aaaa`.

O PDV deve priorizar operação rápida por teclado e leitor de código de barras.

### RNF06 — Manutenibilidade

O backend deve separar autenticação, rotas, banco e utilitários.

O frontend deve concentrar a camada de interação em JavaScript modularmente organizado por páginas e responsabilidades.

O banco deve possuir um schema canônico (`database.sql`) e também a versão organizada em arquivos na pasta `database/`.

### RNF07 — Inicialização

A instalação deve poder ser feita com:

```bash
npm install
cp .env.example .env
npm run setup
npm run seed
npm start
```

Ou, após configurar o `.env`:

```bash
npm run bootstrap
npm start
```

## 6. Tecnologias

### Frontend

- HTML5
- CSS3
- JavaScript puro
- Fetch API
- `Intl.NumberFormat` para valores em moeda

### Backend

- Node.js
- Express
- bcryptjs
- jsonwebtoken
- mysql2/promise
- dotenv
- Helmet
- CORS

### Banco de dados

- MySQL 8+
- InnoDB
- Foreign Keys
- CHECK constraints
- Views
- Transactions
- Row locking com `FOR UPDATE`
- Índices
- JSON para armazenamento da resposta da operação idempotente

## 7. Arquitetura lógica

```text
Navegador
   │
   │ HTTP / JSON
   ▼
Express / Node.js
   │
   ├── Middleware de autenticação/autorização
   ├── Rotas de vendas
   ├── Rotas de produtos
   ├── Rotas de movimentações
   ├── Rotas de funcionários
   ├── Rotas de relatórios
   └── Rotas de dashboard
   │
   ▼
mysql2 / Pool de conexões
   │
   ▼
MySQL 8+
```

## 8. Integridade das principais entidades

```text
cargos 1 ─── N funcionarios
categorias 1 ─── N produtos
funcionarios 1 ─── N vendas
vendas 1 ─── N venda_item
produtos 1 ─── N venda_item
produtos 1 ─── N movimentacoes
funcionarios 1 ─── N movimentacoes
vendas 1 ─── N movimentacoes (quando originadas pelo PDV)
formas_pagamento 1 ─── N vendas
```

## 9. Regras críticas de negócio

1. Um funcionário com histórico de venda não pode ser excluído.
2. Gerentes não podem excluir ou alterar outros gerentes.
3. Gerentes não podem criar administradores.
4. Administradores não podem excluir a própria conta.
5. Nenhum usuário pode desativar a própria conta.
6. Uma venda não pode ser finalizada sem itens.
7. Uma venda não pode consumir quantidade superior ao estoque disponível.
8. O preço histórico do item vendido deve ser preservado.
9. Alterar o cadastro do produto não altera seu estoque.
10. Estoque alterado deve gerar movimentação.
11. Venda finalizada e baixa de estoque devem ocorrer na mesma transação.
12. Reenvio de uma mesma finalização não pode criar uma segunda venda.
13. Produto inativo não pode ser vendido nem utilizado em novas movimentações.
14. Todas as regras de autorização devem ser aplicadas no backend.

## 10. Critérios de aceite principais

O sistema será considerado funcional quando:

- um ADMIN conseguir administrar usuários dentro das regras de perfil;
- um GERENTE conseguir administrar funcionários comuns sem obter privilégios de ADMIN;
- um GERENTE não conseguir apagar outro gerente nem a si próprio;
- um ADMIN não conseguir apagar a própria conta;
- um funcionário com venda registrada não puder ser excluído;
- o PDV permitir realizar uma venda completa sem solicitar cliente;
- o estoque for reduzido corretamente após a venda;
- uma venda concorrente não puder gerar estoque negativo;
- uma repetição da mesma requisição idempotente não criar venda duplicada;
- os relatórios permitirem filtros úteis e exibirem datas em `dd/mm/aaaa`;
- o banco puder ser inicializado pelo script de setup;
- `npm run check` não apresentar erros de sintaxe.

CREATE DATABASE IF NOT EXISTS estoque_mercadinho
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE estoque_mercadinho;

CREATE TABLE IF NOT EXISTS cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(30) NOT NULL UNIQUE,
    descricao VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    descricao VARCHAR(255) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formas_pagamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    login VARCHAR(60) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    cargo_id INT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_funcionarios_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_funcionarios_cargo (cargo_id),
    INDEX idx_funcionarios_ativo (ativo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(150) NOT NULL,
    categoria_id INT NOT NULL,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quantidade INT NOT NULL DEFAULT 0,
    limite_minimo INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_produtos_preco CHECK (preco >= 0),
    CONSTRAINT chk_produtos_quantidade CHECK (quantidade >= 0),
    CONSTRAINT chk_produtos_limite CHECK (limite_minimo >= 0),
    CONSTRAINT fk_produtos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_produtos_nome (nome),
    INDEX idx_produtos_categoria (categoria_id),
    INDEX idx_produtos_ativo (ativo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    funcionario_id INT NOT NULL,
    forma_pagamento_id INT NULL,
    observacao VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizada BOOLEAN NOT NULL DEFAULT FALSE,
    finalizada_at TIMESTAMP NULL,
    CONSTRAINT fk_vendas_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_vendas_pagamento FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_vendas_data (created_at),
    INDEX idx_vendas_funcionario (funcionario_id),
    INDEX idx_vendas_finalizada (finalizada)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS venda_item (
    venda_id BIGINT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (venda_id, produto_id),
    CONSTRAINT chk_venda_item_quantidade CHECK (quantidade > 0),
    CONSTRAINT chk_venda_item_preco CHECK (preco_unitario >= 0),
    CONSTRAINT fk_venda_item_venda FOREIGN KEY (venda_id) REFERENCES vendas(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_venda_item_produto FOREIGN KEY (produto_id) REFERENCES produtos(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idempotency_keys (
    usuario_id INT NOT NULL,
    chave VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status_code SMALLINT NOT NULL DEFAULT 0,
    response_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, chave),
    FOREIGN KEY (usuario_id) REFERENCES funcionarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_idempotency_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimentacoes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    venda_id BIGINT NULL,
    tipo ENUM('ENTRADA', 'SAIDA') NOT NULL,
    quantidade INT NOT NULL,
    observacao VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_movimentacoes_quantidade CHECK (quantidade > 0),
    CONSTRAINT fk_mov_produto FOREIGN KEY (produto_id) REFERENCES produtos(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_mov_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_mov_venda FOREIGN KEY (venda_id) REFERENCES vendas(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_mov_data (created_at),
    INDEX idx_mov_produto (produto_id),
    INDEX idx_mov_funcionario (funcionario_id),
    INDEX idx_mov_venda (venda_id)
) ENGINE=InnoDB;

INSERT INTO cargos (nome, descricao) VALUES
    ('ADMIN', 'Administrador do sistema, com gestão completa de usuários e configurações.'),
    ('GERENTE', 'Gestão operacional de estoque e funcionários.'),
    ('FUNCIONARIO', 'Operação de produtos, estoque e caixa.')
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao);

INSERT INTO categorias (nome, descricao) VALUES
    ('Bebidas', 'Águas, refrigerantes, sucos e bebidas em geral.'),
    ('Mercearia', 'Alimentos e produtos de mercearia.'),
    ('Higiene', 'Produtos de higiene pessoal.'),
    ('Limpeza', 'Produtos para limpeza.'),
    ('Outros', 'Produtos não enquadrados nas demais categorias.')
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao);

INSERT INTO formas_pagamento (nome) VALUES
    ('Dinheiro'),
    ('Cartão de Débito'),
    ('Cartão de Crédito'),
    ('PIX'),
    ('Crediário'),
    ('Outra Forma')
ON DUPLICATE KEY UPDATE ativo = TRUE;

CREATE OR REPLACE VIEW detalhes_funcionarios_view AS
SELECT
    f.id, f.nome, f.login, f.cargo_id, c.nome AS perfil,
    c.nome AS cargo_nome, f.ativo, f.created_at, f.updated_at
FROM funcionarios f
JOIN cargos c ON c.id = f.cargo_id;

CREATE OR REPLACE VIEW detalhes_produtos_view AS
SELECT
    p.id, p.codigo, p.nome, p.categoria_id, c.nome AS categoria,
    p.preco, p.quantidade, p.limite_minimo, p.ativo,
    p.created_at, p.updated_at
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id;

CREATE OR REPLACE VIEW movimentacoes_view AS
SELECT
    m.id, m.produto_id, p.codigo, p.nome AS produto,
    m.funcionario_id, f.nome AS funcionario,
    m.venda_id, m.tipo, m.quantidade, m.observacao, m.created_at
FROM movimentacoes m
JOIN produtos p ON p.id = m.produto_id
JOIN funcionarios f ON f.id = m.funcionario_id;

CREATE OR REPLACE VIEW detalhes_vendas_view AS
SELECT
    v.id, v.funcionario_id, f.nome AS funcionario_nome,
    v.forma_pagamento_id, fp.nome AS forma_pagamento,
    v.observacao, v.created_at, v.finalizada, v.finalizada_at,
    COALESCE(SUM(vi.quantidade * vi.preco_unitario), 0) AS valor_total
FROM vendas v
JOIN funcionarios f ON f.id = v.funcionario_id
LEFT JOIN formas_pagamento fp ON fp.id = v.forma_pagamento_id
LEFT JOIN venda_item vi ON vi.venda_id = v.id
GROUP BY v.id, v.funcionario_id, f.nome, v.forma_pagamento_id,
         fp.nome, v.observacao, v.created_at, v.finalizada, v.finalizada_at;

CREATE OR REPLACE VIEW venda_item_view AS
SELECT
    vi.venda_id, vi.produto_id, p.nome AS produto_nome,
    p.codigo AS produto_codigo, c.nome AS categoria_nome,
    vi.quantidade, vi.preco_unitario,
    vi.quantidade * vi.preco_unitario AS subtotal,
    vi.created_at
FROM venda_item vi
JOIN produtos p ON p.id = vi.produto_id
JOIN categorias c ON c.id = p.categoria_id;

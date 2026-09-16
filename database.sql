CREATE DATABASE IF NOT EXISTS estoque_mercadinho
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE estoque_mercadinho;


CREATE TABLE IF NOT EXISTS cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT
);


CREATE TABLE IF NOT EXISTS funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    login VARCHAR(60) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    cargo_id INT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (cargo_id) REFERENCES cargos(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT
);


CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(150) NOT NULL,
    categoria_id INT NOT NULL,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quantidade INT NOT NULL DEFAULT 0,
    limite_minimo INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CHECK (preco >= 0),
    CHECK (quantidade >= 0),
    CHECK (limite_minimo >= 0),

    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE IF NOT EXISTS formas_pagamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE
);


CREATE TABLE IF NOT EXISTS venda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    funcionario_id INT NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    forma_pagamento_id INT,
    observacao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CHECK (valor_total >= 0)
);


CREATE TABLE IF NOT EXISTS venda_item (
    venda_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    PRIMARY KEY (venda_id, produto_id),

    FOREIGN KEY (venda_id) REFERENCES venda(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (produto_id) REFERENCES produtos(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CHECK (quantidade > 0),
    CHECK (preco_unitario >= 0)
);


CREATE TABLE IF NOT EXISTS movimentacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    tipo ENUM('ENTRADA', 'SAIDA') NOT NULL,
    quantidade INT NOT NULL,
    observacao VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (produto_id) REFERENCES produtos(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CHECK (quantidade > 0),

    INDEX idx_mov_data (created_at),
    INDEX idx_mov_produto (produto_id)
);
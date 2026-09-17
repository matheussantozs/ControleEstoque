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
    login VARCHAR(60) NOT NULL UNIQUE DEFAULT nome,
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


CREATE TABLE IF NOT EXISTS vendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    funcionario_id INT NOT NULL,
    forma_pagamento_id INT,
    observacao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finalizada BOOLEAN NOT NULL DEFAULT FALSE,

    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
);


CREATE TABLE IF NOT EXISTS venda_item (
    venda_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

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



CREATE VIEW IF NOT EXISTS detalhes_funcionarios_view AS
SELECT f.*, c.nome AS cargo_nome
FROM funcionarios AS f
INNER JOIN cargos AS c 
ON f.cargo_id = c.id;


CREATE VIEW IF NOT EXISTS detalhes_produtos_view AS
SELECT p.*, c.nome AS categoria_nome
FROM produtos AS p
INNER JOIN categorias AS c 
ON p.categoria_id = c.id;


CREATE VIEW IF NOT EXISTS detalhes_vendas_view AS
SELECT 
    v.*,
    (
        SELECT SUM(
            vi.quantidade * vi.valor_unitario
        )
    ) AS valor_total,
    fp.nome AS forma_pagamento,
    func.nome AS funcionario_nome,

FROM vendas AS v
INNER JOIN formas_pagamento AS fp
ON v.forma_pagamento_id = fp.id
INNER JOIN funcionarios AS func
ON v.funcionario_id = func.id
INNER JOIN venda_item AS vi
ON vi.venda_id = v.id
GROUP BY v.id, v.funcionario_id;


CREATE VIEW IF NOT EXISTS venda_item_view AS
SELECT 
    vi.*, 
    p.nome AS produto_nome,
    p.codigo AS produto_codigo,
    c.nome AS categoria_nome
FROM venda_item AS vi
INNER JOIN produtos AS p
ON vi.produto_id = p.id
INNER JOIN categorias AS c
ON p.categoria_id = c.id;


CREATE VIEW IF NOT EXISTS venda_valor_view AS
SELECT 
    v.id AS venda_id,
    v.funcionario_id,
    v.created_at,
    SUM(vi.quantidade * vi.preco_unitario) AS valor_total
FROM vendas AS v
INNER JOIN venda_item AS vi
ON v.id = vi.venda_id
GROUP BY v.id, v.funcionario_id, v.created_at;

DELIMITER $$
CREATE OR REPLACE FUNCTION criar_funcionario_function (
    nome_c TEXT,
    senha_c TEXT,
    cargo_id_c INT,
    login_c TEXT,
    ativo_c BOOLEAN
)
RETURNS INT
DETERMINISTIC
BEGIN
    IF NOT EXISTS 
        (SELECT 1 FROM cargos WHERE id = cargo_id_c)
        THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cargo não encontrado';
    END IF;
    INSERT INTO funcionarios (
        nome,
        senha, 
        cargo_id, 
        login, ativo
    )
    VALUES (
        nome_c, 
        senha_c, 
        cargo_id_c, 
        login_c, 
        ativo_c
    );
    RETURN LAST_INSERT_ID();
END $$
DELIMITER;


DELIMITER $$
CREATE OR REPLACE FUNCTION criar_produto_function (
    codigo_c TEXT,
    nome_c TEXT,
    categoria_id_c INT,
    preco_c DECIMAL(10,2),
    quantidade_c INT,
    limite_minimo_c INT
)
RETURNS INT
DETERMINISTIC
BEGIN
    IF NOT EXISTS 
        (SELECT 1 FROM categorias WHERE id = categoria_id_c)
        THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Categoria não encontrada';
    END IF;
    INSERT INTO produtos (codigo, nome, categoria_id, preco, quantidade, limite_minimo)
    VALUES (
        codigo_c, 
        nome_c, 
        categoria_id_c, 
        preco_c, 
        quantidade_c, 
        limite_minimo_c
    );
    RETURN LAST_INSERT_ID();
END $$
DELIMITER;



CREATE OR REPLACE FUNCTION criar_venda_function (
    funcionario_id_c INT,
    observacao_c TEXT,
    valor_total_c DECIMAL(10,2),
    forma_pagamento_id_c INT
    finalizada_c BOOLEAN,
)
RETURNS INT
DETERMINISTIC
BEGIN
    IF NOT EXISTS 
        (SELECT 1 FROM funcionarios WHERE id = funcionario_id_c)
        THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Funcionário não encontrado';
    END IF;

    IF forma_pagamento_id_c IS NOT NULL AND NOT EXISTS 
        (SELECT 1 FROM formas_pagamento WHERE id = forma_pagamento_id_c)
        THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Forma de pagamento não encontrada';
    END IF;

    INSERT INTO vendas (
        funcionario_id, 
        observacao, 
        valor_total, 
        forma_pagamento_id,
        finalizada
    )
    VALUES (
        funcionario_id_c, 
        observacao_c, 
        valor_total_c, 
        forma_pagamento_id_c,
        finalizada_c
    );
    RETURN LAST_INSERT_ID();
END $$
DELIMITER;


CREATE OR REPLACE FUNCTION venda_item_function (
    venda_id_c INT,
    produto_codigo_c TEXT,
    quantidade_c INT,
)
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE 
        produto_id_v INT,
        produto_status_v INT,
        produto_quantidade_v INT;

    SELECT id, status, quantidade
    INTO produto_id_v, produto_status_v, produto_quantidade_v
    FROM produtos 
    WHERE codigo = produto_codigo_c;

    IF produto_id_v IS NULL 
    THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Produto não encontrado';

    ELSEIF produto_status_v = 0 
    THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Produto inativo';

    ELSEIF produto_quantidade_v < quantidade_c 
    THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade insuficiente em estoque';
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM venda_item 
        WHERE venda_id = venda_id_c AND produto_id = produto_id_v
    )
    THEN
        INSERT INTO venda_item (
            venda_id, 
            produto_id, 
            quantidade, 
            preco_unitario
        )
        VALUES (
            venda_id_c,
            produto_id_v, 
            quantidade_c, 
            (SELECT preco FROM produtos WHERE id = produto_id_v)
        );
        RETURN LAST_INSERT_ID();
    END IF;


    UPDATE venda_item 
    SET quantidade = quantidade + quantidade_c
    WHERE venda_id = venda_id_c AND produto_id = produto_id_v;
    RETURN LAST_INSERT_ID();
END $$
DELIMITER;
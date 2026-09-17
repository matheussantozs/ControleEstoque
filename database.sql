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
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
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
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS venda_item (
    venda_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (venda_id, produto_id),

    FOREIGN KEY (venda_id) REFERENCES vendas(id)
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

CREATE OR REPLACE VIEW detalhes_funcionarios_view AS
SELECT
    f.id,
    f.nome,
    f.login,
    f.senha,
    f.cargo_id,
    c.nome AS cargo_nome,
    f.ativo,
    f.created_at,
    f.updated_at
FROM funcionarios AS f
INNER JOIN cargos AS c
    ON f.cargo_id = c.id;

CREATE OR REPLACE VIEW detalhes_produtos_view AS
SELECT
    p.id,
    p.codigo,
    p.nome,
    p.categoria_id,
    c.nome AS categoria_nome,
    p.preco,
    p.quantidade,
    p.limite_minimo,
    p.ativo,
    p.created_at,
    p.updated_at
FROM produtos AS p
INNER JOIN categorias AS c
    ON p.categoria_id = c.id;

CREATE OR REPLACE VIEW detalhes_vendas_view AS
SELECT
    v.id,
    v.funcionario_id,
    func.nome AS funcionario_nome,
    v.forma_pagamento_id,
    fp.nome AS forma_pagamento,
    v.observacao,
    v.created_at,
    v.finalizada,
    COALESCE(SUM(
        vi.quantidade * vi.preco_unitario
    ), 0) AS valor_total
FROM vendas AS v
INNER JOIN funcionarios AS func
    ON v.funcionario_id = func.id
LEFT JOIN formas_pagamento AS fp
    ON v.forma_pagamento_id = fp.id
LEFT JOIN venda_item AS vi
    ON vi.venda_id = v.id
GROUP BY
    v.id,
    v.funcionario_id,
    func.nome,
    v.forma_pagamento_id,
    fp.nome,
    v.observacao,
    v.created_at,
    v.finalizada;

CREATE OR REPLACE VIEW venda_item_view AS
SELECT
    vi.venda_id,
    vi.produto_id,
    p.nome AS produto_nome,
    p.codigo AS produto_codigo,
    c.nome AS categoria_nome,
    vi.quantidade,
    vi.preco_unitario,
    vi.quantidade * vi.preco_unitario AS subtotal,
    vi.created_at
FROM venda_item AS vi
INNER JOIN produtos AS p
    ON vi.produto_id = p.id
INNER JOIN categorias AS c
    ON p.categoria_id = c.id;

CREATE OR REPLACE VIEW venda_valor_view AS
SELECT
    v.id AS venda_id,
    v.funcionario_id,
    v.created_at,
    COALESCE(SUM(
        vi.quantidade * vi.preco_unitario
    ), 0) AS valor_total
FROM vendas AS v
LEFT JOIN venda_item AS vi
    ON v.id = vi.venda_id
GROUP BY
    v.id,
    v.funcionario_id,
    v.created_at;

DELIMITER $$

CREATE OR REPLACE FUNCTION criar_funcionario_function (
    nome_c VARCHAR(120),
    senha_c VARCHAR(255),
    cargo_id_c INT,
    login_c VARCHAR(60),
    ativo_c BOOLEAN
)
RETURNS INT
MODIFIES SQL DATA
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM cargos
        WHERE id = cargo_id_c
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cargo não encontrado';
    END IF;

    INSERT INTO funcionarios (
        nome,
        senha,
        cargo_id,
        login,
        ativo
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

CREATE OR REPLACE FUNCTION criar_produto_function (
    codigo_c VARCHAR(50),
    nome_c VARCHAR(150),
    categoria_id_c INT,
    preco_c DECIMAL(10,2),
    quantidade_c INT,
    limite_minimo_c INT
)
RETURNS INT
MODIFIES SQL DATA
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM categorias
        WHERE id = categoria_id_c
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Categoria não encontrada';
    END IF;

    INSERT INTO produtos (
        codigo,
        nome,
        categoria_id,
        preco,
        quantidade,
        limite_minimo
    )
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

CREATE OR REPLACE FUNCTION criar_venda_function (
    funcionario_id_c INT,
    observacao_c TEXT,
    forma_pagamento_id_c INT,
    finalizada_c BOOLEAN
)
RETURNS INT
MODIFIES SQL DATA
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM funcionarios
        WHERE id = funcionario_id_c
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Funcionário não encontrado';
    END IF;

    IF forma_pagamento_id_c IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM formas_pagamento
            WHERE id = forma_pagamento_id_c
       )
    THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Forma de pagamento não encontrada';
    END IF;

    INSERT INTO vendas (
        funcionario_id,
        observacao,
        forma_pagamento_id,
        finalizada
    )
    VALUES (
        funcionario_id_c,
        observacao_c,
        forma_pagamento_id_c,
        finalizada_c
    );

    RETURN LAST_INSERT_ID();
END $$

CREATE OR REPLACE FUNCTION adicionar_item_venda_function (
    venda_id_c INT,
    produto_codigo_c VARCHAR(50),
    quantidade_c INT
)
RETURNS INT
MODIFIES SQL DATA
BEGIN
    DECLARE produto_id_v INT;
    DECLARE produto_ativo_v BOOLEAN;
    DECLARE produto_quantidade_v INT;
    DECLARE produto_preco_v DECIMAL(10,2);

    IF NOT EXISTS (
        SELECT 1
        FROM vendas
        WHERE id = venda_id_c
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Venda não encontrada';
    END IF;

    IF quantidade_c <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Quantidade deve ser maior que zero';
    END IF;

    SELECT
        id,
        ativo,
        quantidade,
        preco
    INTO
        produto_id_v,
        produto_ativo_v,
        produto_quantidade_v,
        produto_preco_v
    FROM produtos
    WHERE codigo = produto_codigo_c;

    IF produto_id_v IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Produto não encontrado';
    END IF;

    IF produto_ativo_v = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Produto inativo';
    END IF;

    IF produto_quantidade_v < quantidade_c THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Quantidade insuficiente em estoque';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM venda_item
        WHERE venda_id = venda_id_c
        AND produto_id = produto_id_v
    ) THEN

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
            produto_preco_v
        );

    ELSE

        UPDATE venda_item
        SET quantidade = quantidade + quantidade_c
        WHERE venda_id = venda_id_c
        AND produto_id = produto_id_v;

    END IF;

    RETURN produto_id_v;
END $$

DELIMITER ;
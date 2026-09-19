CREATE TABLE IF NOT EXISTS formas_pagamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    funcionario_id INT NOT NULL,
    forma_pagamento_id INT NULL,
    observacao VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizada BOOLEAN NOT NULL DEFAULT FALSE,
    finalizada_at TIMESTAMP NULL,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id) ON DELETE RESTRICT ON UPDATE CASCADE,
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
    CHECK (quantidade > 0),
    CHECK (preco_unitario >= 0),
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimentacoes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    funcionario_id INT NOT NULL,
    venda_id BIGINT NULL,
    tipo ENUM('ENTRADA', 'SAIDA') NOT NULL,
    quantidade INT NOT NULL,
    observacao VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantidade > 0),
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_mov_data (created_at),
    INDEX idx_mov_produto (produto_id),
    INDEX idx_mov_funcionario (funcionario_id),
    INDEX idx_mov_venda (venda_id)
) ENGINE=InnoDB;

DELIMITER //

DROP PROCEDURE IF EXISTS adicionar_item_venda_procedure//
CREATE PROCEDURE adicionar_item_venda_procedure(
    IN venda_id_c BIGINT,
    IN produto_codigo_c VARCHAR(50),
    IN quantidade_c INT
)
BEGIN
    DECLARE produto_id_v INT DEFAULT NULL;
    DECLARE produto_ativo_v BOOLEAN DEFAULT FALSE;
    DECLARE produto_preco_v DECIMAL(10,2) DEFAULT 0;

    IF quantidade_c <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade deve ser maior que zero';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM vendas WHERE id = venda_id_c AND finalizada = FALSE) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Venda não encontrada ou já finalizada';
    END IF;

    SELECT id, ativo, preco INTO produto_id_v, produto_ativo_v, produto_preco_v
    FROM produtos WHERE codigo = produto_codigo_c LIMIT 1;

    IF produto_id_v IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Produto não encontrado';
    END IF;
    IF produto_ativo_v = FALSE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Produto inativo';
    END IF;

    INSERT INTO venda_item(venda_id, produto_id, quantidade, preco_unitario)
    VALUES(venda_id_c, produto_id_v, quantidade_c, produto_preco_v)
    ON DUPLICATE KEY UPDATE quantidade = quantidade + quantidade_c;

    SELECT * FROM venda_item_view WHERE venda_id = venda_id_c AND produto_id = produto_id_v;
END//

DELIMITER ;

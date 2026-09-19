DELIMITER //

DROP PROCEDURE IF EXISTS criar_produto_procedure//
CREATE PROCEDURE criar_produto_procedure(
    IN codigo_c VARCHAR(50),
    IN nome_c VARCHAR(150),
    IN categoria_id_c INT,
    IN preco_c DECIMAL(10,2),
    IN quantidade_c INT,
    IN limite_minimo_c INT
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM categorias WHERE id = categoria_id_c AND ativo = TRUE) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Categoria não encontrada';
    END IF;

    INSERT INTO produtos(codigo, nome, categoria_id, preco, quantidade, limite_minimo)
    VALUES(codigo_c, nome_c, categoria_id_c, preco_c, quantidade_c, limite_minimo_c);

    SELECT * FROM detalhes_produtos_view WHERE id = LAST_INSERT_ID();
END//

DELIMITER ;

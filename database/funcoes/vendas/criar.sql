DELIMITER //

DROP PROCEDURE IF EXISTS criar_venda_procedure//
CREATE PROCEDURE criar_venda_procedure(
    IN funcionario_id_c INT,
    IN observacao_c VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM funcionarios WHERE id = funcionario_id_c AND ativo = TRUE) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Funcionário não encontrado ou inativo';
    END IF;

    INSERT INTO vendas(funcionario_id, observacao, finalizada)
    VALUES(funcionario_id_c, observacao_c, FALSE);

    SELECT * FROM detalhes_vendas_view WHERE id = LAST_INSERT_ID();
END//

DELIMITER ;

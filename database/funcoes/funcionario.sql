DELIMITER //

DROP PROCEDURE IF EXISTS criar_funcionario_procedure//
CREATE PROCEDURE criar_funcionario_procedure(
    IN nome_c VARCHAR(120),
    IN senha_c VARCHAR(255),
    IN cargo_id_c INT,
    IN login_c VARCHAR(60),
    IN ativo_c BOOLEAN
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cargos WHERE id = cargo_id_c) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cargo não encontrado';
    END IF;

    INSERT INTO funcionarios(nome, senha, cargo_id, login, ativo)
    VALUES(nome_c, senha_c, cargo_id_c, login_c, ativo_c);

    SELECT * FROM detalhes_funcionarios_view WHERE id = LAST_INSERT_ID();
END//

DELIMITER ;

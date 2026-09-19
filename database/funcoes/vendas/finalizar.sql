DELIMITER //

DROP PROCEDURE IF EXISTS finalizar_venda_procedure//
CREATE PROCEDURE finalizar_venda_procedure(
    IN venda_id_c BIGINT,
    IN forma_pagamento_id_c INT
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vendas WHERE id = venda_id_c AND finalizada = FALSE) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Venda não encontrada ou já finalizada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM venda_item WHERE venda_id = venda_id_c) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Venda sem itens';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM formas_pagamento WHERE id = forma_pagamento_id_c AND ativo = TRUE) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Forma de pagamento inválida';
    END IF;

    UPDATE vendas
    SET forma_pagamento_id = forma_pagamento_id_c,
        finalizada = TRUE,
        finalizada_at = CURRENT_TIMESTAMP
    WHERE id = venda_id_c;

    SELECT * FROM detalhes_vendas_view WHERE id = venda_id_c;
END//

DELIMITER ;

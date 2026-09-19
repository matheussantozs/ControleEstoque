# Banco de dados

`../database.sql` e `tudo.sql` são os scripts completos e canônicos.

A organização desta pasta separa:

- `tabelas/`: estrutura física e constraints;
- `visualizacoes/`: views de consulta;
- `funcoes/`: procedures de domínio.

Para uma instalação nova, prefira executar `../database.sql` ou `tudo.sql` de uma vez. Os arquivos separados existem para estudo/manutenção e precisam respeitar as dependências entre tabelas.

As antigas stored functions foram convertidas para procedures porque MySQL não suporta `RETURNS nome_da_view` como tipo de retorno de uma stored function. As procedures retornam os registros por `SELECT`.

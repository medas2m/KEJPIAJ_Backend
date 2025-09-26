/*
 * Endpoint: GET /fetchWskData/:tabela
 *
 * Opis:
 * Zwraca dane z tabeli A_DANE_POMIAROWE na podstawie parametru `tabela`.
 * Dołącza dane użytkownika (Opiekun) z tabeli A_Users przez LEFT JOIN.
 *
 * Przykład użycia:
 *   /fetchWskData/OS_LibiazB_En_Ew
 */

module.exports = (server, pool, sql) => {
  server.get("/fetchWskData/:tabela", async (req, res) => {
    const { tabela } = req.params;

    try {
      const result = await pool
        .request()
        .input("tabela", sql.NVarChar(50), tabela).query(`
            SELECT 
                d.lp,
                d.Obiekt,
                d.Nazwa,
                d.Jednostka,
                d.Zmienna,
                d.Tabela,
                d.nesting,
                d.Rodzic,
                d.WSK,
                d.Cel,
                d.Opis,
                d.Opiekun,
                u.FirstName + ' ' + u.LastName AS OpiekunFullName,
                d.Prog_1,
                d.Prog_2,
                d.Prog_3,
                d.NazwaWsk,
                d.Typ,
                d.Glebokosc,
                d.JednostkaWsk,
                d.kolor1,
                d.kolor2,
                d.ZmiennaPom
            FROM [KEJPIAJ].[dbo].[A_DANE_POMIAROWE] d
            LEFT JOIN [KEJPIAJ].[dbo].[A_Users] u ON d.Opiekun = u.UserID
            WHERE d.Tabela = @tabela
          `);

      res.send(result.recordset);
    } catch (err) {
      console.error("Błąd przy /fetchWskData:", err);
      res.send(500, { error: "Błąd podczas pobierania danych wskaźników." });
    }
  });
};

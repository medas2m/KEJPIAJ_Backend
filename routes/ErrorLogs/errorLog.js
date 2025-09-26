/**
 * @file errorLog.js
 * @description
 * Endpoint POST /log-error służy do rejestrowania błędów aplikacji frontendowej w bazie danych (tabela: A_Error_Log).
 * Obsługuje zarówno błędy JavaScript (np. runtime, unhandled promise), jak i stack trace komponentów React.
 *
 * Dodatkowo, jeśli przekazany zostanie userId, dane użytkownika (imię, nazwisko) zostaną automatycznie pobrane z tabeli A_Users.
 *
 * Pola wejściowe oczekiwane w req.body:
 *  - error (string)        → wymagany opis błędu (np. RangeError: Invalid time value)
 *  - info (object/string)  → opcjonalne szczegóły stack trace, np. z componentDidCatch lub global catcher
 *  - time (string)         → opcjonalna data wystąpienia błędu (w ISO lub null – wtedy aktualna)
 *  - url (string)          → opcjonalny adres, na którym wystąpił błąd
 *  - userAgent (string)    → opcjonalna informacja o przeglądarce/użytkowniku
 *  - userId (number)       → opcjonalny identyfikator użytkownika z tabeli A_Users (bez danych poufnych!)
 *
 * Wartości zapisywane są w tabeli A_Error_Log.
 *
 * W razie błędu zwraca status 500 i loguje go do konsoli.
 *
 * @author 🐱‍🐉
 * @created 2025-05-08
 */

module.exports = (server, pool, sql) => {
  server.post("/log-error", async (req, res) => {
    try {
      const { error, info, time, url, userAgent, userId } = req.body;

      if (!error) {
        return res.send(400, { error: "Brakuje treści błędu." });
      }

      const timestamp = time || new Date().toISOString();

      let userFirstName = null;
      let userLastName = null;

      if (userId) {
        const userQuery = await pool.request().input("userId", sql.Int, userId)
          .query(`
                SELECT FirstName, LastName 
                FROM [KEJPIAJ].[dbo].[A_Users] 
                WHERE UserID = @userId
              `);

        const user = userQuery.recordset?.[0];
        if (user) {
          userFirstName = user.FirstName;
          userLastName = user.LastName;
        }
      }

      await pool
        .request()
        .input("ErrorMessage", sql.NVarChar(sql.MAX), error)
        .input(
          "ComponentStack",
          sql.NVarChar(sql.MAX),
          JSON.stringify(info || "")
        )
        .input("OccurredAt", sql.DateTime, new Date(timestamp))
        .input("Url", sql.NVarChar(500), url || null)
        .input("UserAgent", sql.NVarChar(500), userAgent || null)
        .input("FirstName", sql.NVarChar(100), userFirstName)
        .input("LastName", sql.NVarChar(100), userLastName).query(`
            INSERT INTO [KEJPIAJ].[dbo].[A_Error_Log] 
            (ErrorMessage, ComponentStack, OccurredAt, Url, UserAgent, FirstName, LastName)
            VALUES (@ErrorMessage, @ComponentStack, @OccurredAt, @Url, @UserAgent, @FirstName, @LastName)
          `);

      res.send(200, { message: "Błąd zapisany do A_Error_Log." });
    } catch (err) {
      console.error("Błąd przy zapisie logu:", err);
      res.send(500, { error: "Błąd serwera przy logowaniu błędu." });
    }
  });
};

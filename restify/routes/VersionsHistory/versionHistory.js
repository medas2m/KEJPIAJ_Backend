module.exports = (server, pool, sql) => {
  // GET: Pobierz WSZYSTKIE wersje (posortowane od najnowszej)
  server.get("/version-history", async (req, res) => {
    try {
      const result = await pool.request().query(`
          SELECT 
            ID, 
            VersionNumber, 
            ReleaseDate, 
            Changes, 
            CreatedBy, 
            CreatedAt, 
            IsActive
          FROM [KEJPIAJ].[dbo].[A_VersionHistory]
          WHERE IsActive = 1
          ORDER BY ReleaseDate DESC, ID DESC
        `);

      // Zamiana Changes z JSON stringa na array:
      const versions = result.recordset.map((row) => ({
        ...row,
        Changes: (() => {
          try {
            return JSON.parse(row.Changes) || [];
          } catch {
            return [];
          }
        })(),
      }));

      res.send(200, versions);
    } catch (err) {
      console.error("[VersionHistory] GET /api/version-history error:", err);
      res.send(500, { error: "Błąd serwera przy pobieraniu historii wersji." });
    }
  });

  // GET: Pobierz SZCZEGÓŁY wybranej wersji po ID
  server.get("/version-history/:id", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.send(400, { error: "Brak parametru id." });

    try {
      const result = await pool.request().input("id", sql.Int, id).query(`
            SELECT 
              ID, 
              VersionNumber, 
              ReleaseDate, 
              Changes, 
              CreatedBy, 
              CreatedAt, 
              IsActive
            FROM [KEJPIAJ].[dbo].[A_VersionHistory]
            WHERE ID = @id AND IsActive = 1
          `);

      if (result.recordset.length === 0)
        return res.send(404, { error: "Nie znaleziono wersji o podanym ID." });

      const row = result.recordset[0];
      row.Changes = (() => {
        try {
          return JSON.parse(row.Changes) || [];
        } catch {
          return [];
        }
      })();

      res.send(200, row);
    } catch (err) {
      console.error(
        "[VersionHistory] GET /api/version-history/:id error:",
        err
      );
      res.send(500, {
        error: "Błąd serwera przy pobieraniu szczegółów wersji.",
      });
    }
  });

  // POST: Dodaj nową wersję
  server.post("/version-history", async (req, res) => {
    const { VersionNumber, ReleaseDate, Changes, CreatedBy } = req.body;

    if (!VersionNumber || !ReleaseDate || !Changes)
      return res.send(400, {
        error: "Wymagane pola: VersionNumber, ReleaseDate, Changes.",
      });

    try {
      // Changes musi być array — zamień na JSON string
      const changesJson = JSON.stringify(Changes);

      await pool
        .request()
        .input("VersionNumber", sql.NVarChar(32), VersionNumber)
        .input("ReleaseDate", sql.Date, ReleaseDate)
        .input("Changes", sql.NVarChar(sql.MAX), changesJson)
        .input("CreatedBy", sql.NVarChar(100), CreatedBy || null).query(`
            INSERT INTO [KEJPIAJ].[dbo].[A_VersionHistory] (VersionNumber, ReleaseDate, Changes, CreatedBy)
            VALUES (@VersionNumber, @ReleaseDate, @Changes, @CreatedBy)
          `);

      res.send(201, { message: "Wersja została dodana." });
    } catch (err) {
      console.error("[VersionHistory] POST /api/version-history error:", err);
      res.send(500, { error: "Błąd serwera przy dodawaniu wersji." });
    }
  });

  // PUT: Aktualizuj wersję po ID
  server.put("/version-history/:id", async (req, res) => {
    const { id } = req.params;
    const { VersionNumber, ReleaseDate, Changes, CreatedBy, IsActive } =
      req.body;

    if (!id) return res.send(400, { error: "Brak parametru id." });
    if (!VersionNumber || !ReleaseDate || !Changes)
      return res.send(400, {
        error: "Wymagane pola: VersionNumber, ReleaseDate, Changes.",
      });

    try {
      const changesJson = JSON.stringify(Changes);

      const result = await pool
        .request()
        .input("id", sql.Int, id)
        .input("VersionNumber", sql.NVarChar(32), VersionNumber)
        .input("ReleaseDate", sql.Date, ReleaseDate)
        .input("Changes", sql.NVarChar(sql.MAX), changesJson)
        .input("CreatedBy", sql.NVarChar(100), CreatedBy || null)
        .input("IsActive", sql.Bit, IsActive === undefined ? 1 : IsActive)
        .query(`
            UPDATE [KEJPIAJ].[dbo].[A_VersionHistory]
            SET VersionNumber = @VersionNumber,
                ReleaseDate = @ReleaseDate,
                Changes = @Changes,
                CreatedBy = @CreatedBy,
                IsActive = @IsActive
            WHERE ID = @id
          `);

      if (result.rowsAffected[0] === 0)
        return res.send(404, { error: "Nie znaleziono wersji o podanym ID." });

      res.send(200, { message: "Wersja została zaktualizowana." });
    } catch (err) {
      console.error(
        "[VersionHistory] PUT /api/version-history/:id error:",
        err
      );
      res.send(500, { error: "Błąd serwera przy aktualizacji wersji." });
    }
  });

  // DELETE: Usuń (dezaktywuj) wersję po ID
  server.del("/version-history/:id", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.send(400, { error: "Brak parametru id." });

    try {
      const result = await pool.request().input("id", sql.Int, id).query(`
            UPDATE [KEJPIAJ].[dbo].[A_VersionHistory]
            SET IsActive = 0
            WHERE ID = @id
          `);

      if (result.rowsAffected[0] === 0)
        return res.send(404, { error: "Nie znaleziono wersji o podanym ID." });

      res.send(200, { message: "Wersja została usunięta (dezaktywowana)." });
    } catch (err) {
      console.error(
        "[VersionHistory] DELETE /api/version-history/:id error:",
        err
      );
      res.send(500, { error: "Błąd serwera przy usuwaniu wersji." });
    }
  });
};

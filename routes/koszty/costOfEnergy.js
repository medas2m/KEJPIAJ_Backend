// routes/koszty/costOfEnergy.js

module.exports = (server, pool, sql) => {
  // GET: Pobierz aktualny koszt energii
  server.get("/costOfEnergy", async (req, res) => {
    try {
      const result = await pool.request().query(`
          SELECT CAST(ParamValue AS FLOAT) AS EnergyCost
          FROM [KEJPIAJ].[dbo].[A_SYS_PARAMS]
          WHERE ParamName = 'ENERGY_COST_PER_KWH'
        `);

      if (result.recordset.length === 0) {
        return res.send(404, {
          error: "Nie znaleziono parametru ENERGY_COST_PER_KWH.",
        });
      }

      res.send(200, { value: result.recordset[0].EnergyCost });
    } catch (error) {
      console.error("Błąd przy pobieraniu kosztu energii:", error);
      res.send(500, { error: "Błąd serwera przy pobieraniu kosztu energii." });
    }
  });

  // PUT: Aktualizuj koszt energii
  server.put("/costOfEnergy", async (req, res) => {
    const { value } = req.body;

    if (value == null || isNaN(value)) {
      return res.send(400, { error: "Niepoprawna wartość kosztu kWh." });
    }

    try {
      await pool.request().input("paramValue", sql.Float, value).query(`
            UPDATE [KEJPIAJ].[dbo].[A_SYS_PARAMS]
            SET ParamValue = @paramValue
            WHERE ParamName = 'ENERGY_COST_PER_KWH'
          `);

      res.send(200, { message: "Koszt kWh został zaktualizowany." });
    } catch (error) {
      console.error("Błąd przy aktualizacji kosztu:", error);
      res.send(500, { error: "Błąd podczas aktualizacji kosztu energii." });
    }
  });
};

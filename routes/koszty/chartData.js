// routes/koszty/chartData.js

module.exports = (server, pool, sql) => {
  server.get("/chartData/:chartNumber", async (req, res) => {
    const { chartNumber } = req.params;

    if (!chartNumber) {
      return res.send(400, { error: "Wymagany parametr chartNumber" });
    }

    try {
      const result = await pool
        .request()
        .input("chartNumber", sql.Int, chartNumber).query(`
          SELECT 
            ChartNumber, 
            ChartName, 
            EnergyUsedTable,
            EnergyProducedTable,
            EnergyPurchasedTable,
            ShowEnergyUsed,
            ShowEnergyProduced,
            ShowEnergyPurchased
          FROM [KEJPIAJ].[dbo].[A_ENERGY_CHARTS]
          WHERE ChartNumber = @chartNumber
        `);

      if (result.recordset.length === 0) {
        return res.send(404, {
          error: "Nie znaleziono wykresu o podanym ChartNumber.",
        });
      }

      const row = result.recordset[0];

      const parseSafe = (json) => {
        try {
          return JSON.parse(json) || [];
        } catch {
          return [];
        }
      };

      const usedRaw = row.EnergyUsedTable;
      const producedRaw = row.EnergyProducedTable;
      const purchasedRaw = row.EnergyPurchasedTable;

      /* console.log("[chartData] BEFORE PARSE:", {
        EnergyUsedTable: usedRaw,
        EnergyProducedTable: producedRaw,
        EnergyPurchasedTable: purchasedRaw,
      }); */

      const used = parseSafe(usedRaw);
      const produced = parseSafe(producedRaw);
      const purchased = parseSafe(purchasedRaw);

      /* console.log("[chartData] AFTER PARSE:", {
        EnergyUsedTable: used,
        EnergyProducedTable: produced,
        EnergyPurchasedTable: purchased,
      }); */

      res.send({
        ChartNumber: row.ChartNumber,
        ChartName: row.ChartName,

        // sprawdzamy flage przy każdym rekordzie
        EnergyUsedTables: row.ShowEnergyUsed ? used : [],
        EnergyProducedTables: row.ShowEnergyProduced ? produced : [],
        EnergyPurchasedTables: row.ShowEnergyPurchased ? purchased : [],

        // może kiedyś sie przyda
        ShowEnergyUsed: !!row.ShowEnergyUsed,
        ShowEnergyProduced: !!row.ShowEnergyProduced,
        ShowEnergyPurchased: !!row.ShowEnergyPurchased,
      });
    } catch (err) {
      console.error("Błąd przy /chartData:", err);
      res.send(500, { error: "Błąd pobierania danych wykresu." });
    }
  });
};

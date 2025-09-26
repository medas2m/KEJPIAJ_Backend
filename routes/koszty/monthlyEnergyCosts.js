module.exports = (server, pool, sql) => {
  server.get("/monthlyEnergyCosts", async (req, res) => {
    const { sourceTables, currentDate, compareDate } = req.query;

    if (!sourceTables || !currentDate || !compareDate) {
      return res.send(400, {
        error:
          "Wymagane parametry: sourceTables (array JSON), currentDate, compareDate (format: YYYY-MM-DD)",
      });
    }

    let parsedTables;
    try {
      parsedTables = JSON.parse(sourceTables);
    } catch (err) {
      return res.send(400, {
        error: "sourceTables musi być poprawną tablicą JSON.",
      });
    }

    parsedTables = [
      ...new Set(
        (Array.isArray(parsedTables) ? parsedTables : [])
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean)
      ),
    ];

    if (parsedTables.length === 0) {
      return res.send(200, []); // nic do zwrócenia
    }

    const curr = new Date(currentDate);
    const comp = new Date(compareDate);

    const currentYear = curr.getFullYear();
    const compareYear = comp.getFullYear();

    const results = [];

    for (const table of parsedTables) {
      const query = `
        DECLARE @EnergyCostPerKwh FLOAT = (
          SELECT CAST(ParamValue AS FLOAT)
          FROM [KEJPIAJ].[dbo].[A_SYS_PARAMS]
          WHERE ParamName = 'ENERGY_COST_PER_KWH'
        );

        DECLARE @sourceTable NVARCHAR(100) = @sourceTableInput;
        DECLARE @currentYear INT = @currentYearInput;
        DECLARE @compareYear INT = @compareYearInput;

        WITH Months AS (
          SELECT number AS MonthNumber
          FROM master.dbo.spt_values
          WHERE type = 'P' AND number BETWEEN 1 AND 12
        ),
        PreviousYear AS (
          SELECT 
            MONTH([Date]) AS MonthNumber,
            SUM(TotalIncrement) OVER (
              ORDER BY MONTH([Date])
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) * @EnergyCostPerKwh AS PrevCostToDate,
            SUM(TotalIncrement) OVER () * @EnergyCostPerKwh AS PrevYearTotalCost
          FROM AggregatedDataMonthly
          WHERE 
            SourceTable = @sourceTable
            AND YEAR([Date]) = @compareYear
        ),
        CurrentYearBase AS (
          SELECT 
            MONTH([Date]) AS MonthNumber,
            SUM(TotalIncrement) OVER (
              ORDER BY MONTH([Date])
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) * @EnergyCostPerKwh AS CurrCostToDate
          FROM AggregatedDataMonthly
          WHERE 
            SourceTable = @sourceTable
            AND YEAR([Date]) = @currentYear
        ),
        LastAvailableCurrent AS (
          SELECT TOP 1
            MONTH([Date]) AS LastMonthWithData,
            SUM(TotalIncrement) OVER (
              ORDER BY MONTH([Date])
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) * @EnergyCostPerKwh AS LastKnownCost
          FROM AggregatedDataMonthly
          WHERE 
            SourceTable = @sourceTable
            AND YEAR([Date]) = @currentYear
          ORDER BY [Date] DESC
        ),
        CurrentYear AS (
          SELECT 
            m.MonthNumber,
            ISNULL(c.CurrCostToDate, lac.LastKnownCost) AS CurrCostToDate,
            CASE 
              WHEN c.CurrCostToDate IS NULL THEN CAST(1 AS BIT)
              ELSE CAST(0 AS BIT)
            END AS IsEstimated
          FROM Months m
          LEFT JOIN CurrentYearBase c ON m.MonthNumber = c.MonthNumber
          CROSS APPLY LastAvailableCurrent lac
        )
        SELECT 
          @sourceTable AS Source,
          DATEFROMPARTS(@compareYear, m.MonthNumber, 1) AS PrevMonthStart,
          p.PrevCostToDate,
          p.PrevYearTotalCost,
          DATEFROMPARTS(@currentYear, m.MonthNumber, 1) AS CurrMonthStart,
          c.CurrCostToDate,
          c.IsEstimated
        FROM Months m
        LEFT JOIN PreviousYear p ON m.MonthNumber = p.MonthNumber
        LEFT JOIN CurrentYear c ON m.MonthNumber = c.MonthNumber
        ORDER BY m.MonthNumber;
      `;

      try {
        const queryResult = await pool
          .request()
          .input("sourceTableInput", sql.NVarChar, table)
          .input("currentYearInput", sql.Int, currentYear)
          .input("compareYearInput", sql.Int, compareYear)
          .query(query);

        results.push({
          source: table,
          data: queryResult.recordset,
        });
      } catch (err) {
        console.error(`Błąd SQL dla tabeli ${table}:`, err);
        results.push({
          source: table,
          error: `Błąd pobierania danych dla ${table}`,
        });
      }
    }

    res.send(200, results);
  });
};

module.exports = (server, pool, sql) => {
  server.get("/energyCosts", async (req, res) => {
    const { sourceTables, currentDate, compareDate } = req.query;

    if (!sourceTables || !currentDate || !compareDate) {
      return res.send(400, {
        error:
          "Wymagane parametry: sourceTables (JSON array), currentDate, compareDate",
      });
    }

    let tableList;
    try {
      tableList = JSON.parse(sourceTables);
    } catch {
      return res.send(400, {
        error: "sourceTables musi być poprawną tablicą JSON.",
      });
    }

    // normalizacja: usuwamy falsy i duplikaty oraz przycinamy spacje
    tableList = [
      ...new Set(
        (Array.isArray(tableList) ? tableList : [])
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean)
      ),
    ];

    // jeżeli po normalizacji nic nie ma – nic nie liczymy
    if (tableList.length === 0) {
      return res.send(200, []); // nic do zwrócenia
    }

    const curr = new Date(currentDate);
    const comp = new Date(compareDate);
    const currentYear = curr.getFullYear();
    const currentMonth = curr.getMonth() + 1;
    const compareYear = comp.getFullYear();
    const compareMonth = comp.getMonth() + 1;

    const queryTemplate = `
      DECLARE @EnergyCostPerKwh FLOAT = (
        SELECT CAST(ParamValue AS FLOAT)
        FROM [KEJPIAJ].[dbo].[A_SYS_PARAMS]
        WHERE ParamName = 'ENERGY_COST_PER_KWH'
      );

      DECLARE @sourceTable NVARCHAR(100) = @table;
      DECLARE @currentMonth INT = @cMonth;
      DECLARE @currentYear INT = @cYear;
      DECLARE @compareMonth INT = @pMonth;
      DECLARE @compareYear INT = @pYear;

      DECLARE @maxCurrDay INT = DAY(EOMONTH(DATEFROMPARTS(@currentYear, @currentMonth, 1)));
      DECLARE @maxCompDay INT = DAY(EOMONTH(DATEFROMPARTS(@compareYear, @compareMonth, 1)));
      DECLARE @maxDays INT = CASE WHEN @maxCurrDay > @maxCompDay THEN @maxCurrDay ELSE @maxCompDay END;

      WITH DaysCurr AS (
        SELECT number AS DayOfMonth
        FROM master.dbo.spt_values
        WHERE type = 'P' AND number BETWEEN 1 AND @maxDays
      ),
      PreviousMonth AS (
        SELECT 
          [Date] AS PrevDate,
          DAY([Date]) AS DayOfMonth,
          SUM(TotalIncrement) OVER (
            ORDER BY [Date]
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) * @EnergyCostPerKwh AS PrevCumCost,
          SUM(TotalIncrement) OVER () * @EnergyCostPerKwh AS PrevMonthTotal
        FROM AggregatedDataDaily
        WHERE 
          SourceTable = @sourceTable
          AND MONTH([Date]) = @compareMonth
          AND YEAR([Date]) = @compareYear
      ),
      CurrentMonthBase AS (
        SELECT 
          [Date] AS CurrDate,
          DAY([Date]) AS DayOfMonth,
          SUM(TotalIncrement) OVER (
            ORDER BY [Date]
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) * @EnergyCostPerKwh AS CurrCumCost
        FROM AggregatedDataDaily
        WHERE 
          SourceTable = @sourceTable
          AND MONTH([Date]) = @currentMonth
          AND YEAR([Date]) = @currentYear
      ),
      LastAvailableCurrent AS (
        SELECT TOP 1 
          DAY(CurrDate) AS LastDay,
          CurrCumCost
        FROM CurrentMonthBase
        ORDER BY CurrDate DESC
      ),
      CurrentMonth AS (
        SELECT 
          d.DayOfMonth,
          MAX(c.CurrDate) AS CurrDate,
          ISNULL(MAX(c.CurrCumCost), 
            CASE WHEN EXISTS(SELECT 1 FROM CurrentMonthBase) AND d.DayOfMonth <= lac.LastDay THEN lac.CurrCumCost ELSE NULL END
          ) AS CurrCostToDate
        FROM DaysCurr d
        LEFT JOIN CurrentMonthBase c ON d.DayOfMonth = c.DayOfMonth
        OUTER APPLY (
          SELECT TOP 1 LastDay, CurrCumCost 
          FROM LastAvailableCurrent
        ) lac
        GROUP BY d.DayOfMonth, lac.LastDay, lac.CurrCumCost
      )
      SELECT 
        @sourceTable AS Source,
        CASE 
          WHEN dc.DayOfMonth <= @maxCompDay 
            THEN DATEFROMPARTS(@compareYear, @compareMonth, dc.DayOfMonth)
          ELSE NULL 
        END AS PrevFullDate,
        p.PrevDate,
        p.PrevCumCost AS PrevCostToDate,
        p.PrevMonthTotal AS PrevMonthTotalCost,
        CASE 
          WHEN dc.DayOfMonth <= @maxCurrDay 
            THEN DATEFROMPARTS(@currentYear, @currentMonth, dc.DayOfMonth)
          ELSE NULL 
        END AS CurrFullDate,
        c.CurrCostToDate
      FROM DaysCurr dc
      LEFT JOIN PreviousMonth p ON dc.DayOfMonth = p.DayOfMonth
      LEFT JOIN CurrentMonth c ON dc.DayOfMonth = c.DayOfMonth
      WHERE (dc.DayOfMonth <= @maxCompDay AND p.PrevDate IS NOT NULL) 
         OR (dc.DayOfMonth <= @maxCurrDay AND c.CurrCostToDate IS NOT NULL)
      ORDER BY dc.DayOfMonth;
    `;

    try {
      const fullData = [];

      for (const tableName of tableList) {
        const result = await pool
          .request()
          .input("table", sql.NVarChar, tableName)
          .input("cMonth", sql.Int, currentMonth)
          .input("cYear", sql.Int, currentYear)
          .input("pMonth", sql.Int, compareMonth)
          .input("pYear", sql.Int, compareYear)
          .query(queryTemplate);

        fullData.push({ source: tableName, data: result.recordset });
      }

      res.send(200, fullData);
    } catch (error) {
      console.error("SQL error:", error);
      res.send(500, {
        error: "Błąd podczas pobierania danych kosztów energii.",
      });
    }
  });
};

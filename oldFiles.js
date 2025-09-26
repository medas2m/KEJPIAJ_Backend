// ten plik ma za zadanie trzymanie poprzednich wersji endpointów, które spełniły ważną rolę

//   server.get("/sumForYearFromCache", async (req, res) => {
//     console.log("Received query parameters:", req.query);

//     const dateParam = req.query.date;
//     if (!dateParam) {
//       res.status(400).send("Date parameter is required.");
//       return;
//     }

//     const providedDate = new Date(dateParam);
//     const startDate = new Date(providedDate.getFullYear(), 0, 1); // Pierwszy dzień roku
//     const endDate = new Date(providedDate.getFullYear() + 1, 0, 1); // Pierwszy dzień następnego roku

//     const startDateStr = startDate.toISOString().split("T")[0];
//     const endDateStr = endDate.toISOString().split("T")[0];

//     const query = `
//     SELECT
//         Year,
//         Month,
//         CASE
//             WHEN Typ = 1 THEN AVG(DailyIncrement)
//             ELSE SUM(DailyIncrement)
//         END AS DailyIncrement,
//         PreviousIncrement,
//         Rodzic,
//         Nazwa,
//         Nesting,
//         WSK,
//         Obiekt,
//         SourceTable,
//         Cel,
//         lp,
//         Prog_1,
//         Prog_2,
//         Prog_3,
//         JednostkaWsk,
//         kolor1,
//         kolor2,
//         Typ
//     FROM (
//         SELECT
//             YEAR(RoundedDate) AS Year,
//             MONTH(RoundedDate) AS Month,
//             DailyIncrement,
//             PreviousIncrement,
//             Rodzic,
//             Nazwa,
//             Nesting,
//             WSK,
//             Obiekt,
//             SourceTable,
//             Cel,
//             lp,
//             Prog_1,
//             Prog_2,
//             Prog_3,
//             JednostkaWsk,
//             kolor1,
//             kolor2,
//             Typ
//         FROM
//             CachedResults
//         WHERE
//             RoundedDate >= @startDate AND RoundedDate < @endDate
//     ) AS subquery
//     GROUP BY
//         Year,
//         Month,
//         Rodzic,
//         Nazwa,
//         Nesting,
//         DailyIncrement,
//         PreviousIncrement,
//         WSK,
//         Obiekt,
//         SourceTable,
//         Cel,
//         lp,
//         Prog_1,
//         Prog_2,
//         Prog_3,
//         JednostkaWsk,
//         kolor1,
//         kolor2,
//         Typ
//     ORDER BY
//         Year DESC,
//         Month DESC
// `;

//     console.log("SQL query:", query);

//     try {
//       const pool = await sql.connect(config);
//       const result = await pool
//         .request()
//         .input("startDate", sql.NVarChar, startDateStr)
//         .input("endDate", sql.NVarChar, endDateStr)
//         .query(query);

//       res.send(result.recordset);
//     } catch (error) {
//       console.error("SQL error", error);
//       res.status(500).send("Internal Server Error");
//     }
//   });

/* TEN ENDPOIN BYŁ UŻYWANY DO 07.05.2025
       
       server.get("/fetchWskData/:tabela", (req, res, next) => {
        const tabelaParam = req.params.tabela;
        pool
          .request()
          .query(
            `
                SELECT 
                    lp,
                    Obiekt,
                    Nazwa,
                    Jednostka,
                    Zmienna,
                    Tabela,
                    nesting,
                    Rodzic,
                    WSK,
                    Cel,
                    Opis,
                    Opiekun,
                    Prog_1,
                    Prog_2,
                    Prog_3,
                    NazwaWsk,
                    Typ,
                    Glebokosc,
                    JednostkaWsk,
                    kolor1,
                    kolor2,
                    ZmiennaPom
                FROM [KEJPIAJ].[dbo].[A_DANE_POMIAROWE]
                WHERE tabela = @tabela
            `,
            (err, result) => {
              if (err) {
                console.error(err);
                res.send(500, err);
              } else {
                res.send(result.recordset);
              }
              next();
            }
          )
          .input("tabela", sql.NVarChar(50), tabelaParam);
      }); */

/* server.get("/sumForYearFromCache", async (req, res) => {
        console.log("Received query parameters:", req.query);

        const dateParam = req.query.date;
        if (!dateParam) {
          res.send(400, "Date parameter is required.");
          return;
        }

        const providedDate = new Date(dateParam);
        const startDate = new Date(providedDate.getFullYear(), 0, 1); // Pierwszy dzień roku
        const endDate = new Date(providedDate.getFullYear() + 1, 0, 1); // Pierwszy dzień następnego roku

        const startDateStr = startDate.toISOString().split("T")[0];
        const endDateStr = endDate.toISOString().split("T")[0];

        const query = `
        SELECT
        Year,
        SUM(DailyIncrement) AS DailyIncrement,
        SUM(PreviousIncrement) AS PreviousIncrement,
        Rodzic,
        Nazwa,
        Nesting,
        WSK,
        Obiekt,
        Cel,
        lp,
        Prog_1,
        Prog_2,
        Prog_3,
        JednostkaWsk,
        kolor1,
        kolor2,
  SourceTable
      FROM
        [KEJPIAJ].[dbo].[_AggregatedDataYearlyView]
      WHERE
        YEAR >=2024 AND YEAR < 2025
      GROUP BY
        Year,
        Rodzic,
        Nazwa,
        Nesting,
        WSK,
        Obiekt,
        Cel,
        lp,
        Prog_1,
        Prog_2,
        Prog_3,
        JednostkaWsk,
        kolor1,
        kolor2,
  SourceTable
      ORDER BY
        Year DESC
        `;

        console.log("SQL query:", query);

        try {
          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("startDate", sql.DateTime, startDate)
            .input("endDate", sql.DateTime, endDate)
            .query(query);

          res.send(result.recordset);
        } catch (error) {
          console.error("SQL error", error);
          res.send(500, "Internal Server Error");
        }
      }); */

/* server.get("/dataForYear", (req, res, next) => {
        console.log("Received query parameters:", req.query);

        const dateParam = req.query.date;
        const tableName = req.query.tableName;

        if (!dateParam) {
          res.send(400, "Date parameter is required.");
          return next();
        }

        if (!tableName) {
          res.send(400, "tableName parameter is required.");
          return next();
        }

        // Tworzenie zakresu dla całego roku
        const startDate = new Date(dateParam);
        const year = startDate.getFullYear(); // Pobieranie roku z daty

        const query = `
            SELECT 
                YEAR(RoundedDate) AS Year,
                MONTH(RoundedDate) AS Month,
                SUM(DailyIncrement) AS HourlyIncrementValue
            FROM 
                dbo._AggregatedDataMonthlyView
            WHERE 
                YEAR(RoundedDate) = @Year
                AND SourceTable = @TableName
            GROUP BY 
                YEAR(RoundedDate), MONTH(RoundedDate)
            ORDER BY 
                MONTH(RoundedDate)
        `;

        pool
          .request()
          .input("Year", sql.Int, year)
          .input("TableName", sql.NVarChar, tableName)
          .query(query)
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      }); */

/* server.get("/dataForGivenDate", (req, res, next) => {
        const dateParam = req.query.date;

        if (!dateParam) {
          res.send(400, "Date parameter is required.");
          return next();
        }

        const query = `
                SELECT * FROM vw_EnergiaWithDate WHERE [date] = @inputDate
            `;

        pool
          .request()
          .input("inputDate", sql.Date, dateParam)
          .query(query)
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      }); */

/* server.get("/pomiary", (req, res, next) => {
        pool
          .request()
          .query(
            "SELECT [id], [tabela_zrodlowa], [opis] FROM [KEJPIAJ].[dbo].[A_Pomiary]"
          )
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      }); */

/* server.get("/obiekty", (req, res, next) => {
        pool
          .request()
          .query(
            "SELECT [Id], [Nazwa], [Opis], [Typ] FROM [KEJPIAJ].[dbo].[A_Obiekty]"
          )
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      }); */

/* server.get("/DanePomiarowe", (req, res, next) => {
        pool
          .request()
          .query(
            `WITH YesterdayValue AS (
                    SELECT SourceTable, DailyIncrement AS YesterdayValue
                    FROM CachedResults
                    WHERE RoundedDate = '2023-10-11'
                ),
                
                AvgValue30 AS (
                    SELECT 
                        cr.SourceTable, 
                        ROUND(
                          CASE 
                            WHEN dp.Jednostka IN ('%', 'm3/kWh') THEN AVG(cr.DailyIncrement)/30 
                            ELSE AVG(cr.DailyIncrement) 
                          END, 
                          1) AS AvgValueLast30Days
                    FROM CachedResults cr
                    JOIN A_DANE_POMIAROWE dp ON cr.SourceTable = dp.Tabela
                    WHERE RoundedDate BETWEEN DATEADD(DAY, -30, CAST(GETDATE() AS DATE)) AND CAST(GETDATE() AS DATE)
                    GROUP BY cr.SourceTable, dp.Jednostka
                ),
                
                AvgValue90 AS (
                    SELECT 
                        cr.SourceTable, 
                        ROUND(
                          CASE 
                            WHEN dp.Jednostka IN ('%', 'm3/kWh') THEN AVG(cr.DailyIncrement)/90 
                            ELSE AVG(cr.DailyIncrement) 
                          END, 
                          1) AS AvgValueLast90Days
                    FROM CachedResults cr
                    JOIN A_DANE_POMIAROWE dp ON cr.SourceTable = dp.Tabela
                    WHERE RoundedDate BETWEEN DATEADD(DAY, -90, CAST(GETDATE() AS DATE)) AND CAST(GETDATE() AS DATE)
                    GROUP BY cr.SourceTable, dp.Jednostka
                )
                
                SELECT 
                    yv.YesterdayValue,
                    av30.AvgValueLast30Days,
                    av90.AvgValueLast90Days,
                    dp.*,
                    u.FirstName + ' ' + u.LastName AS Opiekun
                FROM A_DANE_POMIAROWE dp
                LEFT JOIN YesterdayValue yv ON dp.Tabela = yv.SourceTable
                LEFT JOIN AvgValue30 av30 ON dp.Tabela = av30.SourceTable
                LEFT JOIN AvgValue90 av90 ON dp.Tabela = av90.SourceTable
                LEFT JOIN A_Users u ON dp.Opiekun = u.UserID
                WHERE dp.Tabela IS NOT NULL 
                ORDER BY dp.Obiekt ASC;
                ;`
          )
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      }); */

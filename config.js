const restify = require("restify");
const sql = require("mssql");
const corsMiddleware = require("restify-cors-middleware");
const energyCostsRoutes = require("./routes/koszty/energyCosts");
const chartDataRoutes = require("./routes/koszty/chartData");
const costOfEnergyRoutes = require("./routes/koszty/costOfEnergy");
const monthlyEnergyCostsRoutes = require("./routes/koszty/monthlyEnergyCosts");
const userByEditLevel = require("./routes/WSK/usersByEditLevel");
const fetchWskData = require("./routes/WSK/fetchWskData");
const errorLogRoutes = require("./routes/ErrorLogs/errorLog");
const versionHistoryRoutes = require("./routes/VersionsHistory/versionHistory");
const medasDataImportRoutes = require("./routes/MedasDataImport/medasDataImport");

const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser());

const config = {
  user: "KEJPIAJ",
  password: "kejpiaj!234",
  server: "172.16.155.226",
  database: "KEJPIAJ",
  options: {
    encrypt: false,
  },
};

// const config = {
//   user: "KEJPIAJ",
//   password: "kejpiaj!234",
//   server: "172.16.155.226\\KEJPIAJ",
//   database: "KEJPIAJ",
//   options: {
//     encrypt: false,
//   },
// };

/* const config = {
  user: 'MEDAS',
  password: 'Sadem12#',
  server: '192.168.100.4\\sql2016',
  database: 'kejpiaj',
  options: {
      encrypt: false,
  },
  requestTimeout: 450000, // Domyślny timeout 15 sekund
};  */

const cors = corsMiddleware({
  origins: ["*"], // Dopuszczalne źródła
  allowHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"], // Dopuszczalne nagłówki
  exposeHeaders: [],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Dopuszczalne metody
  preflightMaxAge: 5, // Opcjonalnie: max age (w sekundach)
  preflight: true,
});

server.pre(cors.preflight);
server.use(cors.actual);

try {
  sql
    .connect(config)
    .then((pool) => {
      console.log("Connected to database");
      energyCostsRoutes(server, pool, sql); // endpoint pod koszty gdzie daje nazwe aliasa, date i rok i otrzymuje wartości
      chartDataRoutes(server, pool, sql); // endpoint dla kosztów aby otrzymać nazwy aliasów pod wykres
      costOfEnergyRoutes(server, pool, sql); // endpoint, który ustawia jaki jest koszt 1kwh i tak przemnaża dane
      monthlyEnergyCostsRoutes(server, pool, sql); // endpoint, który daje mi dane dla roku w kosztach
      userByEditLevel(
        server,
        pool,
        sql
      ); /* endpoint, który Zwraca listę użytkowników z tabeli [A_Users], 
      opcjonalnie filtrując ich na podstawie poziomu uprawnień do edycji (EditPermissionLevel). */
      fetchWskData(
        server,
        pool,
        sql
      ); /* Zwraca dane z tabeli A_DANE_POMIAROWE na podstawie parametru `tabela`.
       Dołącza dane użytkownika (Opiekun) z tabeli A_Users przez LEFT JOIN. */
      errorLogRoutes(server, pool, sql);
      versionHistoryRoutes(server, pool, sql);
      medasDataImportRoutes(server, pool, sql); // zdarzenia systemowe w headerze na froncie i w menu akcji

      server.get("/users", (req, res, next) => {
        pool
          .request()
          .query(
            "SELECT [UserID], [FirstName], [LastName], [Login], [PermissionLevel], [EditPermissionLevel] FROM [KEJPIAJ].[dbo].[A_Users]"
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
      });

      const bcrypt = require("bcrypt");
      const jwt = require("jsonwebtoken");

      server.post("/login", (req, res, next) => {
        const { Login, Password } = req.body;

        pool
          .request()
          .input("Login", sql.NVarChar(100), Login)
          .query(
            "SELECT HashedPassword, PermissionLevel, UserId, FirstName, LastName FROM A_Users WHERE Login = @Login"
          )
          .then((result) => {
            if (result.recordset.length === 0) {
              res.send(404, "User not found.");
              return next();
            }

            const hashedPasswordFromDB = result.recordset[0].HashedPassword;
            const permissionLevel = result.recordset[0].PermissionLevel;
            const userId = result.recordset[0].UserId;
            const firstName = result.recordset[0].FirstName;
            const lastName = result.recordset[0].LastName;

            bcrypt.compare(Password, hashedPasswordFromDB, (err, isMatch) => {
              if (err) {
                res.send(500, "Error comparing passwords.");
                return next();
              }

              if (isMatch) {
                const token = jwt.sign(
                  {
                    Login: Login,
                    permissionLevel: permissionLevel,
                    userId: userId,
                    firstName: firstName,
                    lastName: lastName,
                  },
                  "SECRET_KEY",
                  { expiresIn: "1h" }
                );

                res.send(200, {
                  message: "Login successful.",
                  token: token,
                  permissionLevel: permissionLevel,
                  userId: userId,
                  firstName: firstName,
                  lastName: lastName,
                });
              } else {
                res.send(401, "Incorrect password.");
              }
              next();
            });
          })
          .catch((err) => {
            console.error(err);
            res.send(500, "Error querying the database.");
            next();
          });
      });

      server.post("/addNotatka", (req, res, next) => {
        const { Data, Tresc, Autor, ADP_Lp } = req.body;

        pool
          .request()
          .input("Data", sql.DateTime, Data)
          .input("Tresc", sql.Text, Tresc)
          .input("Autor", sql.NVarChar(255), Autor)
          .input("ADP_Lp", sql.Int, ADP_Lp)
          .query(
            `INSERT INTO Notatki (Data, Tresc, Autor, ADP_Lp)
                        VALUES (@Data, @Tresc, @Autor, @ADP_Lp)`
          )
          .then((result) => {
            res.send(200, "Notatka added successfully.");
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      });

      server.get("/WSK", (req, res, next) => {
        pool
          .request()
          .query("SELECT * FROM A_Wskazniki")
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      });

      server.get("/getADanePomiarowe", (req, res, next) => {
        pool
          .request()
          .query(
            `
              SELECT dp.*, ao.Kolor AS objectColor
              FROM [KEJPIAJ].[dbo].[A_DANE_POMIAROWE] dp
              LEFT JOIN [KEJPIAJ].[dbo].[A_Obiekty] ao ON dp.IDObiektu = ao.Id
              ORDER BY dp.Tabela ASC
            `
          )
          .then((result) => {
            res.send(
              result.recordset.map((row) => ({
                lp: row.lp,
                obiekt: row.Obiekt,
                nazwa: row.Nazwa,
                jednostka: row.Jednostka,
                zmienna: row.Zmienna,
                tabela: row.Tabela,
                nesting: row.nesting,
                rodzic: row.Rodzic,
                wsk: row.WSK,
                cel: row.Cel,
                opis: row.Opis,
                opiekun: row.Opiekun,
                prog_1: row.Prog_1,
                prog_2: row.Prog_2,
                prog_3: row.Prog_3,
                nazwaWsk: row.NazwaWsk,
                typ: row.Typ,
                glebokosc: row.Glebokosc,
                jednostkaWsk: row.JednostkaWsk,
                kolor1: row.kolor1,
                kolor2: row.kolor2,
                zmiennaPom: row.ZmiennaPom,
                mainColor: row.MainColor,
                nazwa2: row.Nazwa2,
                bgChartTypeSeries: row.bgChartTypeSeries,
                objectColor: row.objectColor,
              }))
            );
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      });

      server.get("/DanePomiarowe", (req, res, next) => {
        pool
          .request()
          .query(
            `WITH YesterdayValue AS (
              SELECT SourceTable, DailyIncrement AS YesterdayValue
              FROM [_AggregatedDataDailyView]
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
                      2) AS AvgValueLast30Days -- Zaokrąglenie do 2 miejsc po przecinku
              FROM [_AggregatedDataDailyView] cr
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
                      2) AS AvgValueLast90Days -- Zaokrąglenie do 2 miejsc po przecinku
              FROM [_AggregatedDataDailyView] cr
              JOIN A_DANE_POMIAROWE dp ON cr.SourceTable = dp.Tabela
              WHERE RoundedDate BETWEEN DATEADD(DAY, -90, CAST(GETDATE() AS DATE)) AND CAST(GETDATE() AS DATE)
              GROUP BY cr.SourceTable, dp.Jednostka
          )
          
          SELECT 
              yv.YesterdayValue,
              av30.AvgValueLast30Days,
              av90.AvgValueLast90Days,
              dp.*,
              ob.Kolor AS objectColor,
              u.FirstName + ' ' + u.LastName AS Opiekun
          FROM A_DANE_POMIAROWE dp
          LEFT JOIN YesterdayValue yv ON dp.Tabela = yv.SourceTable
          LEFT JOIN AvgValue30 av30 ON dp.Tabela = av30.SourceTable
          LEFT JOIN AvgValue90 av90 ON dp.Tabela = av90.SourceTable
          LEFT JOIN A_Users u ON dp.Opiekun = u.UserID
          LEFT JOIN A_Obiekty ob ON dp.ObjectNameAlternative = ob.Obiekt
          WHERE dp.Tabela IS NOT NULL 
          ORDER BY dp.ObjectNameAlternative ASC;`
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
      });

      server.post("/addKPI", (req, res, next) => {
        const {
          Id_pomiaru,
          Id_Obiektu,
          Cel,
          Opis,
          Opiekun,
          Prog_1,
          Prog_2,
          Prog_3,
          Nazwa,
          Typ,
          Glebokosc,
          Jednostka,
          Nazwa2,
        } = req.body;

        pool
          .request()
          .input("Id_pomiaru", sql.Int, Id_pomiaru)
          .input("Id_Obiektu", sql.Int, Id_Obiektu)
          .input("Cel", sql.NVarChar(255), Cel)
          .input("Opis", sql.NVarChar(sql.MAX), Opis)
          .input("Opiekun", sql.NVarChar(255), Opiekun)
          .input("Prog_1", sql.Decimal(18, 2), Prog_1)
          .input("Prog_2", sql.Decimal(18, 2), Prog_2)
          .input("Prog_3", sql.Decimal(18, 2), Prog_3)
          .input("Nazwa", sql.NVarChar(255), Nazwa)
          .input("Nazwa2", sql.NVarChar(255), Nazwa2)
          .input("Typ", sql.NVarChar(50), Typ)
          .input("Glebokosc", sql.Int, Glebokosc)
          .input("Jednostka", sql.NVarChar(50), Jednostka)
          .query(
            `INSERT INTO A_Wskazniki (Id_pomiaru, Id_Obiektu, Cel, Opis, Opiekun, Prog_1, Prog_2, Prog_3, Nazwa, Nazwa2, Typ, Glebokosc, Jednostka)
                        VALUES (@Id_pomiaru, @Id_Obiektu, @Cel, @Opis, @Opiekun, @Prog_1, @Prog_2, @Prog_3, @Nazwa, @Nazwa2, @Typ, @Glebokosc, @Jednostka)`
          )
          .then((result) => {
            res.send(200, "Indicator added successfully.");
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      });

      server.put("/updateKPI/:lp", (req, res, next) => {
        const {
          lp,
          Nazwa,
          Nazwa2,
          Jednostka,
          Opis,
          Prog1,
          Prog2,
          Prog3,
          color1,
          color2,
          Cel,
          DataRealizacji,
          Opiekun,
          ZmiennaSkorelowana,
        } = req.body;

        pool
          .request()
          .input("lp", sql.Int, lp)
          .input("Nazwa", sql.NVarChar(255), Nazwa)
          .input("Nazwa2", sql.NVarChar(255), Nazwa2)
          .input("Jednostka", sql.NVarChar(50), Jednostka)
          .input("Opis", sql.NVarChar(255), Opis)
          .input("Prog_1", sql.Decimal(18, 2), Prog1)
          .input("Prog_2", sql.Decimal(18, 2), Prog2)
          .input("Prog_3", sql.Decimal(18, 2), Prog3)
          .input("kolor1", sql.NVarChar(25), color1)
          .input("kolor2", sql.NVarChar(25), color2)
          .input("Cel", sql.Decimal(10, 2), Cel)
          .input("Opiekun", sql.Int, Opiekun)
          .input("ZmiennaPom", sql.NVarChar(25), ZmiennaSkorelowana)
          .query(
            `
                    UPDATE A_DANE_POMIAROWE
                    SET Nazwa = @Nazwa, Nazwa2 = @Nazwa2, Jednostka = @Jednostka, Opis = @Opis, Prog_1 = @Prog_1, Prog_2 = @Prog_2, Prog_3 = @Prog_3,
                        kolor1 = @kolor1, kolor2 = @kolor2, Cel = @Cel, Opiekun = @Opiekun, ZmiennaPom = @ZmiennaPom
                    WHERE lp = @lp
                `
          )
          .then((result) => {
            res.send(200, "Data updated successfully.");
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      });

      //Dane dobowe

      server.get("/dataForDay", (req, res, next) => {
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

        // Konwersja daty z parametru do formatu 'YYYY-MM-DD'
        const date = new Date(dateParam);
        const formattedDate = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'

        // Kwerenda SQL z ustawieniem godziny na 00:00
        const query = `
            WITH Hours AS (
                SELECT 0 AS Hour
                UNION ALL
                SELECT Hour + 1 FROM Hours WHERE Hour < 23
            )
            SELECT 
                H.Hour, 
                COALESCE(T.HourlyIncrement, 0) AS HourlyIncrementValue
            FROM 
                Hours H
            LEFT JOIN 
                ${tableName} T ON DATEPART(HOUR, T.RoundedTime) = H.Hour 
                AND T.RoundedTime >= '${formattedDate} 00:00:00.000' 
                AND T.RoundedTime < DATEADD(DAY, 1, '${formattedDate} 00:00:00.000')
            ORDER BY 
                H.Hour
        `;

        console.log("Executing SQL Query:", query);

        pool
          .request()
          .query(query)
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error("SQL Query Error:", err);
            res.send(500, err);
            next();
          });
      });

      function formatDateToSQLString(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(date.getDate()).padStart(2, "0")}`;
      }

      server.get("/dataForMonth", (req, res, next) => {
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

        // Tworzenie zakresu dla całego miesiąca
        const startDate = new Date(dateParam);
        startDate.setUTCHours(0, 0, 0, 0); // Ustawienie godziny na 00:00 UTC
        startDate.setDate(1); // Ustawienie na pierwszy dzień miesiąca

        const today = new Date();
        let endDate;

        // Sprawdzenie, czy to jest bieżący miesiąc
        if (
          startDate.getMonth() === today.getMonth() &&
          startDate.getFullYear() === today.getFullYear()
        ) {
          // Ustawienie na bieżący dzień - 1
          endDate = new Date(today);
          endDate.setUTCHours(0, 0, 0, 0);
          endDate.setDate(today.getDate() - 1);
        } else {
          // Ustawienie na ostatni dzień miesiąca
          endDate = new Date(startDate);
          endDate.setMonth(startDate.getMonth() + 1); // Przejście do następnego miesiąca
          endDate.setDate(0); // Ustawienie na ostatni dzień poprzedniego miesiąca (tj. ostatni dzień bieżącego miesiąca)
          endDate.setUTCHours(23, 59, 59, 999); // Ustawienie na koniec ostatniego dnia miesiąca
        }

        const startDateString = startDate.toISOString().split("T")[0];
        const endDateString = endDate.toISOString().split("T")[0];

        const query = `
            ;WITH DateRange AS (
                SELECT CAST('${startDateString}' AS DATE) AS Day
                UNION ALL
                SELECT DATEADD(DAY, 1, Day)
                FROM DateRange
                WHERE DATEADD(DAY, 1, Day) <= '${endDateString}'
            )
            SELECT 
                dr.Day, 
                ISNULL(ad.DailyIncrement, 0) AS HourlyIncrementValue
            FROM 
                DateRange dr
            LEFT JOIN 
                dbo._AggregatedDataDailyView ad
                ON dr.Day = ad.RoundedDate
                AND ad.SourceTable = @tableName
            ORDER BY 
                dr.Day
            OPTION (MAXRECURSION 0);
        `;

        // Logowanie kwerendy SQL
        console.log("SQL Query:", query);
        console.log("Start Date:", startDateString);
        console.log("End Date:", endDateString);

        pool
          .request()
          .input("tableName", sql.NVarChar, tableName)
          .query(query)
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error("SQL error: ", err);
            res.send(500, `Error executing SQL query: ${err.message}`);
            next();
          });
      });

      server.get("/dataForYear", (req, res, next) => {
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
            ;WITH MonthRange AS (
                SELECT 1 AS Month
                UNION ALL
                SELECT Month + 1
                FROM MonthRange
                WHERE Month < 12
            )
            SELECT 
                @Year AS Year,
                mr.Month,
                ISNULL(SUM(ad.DailyIncrement), 0) AS HourlyIncrementValue
            FROM 
                MonthRange mr
            LEFT JOIN 
                dbo._AggregatedDataMonthlyView ad
                ON YEAR(ad.RoundedDate) = @Year
                AND MONTH(ad.RoundedDate) = mr.Month
                AND ad.SourceTable = @TableName
            GROUP BY 
                mr.Month
            ORDER BY 
                mr.Month
            OPTION (MAXRECURSION 0);
        `;

        // Logowanie kwerendy SQL
        console.log("SQL Query:", query);
        console.log("Year:", year);

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
      });

      server.get("/dataForDayFromCache", async (req, res) => {
        /* console.log("Received query parameters:", req.query); */

        const dateParam = req.query.date;
        if (!dateParam) {
          res.status(400).send("Date parameter is required.");
          return;
        }

        const startDate = new Date(dateParam);
        startDate.setHours(0, 0, 0, 0); // Set start of the day

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
        endDate.setHours(0, 0, 0, 0); // Set start of the next day

        // Adjusted SQL query to include new columns
        const query = `
          SELECT 
            SourceTable,
            RoundedDate,
            DailyIncrement,
            PreviousIncrement,
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
            MainColor
          FROM 
            [KEJPIAJ].[dbo].[_AggregatedDataDailyView]
          WHERE 
            RoundedDate >= @startDate AND RoundedDate < @endDate
        `;

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
          res.status(500).send("Internal Server Error");
        }
      });

      server.get("/dataBySourceTableForDay", async (req, res) => {
        /* KARTA WSKAZNIKA -> WARTOSC DLA WYKRESU PIERWSZEGO PO LEWEJ STRONIE */

        const sourceTable = req.query.sourceTable;
        const dateParam = req.query.date;

        // Validate required parameters
        if (!sourceTable) {
          res.status(400).send("SourceTable parameter is required.");
          return;
        }
        if (!dateParam) {
          res.status(400).send("Date parameter is required.");
          return;
        }

        const startDate = new Date(dateParam);
        startDate.setHours(0, 0, 0, 0); // Set start of the day

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
        endDate.setHours(0, 0, 0, 0); // Set start of the next day

        // SQL query to fetch data based on SourceTable and time range
        const query = `
            SELECT 
                SourceTable,
                RoundedDate,
                DailyIncrement,
                PreviousIncrement,
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
                MainColor
            FROM 
                [KEJPIAJ].[dbo].[_AggregatedDataDailyView]
            WHERE 
                SourceTable = @sourceTable
                AND RoundedDate >= @startDate
                AND RoundedDate < @endDate
        `;

        try {
          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("sourceTable", sql.NVarChar, sourceTable) // Use sql.NVarChar for string inputs
            .input("startDate", sql.DateTime, startDate) // Bind startDate
            .input("endDate", sql.DateTime, endDate) // Bind endDate
            .query(query);

          res.send(result.recordset);
        } catch (error) {
          console.error("SQL error", error);
          res.status(500).send("Internal Server Error");
        }
      });

      server.get("/sumForMonthFromCache", async (req, res) => {
        console.log("Received query parameters:", req.query);

        const dateParam = req.query.date;
        if (!dateParam) {
          res.send(400, "Date parameter is required.");
          return;
        }

        const providedDate = new Date(dateParam);
        const startDate = new Date(
          providedDate.getFullYear(),
          providedDate.getMonth(),
          1
        ); // Pierwszy dzień miesiąca
        const endDate = new Date(
          providedDate.getFullYear(),
          providedDate.getMonth() + 1,
          1
        ); // Pierwszy dzień następnego miesiąca

        const startDateStr = startDate.toISOString().split("T")[0];
        const endDateStr = endDate.toISOString().split("T")[0];

        const query = `
          SELECT 
            YEAR(RoundedDate) AS Year,
            MONTH(RoundedDate) AS Month,
            DailyIncrement,
            PreviousIncrement,
            Rodzic,
            Nazwa,
            Nesting,
            WSK,
            Obiekt,
            SourceTable,
            Cel,
            lp,
            Prog_1,
            Prog_2,
            Prog_3,
            JednostkaWsk,
            kolor1,
            kolor2,
            MainColor
          FROM 
            [KEJPIAJ].[dbo].[_AggregatedDataMonthlyView]
          WHERE 
            RoundedDate >= @startDate AND RoundedDate < @endDate
        `;

        console.log("SQL query:", query);
        console.log("Start Date:", startDateStr);
        console.log("End Date:", endDateStr);

        try {
          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("startDate", sql.DateTime, startDate)
            .input("endDate", sql.DateTime, endDate)
            .query(query);

          res.send(200, result.recordset);
        } catch (error) {
          console.error("SQL error", error.message);
          res.send(500, `Internal Server Error: ${error.message}`);
        }
      });

      server.get("/dataBySourceTableForMonth", async (req, res) => {
        /* KARTA WSKAZNIKA -> WARTOSC DLA WYKRESU PIERWSZEGO PO LEWEJ STRONIE */
        const dateParam = req.query.date;
        const sourceTable = req.query.sourceTable;

        // Validate required parameters
        if (!dateParam) {
          return res.status(400).send("Date parameter is required.");
        }
        if (!sourceTable) {
          return res.status(400).send("SourceTable parameter is required.");
        }

        const providedDate = new Date(dateParam);
        const startDate = new Date(
          providedDate.getFullYear(),
          providedDate.getMonth(),
          1
        ); // First day of the month
        const endDate = new Date(
          providedDate.getFullYear(),
          providedDate.getMonth() + 1,
          1
        ); // First day of the next month

        // SQL query to fetch monthly summary by SourceTable
        const query = `
            SELECT 
                SourceTable,
                YEAR(RoundedDate) AS Year,
                MONTH(RoundedDate) AS Month,
                DailyIncrement,
                PreviousIncrement,
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
                MainColor
            FROM 
                [KEJPIAJ].[dbo].[_AggregatedDataMonthlyView]
            WHERE 
                RoundedDate >= @startDate 
                AND RoundedDate < @endDate
                AND SourceTable = @sourceTable
        `;

        try {
          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("startDate", sql.DateTime, startDate)
            .input("endDate", sql.DateTime, endDate)
            .input("sourceTable", sql.NVarChar, sourceTable)
            .query(query);

          res.send(200, result.recordset);
        } catch (error) {
          console.error("SQL error", error.message);
          res.send(500, `Internal Server Error: ${error.message}`);
        }
      });

      server.get("/sumForYearFromCache", async (req, res) => {
        console.log("Received query parameters:", req.query);

        const dateParam = req.query.date;
        if (!dateParam) {
          res.status(400).send("Date parameter is required.");
          return;
        }

        const providedDate = new Date(dateParam);
        const year = providedDate.getFullYear();

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
            Year = @year
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

        try {
          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("year", sql.Int, year)
            .query(query);

          res.send(result.recordset);
        } catch (error) {
          console.error("SQL error", error);
          res.status(500).send("Internal Server Error");
        }
      });

      server.get("/sumForYearBySourceTable", async (req, res) => {
        /* KARTA WSKAZNIKA -> WARTOSC DLA WYKRESU PIERWSZEGO PO LEWEJ STRONIE */
        console.log("Received query parameters:", req.query);

        const sourceTableParam = req.query.sourceTable;
        const dateParam = req.query.date;

        if (!sourceTableParam) {
          res.send("SourceTable parameter is required.");
          return;
        }

        if (!dateParam) {
          res.send("Date parameter is required.");
          return;
        }

        const providedDate = new Date(dateParam);
        const yearParam = providedDate.getFullYear();
        const nextYearParam = yearParam + 1;

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
      SourceTable = @sourceTableParam
      AND Year >= @yearParam
      AND Year < @nextYearParam
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
            .input("sourceTableParam", sql.VarChar, sourceTableParam)
            .input("yearParam", sql.Int, yearParam)
            .input("nextYearParam", sql.Int, nextYearParam)
            .query(query);

          res.send(result.recordset);
        } catch (error) {
          console.error("SQL error", error);
          res.send("Internal Server Error");
        }
      });

      server.get("/fetchObjectData", (req, res, next) => {
        pool
          .request()
          .query(
            "SELECT * FROM [KEJPIAJ].[dbo].[A_DANE_POMIAROWE] WHERE Rodzic like '%GOS%'"
          )
          .then((result) => {
            res.send(
              result.recordset.map((row) => ({
                lp: row.lp,
                obiekt: row.Obiekt,
                nazwa: row.Nazwa,
                jednostka: row.Jednostka,
                zmienna: row.Zmienna,
                tabela: row.Tabela,
                nesting: row.nesting,
                rodzic: row.Rodzic,
                WSK: row.WSK,
              }))
            );
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      });

      server.get("/notatki/:ADP_Lp", async (req, res) => {
        const adpLp = req.params.ADP_Lp;

        if (!adpLp) {
          res.send(400, { error: "Parametr ADP_Lp jest wymagany" });
          return;
        }

        try {
          let pool = await sql.connect(config);
          let result = await pool
            .request()
            .input("ADP_Lp", sql.Int, adpLp)
            .query("SELECT * FROM Notatki WHERE ADP_Lp = @ADP_Lp");

          res.send(200, result.recordset);
        } catch (err) {
          console.error(err);
          res.send(500, { error: "Błąd podczas pobierania danych" });
        }
      });

      server.put("/updateRow", async (req, res) => {
        try {
          const { tableName, RoundedTime, HourlyIncrement, userId } = req.body;

          // Walidacja danych wejściowych
          if (
            !tableName ||
            !RoundedTime ||
            HourlyIncrement == null ||
            !userId
          ) {
            return res.send(400, {
              error:
                "Brak wymaganych parametrów (tableName, RoundedTime, HourlyIncrement).",
            });
          }

          //pobranie danych dla danego użytkownika
          const userQuery = `
          SELECT FirstName, LastName 
          FROM A_Users 
          WHERE UserID = @userId
          `;

          const userResult = await pool
            .request()
            .input("userId", sql.Int, userId)
            .query(userQuery);

          let changedBy = "Robert Galos"; // Domyślny Robert

          console.log("User query result:", userResult.recordset);

          if (userResult.recordset.length > 0) {
            const user = userResult.recordset[0];
            changedBy = `${user.FirstName} ${user.LastName}`;
          }

          console.log("ChangedBy set to:", changedBy);

          /* poprzedni kod dawida

          // Domyślna wartość użytkownika (jeśli nie została przekazana)
          const changedBy = req.user
            ? `${req.user.firstName} ${req.user.lastName}`
            : "Robert Galos"; // Domyślny użytkownik
          */

          // Sprawdzamy, czy tabela istnieje
          const checkObjectQuery = `
            SELECT [type_desc]
            FROM sys.objects
            WHERE [name] = @tableName
          `;
          const objectResult = await pool
            .request()
            .input("tableName", sql.NVarChar(128), tableName)
            .query(checkObjectQuery);

          if (objectResult.recordset.length === 0) {
            return res.send(404, {
              error: `Obiekt ${tableName} nie istnieje w bazie.`,
            });
          }

          if (objectResult.recordset[0].type_desc !== "USER_TABLE") {
            return res.send(400, {
              error: `Obiekt ${tableName} nie jest tabelą.`,
            });
          }

          // Pobierz starą wartość dla loga
          const oldValueQuery = `
            SELECT [HourlyIncrement] AS OldValue
            FROM [dbo].[${tableName}]
            WHERE [RoundedTime] = DATEADD(HOUR, DATEDIFF(HOUR, 0, @RoundedTime), 0)
          `;
          const oldValueResult = await pool
            .request()
            .input("RoundedTime", sql.NVarChar, RoundedTime)
            .query(oldValueQuery);

          const oldValue =
            oldValueResult.recordset.length > 0
              ? oldValueResult.recordset[0].OldValue
              : null;

          // Aktualizacja danych
          const updateQuery = `
            UPDATE [dbo].[${tableName}]
            SET [HourlyIncrement] = @HourlyIncrement
            WHERE [RoundedTime] = DATEADD(HOUR, DATEDIFF(HOUR, 0, @RoundedTime), 0)
          `;
          const updateResult = await pool
            .request()
            .input("HourlyIncrement", sql.Float, HourlyIncrement)
            .input("RoundedTime", sql.NVarChar, RoundedTime)
            .query(updateQuery);

          const rowsAffected = updateResult.rowsAffected[0] || 0;

          if (rowsAffected === 0) {
            return res.send(404, {
              message: `Nie znaleziono wiersza z RoundedTime = ${RoundedTime} w tabeli ${tableName}.`,
            });
          }

          // Logowanie zmian do tabeli AuditLog
          const logQuery = `
            INSERT INTO AuditLog (TableName, RoundedTime, OldValue, NewValue, ChangedBy)
            VALUES (@tableName, @RoundedTime, @OldValue, @HourlyIncrement, @ChangedBy)
          `;

          await pool
            .request()
            .input("tableName", sql.NVarChar, tableName)
            .input("RoundedTime", sql.NVarChar, RoundedTime)
            .input("OldValue", sql.Float, oldValue)
            .input("HourlyIncrement", sql.Float, HourlyIncrement)
            .input("ChangedBy", sql.NVarChar, changedBy) // Używa domyślnego lub przekazanego użytkownika
            .query(logQuery);

          // Sukces
          return res.send(200, {
            message: `Zaktualizowano ${rowsAffected} wiersz(y) w tabeli ${tableName}.`,
          });
        } catch (error) {
          console.error("Update error:", error);
          return res.send(500, {
            error: `Błąd podczas aktualizacji: ${error.message}`,
          });
        }
      });

      server.get("/auditlog/:tableName", async (req, res) => {
        const tableName = req.params.tableName;

        if (!tableName) {
          res.send(400, { error: "Parametr tableName jest wymagany" });
          return;
        }

        try {
          const pool = await sql.connect(config);

          // Zapytanie do bazy danych
          const query = `
            SELECT 
              RoundedTime,
              OldValue,
              NewValue,
              ChangedBy,
              ChangedAt
            FROM AuditLog
            WHERE TableName = @tableName
            ORDER BY ChangedAt DESC
          `;

          const result = await pool
            .request()
            .input("tableName", sql.NVarChar, tableName)
            .query(query);

          // Jeśli brak wyników
          if (result.recordset.length === 0) {
            res.send(404, { message: `Brak zmian dla tabeli: ${tableName}` });
            return;
          }

          res.send(200, result.recordset);
        } catch (error) {
          console.error("Błąd podczas pobierania danych z AuditLog:", error);
          res.send(500, { error: "Błąd serwera podczas pobierania danych." });
        }
      });

      server.get("/averageLastDay", async (req, res) => {
        const { tableName, date } = req.query;

        if (!tableName) {
          return res.send(400, { error: "Parameter tableName is required." });
        }

        if (!date) {
          return res.send(400, { error: "Parameter date is required." });
        }

        try {
          const providedDate = new Date(date);

          // Ustawiamy daty początkowe i końcowe
          const startDate = new Date(providedDate);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setUTCHours(0, 0, 0, 0);

          const endDate = new Date(providedDate);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setUTCHours(23, 59, 59, 998);

          console.log(
            `Final date range: StartDate: ${startDate.toISOString()}, EndDate: ${endDate.toISOString()}`
          );

          // Tworzymy zapytanie SQL
          const query = `
                SELECT 
                  HourlyIncrement AS ValueUsed,
                  RoundedTime AS DateTimeUsed
                FROM ${tableName} 
                WHERE RoundedTime >= @startDate 
                  AND RoundedTime <= @endDate;
            `;

          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("startDate", sql.DateTime, startDate)
            .input("endDate", sql.DateTime, endDate)
            .query(query);

          const detailedData = result.recordset.map((row) => ({
            value: row.ValueUsed,
            dateTime: row.DateTimeUsed,
          }));

          // Obliczanie średniej
          const values = detailedData.map((data) => data.value);
          const total = values.reduce((sum, val) => sum + val, 0);
          const sampleCount = values.length;
          const averageValue =
            sampleCount > 0 ? parseFloat((total / sampleCount).toFixed(2)) : 0;

          console.log(`Final calculated average: ${averageValue}`);
          console.log(`Number of samples: ${sampleCount}`);

          // Zwracanie odpowiedzi
          res.send({
            tableName,
            date,
            average: averageValue,
            sampleCount,
            details: detailedData, // Szczegóły próbek
            message:
              sampleCount === 0 ? "No data or average is 0." : "Success.",
          });
        } catch (error) {
          console.error("Error calculating averageLastDay:", error);
          res.send(500, { error: "Internal Server Error" });
        }
      });

      server.get("/averageLast7DaysByHour", async (req, res) => {
        const { tableName, date } = req.query;

        if (!tableName) {
          return res.send(400, { error: "Parameter tableName is required." });
        }

        if (!date) {
          return res.send(400, { error: "Parameter date is required." });
        }

        try {
          // Ustawiamy daty
          const providedDate = new Date(date);
          const endDate = new Date(providedDate);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setUTCHours(23, 59, 59, 998);

          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setUTCHours(0, 0, 0, 0);

          console.log(
            `Date range: StartDate: ${startDate.toISOString()}, EndDate: ${endDate.toISOString()}`
          );

          const query = `
            SELECT 
              DATEPART(HOUR, RoundedTime) AS Hour,
              HourlyIncrement AS ValueUsed,
              RoundedTime AS DateTimeUsed
            FROM ${tableName} 
            WHERE RoundedTime >= @startDate 
              AND RoundedTime <= @endDate
            ORDER BY RoundedTime;
          `;

          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("startDate", sql.DateTime, startDate)
            .input("endDate", sql.DateTime, endDate)
            .query(query);

          // Przetwarzanie danych na średnie godzinowe
          const groupedByHour = result.recordset.reduce((acc, row) => {
            const hour = row.Hour;
            if (!acc[hour]) {
              acc[hour] = [];
            }
            acc[hour].push({
              value: row.ValueUsed,
              dateTime: row.DateTimeUsed,
            });
            return acc;
          }, {});

          // Obliczanie średnich godzinowych
          const averagesByHour = Object.keys(groupedByHour).map((hour) => {
            const values = groupedByHour[hour];
            const total = values.reduce((sum, val) => sum + val.value, 0);
            const average = values.length
              ? parseFloat((total / values.length).toFixed(2))
              : 0;
            return {
              hour: parseInt(hour, 10),
              average,
              sampleCount: values.length,
              details: values,
            };
          });

          averagesByHour.sort((a, b) => a.hour - b.hour);

          res.send({
            tableName,
            date,
            averages: averagesByHour.map(({ hour, average, sampleCount }) => ({
              hour,
              average,
              sampleCount,
            })),
            details: averagesByHour.map(({ hour, details }) => ({
              hour,
              samples: details,
            })),
            message: "Success.",
          });
        } catch (error) {
          console.error("Error calculating averageLast7DaysByHour:", error);
          res.send(500, { error: "Internal Server Error" });
        }
      });

      server.get("/objectColors", (req, res, next) => {
        pool
          .request()
          .query("SELECT Id, Obiekt, Kolor FROM A_Obiekty")
          .then((result) => {
            res.send(result.recordset);
            next();
          })
          .catch((err) => {
            console.error(err);
            res.send(500, err);
            next();
          });
      });

      server.put("/objectColors/:id", (req, res, next) => {
        const objectId = req.params.id;
        const { kolor } = req.body;

        if (!kolor || !objectId) {
          res.send(400, { error: "Kolor i ID są wymagane." });
          return next();
        }

        pool
          .request()
          .input("Kolor", sql.NVarChar(10), kolor)
          .input("Id", sql.Int, objectId)
          .query("UPDATE A_Obiekty SET Kolor = @Kolor WHERE Id = @Id")
          .then(() => {
            res.send(200, { message: "Kolor został zapisany." });
            next();
          })
          .catch((err) => {
            console.error("Błąd podczas zapisu koloru:", err);
            res.send(500, { error: "Błąd serwera przy aktualizacji koloru." });
            next();
          });
      });

      server.get("/detectAnomalies", async (req, res) => {
        const { date, threshold = 0.3 } = req.query;

        if (!date) {
          res.send(400, { error: "Missing 'date' query parameter" });
          return;
        }

        const query = `
          WITH cte AS (
              SELECT
                  SourceTable,
                  [Date],
                  TotalIncrement,
                  LAG(TotalIncrement, 1) OVER (PARTITION BY SourceTable ORDER BY [Date]) AS PrevValue
              FROM [KEJPIAJ].[dbo].[AggregatedDataDaily]
          )
          SELECT
              SourceTable,
              [Date],
              TotalIncrement,
              PrevValue,
              CASE
                  WHEN TotalIncrement < 0 THEN 'NEGATIVE_VALUE'
                  WHEN PrevValue IS NOT NULL
                       AND (ABS(TotalIncrement - PrevValue) / ABS(NULLIF(PrevValue, 0))) > @threshold
                       THEN 'CHANGE_ABOVE_THRESHOLD'
                  ELSE 'OK'
              END AS AnomalyType
          FROM cte
          WHERE
              [Date] = @date
              AND (
                  TotalIncrement < 0
                  OR (
                      PrevValue IS NOT NULL
                      AND (ABS(TotalIncrement - PrevValue) / ABS(NULLIF(PrevValue, 0))) > @threshold
                  )
              )
          ORDER BY [Date] DESC, 5 DESC;
        `;

        try {
          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .input("date", sql.Date, date)
            .input("threshold", sql.Float, parseFloat(threshold))
            .query(query);

          res.send(result.recordset);
        } catch (err) {
          console.error("Błąd przy /detectAnomalies:", err);
          res.send(500, { error: "Błąd serwera przy szukaniu anomalii." });
        }
      });

      server.post("/executeAggregations", async (req, res) => {
        try {
          const procedures = [
            "AggregateDailyData",
            "RebuildAggregatedDataDailyView",
            "AggregateMonthlyData",
            "RebuildAggregatedDataMonthlyView",
            "AggregateYearlyData",
            "RebuildAggregatedDataYearlyView",
          ];

          const pool = await sql.connect(config);

          for (const procedure of procedures) {
            try {
              await pool.request().query(`EXEC ${procedure}`);
              console.log(`Procedura ${procedure} wykonana poprawnie.`);
            } catch (err) {
              console.warn(
                `Błąd podczas wykonywania procedury ${procedure}: ${err.message}`
              );
              // Kontynuuj mimo błędu
            }
          }

          res.send(200, {
            message:
              "All aggregation procedures executed (with or without warnings).",
          });
        } catch (error) {
          console.error("Ogólny błąd procedury:", error.message);
          res.send(500, { error: "Failed to execute procedures." });
        }
      });

      server.listen(3005, "0.0.0.0", () => {
        console.log("%s listening at %s", server.name, server.url);
      });
    })
    .catch((err) => {
      console.error("Error connecting to database:", err);
    });
} catch (error) {
  console.error("An error occurred:", error);
}

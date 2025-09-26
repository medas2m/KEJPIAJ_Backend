module.exports = (server, pool, sql) => {
  /**
   * 1) Header icon logic (strictly for IMPORT_FROM_MEDAS):
   *    Green if the last run is < 24h old, otherwise red.
   *    Endpoint returns a minimal payload tailored for the header.
   */
  server.get("/import/header-status", async (_req, res) => {
    try {
      const TASK = "IMPORT_FROM_MEDAS";

      const result = await pool
        .request()
        .input("taskName", sql.NVarChar(200), TASK).query(`
            SELECT TOP 1 RunGUID, StartTime, EndTime, UserName, Status, ErrorMessage, TaskName
            FROM [KEJPIAJ].[dbo].[_UpdateDataFromSourceToDestination_Run]
            WHERE TaskName = @taskName
            ORDER BY COALESCE(EndTime, StartTime) DESC
          `);

      if (result.recordset.length === 0) {
        return res.send(200, {
          taskName: TASK,
          lastRun: null,
          isGreen: false, // no run -> red
          isYoungerThan24h: false,
        });
      }

      const last = result.recordset[0];
      const endOrStart = new Date(last.EndTime || last.StartTime);
      const isYoungerThan24h =
        Date.now() - endOrStart.getTime() <= 24 * 60 * 60 * 1000;

      // SPEC: strictly age-based coloring:
      // green if <24h, red otherwise (errors do not change the rule here)
      const isGreen = isYoungerThan24h;

      res.send(200, {
        taskName: TASK,
        lastRun: last,
        isYoungerThan24h,
        isGreen,
      });
    } catch (err) {
      console.error("GET /import/header-status error:", err);
      res.send(500, { error: "Internal server error" });
    }
  });

  /**
   * 2) Last import ONLY for IMPORT_FROM_MEDAS
   *    Returns the last run row as-is (plus convenience flags).
   */
  server.get("/import/last", async (_req, res) => {
    try {
      const TASK = "IMPORT_FROM_MEDAS";

      const result = await pool
        .request()
        .input("taskName", sql.NVarChar(200), TASK).query(`
            SELECT TOP 1 RunGUID, StartTime, EndTime, UserName, Status, ErrorMessage, TaskName
            FROM [KEJPIAJ].[dbo].[_UpdateDataFromSourceToDestination_Run]
            WHERE TaskName = @taskName
            ORDER BY COALESCE(EndTime, StartTime) DESC
          `);

      if (result.recordset.length === 0) {
        return res.send(200, {
          taskName: TASK,
          lastRun: null,
          isYoungerThan24h: false,
        });
      }

      const last = result.recordset[0];
      const endOrStart = new Date(last.EndTime || last.StartTime);
      const isYoungerThan24h =
        Date.now() - endOrStart.getTime() <= 24 * 60 * 60 * 1000;

      res.send(200, {
        taskName: TASK,
        lastRun: last,
        isYoungerThan24h,
      });
    } catch (err) {
      console.error("GET /import/last error:", err);
      res.send(500, { error: "Internal server error" });
    }
  });

  /**
   * 3) Full import history (ALL tasks, NO limits)
   *    Returns every row in descending time order.
   */
  server.get("/import/history-all", async (_req, res) => {
    try {
      const result = await pool.request().query(`
          SELECT RunGUID, StartTime, EndTime, UserName, Status, ErrorMessage, TaskName
          FROM [KEJPIAJ].[dbo].[_UpdateDataFromSourceToDestination_Run]
          ORDER BY COALESCE(EndTime, StartTime) DESC
        `);

      // map to the shape your modal/table expects
      const rows = result.recordset.map((r, idx) => ({
        id: r.RunGUID,
        name: r.TaskName,
        startTime: r.StartTime,
        endTime: r.EndTime,
        status:
          r.Status === "Zakończony pozytywnie" && !r.ErrorMessage
            ? "success"
            : "error",
        error: r.ErrorMessage || "",
        userName: r.UserName,
        lp: idx + 1,
      }));

      res.send(200, { rows, total: rows.length });
    } catch (err) {
      console.error("GET /import/history-all error:", err);
      res.send(500, { error: "Internal server error" });
    }
  });

  /**
   * 4) Error details for a specific run (no task limitation)
   *    Used when clicking the error icon in the table.
   */
  server.get("/import/error/:runGuid", async (req, res) => {
    try {
      const runGuid = req.params.runGuid;
      if (!runGuid) return res.send(400, { error: "Missing runGuid" });

      const result = await pool
        .request()
        .input("runGuid", sql.NVarChar(100), runGuid).query(`
            SELECT RunGUID, TaskName, StartTime, EndTime, Status, ErrorMessage, UserName
            FROM [KEJPIAJ].[dbo].[_UpdateDataFromSourceToDestination_Run]
            WHERE RunGUID = @runGuid
          `);

      if (result.recordset.length === 0) {
        return res.send(404, { error: "Run not found" });
      }

      const row = result.recordset[0];
      res.send(200, {
        runGuid: row.RunGUID,
        taskName: row.TaskName,
        startTime: row.StartTime,
        endTime: row.EndTime,
        status: row.Status,
        userName: row.UserName,
        error: row.ErrorMessage || "",
      });
    } catch (err) {
      console.error("GET /import/error/:runGuid error:", err);
      res.send(500, { error: "Internal server error" });
    }
  });
};

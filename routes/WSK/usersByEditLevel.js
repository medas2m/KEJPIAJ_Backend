/**
 * Endpoint: GET /usersByEditLevel
 *
 * Opis:
 * Zwraca listę użytkowników z tabeli [A_Users], opcjonalnie filtrując ich
 * na podstawie poziomu uprawnień do edycji (EditPermissionLevel)
 * i/lub poziomu ogólnych uprawnień (PermissionLevel).
 *
 * Przykłady użycia:
 *   /usersByEditLevel?editLevel=2
 *   /usersByEditLevel?permissionLevel=1
 *   /usersByEditLevel?editLevel=2&permissionLevel=1
 */

module.exports = (server, pool, sql) => {
  server.get("/usersByEditLevel", async (req, res) => {
    const { editLevel, permissionLevel } = req.query;

    const baseQuery = `
        SELECT [UserID], [FirstName], [LastName], [Login], [PermissionLevel], [EditPermissionLevel]
        FROM [KEJPIAJ].[dbo].[A_Users]
      `;

    const conditions = [];

    if (editLevel) {
      conditions.push("[EditPermissionLevel] <= @editLevel");
    }

    if (permissionLevel) {
      conditions.push("[PermissionLevel] <= @permissionLevel");
    }

    const filterQuery = conditions.length
      ? `${baseQuery} WHERE ${conditions.join(" AND ")}`
      : baseQuery;

    try {
      const request = pool.request();

      if (editLevel) {
        request.input("editLevel", sql.Int, parseInt(editLevel));
      }

      if (permissionLevel) {
        request.input("permissionLevel", sql.Int, parseInt(permissionLevel));
      }

      const result = await request.query(filterQuery);
      res.send(result.recordset);
    } catch (err) {
      console.error("Błąd przy /usersByEditLevel:", err);
      res.send(500, {
        error: "Błąd podczas pobierania użytkowników.",
      });
    }
  });
};

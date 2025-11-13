
// 1. Import the postgres client.
import postgres from 'postgres';

export default async function handler(req, res) {
  // We only want to handle GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let sql;
  try {
    // 3. Get the month from the query string (e.g., "2025-10")
    const { month } = req.query;
    console.log(`[API] Received request for month: ${month}`);

    if (!month) {
      console.log("[API Error] Month query parameter is missing.");
      return res.status(400).json({ error: 'Month query parameter is required.' });
    }

    // 2. Connect to your database using the URL from your .env file
    console.log("[API] Connecting to database...");
    sql = postgres(process.env.DATABASE_URL, {
      ssl: 'require',
      // Add a connection timeout
      connect_timeout: 10 
    });
    console.log("[API] Database connection successful.");

    // --- 4. Run the SQL Query ---
    //

    //
    console.log("[API] Running SQL query...");
    const employees = await sql`
      SELECT 
        e.name,
        e.designation, -- FIXED: Using the 'designation' column
        e.grosssalary::numeric AS gross_salary, -- FIXED: Using 'grosssalary' and casting it from TEXT to NUMERIC
        COALESCE(a.absent_days, 0) AS absent,
        -- FIXED: Corrected date syntax for Postgres
        EXTRACT(DAY FROM (date_trunc('month', ${month + '-01'}::date) + interval '1 month - 1 day'))::int AS "requiredDays"
      FROM 
        "EmployeeTable" AS e
      LEFT JOIN (
        -- Subquery to count absent days for the given month
        SELECT 
          employeeid, -- FIXED: Using 'employeeid' (no underscore)
          COUNT(*) AS absent_days 
        FROM 
          "AttendanceDaily"
        WHERE 
          to_char(date, 'YYYY-MM') = ${month}
          AND status = 'Absent' -- IS 'Absent' the correct status string?
        GROUP BY 
          employeeid -- FIXED: Using 'employeeid' (no underscore)
      ) AS a ON e.employeeid = a.employeeid -- FIXED: Using 'employeeid' (no underscore)
      ORDER BY
        e.name;
    `;
    console.log(`[API] SQL query successful. Found ${employees.length} employees.`);
    
    // 6. Send the raw data as JSON
    res.status(200).json({
      title: `Main Employee Pay Sheet - ${month}`,
      employees: employees,
    });

  } catch (error) {
    // --- THIS IS THE IMPORTANT PART ---
    // This will print the *exact* database error to your terminal
    console.error('[API CRASH] Error fetching paysheet data:', error);
    
    // Send a more detailed error message back to the frontend
    res.status(500).json({ 
      error: 'Internal server error.', 
      // Check for Postgres-specific error messages
      details: error.message || 'Unknown database error',
      query: error.query, // This might show the failed query
    });
  } finally {
    // 7. End the database connection
    if (sql) {
      await sql.end();
      console.log("[API] Database connection closed.");
    }
  }
}

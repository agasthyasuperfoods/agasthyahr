import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ message: 'Month is required' });
  }

  const client = await pool.connect();

  try {
    // --- THE DIRTY DATA FIX ---
    // We use a chain of cleaning functions:
    // 1. CAST(x AS TEXT)       -> Ensure it's text
    // 2. REPLACE(x, ',', '')   -> Remove commas (e.g., "40,000" -> "40000")
    // 3. TRIM(x)               -> Remove spaces (e.g., " 500 " -> "500")
    // 4. NULLIF(x, '')         -> Handle empty strings
    // 5. NULLIF(x, '-')        -> Handle dashes used as zeros
    // 6. ::numeric             -> Finally convert to number
    
    const cleanNum = (col) => `NULLIF(NULLIF(TRIM(REPLACE(CAST(${col} AS TEXT), ',', '')), ''), '-')::numeric`;

    const query = `
      SELECT 
        e.employeeid,
        e.name,
        e.designation,
        e.doj,
        
        a.id,

        -- GROSS SALARY: Cleaned
        COALESCE(
            ${cleanNum('a.gross_salary')}, 
            ${cleanNum('e.grosssalary')}, 
            0
        ) AS "grossSalary",
        
        COALESCE(a.actual_working_days, 30) AS "requiredDays",
        COALESCE(a.working_days, 0) AS "workingDays",
        COALESCE(a.leaves_taken, 0) AS "absent",
        COALESCE(a.lop_days, 0) AS "lopDaysCount",
        
        -- LEAVES CF: Cleaned (Case Sensitive column)
        COALESCE(
            ${cleanNum('a.leaves_cf')}, 
            ${cleanNum('e."Leaves_cf"')}, 
            0
        ) AS "Leaves_cf",
        
        COALESCE(${cleanNum('a.pf')}, 0) AS pf,
        COALESCE(${cleanNum('a.pt')}, 0) AS pt,
        
        -- OTHER EXPENSES: Cleaned (Most common fail point)
        COALESCE(${cleanNum('a.other_expenses')}, 0) AS "otherExpenses",
        
        COALESCE(${cleanNum('a.net_pay')}, 0) AS "netSalary",
        
        COALESCE(a.current_month_eligibility, 0) AS current_month_eligibility,
        COALESCE(a.late_adj_days, 0) AS late_adj_days

      FROM "EmployeeTable" e
      LEFT JOIN asfho a 
        ON TRIM(e.employeeid) = TRIM(a.employeeid) 
        AND a.month = $1
      ORDER BY e.name ASC;
    `;

    const result = await client.query(query, [month]);

    const employees = result.rows.map(row => ({
      ...row,
      grossSalary: Number(row.grossSalary) || 0,
      Leaves_cf: Number(row.Leaves_cf) || 0,
      requiredDays: Number(row.requiredDays) || 0,
      absent: Number(row.absent) || 0,
      workingDays: Number(row.workingDays) || 0,
      lopDaysCount: Number(row.lopDaysCount) || 0,
      pf: Number(row.pf) || 0,
      pt: Number(row.pt) || 0,
      netSalary: Number(row.netSalary) || 0,
      otherExpenses: Number(row.otherExpenses) || 0
    }));

    res.status(200).json({ 
      success: true, 
      employees 
    });

  } catch (error) {
    console.error('[API ERROR] Paysheet Fetch Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Database Error',
      details: error.detail 
    });
  } finally {
    client.release();
  }
}
//                             
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
    return res.status(200).json({ error: 'Month parameter is required' });
  }
  const client = await pool.connect();

  try {
    // Helper: Safely cleans currency strings -> numbers
    const cleanNum = (col) => `NULLIF(REGEXP_REPLACE(${col}::text, '[^0-9.]', '', 'g'), '')::numeric`;

    const query = `
      SELECT 
        e.employeeid,
        e.name,
        e.designation,
        e.doj,
        
        a.id,

        -- 1. GROSS SALARY (FIXED HERE)
        -- We check 'gross_salary' in the monthly table (a), and 'grosssalary' in the master table (e)
        COALESCE(
          ${cleanNum('a.gross_salary')}, 
          ${cleanNum('e.grosssalary')}, 
          0
        ) AS "grossSalary",
        
        -- 2. LEAVES CF
        COALESCE(${cleanNum('a.leaves_cf')}, ${cleanNum('e."Leaves_cf"')}, 0) AS "Leaves_cf",

        -- 3. ATTENDANCE
        COALESCE(a.actual_working_days, 30) AS "requiredDays",
        COALESCE(a.working_days, 0) AS "workingDays",
        COALESCE(a.leaves_taken, 0) AS "absent",
        COALESCE(a.lop_days, 0) AS "lopDaysCount",
        
        -- 4. DEDUCTIONS
        COALESCE(${cleanNum('a.pf')}, 0) AS pf,
        COALESCE(${cleanNum('a.pt')}, 0) AS pt,
        
        -- 5. OTHER
        COALESCE(${cleanNum('a.other_expenses')}, 0) AS "otherExpenses",
        
        -- 6. NET PAY
        COALESCE(${cleanNum('a.net_pay')}, 0) AS "netSalary",
        
        -- 7. EXTRAS
        COALESCE(a.current_month_eligibility, 0) AS current_month_eligibility,
        COALESCE(a.late_adj_days, 0) AS late_adj_days

      FROM "EmployeeTable" e
      LEFT JOIN asfho a 
        ON TRIM(e.employeeid::text) = TRIM(a.employeeid::text) 
        AND a.month = $1
      
      WHERE (TRIM(e.company::text) = 'ASF' OR TRIM(e."Location"::text) = 'HO')
      
      ORDER BY e.name ASC;
    `;

    const result = await client.query(query, [month]);

    const employees = result.rows.map(row => ({
      ...row,
      grossSalary: Number(row.grossSalary) || 0,
      Leaves_cf: Number(row.Leaves_cf) || 0,
      requiredDays: Number(row.requiredDays) || 30,
      absent: Number(row.absent) || 0,
      workingDays: Number(row.workingDays) || 0,
      lopDaysCount: Number(row.lopDaysCount) || 0,
      pf: Number(row.pf) || 0,
      pt: Number(row.pt) || 0,
      netSalary: Number(row.netSalary) || 0,
      otherExpenses: Number(row.otherExpenses) || 0
    }));

    res.status(200).json({ 
      title: `Main Employee Pay Sheet - ${month}`,
      employees 
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(200).json({ 
      error: 'Database Error', 
      details: error.message 
    });
  } finally {
    client.release();
  }
}
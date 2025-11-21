import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  // 1. Pages Router: Check method manually
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { month, employees } = req.body;

  if (!month || !employees || !Array.isArray(employees)) {
    return res.status(400).json({ message: 'Invalid data payload' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const emp of employees) {
      // --- DATA PREPARATION ---
      
      // Priority: Database ID (Primary Key)
      const rowId = emp.id; 

      // Identifiers
      const employeeId = emp.employeeid ? emp.employeeid.toString().trim() : '';
      const monthStr = month.toString().trim();

      // Personal Info
      const name = emp.name || '';
      const designation = emp.designation || '';
      const doj = emp.doj || null;

      // Numeric Data (Safety Check)
      const grossSalary = Number(emp.gross_salary) || 0;
      const actualWorkingDays = Number(emp.actual_working_days) || 0; 
      const workingDays = Number(emp.working_days) || 0;
      const leavesTaken = Number(emp.leaves_taken) || 0;
      const leavesCf = Number(emp.leaves_cf) || 0;
      const lopDays = Number(emp.lop_days) || 0;
      
      const currentMonthEligibility = Number(emp.current_month_eligibility) || 0; 
      const lateAdjDays = Number(emp.late_adj_days) || 0;

      const pf = Number(emp.pf) || 0;
      const pt = Number(emp.pt) || 0;
      const otherExpenses = emp.other_expenses ? String(emp.other_expenses) : '0';
      const netPay = Number(emp.net_pay) || 0;

      let updateResult = { rowCount: 0 };

      // --- STRATEGY A: Update by ID (Primary Key) ---
      if (rowId) {
        const updateByIdQuery = `
          UPDATE asfho SET
            name = $1, 
            designation = $2, 
            doj = $3,
            gross_salary = $4, 
            actual_working_days = $5,
            current_month_eligibility = $6, 
            leaves_taken = $7,
            late_adj_days = $8, 
            lop_days = $9, 
            leaves_cf = $10,
            working_days = $11, 
            net_pay = $12, 
            pf = $13, 
            pt = $14,
            other_expenses = $15
          WHERE id = $16
        `;
        
        updateResult = await client.query(updateByIdQuery, [
          name, designation, doj,
          grossSalary, actualWorkingDays,
          currentMonthEligibility, leavesTaken,
          lateAdjDays, lopDays, leavesCf,
          workingDays, netPay, pf, pt,
          otherExpenses,
          rowId 
        ]);
      }

      // --- STRATEGY B: UPSERT (Insert or Update by Conflict) ---
      // If ID was missing or update failed
      if (!rowId || updateResult.rowCount === 0) {
        const upsertQuery = `
          INSERT INTO asfho (
            month, name, employeeid, designation, doj,
            gross_salary, actual_working_days, current_month_eligibility,
            leaves_taken, late_adj_days, lop_days, leaves_cf,
            working_days, net_pay, pf, pt, other_expenses
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (month, employeeid) 
          DO UPDATE SET
            name = EXCLUDED.name,
            designation = EXCLUDED.designation,
            doj = EXCLUDED.doj,
            gross_salary = EXCLUDED.gross_salary,
            actual_working_days = EXCLUDED.actual_working_days,
            current_month_eligibility = EXCLUDED.current_month_eligibility,
            leaves_taken = EXCLUDED.leaves_taken,
            late_adj_days = EXCLUDED.late_adj_days,
            lop_days = EXCLUDED.lop_days,
            leaves_cf = EXCLUDED.leaves_cf,
            working_days = EXCLUDED.working_days,
            net_pay = EXCLUDED.net_pay,
            pf = EXCLUDED.pf,
            pt = EXCLUDED.pt,
            other_expenses = EXCLUDED.other_expenses;
        `;

        await client.query(upsertQuery, [
          monthStr, name, employeeId, designation, doj,
          grossSalary, actualWorkingDays, currentMonthEligibility,
          leavesTaken, lateAdjDays, lopDays, leavesCf,
          workingDays, netPay, pf, pt, otherExpenses
        ]);
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Saved Successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API] Database error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
}
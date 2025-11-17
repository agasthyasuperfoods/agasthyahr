import React, { useEffect, useState } from 'react';

function formatDate(d) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function SuperfoodsReimbursementMain() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null); // Show skeleton for row being paid

  // Load data
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const res = await fetch('/api/Accreimbursements');
    const body = await res.json();
    setData(body.success ? body.data : []);
    setLoading(false);
  }

  // Mark payment done (PATCH to API + skeleton reload)
  const handlePay = async (id) => {
    setPayingId(id);
    try {
      await fetch('/api/Accreimbursements', {
        method: 'PATCH',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      await fetchData();
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div style={{
      padding: '30px',
      fontFamily: 'Arial, sans-serif',
      background: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{
        textAlign: 'center',
        marginBottom: '20px',
        color: '#333'
      }}>
        Superfoods Reimbursement Dashboard (Accountant)
      </h1>
      <div style={{
        background:'#fff',
        borderRadius:'8px',
        boxShadow:'0 2px 5px rgba(0,0,0,0.08)',
        padding:'16px',
        overflowX: 'auto'
      }}>
        <table style={{
          minWidth: '950px', width: '100%',
          borderCollapse: 'collapse',
        }}>
          <thead>
            <tr style={{background:'#f9f9f9'}}>
              <th style={th}>Employee</th>
              <th style={th}>Date</th>
              <th style={th}>Description</th>
              <th style={th}>Amount (₹)</th>
              <th style={th}>Attachment</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({length:6}).map((_,j)=>(
                    <td key={j}><div style={{background:'#e6e6e6',height:20,margin:5,borderRadius:5}}/></td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#999', padding: '24px' }}>
                  No submitted reimbursements pending payment.
                </td>
              </tr>
            ) : data.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.employeename}</td>
                <td style={td}>{formatDate(r.date)}</td>
                <td style={td}>{r.description}</td>
                <td style={td}>₹{r.amount}</td>
                <td style={td}>
                  {r.invoice_url ? (
                    <a
                      href={r.invoice_url}
                      target="_blank"
                      download
                      style={downloadBtn}
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  ) : "No file"}
                </td>
                {/* Accountant Action */}
                <td style={td}>
                  {payingId === r.id ? (
                    <div style={{
                      display:'flex',alignItems:'center',
                      justifyContent:'center'
                    }}>
                      <div style={{
                        background:'#e6e6e6',height:20,width:80,borderRadius:5
                      }}>&nbsp;</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePay(r.id)}
                      style={{
                        padding: '8px 15px',
                        background: '#009688',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight:600,
                      }}
                    >
                      Mark Payment Done
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: '15px',
  fontWeight: 600,
  color: '#555',
  background: '#f9f9f9',
  borderBottom: '2px solid #eee'
};
const td = {
  padding: '16px 14px',
  fontSize: '14px',
  color: '#333',
  background: '#fff',
  borderBottom: '1px solid #f2f2f2'
};
const downloadBtn = {
  padding:'7px 13px',
  background:'#e2e6ea',
  color:'#007bff',
  border:'none',
  borderRadius:'5px',
  cursor:'pointer',
  fontWeight:600,
  textDecoration:'none'
};

export default SuperfoodsReimbursementMain;

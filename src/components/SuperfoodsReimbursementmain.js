import React, { useState } from 'react';

// Sample data
const sampleData = [
  {
    id: 1,
    employee: 'Dinitha',
    date: '2025-11-01',
    category: 'Travel',
    purpose: 'Client meeting in Hyderabad',
    amount: 1500,
    mdApproved: true,
    paid: false,
    receipts: ['receipt1.png', 'receipt2.pdf'],
  },
  {
    id: 2,
    employee: 'John',
    date: '2025-11-03',
    category: 'Office Supplies',
    purpose: 'Stationery for project team',
    amount: 500,
    mdApproved: false,
    paid: false,
    receipts: [],
  },
];

function SuperfoodsReimbursementMain() {
  const [fortnight, setFortnight] = useState('first'); // 'first' => 1-15, 'second' => 16-end
  const [reimbursements, setReimbursements] = useState(sampleData);

  const handlePay = (id) => {
    setReimbursements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, paid: true } : r))
    );
  };

  const filteredData = reimbursements.filter((r) =>
    fortnight === 'first' ? new Date(r.date).getDate() <= 15 : new Date(r.date).getDate() > 15
  );

  return (
    <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>Superfoods Reimbursement Dashboard</h1>

      {/* Fortnight Filter */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px', gap: '10px' }}>
        <button
          onClick={() => setFortnight('first')}
          style={{
            padding: '10px 20px',
            borderRadius: '5px',
            border: fortnight === 'first' ? '2px solid #007bff' : '1px solid #ccc',
            background: fortnight === 'first' ? '#e6f0ff' : '#fff',
            cursor: 'pointer',
          }}
        >
          1st - 15th
        </button>
        <button
          onClick={() => setFortnight('second')}
          style={{
            padding: '10px 20px',
            borderRadius: '5px',
            border: fortnight === 'second' ? '2px solid #007bff' : '1px solid #ccc',
            background: fortnight === 'second' ? '#e6f0ff' : '#fff',
            cursor: 'pointer',
          }}
        >
          16th - End
        </button>
      </div>

      {/* Reimbursement Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredData.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666' }}>No reimbursement requests for this period.</div>
        )}

        {filteredData.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            }}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>{r.employee}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>{r.date}</div>
            </div>

            {/* Details Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: '14px', color: '#555' }}>Category: <strong>{r.category}</strong></div>
                <div style={{ fontSize: '14px', color: '#555' }}>Purpose: {r.purpose}</div>
              </div>

              <div style={{ flex: 1, fontWeight: 'bold', fontSize: '16px', color: '#333', textAlign: 'center' }}>
                ₹{r.amount}
              </div>

              {/* MD Approval Status */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span
                  style={{
                    padding: '5px 10px',
                    borderRadius: '15px',
                    background: r.mdApproved ? '#d4edda' : '#fff3cd',
                    color: r.mdApproved ? '#155724' : '#856404',
                    fontWeight: 'bold',
                  }}
                >
                  {r.mdApproved ? 'Approved by MD' : 'Pending MD Approval'}
                </span>
              </div>

              {/* Receipts */}
              <div style={{ flex: 2, textAlign: 'center' }}>
                {r.receipts.length > 0
                  ? r.receipts.map((file, idx) => (
                      <a
                        key={idx}
                        href={`#`} // Replace with actual download URL
                        download={file}
                        style={{
                          marginRight: '8px',
                          textDecoration: 'none',
                          color: '#007bff',
                          fontWeight: 'bold',
                        }}
                      >
                        {file}
                      </a>
                    ))
                  : 'No attachments'}
              </div>

              {/* Action Button */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                {r.mdApproved && !r.paid ? (
                  <button
                    onClick={() => handlePay(r.id)}
                    style={{
                      padding: '8px 15px',
                      background: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark as Paid
                  </button>
                ) : r.paid ? (
                  <span style={{ fontWeight: 'bold', color: '#28a745' }}>Paid</span>
                ) : (
                  <span style={{ fontWeight: 'bold', color: '#ffc107' }}>Pending</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SuperfoodsReimbursementMain;

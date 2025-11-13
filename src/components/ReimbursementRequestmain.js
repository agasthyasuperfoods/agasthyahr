import React, { useState, useEffect, useRef } from 'react';
import { IoMdAttach } from 'react-icons/io';
import { MdClear } from 'react-icons/md';

function ReimbursementRequestmain() {
  const [form, setForm] = useState({
    date: '',
    employeeName: '',
    employeeId: '',
    amount: '',
    description: '',
    invoices: [],
  });
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    const employeeId = localStorage.getItem("employeeId") || "";
    if (employeeId) {
      setLoadingEmp(true);
      fetch(`/api/emp?employeeid=${employeeId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setForm(form => ({
              ...form,
              employeeName: data.name || "",
              employeeId: data.employeeid || ""
            }));
          }
        })
        .catch(err => console.error("Error loading employee:", err))
        .finally(() => setLoadingEmp(false));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'invoice') {
      if (files && files.length > 0) {
        const existingNames = form.invoices.map(f => f.name);
        const newFiles = Array.from(files).filter(f => !existingNames.includes(f.name));
        setForm({ ...form, invoices: [...form.invoices, ...newFiles] });
      }
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleRemoveAttachment = (index) => {
    setForm(form => ({
      ...form,
      invoices: form.invoices.filter((_, i) => i !== index)
    }));
  };

  const handleAttachmentBoxClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // 1. Upload files to SharePoint
    let fileUrls = [];
    if (form.invoices.length > 0) {
      const fileFormData = new FormData();
      form.invoices.forEach(file => fileFormData.append('invoices', file));
      const uploadRes = await fetch('/api/uploadToSharepoint', {
        method: 'POST',
        body: fileFormData
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        setSubmitting(false);
        alert("Attachment upload failed: " + uploadData.message);
        return;
      }
      fileUrls = uploadData.fileUrls;
    }

    // 2. Save reimbursement entry to DB
    const details = {
      date: form.date,
      employeeName: form.employeeName,
      employeeId: form.employeeId,
      amount: form.amount,
      description: form.description,
      fileUrls, // sent as array
    };
    const res = await fetch("/api/reimbursement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) {
      alert("Submitted successfully!\n URLs:\n" + fileUrls.join('\n'));
      setForm({
        date: '',
        employeeName: form.employeeName,
        employeeId: form.employeeId,
        amount: '',
        description: '',
        invoices: [],
      });
    } else {
      alert("Error (save to DB): " + data.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-14 bg-white rounded-xl shadow-lg p-10 font-sans">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 col-span-2">
        Reimbursement Request
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-7">
        {/* Left Side */}
        <div className="flex flex-col space-y-6">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Employee Name</label>
            <input
              type="text"
              name="employeeName"
              value={form.employeeName}
              readOnly
              disabled
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Employee ID</label>
            <input
              type="text"
              name="employeeId"
              value={form.employeeId}
              readOnly
              disabled
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div className="relative">
            <label className="block text-gray-700 font-medium mb-1">Amount</label>
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg pointer-events-none">
              ₹
            </span>
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="Enter amount"
              className="w-full border border-gray-300 rounded-md pl-8 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-700 font-bold"
            />
          </div>
        </div>
        {/* Right Side */}
        <div className="flex flex-col space-y-6">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              placeholder="Description of expense"
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-700 resize-y"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Attachments (any media)</label>
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-400 rounded-lg p-6 cursor-pointer bg-gray-50 hover:border-red-700 transition min-h-[142px]`}
              onClick={handleAttachmentBoxClick}
            >
              <IoMdAttach size={50} className="text-red-700 mb-2" />
              <span className="text-sm text-gray-700 select-none mb-2">
                Click or drag to add files (pdf, ppt, doc, images, video, etc)
              </span>
              <input
                type="file"
                name="invoice"
                accept=""
                multiple
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleChange}
              />
              <div className="flex flex-wrap gap-2 justify-center w-full mt-2">
                {form.invoices.map((file, idx) => {
                  const isImage = /^image\//.test(file.type);
                  return (
                    <div key={idx} className="flex items-center border rounded-md p-2 bg-white shadow-sm relative max-w-[160px]">
                      {isImage ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-10 h-10 object-contain mr-2 rounded"
                        />
                      ) : (
                        <IoMdAttach size={24} className="text-red-700 mr-2" />
                      )}
                      <span className="text-xs text-gray-700 flex-1 break-all max-w-[90px]">{file.name}</span>
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-white rounded-full p-1"
                        onClick={e => {
                          e.stopPropagation();
                          handleRemoveAttachment(idx);
                        }}
                        aria-label="Remove file"
                      >
                        <MdClear size={16} className="text-red-600" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {/* Submit Button */}
        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full bg-red-700 text-white font-bold text-lg py-2 rounded-md mt-2 transition hover:bg-red-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loadingEmp || submitting}
          >
            {loadingEmp ? "Loading employee..." : submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ReimbursementRequestmain;

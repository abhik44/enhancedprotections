import styles from "./CreateStaff.module.css";
import { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function CreateShiftModal({ editingShift, onClose }) {
  const modalId = "createShift";
  const modalRef = useRef(null);

  const defaultStart = "09:00";
  const defaultEnd = "17:00";

  const isEdit = Boolean(editingShift);

  const [form, setForm] = useState({
    date: "",
    startTime: defaultStart,
    endTime: defaultEnd,
    endTimeType: "close",
    siteName: "",
    staffname: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [staffOptions, setStaffOptions] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);

  // 🔥 SEND NOTIFICATION
  const sendNotification = async (staffId, siteName, date) => {
    try {
      const tokenDoc = await getDoc(doc(db, "firebasetokens", staffId));

      if (!tokenDoc.exists()) return;

      const token = tokenDoc.data().token;
      if (!token) return;

      await fetch("/api/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          siteName,
          date,
        }),
      });

      console.log("Notification sent");
    } catch (err) {
      console.error("Notification error:", err);
    }
  };

  // fetch staff
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "staff"));
        const list = snap.docs.map((d) => {
          const data = d.data();
          const fullname = (data?.firstname || "") + (data?.lastname ? " " + data.lastname : "");

          return {
            id: d.id,
            name: fullname.trim() || data?.email || "Unknown",
          };
        });

        if (mounted) setStaffOptions(list);
      } catch (e) {
        console.error("Staff load error:", e);
        setStaffOptions([]);
      }
    })();

    return () => (mounted = false);
  }, []);

  // fetch sites
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const snap = await getDocs(collection(db, "sites"));
        const names = snap.docs
          .map((d) => d.data()?.siteName)
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i);

        if (mounted) setSiteOptions(names);
      } catch (e) {
        console.error("Site load error:", e);
        setSiteOptions([]);
      }
    })();

    return () => (mounted = false);
  }, []);

  useEffect(() => {
    modalRef.current = document.getElementById(modalId);
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((s) => ({ ...s, [id]: value }));
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const validate = () => {
    if (!form.date) return "Please select a date.";
    if (!form.startTime) return "Please select start time.";
    if (!form.siteName) return "Please select site.";
    if (!form.staffname) return "Please select staff.";

    if (form.endTimeType === "time") {
      if (!form.endTime) return "Please select end time";

      const [sh, sm] = form.startTime.split(":").map(Number);
      const [eh, em] = form.endTime.split(":").map(Number);

      let startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;

      // ✅ allow overnight shift
      if (endMin < startMin) {
        endMin += 24 * 60;
      }

      // ❌ still prevent zero or negative duration
      if (endMin === startMin) {
        return "Shift duration cannot be zero";
      }
    }

    return null;
  };

  const hideBootstrapModal = () => {
    const el = modalRef.current;
    if (!el) return;

    const bs = window.bootstrap;
    if (!bs) return;

    let inst = bs.Modal.getInstance(el);
    if (!inst) inst = new bs.Modal(el);
    inst.hide();
  };

  const resetForm = () => {
    setForm({
      date: "",
      startTime: defaultStart,
      endTime: defaultEnd,
      endTimeType: "close",
      siteName: "",
      staffname: "",
      notes: "",
    });
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);

    try {
      const staff = staffOptions.find((s) => s.id === form.staffname);
      const staffNameToSave = staff ? staff.name : "";

      const endTimeToSave = form.endTimeType === "close" ? form.startTime : form.endTime || null;

      if (isEdit && editingShift?.id) {
        const refDoc = doc(db, "shifts", editingShift.id);

        await updateDoc(refDoc, {
          date: form.date,
          startTime: form.startTime,
          endTime: endTimeToSave,
          siteName: form.siteName,
          staffname: form.staffname,
          notes: form.notes || null,
          updatedAt: serverTimestamp(),
        });

        toast.success("Shift updated");
      } else {
        await addDoc(collection(db, "shifts"), {
          date: form.date,
          startTime: form.startTime,
          endTime: endTimeToSave,
          siteName: form.siteName,
          userId: form.staffname,
          staffname: staffNameToSave,
          clockin: "0",
          clockout: "0",
          shiftStatus: "0",
          notes: form.notes || null,
          createdAt: serverTimestamp(),
        });

        // 🔥 CALL NOTIFICATION
        await sendNotification(form.staffname, form.siteName, form.date);

        toast.success("Shift created");
      }

      hideBootstrapModal();
      handleClose();
    } catch (e) {
      console.error("Shift save error:", e);
      toast.error("Failed: " + e.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal fade" id={modalId} tabIndex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header px-4">
            <h5>{isEdit ? "Edit Shift" : "Create Shift"}</h5>
            <button className="btn-close" data-bs-dismiss="modal" onClick={handleClose} />
          </div>

          <div className="modal-body px-4">
            <div className="row">
              <div className="col-md-4 mb-3">
                <input type="date" id="date" className={`form-control ${styles.inputBox}`} value={form.date} onChange={handleChange} />
              </div>

              <div className="col-md-4 mb-3">
                <input type="time" id="startTime" className={`form-control ${styles.inputBox}`} value={form.startTime} onChange={handleChange} />
              </div>

              <div className="col-md-4 mb-3">
                <select id="endTimeType" className={`form-select ${styles.selectBox}`} value={form.endTimeType} onChange={handleChange}>
                  <option value="time">Time</option>
                  <option value="close">Close</option>
                </select>
              </div>

              {form.endTimeType === "time" && (
                <div className="col-md-4 mb-3">
                  <input type="time" id="endTime" className={`form-control ${styles.inputBox}`} value={form.endTime} onChange={handleChange} />
                </div>
              )}

              <div className="col-md-4 mb-3">
                <select id="staffname" className={`form-select ${styles.selectBox}`} value={form.staffname} onChange={handleChange}>
                  <option value="">Select staff</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4 mb-3">
                <select id="siteName" className={`form-select ${styles.selectBox}`} value={form.siteName} onChange={handleChange}>
                  <option value="">Select site</option>
                  {siteOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-12 mb-3">
                <textarea id="notes" className={`form-control ${styles.textareaBox}`} rows="3" value={form.notes} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="modal-footer px-4 pb-4 border-0">
            <button className="btn btn-secondary" data-bs-dismiss="modal" onClick={handleClose}>
              Close
            </button>

            <button className="btn btn-danger custom-red-bg text-white" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// import styles from "./CreateStaff.module.css";
// import { useEffect, useRef, useState } from "react";
// import { db } from "../firebase";
// import { collection, addDoc, getDocs, serverTimestamp, doc, updateDoc } from "firebase/firestore";
// import toast from "react-hot-toast";

// export default function CreateShiftModal({ editingShift, onClose }) {
//   const modalId = "createShift";
//   const modalRef = useRef(null);

//   const defaultStart = "09:00"; // 9:00 AM
//   const defaultEnd = "17:00"; // 5:00 PM

//   const isEdit = Boolean(editingShift);

//   const [form, setForm] = useState({
//     date: "",
//     startTime: defaultStart,
//     endTime: defaultEnd,
//     endTimeType: "close",
//     siteName: "",
//     staffname: "",
//     notes: "",
//   });

//   const [saving, setSaving] = useState(false);
//   const [staffOptions, setStaffOptions] = useState([]);
//   const [siteOptions, setSiteOptions] = useState([]);

//   // fetch staff names from 'staff' collection
//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       try {
//         const snap = await getDocs(collection(db, "staff"));
//         const list = snap.docs.map((d) => {
//           const data = d.data();
//           const fullname = (data?.firstname || "") + (data?.lastname ? " " + data.lastname : "");
//           return {
//             id: d.id,
//             name: fullname.trim() || data?.email || "Unknown",
//           };
//         });
//         if (mounted) setStaffOptions(list);
//       } catch (e) {
//         console.error("Failed to load staff names:", e);
//         setStaffOptions([]);
//       }
//     })();
//     return () => (mounted = false);
//   }, []);

//   // fetch site names from 'sites' collection
//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       try {
//         const snap = await getDocs(collection(db, "sites"));
//         const names = snap.docs
//           .map((d) => d.data()?.siteName)
//           .filter(Boolean)
//           .filter((v, i, arr) => arr.indexOf(v) === i);
//         if (mounted) setSiteOptions(names);
//       } catch (e) {
//         console.error("Failed to load site names:", e);
//         setSiteOptions([]);
//       }
//     })();
//     return () => (mounted = false);
//   }, []);

//   useEffect(() => {
//     modalRef.current = document.getElementById(modalId);
//   }, []);

//   const toInputDate = (value) => {
//     if (!value) return "";
//     if (value?.toDate) {
//       const d = value.toDate();
//       const y = d.getFullYear();
//       const m = String(d.getMonth() + 1).padStart(2, "0");
//       const day = String(d.getDate()).padStart(2, "0");
//       return `${y}-${m}-${day}`;
//     }
//     if (value instanceof Date) {
//       const y = value.getFullYear();
//       const m = String(value.getMonth() + 1).padStart(2, "0");
//       const day = String(value.getDate()).padStart(2, "0");
//       return `${y}-${m}-${day}`;
//     }
//     if (typeof value === "string") {
//       if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
//       const d = new Date(value);
//       if (!isNaN(d)) {
//         const y = d.getFullYear();
//         const m = String(d.getMonth() + 1).padStart(2, "0");
//         const day = String(d.getDate()).padStart(2, "0");
//         return `${y}-${m}-${day}`;
//       }
//     }
//     return "";
//   };

//   useEffect(() => {
//     if (editingShift) {
//       setForm({
//         date: toInputDate(editingShift.date),
//         startTime: editingShift.startTime || defaultStart,
//         endTime: editingShift.endTime && editingShift.endTime !== "close" ? editingShift.endTime : defaultEnd,
//         endTimeType: editingShift.endTime && editingShift.endTime === "Close" ? "close" : "time",
//         siteName: editingShift.siteName || "",
//         staffname: editingShift.staffname || "",
//         notes: editingShift.notes || "",
//       });
//     } else {
//       resetForm();
//     }
//   }, [editingShift]);

//   const handleChange = (e) => {
//     const { id, value } = e.target;
//     setForm((s) => ({ ...s, [id]: value }));
//   };

//   const parseTime = (timeStr) => {
//     if (!timeStr) return null;
//     const parts = timeStr.split(":");
//     if (parts.length < 2) return null;
//     const [h, m] = parts.map(Number);
//     if (isNaN(h) || isNaN(m)) return null;
//     const d = new Date();
//     d.setHours(h, m || 0, 0, 0);
//     return d;
//   };

//   const validate = () => {
//     if (!form.date) return "Please select a date.";
//     if (!form.startTime) return "Please select a start time.";
//     if (!form.endTime) return "Please select an end time.";
//     if (!form.siteName) return "Please select a site.";
//     if (!form.staffname) return "Please select a staff member.";

//     if (form.endTimeType === "time") {
//       if (!form.endTime) return "Please select an end time";

//       const start = parseTime(form.startTime);
//       const end = parseTime(form.endTime);
//       if (!start || !end) return "Invalid time format.";
//       if (end <= start) {
//         const endCopy = new Date(end.getTime());
//         endCopy.setDate(endCopy.getDate() + 1);

//         if (end <= start) return "End time must be after start time.";
//       }
//     }

//     return null;
//   };

//   const hideBootstrapModal = () => {
//     const el = modalRef.current;
//     if (!el) return;
//     const bs = window.bootstrap;
//     if (!bs) {
//       el.classList.remove("show");
//       el.setAttribute("aria-hidden", "true");
//       el.style.display = "none";
//       document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
//       return;
//     }
//     let inst = bs.Modal.getInstance(el);
//     if (!inst) inst = new bs.Modal(el);
//     inst.hide();
//   };

//   const resetForm = () => {
//     setForm({
//       date: "",
//       startTime: defaultStart,
//       endTime: defaultEnd,
//       endTimeType: "close",
//       siteName: "",
//       staffname: "",
//       notes: "",
//     });
//     setSaving(false);
//   };

//   const handleClose = () => {
//     resetForm();
//     onClose?.();
//   };

//   const handleSave = async () => {
//     const err = validate();
//     if (err) {
//       toast.error(err);
//       return;
//     }

//     if (isEdit) {
//       try {
//         const [y, m, d] = form.date.split("-").map(Number);
//         const parts = form.startTime.split(":");
//         if (parts.length < 2) throw new Error("Invalid start time");
//         const [h, min] = parts.map(Number);
//         if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || isNaN(min)) throw new Error("Invalid date or time");

//         const shiftStart = new Date(y, m - 1, d, h, min, 0, 0);
//         const now = new Date();

//         if (!(shiftStart > now)) {
//           toast.error("You can only edit shifts whose start time is still in the future.");
//           return;
//         }
//       } catch (e) {
//         console.error("Edit rule check failed:", e);
//         toast.error("Cannot edit this shift due to invalid date/time.");
//         return;
//       }
//     }

//     setSaving(true);
//     try {
//       const staff = staffOptions.find((st) => st.id === form.staffname);
//       const staffNameToSave = staff ? staff.name : "";

//       const endTimeToSave = form.endTimeType === "close" ? form.startTime : form.endTime || null;

//       if (isEdit && editingShift?.id) {
//         const refDoc = doc(db, "shifts", editingShift.id);
//         await updateDoc(refDoc, {
//           date: form.date,
//           startTime: form.startTime,
//           endTime: endTimeToSave,
//           siteName: form.siteName,
//           staffname: form.staffname,
//           notes: form.notes || null,
//           updatedAt: serverTimestamp(),
//         });
//         toast.success("Shift updated successfully");
//       } else {
//         await addDoc(collection(db, "shifts"), {
//           date: form.date,
//           startTime: form.startTime,
//           endTime: endTimeToSave,
//           siteName: form.siteName,
//           userId: form.staffname,
//           staffname: staffNameToSave,
//           clockin: "0",
//           clockout: "0",
//           shiftStatus: "0",
//           notes: form.notes || null,
//           createdAt: serverTimestamp(),
//         });
//         toast.success("Shift created successfully");
//       }

//       hideBootstrapModal();
//       handleClose();
//     } catch (e) {
//       console.error("Error saving shift:", e);
//       toast.error("Failed to save shift: " + (e.message || e));
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="modal fade" id={modalId} tabIndex="-1" aria-labelledby={modalId} aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
//       <div className="modal-dialog modal-lg">
//         <div className="modal-content">
//           <div className="modal-header px-4">
//             <h5 className="mb-0">{isEdit ? "Edit Shift" : "Create Shift"}</h5>
//             <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={handleClose} />
//           </div>

//           <div className="modal-body px-4">
//             <form onSubmit={(e) => e.preventDefault()}>
//               <div className="row">
//                 {/* date */}
//                 <div className="col-md-4 mb-3">
//                   <label htmlFor="date" className="form-label fw-medium">
//                     Select date
//                   </label>
//                   <input type="date" id="date" className={`form-control ${styles.inputBox}`} value={form.date} onChange={handleChange} />
//                 </div>

//                 {/* start time */}
//                 <div className="col-md-4 mb-3">
//                   <label htmlFor="startTime" className="form-label fw-medium">
//                     Start time
//                   </label>
//                   <input type="time" id="startTime" className={`form-control ${styles.inputBox}`} value={form.startTime} onChange={handleChange} />
//                 </div>

//                 {/* end time type */}
//                 <div className="col-md-4 mb-3">
//                   <label htmlFor="endTimeType" className="form-label fw-medium">
//                     End Time type
//                   </label>

//                   <select id="endTimeType" className={`form-select ${styles.selectBox}`} aria-label="End time type" value={form.endTimeType} onChange={handleChange}>
//                     <option value="time">Time</option>
//                     <option value="close">Close</option>
//                   </select>
//                 </div>

//                 {/* end time type */}

//                 {/* end time */}
//                 {form.endTimeType === "time" && (
//                   <div className="col-md-4 mb-3">
//                     <label htmlFor="endTime" className="form-label fw-medium">
//                       End time
//                     </label>
//                     <input type="time" id="endTime" className={`form-control ${styles.inputBox}`} value={form.endTime} onChange={handleChange} />
//                   </div>
//                 )}

//                 {/* staff name dropdown */}
//                 <div className="col-md-4 mb-3">
//                   <label htmlFor="staffname" className="form-label fw-medium">
//                     Select staff
//                   </label>
//                   <select id="staffname" className={`form-select ${styles.selectBox}`} value={form.staffname} onChange={handleChange}>
//                     <option value="">Select staff</option>
//                     {staffOptions.length > 0 ? (
//                       staffOptions.map((s) => (
//                         <option key={s.id} value={s.id}>
//                           {s.name}
//                         </option>
//                       ))
//                     ) : (
//                       <option disabled>No staff found</option>
//                     )}
//                   </select>
//                 </div>

//                 {/* site name dropdown */}
//                 <div className="col-md-4 mb-3">
//                   <label htmlFor="siteName" className="form-label fw-medium">
//                     Select site
//                   </label>
//                   <select id="siteName" className={`form-select ${styles.selectBox}`} value={form.siteName} onChange={handleChange}>
//                     <option value="">Select site</option>
//                     {siteOptions.length > 0 ? (
//                       siteOptions.map((s) => (
//                         <option key={s} value={s}>
//                           {s}
//                         </option>
//                       ))
//                     ) : (
//                       <option disabled>No sites found</option>
//                     )}
//                   </select>
//                 </div>

//                 {/* notes */}
//                 <div className="col-md-12 mb-3">
//                   <label htmlFor="notes" className="form-label fw-medium">
//                     Notes
//                   </label>
//                   <textarea id="notes" className={`form-control ${styles.textareaBox}`} rows="3" value={form.notes} onChange={handleChange} />
//                 </div>
//               </div>
//             </form>
//           </div>

//           <div className="modal-footer px-4 pb-4 border-0">
//             <button type="button" className="btn btn-secondary px-3" data-bs-dismiss="modal" onClick={handleClose}>
//               Close
//             </button>
//             <button type="button" className="btn btn-danger custom-red-bg text-white fw-medium px-3" onClick={handleSave} disabled={saving}>
//               {saving ? "Saving..." : isEdit ? "Update" : "Save"}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

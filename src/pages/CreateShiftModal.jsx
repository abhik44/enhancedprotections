import styles from "./CreateStaff.module.css";
import { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, serverTimestamp, doc, updateDoc, getDoc, query, where, writeBatch, deleteField } from "firebase/firestore";
import toast from "react-hot-toast";
import { spanMinutes, sumBreakMinutes, timeToMinutes } from "../utils/hours";

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
    clockin: "0",
    clockout: "0",
    breaks: [],
  });

  const [saving, setSaving] = useState(false);
  const [staffOptions, setStaffOptions] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);
  // both halves of a midnight-split shift ({ 1: shift, 2: shift }), or null
  const [splitHalves, setSplitHalves] = useState(null);
  const splitLoading = Boolean(editingShift?.splitGroupId) && !splitHalves;

  // 🔥 SEND NOTIFICATION
  const sendNotification = async (staffId, siteName, date, title = "New Shift Assigned") => {
    try {
      const tokenDoc = await getDoc(doc(db, "firebasetokens", staffId));
      const token = tokenDoc.exists() ? tokenDoc.data().token : null;

      if (!token) {
        toast.error("Shift saved, but no notification sent: this staff member hasn't opened the app on their phone yet");
        return;
      }

      const res = await fetch("/api/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          siteName,
          date,
          title,
        }),
      });

      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        console.error("Notification failed:", details);
        toast.error("Shift saved, but the notification failed to send. Ask the staff member to open the app so their device re-registers.");
        return;
      }

      console.log("Notification sent");
    } catch (err) {
      console.error("Notification error:", err);
      toast.error("Shift saved, but the notification failed to send");
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

      // ✅ allow overnight shift, still prevent zero or negative duration
      const duration = spanMinutes(form.startTime, form.endTime);
      if (!duration) {
        return "Shift duration cannot be zero";
      }
    }

    for (let i = 0; i < form.breaks.length; i++) {
      const b = form.breaks[i];
      const breakSpan = spanMinutes(b.start, b.end);
      if (b.end !== "0" && (!breakSpan || breakSpan <= 0)) {
        return `Break ${i + 1} end time must be after start time.`;
      }
    }

    if (form.clockin !== "0" && form.clockout !== "0") {
      const shiftSpan = spanMinutes(form.clockin, form.clockout);
      if (!shiftSpan || shiftSpan <= sumBreakMinutes(form.breaks)) {
        return "Clock out must be after clock in, accounting for breaks.";
      }
    }

    return null;
  };

  const hideBootstrapModal = () => {
    const el = modalRef.current;
    if (!el) return;

    const bs = window.bootstrap;

    if (bs) {
      let inst = bs.Modal.getInstance(el);
      if (!inst) inst = new bs.Modal(el);
      inst.hide();
    }

    // ✅ ALWAYS ensure cleanup (this is what you’re missing)
    el.classList.remove("show");
    el.setAttribute("aria-hidden", "true");
    el.style.display = "none";

    document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
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
      clockin: "0",
      clockout: "0",
      breaks: [],
    });
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  // load the sibling half when editing a midnight-split shift
  useEffect(() => {
    if (!editingShift?.splitGroupId) {
      setSplitHalves(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "shifts"), where("splitGroupId", "==", editingShift.splitGroupId)));
        const halves = {};
        snap.docs.forEach((d) => {
          const data = { id: d.id, ...d.data() };
          halves[data.splitPart] = data;
        });
        if (mounted) setSplitHalves(halves[1] && halves[2] ? halves : null);
      } catch (e) {
        console.error("Split shift load error:", e);
        if (mounted) setSplitHalves(null);
      }
    })();

    return () => (mounted = false);
  }, [editingShift]);

  useEffect(() => {
    if (!editingShift) return;

    const staffMatch = staffOptions.find((s) => s.name === editingShift.staffname);

    // a split shift is edited as one overnight range (half 1 start -> half 2 end)
    const first = splitHalves ? splitHalves[1] : editingShift;
    const last = splitHalves ? splitHalves[2] : editingShift;

    setForm({
      date: first.date || "",
      startTime: first.startTime || defaultStart,
      endTime: last.endTime && last.endTime !== "close" ? last.endTime : defaultEnd,
      // an auto-split "Close" shift (staff app, clocked out after midnight) has half 2 = 00:00 - 00:00
      endTimeType: last.endTime === (splitHalves ? last.startTime : first.startTime) ? "close" : "time",
      siteName: editingShift.siteName || "",
      staffname: staffMatch ? staffMatch.id : "", // ✅ IMPORTANT
      notes: editingShift.notes || "",
      clockin: editingShift.clockin || "0",
      clockout: editingShift.clockout || "0",
      breaks: Array.isArray(editingShift.breaks) ? editingShift.breaks.map((b) => ({ ...b })) : [],
    });
  }, [editingShift, staffOptions, splitHalves]);

  const addBreak = () => setForm((s) => ({ ...s, breaks: [...s.breaks, { start: "09:00", end: "0" }] }));
  const removeBreak = (i) => setForm((s) => ({ ...s, breaks: s.breaks.filter((_, idx) => idx !== i) }));
  const updateBreak = (i, key, value) =>
    setForm((s) => ({
      ...s,
      breaks: s.breaks.map((b, idx) => (idx === i ? { ...b, [key]: value } : b)),
    }));

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

      // a "Close" shift that already ran past midnight stays split: half 1 to 00:00, half 2 00:00 - Close
      const keepCloseSplit = Boolean(splitHalves) && form.endTimeType === "close";

      // only tell staff about edits to when/where/who, not timesheet fixes (clock times, breaks, notes)
      const origFirst = splitHalves ? splitHalves[1] : editingShift;
      const origLast = splitHalves ? splitHalves[2] : editingShift;
      const scheduleChanged =
        isEdit &&
        (form.date !== origFirst.date ||
          form.startTime !== origFirst.startTime ||
          (keepCloseSplit ? "00:00" : endTimeToSave) !== origLast.endTime ||
          form.siteName !== editingShift.siteName ||
          form.staffname !== editingShift.userId);
      const notifyUpdate = async () => {
        if (scheduleChanged) await sendNotification(form.staffname, form.siteName, form.date, "Shift Updated");
      };

      const formatLocalDate = (value) => {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      };

      const newShiftFields = {
        siteName: form.siteName,
        userId: form.staffname,
        staffname: staffNameToSave,
        clockin: "0",
        clockout: "0",
        shiftStatus: "0",
        notes: form.notes || null,
        createdAt: serverTimestamp(),
      };

      const isOvernight =
        keepCloseSplit ||
        (form.endTimeType === "time" &&
          form.endTime &&
          form.endTime !== "00:00" &&
          timeToMinutes(form.endTime) < timeToMinutes(form.startTime));

      // clock fields belong to the half that was opened for editing
      const clockFields = {
        clockin: form.clockin,
        clockout: form.clockout,
        breaks: form.breaks,
      };

      if (isOvernight) {
        const [y, m, d] = form.date.split("-").map(Number);
        const nextDate = new Date(y, m - 1, d + 1);
        const nextDateStr = formatLocalDate(nextDate);

        // both halves share splitGroupId (= half 1's id) so the staff app treats them as one shift
        const batch = writeBatch(db);
        const firstRef = isEdit && editingShift?.id ? doc(db, "shifts", splitHalves ? splitHalves[1].id : editingShift.id) : doc(collection(db, "shifts"));
        const secondRef = splitHalves ? doc(db, "shifts", splitHalves[2].id) : doc(collection(db, "shifts"));

        const firstHalf = { date: form.date, startTime: form.startTime, endTime: "00:00", splitGroupId: firstRef.id, splitPart: 1 };
        const secondHalf = { date: nextDateStr, startTime: "00:00", endTime: keepCloseSplit ? "00:00" : form.endTime, splitGroupId: firstRef.id, splitPart: 2 };
        const sharedFields = {
          siteName: form.siteName,
          staffname: staffNameToSave,
          userId: form.staffname,
          notes: form.notes || null,
          updatedAt: serverTimestamp(),
        };

        if (isEdit && editingShift?.id) {
          const editedPart = splitHalves && editingShift.id === splitHalves[2].id ? 2 : 1;

          batch.update(firstRef, { ...firstHalf, ...sharedFields, ...(editedPart === 1 ? clockFields : {}) });

          if (splitHalves) {
            batch.update(secondRef, { ...secondHalf, ...sharedFields, ...(editedPart === 2 ? clockFields : {}) });
          } else {
            batch.set(secondRef, { ...newShiftFields, ...secondHalf, shiftStatus: editingShift.shiftStatus || "0" });
          }

          await batch.commit();

          await notifyUpdate();
          toast.success("Overnight shift updated");
        } else {
          batch.set(firstRef, { ...newShiftFields, ...firstHalf });
          batch.set(secondRef, { ...newShiftFields, ...secondHalf });
          await batch.commit();

          await sendNotification(form.staffname, form.siteName, form.date);
          toast.success("Overnight shift created and split across two days");
        }
      } else if (isEdit && splitHalves) {
        // a split shift no longer crosses midnight: keep half 1, drop half 2
        const batch = writeBatch(db);
        batch.update(doc(db, "shifts", splitHalves[1].id), {
          date: form.date,
          startTime: form.startTime,
          endTime: endTimeToSave,
          siteName: form.siteName,
          staffname: staffNameToSave,
          userId: form.staffname,
          notes: form.notes || null,
          ...(editingShift.id === splitHalves[1].id ? clockFields : {}),
          splitGroupId: deleteField(),
          splitPart: deleteField(),
          updatedAt: serverTimestamp(),
        });
        batch.delete(doc(db, "shifts", splitHalves[2].id));
        await batch.commit();

        await notifyUpdate();
        toast.success("Shift updated");
      } else if (isEdit && editingShift?.id) {
        const refDoc = doc(db, "shifts", editingShift.id);

        await updateDoc(refDoc, {
          date: form.date,
          startTime: form.startTime,
          endTime: endTimeToSave,
          siteName: form.siteName,
          staffname: staffNameToSave, // ✅ name
          userId: form.staffname, // ✅ id
          clockin: form.clockin,
          clockout: form.clockout,
          breaks: form.breaks,
          updatedAt: serverTimestamp(),
        });

        await notifyUpdate();
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

              {isEdit && (
                <div className="col-md-12 mb-3 border-top pt-3">
                  <h6>Clock Times (admin correction)</h6>
                  <div className="row">
                    <div className="col-md-4 mb-2">
                      <label className="form-label">Clock In</label>
                      <input
                        type="time"
                        className="form-control"
                        value={form.clockin === "0" ? "" : form.clockin}
                        onChange={(e) => setForm((s) => ({ ...s, clockin: e.target.value || "0" }))}
                      />
                    </div>
                    <div className="col-md-4 mb-2">
                      <label className="form-label">Clock Out</label>
                      <input
                        type="time"
                        className="form-control"
                        value={form.clockout === "0" ? "" : form.clockout}
                        onChange={(e) => setForm((s) => ({ ...s, clockout: e.target.value || "0" }))}
                      />
                    </div>
                  </div>

                  <h6 className="mt-3">Breaks</h6>
                  {form.breaks.map((b, i) => (
                    <div className="row align-items-center mb-2" key={i}>
                      <div className="col-md-4">
                        <input type="time" className="form-control" value={b.start} onChange={(e) => updateBreak(i, "start", e.target.value)} />
                      </div>
                      <div className="col-md-4">
                        <input
                          type="time"
                          className="form-control"
                          value={b.end === "0" ? "" : b.end}
                          onChange={(e) => updateBreak(i, "end", e.target.value || "0")}
                        />
                      </div>
                      <div className="col-md-2">
                        <button type="button" className="btn btn-link text-danger" onClick={() => removeBreak(i)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addBreak}>
                    + Add break
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer px-4 pb-4 border-0">
            <button className="btn btn-secondary" data-bs-dismiss="modal" onClick={handleClose}>
              Close
            </button>

            <button className="btn btn-danger custom-red-bg text-white" onClick={handleSave} disabled={saving || splitLoading}>
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

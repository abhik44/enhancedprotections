import { useEffect, useMemo, useState } from "react";
import Search from "../ui/Search";
import CreateShiftModal from "./CreateShiftModal";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import CalendarSlider from "../ui/CalendarSlider";
import { formatToAmPm } from "../utils/formatTime";
import { HiPencilSquare } from "react-icons/hi2";
import { deleteDoc, doc } from "firebase/firestore";
import { HiTrash } from "react-icons/hi2";
//
// ✅ BULLETPROOF DATE PARSER
//
function parseDate(value) {
  if (!value) return null;

  // Firestore Timestamp
  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (value?.toDate) {
    return value.toDate();
  }

  // JS Date
  if (value instanceof Date) {
    return value;
  }

  // STRING FORMATS
  if (typeof value === "string") {
    // DD/MM/YYYY  ✅ YOUR CASE
    if (value.includes("/")) {
      const [day, month, year] = value.split("/").map(Number);
      if (day && month && year) {
        return new Date(year, month - 1, day);
      }
    }

    // fallback
    const d = new Date(value);
    if (!isNaN(d)) return d;
  }

  return null;
}

function formatDate(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString() : "-";
}

function getShiftStartDateTime(shift) {
  const d = parseDate(shift.date);
  if (!d || !shift.startTime) return null;

  const [h, m] = shift.startTime.split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
}

function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingShift, setEditingShift] = useState(null);

  // ✅ date range
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null,
  });

  //
  // 🔥 FIREBASE LISTENER
  //
  useEffect(() => {
    const q = query(collection(db, "shifts"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setShifts(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleDelete = async (shiftId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this shift?");

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "shifts", shiftId));
    } catch (err) {
      console.error("Error deleting shift:", err);
      alert("Failed to delete shift");
    }
  };

  //
  // 🔥 FINAL FILTER (WORKING)
  //
  const filteredShifts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return shifts.filter((s) => {
      // search
      const matchesSearch = !q || (s.staffname || "").toLowerCase().includes(q);

      // no date filter yet
      if (!dateRange.start || !dateRange.end) {
        return matchesSearch;
      }

      const shiftDate = parseDate(s.date);
      if (!shiftDate) return false;

      // normalize ALL to midnight
      const sd = new Date(shiftDate);
      sd.setHours(0, 0, 0, 0);

      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);

      const end = new Date(dateRange.end);
      end.setHours(0, 0, 0, 0);

      return sd >= start && sd <= end && matchesSearch;
    });
  }, [searchTerm, shifts, dateRange]);

  const canEditShift = (shift) => {
    const dt = getShiftStartDateTime(shift);
    return dt && dt > new Date();
  };

  const getShiftStatus = (status) => {
    const s = String(status);

    if (s === "1") return "Accepted";
    if (s === "2") return "Rejected";
    return "Pending";
  };

  const calculateWorkedHours = (clockin, clockout) => {
    if (clockin == "0" || clockout == "0") return "-";

    try {
      const [sh, sm] = clockin.split(":").map(Number);
      const [eh, em] = clockout.split(":").map(Number);

      let startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;

      // ✅ handle overnight clockout (rare but safe)
      if (endMin < startMin) {
        endMin += 24 * 60;
      }

      const diff = endMin - startMin;

      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;

      return `${hours}h ${minutes}m`;
    } catch (e) {
      return "-";
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between mb-3">
        <h3>Shifts</h3>

        <div className="d-flex gap-3">
          <Search value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by staff..." />

          <button className="btn btn-danger" data-bs-toggle="modal" data-bs-target="#createShift" onClick={() => setEditingShift(null)}>
            + Create Shift
          </button>

          <CreateShiftModal editingShift={editingShift} onClose={() => setEditingShift(null)} />
        </div>
      </div>

      <div className="border p-3 rounded">
        {/* ✅ Calendar connected */}
        <div className="mb-3 text-end">
          <CalendarSlider onChange={setDateRange} />
        </div>

        {loading ? (
          <Spinner />
        ) : filteredShifts.length === 0 ? (
          <div>No shifts found</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Date</th>
                <th>Start</th>
                <th>End</th>
                <th>Total Hours Worked</th>

                <th>Site</th>
                <th>Status</th>
                <th>Edit</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {filteredShifts.map((s) => (
                <tr key={s.id}>
                  <td>{s.staffname}</td>
                  <td>{formatDate(s.date)}</td>
                  <td>{formatToAmPm(s.startTime)}</td>
                  <td>{s.startTime === s.endTime ? "Close" : formatToAmPm(s.endTime)}</td>
                  <td>{calculateWorkedHours(s.clockin, s.clockout)}</td>
                  <td>{s.siteName}</td>
                  <td>
                    <span className={s.shiftStatus === "1" ? "text-success fw-bold" : s.shiftStatus === "2" ? "text-danger fw-bold" : "text-warning fw-bold"}>
                      {getShiftStatus(s.shiftStatus)}
                    </span>
                  </td>

                  <td>
                    {canEditShift(s) ? (
                      <button className="btn btn-link" data-bs-toggle="modal" data-bs-target="#createShift" onClick={() => setEditingShift(s)}>
                        <HiPencilSquare />
                      </button>
                    ) : (
                      <HiPencilSquare style={{ opacity: 0.3 }} />
                    )}
                  </td>
                  <td>
                    <button className="btn btn-link text-danger p-0 border-0" onClick={() => handleDelete(s.id)}>
                      <HiTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default Shifts;

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
import { formatDate, isDateWithinRange } from "../utils/dateUtils";
import { calculateWorkedHours, formatMinutes, sumBreakMinutes } from "../utils/hours";

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
      if (!matchesSearch) return false;

      return isDateWithinRange(s.date, dateRange.start, dateRange.end);
    });
  }, [searchTerm, shifts, dateRange]);

  const getShiftStatus = (status) => {
    const s = String(status);

    if (s === "1") return "Accepted";
    if (s === "2") return "Rejected";
    return "Pending";
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
                <th>Clocked In</th>
                <th>Clocked Out</th>
                <th>Breaks</th>
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
                  <td>{s.clockin}</td>
                  <td>{s.clockout}</td>
                  <td>{formatMinutes(sumBreakMinutes(s.breaks))}</td>

                  <td>{calculateWorkedHours(s.clockin, s.clockout, s.breaks)}</td>
                  <td>{s.siteName}</td>
                  <td>
                    <span className={s.shiftStatus === "1" ? "text-success fw-bold" : s.shiftStatus === "2" ? "text-danger fw-bold" : "text-warning fw-bold"}>
                      {getShiftStatus(s.shiftStatus)}
                    </span>
                  </td>

                  <td>
                    <button className="btn btn-link" data-bs-toggle="modal" data-bs-target="#createShift" onClick={() => setEditingShift(s)}>
                      <HiPencilSquare />
                    </button>
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

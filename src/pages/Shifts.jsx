import { useEffect, useMemo, useState } from "react";
import Search from "../ui/Search";
import CreateShiftModal from "./CreateShiftModal";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import CalendarSlider from "../ui/CalendarSlider";
import { formatToAmPm } from "../utils/formatTime";
import { HiPencilSquare } from "react-icons/hi2";
import { deleteDoc, doc, writeBatch } from "firebase/firestore";
import toast from "react-hot-toast";
import { linkOvernightPairs } from "../utils/linkOvernightPairs";

// one-off backfill button, hidden for now; set to true to show it again
const SHOW_LINK_OVERNIGHT_PAIRS = false;
import { HiTrash } from "react-icons/hi2";
import { formatDate, isDateWithinRange } from "../utils/dateUtils";
import { calculateWorkedHours, formatMinutes, sumBreakMinutes } from "../utils/hours";
import styles from "./Shifts.module.css"

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

  const handleDelete = async (shift) => {
    // a midnight-split shift is one shift to the staff member, so delete both halves together
    const halves = shift.splitGroupId ? shifts.filter((s) => s.splitGroupId === shift.splitGroupId) : [shift];

    const confirmDelete = window.confirm(
      halves.length > 1
        ? "This overnight shift is split across two days. Delete both parts?"
        : "Are you sure you want to delete this shift?",
    );

    if (!confirmDelete) return;

    try {
      if (halves.length > 1) {
        const batch = writeBatch(db);
        halves.forEach((h) => batch.delete(doc(db, "shifts", h.id)));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, "shifts", shift.id));
      }
    } catch (err) {
      console.error("Error deleting shift:", err);
      alert("Failed to delete shift");
    }
  };

  const [linking, setLinking] = useState(false);

  const handleLinkOvernightPairs = async () => {
    setLinking(true);
    try {
      const count = await linkOvernightPairs(shifts);
      toast.success(count ? `Linked ${count} overnight shift${count > 1 ? "s" : ""}` : "No unlinked overnight shifts found");
    } catch (err) {
      console.error("Error linking overnight shifts:", err);
      toast.error("Failed to link overnight shifts");
    } finally {
      setLinking(false);
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



      
<div className={styles.pageHeader}>
  <h3 className={styles.pageTitle}>Shifts</h3>

  <div className={styles.headerActions}>
    <div className={styles.searchWrapper}>
      <Search
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by staff..."
      />
    </div>

    {SHOW_LINK_OVERNIGHT_PAIRS && (
      <button
        className={`btn btn-outline-secondary ${styles.toolbarButton}`}
        onClick={handleLinkOvernightPairs}
        disabled={linking || loading}
      >
        {linking ? "Linking..." : "Link overnight pairs"}
      </button>
    )}

    <button
      className={`btn btn-danger ${styles.toolbarButton}`}
      data-bs-toggle="modal"
      data-bs-target="#createShift"
      onClick={() => setEditingShift(null)}
    >
      + Create Shift
    </button>

    <CreateShiftModal
      editingShift={editingShift}
      onClose={() => setEditingShift(null)}
    />
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
          <>
            {/* ================= Mobile: Cards ================= */}
            <div className={`${styles.mobileOnly} ${styles.cardList}`}>
              {filteredShifts.map((s) => {
                const statusClass = s.shiftStatus === "1" ? styles.statusAccepted : s.shiftStatus === "2" ? styles.statusRejected : styles.statusPending;

                return (
                  <div className={styles.card} key={s.id}>
                    {/* Top row: status on the left, action icons on the right */}
                    <div className={styles.cardTop}>
                      <span className={`${styles.statusBadge} ${statusClass}`}>{getShiftStatus(s.shiftStatus)}</span>

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Edit"
                          aria-label="Edit shift"
                          data-bs-toggle="modal"
                          data-bs-target="#createShift"
                          onClick={() => setEditingShift(s)}
                        >
                          <HiPencilSquare />
                        </button>

                        <button type="button" className={styles.iconBtnDanger} title="Delete" aria-label="Delete shift" onClick={() => handleDelete(s)}>
                          <HiTrash />
                        </button>
                      </div>
                    </div>

                    <dl className={styles.details}>
                      <dt>Staff</dt>
                      <dd className={styles.strong}>{s.staffname || "-"}</dd>
                      <dt>Date</dt>
                      <dd>{formatDate(s.date)}</dd>
                      <dt>Shift</dt>
                      <dd>
                        {formatToAmPm(s.startTime)} – {s.startTime === s.endTime ? "Close" : formatToAmPm(s.endTime)}
                      </dd>
                      <dt>Clocked In</dt>
                      <dd>{s.clockin || "-"}</dd>
                      <dt>Clocked Out</dt>
                      <dd>{s.clockout || "-"}</dd>
                      <dt>Breaks</dt>
                      <dd>{formatMinutes(sumBreakMinutes(s.breaks))}</dd>
                      <dt>Total Hours</dt>
                      <dd>{calculateWorkedHours(s.clockin, s.clockout, s.breaks)}</dd>
                      <dt>Site</dt>
                      <dd>{s.siteName || "-"}</dd>
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* ================= Desktop / tablet: Table ================= */}
            <div className={`${styles.desktopOnly} ${styles.tableWrapper}`}>
              <table className={`table ${styles.shiftsTable}`}>
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
                    <button className="btn btn-link text-danger p-0 border-0" onClick={() => handleDelete(s)}>
                      <HiTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
               </div>
          </>
        )}
      </div>
    </>
  );
}

export default Shifts;

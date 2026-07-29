import { Fragment, useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Spinner from "../ui/Spinner";
import CalendarSlider from "../ui/CalendarSlider";
import { formatToAmPm } from "../utils/formatTime";
import { isDateWithinRange, addDays, isoDateKey } from "../utils/dateUtils";
import { calculateWorkedMinutes, formatMinutes, timeToMinutes } from "../utils/hours";

function formatDayHeader(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatRangeLabel(start, end) {
  if (!start || !end) return "";
  return `${formatDayHeader(start)} - ${formatDayHeader(end)}`;
}

function VenueTimesheet() {
  const [siteOptions, setSiteOptions] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);

  // fetch sites for the dropdown
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

  // live shifts for the selected venue
  useEffect(() => {
    if (!selectedSite) {
      setShifts([]);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "shifts"), where("siteName", "==", selectedSite));

    const unsub = onSnapshot(q, (snapshot) => {
      setShifts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [selectedSite]);

  const dayDates = useMemo(() => {
    if (!dateRange.start) return [];
    return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(dateRange.start, i));
  }, [dateRange.start]);

  const guardRows = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];

    const weekShifts = shifts.filter((s) => isDateWithinRange(s.date, dateRange.start, dateRange.end));

    const byGuard = new Map();
    weekShifts.forEach((s) => {
      const key = s.userId || s.staffname;
      if (!byGuard.has(key)) {
        byGuard.set(key, { staffname: s.staffname, byDate: {} });
      }
      const guard = byGuard.get(key);
      if (!guard.byDate[s.date]) guard.byDate[s.date] = [];
      guard.byDate[s.date].push(s);
    });

    const rows = Array.from(byGuard.values()).map((guard) => {
      let weeklyTotalMinutes = 0;
      let hasAnyMinutes = false;

      const days = dayDates.map((date) => {
        const key = isoDateKey(date);
        const dayShifts = guard.byDate[key] || [];

        if (dayShifts.length === 0) {
          return { start: "-", finish: "-", hours: "-" };
        }

        let dayMinutes = 0;
        let dayHasMinutes = false;
        let earliestStart = null;
        let latestEnd = null;

        dayShifts.forEach((s) => {
          const mins = calculateWorkedMinutes(s.clockin, s.clockout, s.breaks);
          if (mins != null) {
            dayMinutes += mins;
            dayHasMinutes = true;
          }

          const startMin = timeToMinutes(s.clockin);
          if (startMin != null && (earliestStart == null || startMin < earliestStart.min)) {
            earliestStart = { min: startMin, value: s.clockin };
          }

          const endMin = timeToMinutes(s.clockout);
          if (endMin != null && (latestEnd == null || endMin > latestEnd.min)) {
            latestEnd = { min: endMin, value: s.clockout };
          }
        });

        if (dayHasMinutes) {
          weeklyTotalMinutes += dayMinutes;
          hasAnyMinutes = true;
        }

        return {
          start: earliestStart ? formatToAmPm(earliestStart.value) : "-",
          finish: latestEnd ? formatToAmPm(latestEnd.value) : "-",
          hours: dayHasMinutes ? formatMinutes(dayMinutes) : "-",
        };
      });

      return {
        staffname: guard.staffname,
        days,
        weeklyTotal: hasAnyMinutes ? formatMinutes(weeklyTotalMinutes) : "-",
      };
    });

    rows.sort((a, b) => (a.staffname || "").localeCompare(b.staffname || ""));
    return rows;
  }, [shifts, dateRange, dayDates]);

  const handleDownloadPdf = () => {
    if (!selectedSite || guardRows.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    doc.setFontSize(16);
    doc.text(`${selectedSite} — Weekly Timesheet`, 40, 40);
    doc.setFontSize(11);
    doc.text(formatRangeLabel(dateRange.start, dateRange.end), 40, 58);

    const head = [
      [
        { content: "Staff", rowSpan: 2 },
        ...dayDates.map((d) => ({ content: formatDayHeader(d), colSpan: 3, styles: { halign: "center" } })),
        { content: "Weekly Total", rowSpan: 2 },
      ],
      dayDates.flatMap(() => ["Start", "Finish", "Hrs"]),
    ];

    const body = guardRows.map((row) => [row.staffname, ...row.days.flatMap((d) => [d.start, d.finish, d.hours]), row.weeklyTotal]);

    autoTable(doc, {
      head,
      body,
      startY: 75,
      theme: "grid",
      headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: "bold", halign: "center" },
      styles: { fontSize: 8, cellPadding: 3, halign: "center" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    });

    const filename = `Timesheet_${selectedSite.replace(/\s+/g, "_")}_${isoDateKey(dateRange.start)}_to_${isoDateKey(dateRange.end)}.pdf`;
    doc.save(filename);
  };

  return (
    <>
      <div className="d-flex justify-content-between gap-3 align-items-center mb-3 flex-wrap">
        <h3 className="text-4a">Venue Timesheet</h3>

        <div className="d-flex gap-3 align-items-center flex-wrap">
          <select className="form-select" style={{ minWidth: "220px" }} value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
            <option value="">Select venue</option>
            {siteOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <CalendarSlider onChange={setDateRange} />

          <button className="btn custom-red-bg text-white fw-medium" disabled={!selectedSite || guardRows.length === 0} onClick={handleDownloadPdf}>
            Download PDF
          </button>
        </div>
      </div>

      <div className="border p-3 rounded">
        {!selectedSite ? (
          <div className="text-center">Select a venue to view its timesheet</div>
        ) : loading ? (
          <Spinner />
        ) : guardRows.length === 0 ? (
          <div className="text-center">No shifts found for this venue and week</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table table-sm text-center align-middle">
              <thead>
                <tr>
                  <th rowSpan={2} className="text-start align-middle">
                    Staff
                  </th>
                  {dayDates.map((d) => (
                    <th key={isoDateKey(d)} colSpan={3}>
                      {formatDayHeader(d)}
                    </th>
                  ))}
                  <th rowSpan={2} className="align-middle">
                    Weekly Total
                  </th>
                </tr>
                <tr>
                  {dayDates.map((d) => (
                    <Fragment key={isoDateKey(d)}>
                      <th>Start</th>
                      <th>Finish</th>
                      <th>Hrs</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {guardRows.map((row) => (
                  <tr key={row.staffname}>
                    <td className="text-start fw-bold">{row.staffname}</td>
                    {row.days.map((d, i) => (
                      <Fragment key={i}>
                        <td>{d.start}</td>
                        <td>{d.finish}</td>
                        <td>{d.hours}</td>
                      </Fragment>
                    ))}
                    <td className="fw-bold">{row.weeklyTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default VenueTimesheet;

import { Fragment, useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, doc, getDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Spinner from "../ui/Spinner";
import CalendarSlider from "../ui/CalendarSlider";
import { formatToAmPm } from "../utils/formatTime";
import { isDateWithinRange, addDays, isoDateKey, getIsoWeekNumber } from "../utils/dateUtils";
import { calculateWorkedMinutes, formatMinutes, timeToMinutes } from "../utils/hours";

// Static company details for the timesheet PDF footer.
const COMPANY_INFO = {
  name: "Enhanced Protections Pty Ltd",
  phone: "1300 374 827",
  email: "contact@enhancedprotections.com",
  website: "enhancedprotections.com",
  rostering: "Rostering - Bashar: 0420 265 280",
  invoices: "Invoices - Lachie: 0437 633 019",
  licenceLine: "NSW M/L: 000110080   ABN: 34 686 330 334   ASAIL: 45503",
};

const DISCLAIMER =
  "This timesheet has been generated from our electronic rostering and attendance records. If you have any " +
  "questions regarding the recorded hours, please contact our operations team within seven (7) days.";

function formatDayShort(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatRangeLabel(start, end) {
  if (!start || !end) return "";
  return `${formatDayShort(start)} - ${formatDayShort(end)}`;
}

function VenueTimesheet() {
  const [siteOptions, setSiteOptions] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [licenceMap, setLicenceMap] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  // fetch sites for the dropdown (name + address for the PDF subtitle)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const snap = await getDocs(collection(db, "sites"));
        const seen = new Set();
        const options = [];

        snap.docs.forEach((d) => {
          const data = d.data();
          if (!data?.siteName || seen.has(data.siteName)) return;
          seen.add(data.siteName);
          options.push({ name: data.siteName, address: data.address || "" });
        });

        if (mounted) setSiteOptions(options);
      } catch (e) {
        console.error("Site load error:", e);
        setSiteOptions([]);
      }
    })();

    return () => (mounted = false);
  }, []);

  // preload the company logo as a data URL for embedding in the PDF
  useEffect(() => {
    let mounted = true;

    fetch("/logo.png")
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          }),
      )
      .then((dataUrl) => {
        if (mounted) setLogoDataUrl(dataUrl);
      })
      .catch(() => {});

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

  const selectedSiteAddress = useMemo(() => siteOptions.find((s) => s.name === selectedSite)?.address || "", [siteOptions, selectedSite]);

  const dayDates = useMemo(() => {
    if (!dateRange.start) return [];
    return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(dateRange.start, i));
  }, [dateRange.start]);

  const weekShifts = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    return shifts.filter((s) => isDateWithinRange(s.date, dateRange.start, dateRange.end));
  }, [shifts, dateRange]);

  const dayGuardCounts = useMemo(() => {
    return dayDates.map((date) => {
      const key = isoDateKey(date);
      const guardsThatDay = new Set(weekShifts.filter((s) => s.date === key).map((s) => s.userId || s.staffname));
      return guardsThatDay.size;
    });
  }, [dayDates, weekShifts]);

  const guardRows = useMemo(() => {
    if (dayDates.length === 0) return [];

    const byGuard = new Map();
    weekShifts.forEach((s) => {
      const key = s.userId || s.staffname;
      if (!byGuard.has(key)) {
        byGuard.set(key, { userId: s.userId || null, staffname: s.staffname, byDate: {} });
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
        userId: guard.userId,
        staffname: guard.staffname,
        days,
        weeklyTotalMinutes,
        weeklyTotal: hasAnyMinutes ? formatMinutes(weeklyTotalMinutes) : "-",
      };
    });

    rows.sort((a, b) => (a.staffname || "").localeCompare(b.staffname || ""));
    return rows;
  }, [weekShifts, dayDates]);

  const totals = useMemo(() => {
    const totalMinutes = guardRows.reduce((sum, r) => sum + r.weeklyTotalMinutes, 0);
    return {
      guardsSupplied: guardRows.length,
      totalShifts: weekShifts.length,
      totalHours: formatMinutes(totalMinutes),
    };
  }, [guardRows, weekShifts]);

  const guardIdsKey = useMemo(() => guardRows.map((r) => r.userId).filter(Boolean).sort().join(","), [guardRows]);

  // fetch each guard's licence details (RSA / Security Licence / First Aid) for the PDF footer
  useEffect(() => {
    const ids = guardIdsKey ? guardIdsKey.split(",") : [];
    if (ids.length === 0) {
      setLicenceMap({});
      return;
    }

    let mounted = true;

    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, "staff", id));
            const ed = snap.exists() ? snap.data()?.employmentDetails : null;
            return [
              id,
              {
                rsaNumber: ed?.rsaNumber || "-",
                securityLicenceNumber: ed?.securityLicenceNumber || "-",
                firstAidNumber: ed?.firstAidNumber || "-",
              },
            ];
          } catch (e) {
            console.error("Licence fetch error:", e);
            return [id, null];
          }
        }),
      );

      if (mounted) setLicenceMap(Object.fromEntries(entries.filter(([, v]) => v)));
    })();

    return () => (mounted = false);
  }, [guardIdsKey]);

  const handleDownloadPdf = () => {
    if (!selectedSite || guardRows.length === 0) return;

    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();

    // header
    pdf.setFontSize(18);
    pdf.setFont(undefined, "bold");
    pdf.text(`${selectedSite} — Weekly Timesheet`, 40, 40);

    pdf.setDrawColor(200, 30, 30);
    pdf.setLineWidth(1.5);
    pdf.line(40, 48, pageWidth - 40, 48);

    pdf.setFont(undefined, "normal");
    pdf.setFontSize(10);
    const subtitle = selectedSiteAddress ? `${formatRangeLabel(dateRange.start, dateRange.end)}, ${selectedSiteAddress}` : formatRangeLabel(dateRange.start, dateRange.end);
    pdf.text(subtitle, 40, 64);

    // table
    const head = [
      [
        { content: "Staff", rowSpan: 2 },
        ...dayDates.map((d, i) => ({
          content: `${formatDayShort(d)}, Guards: ${dayGuardCounts[i]}`,
          colSpan: 3,
          styles: { halign: "center" },
        })),
        { content: "Weekly Total", rowSpan: 2 },
      ],
      dayDates.flatMap(() => ["Start", "Finish", "Hrs"]),
    ];

    const body = guardRows.map((row) => [row.staffname, ...row.days.flatMap((d) => [d.start, d.finish, d.hours]), row.weeklyTotal]);

    autoTable(pdf, {
      head,
      body,
      startY: 80,
      theme: "grid",
      headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: "bold", halign: "center" },
      styles: { fontSize: 8, cellPadding: 3, halign: "center" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    });

    let y = pdf.lastAutoTable.finalY + 24;

    // summary stats (right aligned)
    pdf.setFontSize(9);
    pdf.setFont(undefined, "bold");
    pdf.text(`Guards Supplied: ${totals.guardsSupplied}`, pageWidth - 40, y, { align: "right" });
    pdf.text(`Total Shifts: ${totals.totalShifts}`, pageWidth - 40, y + 12, { align: "right" });
    pdf.text(`Total Hours: ${totals.totalHours}`, pageWidth - 40, y + 24, { align: "right" });

    // disclaimer (right aligned, italic)
    pdf.setFont(undefined, "italic");
    pdf.setFontSize(7.5);
    pdf.setTextColor(90, 90, 90);
    const disclaimerLines = pdf.splitTextToSize(DISCLAIMER, 260);
    pdf.text(disclaimerLines, pageWidth - 40, y + 42, { align: "right" });
    pdf.setTextColor(0, 0, 0);

    y += 90;

    // footer: company info (left), guard licence details (middle), signature block (right)
    const leftX = 40;
    const midX = pageWidth / 2 - 60;
    const rightX = pageWidth - 200;
    let leftY = y;
    let midY = y;

    pdf.setFont(undefined, "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(COMPANY_INFO.name, leftX, leftY);
    leftY += 16;

    pdf.setFont(undefined, "normal");
    pdf.setFontSize(9);
    pdf.text(`24/7 Operations: ${COMPANY_INFO.phone}`, leftX, leftY);
    leftY += 14;
    pdf.text(`Email: ${COMPANY_INFO.email}`, leftX, leftY);
    leftY += 14;
    pdf.text(`Website: ${COMPANY_INFO.website}`, leftX, leftY);
    leftY += 18;
    pdf.text("For enquiries regarding invoices, timesheets or staffing,", leftX, leftY);
    leftY += 12;
    pdf.text("please contact our operations team.", leftX, leftY);
    leftY += 18;
    pdf.text(COMPANY_INFO.rostering, leftX, leftY);
    leftY += 14;
    pdf.text(COMPANY_INFO.invoices, leftX, leftY);
    leftY += 18;
    pdf.setFontSize(8);
    pdf.text(COMPANY_INFO.licenceLine, leftX, leftY);

    // guard licence details
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(10);
    pdf.text("Guard Licence Details", midX, midY);
    midY += 16;

    pdf.setFont(undefined, "normal");
    pdf.setFontSize(8);
    guardRows.forEach((row) => {
      const lic = (row.userId && licenceMap[row.userId]) || { rsaNumber: "-", securityLicenceNumber: "-", firstAidNumber: "-" };
      pdf.text(`${row.staffname} — RSA: ${lic.rsaNumber} | Security Licence: ${lic.securityLicenceNumber} | First Aid: ${lic.firstAidNumber}`, midX, midY);
      midY += 13;
    });

    // signature block
    let sigY = y;
    pdf.setFont(undefined, "italic");
    pdf.setFontSize(11);
    pdf.text("Venue Representative", rightX, sigY);
    sigY += 22;
    pdf.text("Name: ________________________", rightX, sigY);
    sigY += 22;
    pdf.text("Signature: ______________________", rightX, sigY);
    sigY += 22;
    pdf.text("Date: __________________________", rightX, sigY);

    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, "PNG", rightX + 60, sigY + 15, 70, 53);
    }

    const { year: isoYear, week: isoWeek } = getIsoWeekNumber(dateRange.start);
    pdf.setFont(undefined, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Timesheet Version ${isoYear}.${String(isoWeek).padStart(2, "0")}`, rightX + 60, sigY + 80);

    const filename = `Timesheet_${selectedSite.replace(/\s+/g, "_")}_${isoDateKey(dateRange.start)}_to_${isoDateKey(dateRange.end)}.pdf`;
    pdf.save(filename);
  };

  return (
    <>
      <div className="d-flex justify-content-between gap-3 align-items-center mb-3 flex-wrap">
        <h3 className="text-4a">Venue Timesheet</h3>

        <div className="d-flex gap-3 align-items-center flex-wrap">
          <select className="form-select" style={{ minWidth: "220px" }} value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
            <option value="">Select venue</option>
            {siteOptions.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          <CalendarSlider onChange={setDateRange} alignToMonday />

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
                  {dayDates.map((d, i) => (
                    <th key={isoDateKey(d)} colSpan={3}>
                      {formatDayShort(d)}, Guards: {dayGuardCounts[i]}
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
                  <tr key={row.userId || row.staffname}>
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

            <div className="d-flex justify-content-end gap-4 mt-3 fw-medium">
              <span>Guards Supplied: {totals.guardsSupplied}</span>
              <span>Total Shifts: {totals.totalShifts}</span>
              <span>Total Hours: {totals.totalHours}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default VenueTimesheet;

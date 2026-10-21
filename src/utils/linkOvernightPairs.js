import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

// One-off backfill: link midnight-split shift pairs created before splitGroupId existed,
// so the staff app shows them as one shift. Only links pairs nobody has clocked into yet.
// Safe to run repeatedly — linked pairs are skipped.

const nextDateKey = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${next.getFullYear()}-${mm}-${dd}`;
};

const isUnstarted = (s) => (s.clockin ?? "0") === "0";

export async function linkOvernightPairs(shifts) {
  const unlinked = shifts.filter((s) => !s.splitGroupId && s.date && isUnstarted(s));

  const secondHalves = new Map();
  unlinked
    .filter((s) => s.startTime === "00:00" && s.endTime !== "00:00")
    .forEach((s) => {
      const key = `${s.userId}|${s.siteName}|${s.date}`;
      if (!secondHalves.has(key)) secondHalves.set(key, s);
    });

  const pairs = [];
  unlinked
    .filter((s) => s.endTime === "00:00" && s.startTime !== "00:00")
    .forEach((first) => {
      const key = `${first.userId}|${first.siteName}|${nextDateKey(first.date)}`;
      const second = secondHalves.get(key);
      if (!second) return;
      secondHalves.delete(key);
      pairs.push([first, second]);
    });

  // Firestore batches cap at 500 writes; 2 writes per pair
  for (let i = 0; i < pairs.length; i += 200) {
    const batch = writeBatch(db);
    pairs.slice(i, i + 200).forEach(([first, second]) => {
      batch.update(doc(db, "shifts", first.id), { splitGroupId: first.id, splitPart: 1 });
      batch.update(doc(db, "shifts", second.id), { splitGroupId: first.id, splitPart: 2 });
    });
    await batch.commit();
  }

  return pairs.length;
}

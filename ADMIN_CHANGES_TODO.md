# Admin panel changes to port

Changes made in this copy (`Documents/projects/enhancedprotectionsadmincla`) that still need to be applied to the up-to-date admin panel repo. Newest at the bottom.

---

## 1. Send notifications when a shift is updated (2026-10-22)

**Client request:** "When I update/create the shifts it doesn't send a notification out."

**What was wrong**
- Creating a shift sent a notification, but editing one never did. The only exception was an edit that turned a shift into an overnight shift.
- Failures were silent. `sendNotification` ignored the API response, and the API returned 200 even when Firebase Cloud Messaging (FCM) rejected the message (for example, a stale device token). The admin never knew a notification hadn't gone out.
- The title was always "New Shift Assigned".

### 1a. `api/send-notification.js`

Accept an optional `title`:

```js
// before
const { token, siteName, date } = req.body;
// after
const { token, siteName, date, title = "New Shift Assigned" } = req.body;
```

```js
// before
notification: {
  title: "New Shift Assigned",
// after
notification: {
  title,
```

Pass FCM errors through instead of always returning 200:

```js
// before
const fcmData = await fcmRes.json();

return res.status(200).json(fcmData);
// after
const fcmData = await fcmRes.json();

// pass FCM failures through (e.g. 404 UNREGISTERED = stale device token) so the admin can see them
return res.status(fcmRes.ok ? 200 : fcmRes.status).json(fcmData);
```

### 1b. `src/pages/CreateShiftModal.jsx`: `sendNotification`

Replace the whole function. It now takes a `title`, checks the response, and shows a toast (`react-hot-toast`) when nothing was sent:

```js
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
```

### 1c. `src/pages/CreateShiftModal.jsx`: notify on update in `handleSave`

Right after `const endTimeToSave = ...` in `handleSave`, add the following. It notifies only when the date, time, site or staff changed. Timesheet fixes (clock times, breaks, notes) don't notify.

```js
// only tell staff about edits to when/where/who, not timesheet fixes (clock times, breaks, notes)
const origFirst = splitHalves ? splitHalves[1] : editingShift;
const origLast = splitHalves ? splitHalves[2] : editingShift;
const scheduleChanged =
  isEdit &&
  (form.date !== origFirst.date ||
    form.startTime !== origFirst.startTime ||
    endTimeToSave !== origLast.endTime ||
    form.siteName !== editingShift.siteName ||
    form.staffname !== editingShift.userId);
const notifyUpdate = async () => {
  if (scheduleChanged) await sendNotification(form.staffname, form.siteName, form.date, "Shift Updated");
};
```

> If the other repo has no overnight split-shift code (`splitHalves`), use `editingShift` in place of both `origFirst` and `origLast`.

Then call `await notifyUpdate();` just before every `toast.success(...)` on an **update** path:

| Update path | Before | After |
|---|---|---|
| Overnight shift edited | `if (!splitHalves) await sendNotification(form.staffname, form.siteName, nextDateStr);` | `await notifyUpdate();` |
| Split shift no longer overnight (after `batch.commit()`) | *(no notification)* | `await notifyUpdate();` |
| Normal shift edited (after `updateDoc(...)`) | *(no notification)* | `await notifyUpdate();` |

The create paths stay as they were: `sendNotification(...)` with the default "New Shift Assigned" title.

**Test:** edit a shift's time → staff phone gets "Shift Updated". Edit only clock-in/out → no notification. Assign a shift to staff who never opened the app → red toast in the admin.

**Status:** applied to the updated admin code here (Oct 19 `src`) on 2026-10-22. `vite build` passes. Not yet tested against a real phone.

---

## 2. Keep auto-split "Close" shifts intact when editing (2026-10-22)

**Why:** the staff app now splits a single "Close" shift (e.g. 22:00 – Close) at midnight when the guard is still clocked in after 00:00. Half 1 ends at 00:00, and a new half 2 is created for the next day as `00:00 – 00:00` (start = end = "Close"), linked by `splitGroupId` / `splitPart` and marked `autoSplit: true`. Without this change, opening that pair in the admin showed end time `00:00` as a normal time. Saving then took the "no longer overnight" path and **deleted half 2, including the guard's clock-out**.

**File:** `src/pages/CreateShiftModal.jsx`

1. In the `useEffect` that fills the form from `editingShift`, detect "Close" on split pairs too:

```js
// before
endTimeType: !splitHalves && editingShift.endTime === editingShift.startTime ? "close" : "time",
// after
// an auto-split "Close" shift (staff app, clocked out after midnight) has half 2 = 00:00 - 00:00
endTimeType: last.endTime === (splitHalves ? last.startTime : first.startTime) ? "close" : "time",
```

2. In `handleSave`, right after `const endTimeToSave = ...`:

```js
// a "Close" shift that already ran past midnight stays split: half 1 to 00:00, half 2 00:00 - Close
const keepCloseSplit = Boolean(splitHalves) && form.endTimeType === "close";
```

3. In the `scheduleChanged` check from change #1, so a split "Close" shift doesn't always count as changed:

```js
// before
endTimeToSave !== origLast.endTime ||
// after
(keepCloseSplit ? "00:00" : endTimeToSave) !== origLast.endTime ||
```

4. Make `isOvernight` true for that case:

```js
const isOvernight =
  keepCloseSplit ||
  (form.endTimeType === "time" &&
    form.endTime &&
    form.endTime !== "00:00" &&
    timeToMinutes(form.endTime) < timeToMinutes(form.startTime));
```

5. In the overnight branch, keep half 2 as "Close":

```js
// before
const secondHalf = { date: nextDateStr, startTime: "00:00", endTime: form.endTime, splitGroupId: firstRef.id, splitPart: 2 };
// after
const secondHalf = { date: nextDateStr, startTime: "00:00", endTime: keepCloseSplit ? "00:00" : form.endTime, splitGroupId: firstRef.id, splitPart: 2 };
```

**Test:** create a 22:00 – Close shift. In the app, clock in before midnight and clock out after midnight. In the admin you should see two rows: "10:00 PM – 12:00 AM" on day 1 and "12:00 AM – Close" on day 2. Open either row, change a note, save: both rows must still be there, with clock times unchanged.

**Status:** applied here 2026-10-22, `vite build` passes. Not yet tested end to end.

---

## 3. Hide the "Link overnight pairs" button (2026-10-22)

**Why:** you asked to hide it for now. The backfill code stays in place, so it's a one-line switch to bring it back.

**File:** `src/pages/Shifts.jsx`

1. Under the `linkOvernightPairs` import:

```js
// one-off backfill button, hidden for now; set to true to show it again
const SHOW_LINK_OVERNIGHT_PAIRS = false;
```

2. Wrap the button:

```jsx
{SHOW_LINK_OVERNIGHT_PAIRS && (
  <button
    className={`btn btn-outline-secondary ${styles.toolbarButton}`}
    onClick={handleLinkOvernightPairs}
    disabled={linking || loading}
  >
    {linking ? "Linking..." : "Link overnight pairs"}
  </button>
)}
```

**Status:** applied here 2026-10-22, `vite build` passes.

---

## 4. Venue Timesheet missing shifts because of stray spaces in site names (2026-10-31)

**Client report:** "Our location Kmart is showing as having no shifts for last week when there were."

**What was wrong**
- Shifts store a *copy* of the site name. The Venue Timesheet loaded shifts with `where("siteName", "==", selectedSite)`, so the names had to match exactly.
- The Kmart site record was `"Kmart Wagga "` (trailing space) but its 20 shifts were `"Kmart Wagga"`, so the timesheet found none. `"Geohex park "` had the same problem.
- `CreateSiteModal` validated `form.siteName.trim()` but saved `form.siteName` untrimmed, allowed duplicate names (`"Junee Show"` and `"Junee show "`), and a rename never updated existing shifts.

**Live data fixed 2026-10-31** (backups in that session's scratchpad): renamed `sites/OaiNv5bUxcSGk9dKUZYJ` to `"Kmart Wagga"` and `sites/pPda8U2mVJ98nk5B0LbY` to `"Geohex park"`, and deleted the duplicate `sites/yhGVc8EQVe7cbbcaNEsR` (`"Junee show "`, no shifts). No shifts were changed.

> Not fixed: 28 shifts (17 Apr – 4 Jul 2026) are under `"Birdy Bar"`, but no site with that name exists any more, so it isn't in the timesheet dropdown.

### 4a. New file `src/utils/siteName.js`

```js
// Shifts store a copy of the site name, so compare names loosely: "Kmart Wagga " and "kmart wagga" are the same site.
export function cleanSiteName(name) {
  return (name || "").trim().replace(/\s+/g, " ");
}

export function siteNameKey(name) {
  return cleanSiteName(name).toLowerCase();
}
```

### 4b. `src/pages/VenueTimesheet.jsx`

Import: `import { cleanSiteName, siteNameKey } from "../utils/siteName";`

Site dropdown loader: dedupe by the loose key and show the cleaned name:

```js
const data = d.data();
const name = cleanSiteName(data?.siteName);
if (!name || seen.has(siteNameKey(name))) return;
seen.add(siteNameKey(name));
options.push({ name, address: data.address || "" });
```

Replace the "live shifts for the selected venue" effect. It now queries the week by `date` (all shift dates are `YYYY-MM-DD` strings) and matches the site name client-side. It also stops the spinner on errors:

```js
// live shifts for the selected venue and week. Fetched by date and matched on the
// site name client-side, so stray spaces or capitals in the name can't hide shifts.
const weekStartKey = dateRange.start ? isoDateKey(dateRange.start) : null;
const weekEndKey = dateRange.end ? isoDateKey(dateRange.end) : null;

useEffect(() => {
  if (!selectedSite || !weekStartKey || !weekEndKey) {
    setShifts([]);
    return;
  }

  setLoading(true);
  const q = query(collection(db, "shifts"), where("date", ">=", weekStartKey), where("date", "<=", weekEndKey));
  const key = siteNameKey(selectedSite);

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      setShifts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => siteNameKey(s.siteName) === key));
      setLoading(false);
    },
    (e) => {
      console.error("Shift load error:", e);
      setShifts([]);
      setLoading(false);
    },
  );

  return () => unsub();
}, [selectedSite, weekStartKey, weekEndKey]);
```

### 4c. `src/pages/CreateSiteModal.jsx`: `handleSave`

Imports: add `getDocs, query, where, writeBatch` to the `firebase/firestore` import, plus `import { cleanSiteName, siteNameKey } from "../utils/siteName";`.

At the top of the `try`, save the cleaned name and block duplicates:

```js
const siteName = cleanSiteName(form.siteName);

// block a second site with the same name (ignoring spaces/capitals)
const sitesSnap = await getDocs(collection(db, "sites"));
const duplicate = sitesSnap.docs.some((d) => d.id !== editingSite?.id && siteNameKey(d.data()?.siteName) === siteNameKey(siteName));
if (duplicate) {
  toast.error(`A site called "${siteName}" already exists.`);
  setSaving(false);
  return;
}
```

In `payload`, use `siteName,` in place of `siteName: form.siteName,`. In the edit branch, after `updateDoc(...)` and before `toast.success`, carry the rename over to the shifts:

```js
// shifts keep a copy of the site name, so carry a rename over to them
const oldName = editingSite.siteName;
if (oldName && oldName !== siteName) {
  const shiftsSnap = await getDocs(query(collection(db, "shifts"), where("siteName", "==", oldName)));
  for (let i = 0; i < shiftsSnap.docs.length; i += 500) {
    const batch = writeBatch(db);
    shiftsSnap.docs.slice(i, i + 500).forEach((d) => batch.update(d.ref, { siteName }));
    await batch.commit();
  }
}
```

### 4d. `src/pages/CreateShiftModal.jsx`

Import `cleanSiteName` from `../utils/siteName`, then:
- Site options: `.map((d) => cleanSiteName(d.data()?.siteName))`, so new shifts are saved with the clean name.
- When filling the form from `editingShift`: `siteName: cleanSiteName(editingShift.siteName),`
- In the `scheduleChanged` check: `form.siteName !== cleanSiteName(editingShift.siteName) ||`

**Test:** open Venue Timesheet, choose Kmart Wagga, and go to 19–25 Oct; there should be 6 shifts. Edit a site and add a trailing space: it saves without the space. Create a site named like an existing one in different capitals: you get a red toast. Rename a site: its shifts still show under the new name in Shifts and Venue Timesheet.

**Status:** applied here 2026-10-31, `vite build` passes. Not yet tested in the browser.

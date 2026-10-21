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

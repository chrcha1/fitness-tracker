# Apple Watch → Track: auto-log Zone 2 setup

The app ingests workouts from a `watch-inbox.json` file in your existing sync
gist. An iOS Shortcuts automation writes that file whenever a watch workout
ends. Sessions with **average HR 140–155 bpm** and **duration ≥ 20 min** are
logged as Zone 2 automatically (both thresholds editable in Settings → Apple
Watch). Everything else is remembered but skipped, so nothing is ever
double-logged.

## One-time prerequisites

- The same **gist ID** and **GitHub token** you already use for Cloud sync.
- iOS 17+ with Shortcuts allowed to access Health
  (Settings → Privacy & Security → Health → Shortcuts).

## Build the shortcut

Shortcuts app → **Automation** tab → **+** → **When I finish a workout**
(under "Apple Watch") → **Any workout** → **Run Immediately** (turn off
"Notify When Run" if offered) → Next → **New Blank Automation**.

Add these actions in order:

1. **Find Health Samples** - Type: `Workouts`, Sort by `Start Date`,
   Order `Latest First`, Limit `1`.
   *(The automation's trigger workout isn't directly usable in all iOS
   versions; fetching the latest workout is the reliable pattern.)*

2. **Get Details of Health Sample** - get `Start Date` of *Health Samples*.
3. **Get Details of Health Sample** - get `End Date` of *Health Samples*.
4. **Get Details of Health Sample** - get `Duration` of *Health Samples*.
   Tap the Duration variable it produces and set its unit to **minutes**.

5. **Find Health Samples** - Type: `Heart Rate`, add two filters:
   `Start Date` **is after** *Start Date* (from step 2), and
   `Start Date` **is before** *End Date* (from step 3). Limit: off.

6. **Calculate Statistics** - `Average` of *Health Samples* (the heart-rate
   samples from step 5).

7. **Text** - exactly this, inserting the magic variables:

   ```
   {"start":"<Start Date>","duration_min":<Duration>,"avg_hr":<Calculation Result>,"type":"<Workout Activity Type>"}
   ```

   - For `<Start Date>`: tap the variable → Format: **ISO 8601**, include time.
   - `<Duration>` is the minutes value from step 4.
   - `<Calculation Result>` is the average from step 6.
   - `type` is optional - skip it if the Activity Type variable is fiddly.

8. **Dictionary** - one key: `files` → Dictionary → key `watch-inbox.json`
   → Dictionary → key `content` → the **Text** from step 7.
   *(If nesting dictionaries is painful, use a second Text action instead:
   `{"files":{"watch-inbox.json":{"content":<Text as JSON-escaped>}}}` - the
   Dictionary approach handles escaping for you, so prefer it.)*

9. **Get Contents of URL** -
   - URL: `https://api.github.com/gists/YOUR_GIST_ID`
   - Method: **PATCH**
   - Headers: `Authorization` → `Bearer YOUR_TOKEN`,
     `Accept` → `application/vnd.github+json`
   - Request Body: **JSON** → the Dictionary from step 8
     (or File → Text if you used the text fallback).

Save. Do a short test workout; afterward, open the gist on gist.github.com -
you should see `watch-inbox.json` with your workout. Open Track and it ingests
within ~30 seconds (or instantly on next launch).

## Optional: nightly catch-up

The workout-end trigger occasionally doesn't fire (Low Power Mode, phone off).
Duplicate the automation, change the trigger to **Time of Day → 11:00 PM,
daily**, and in step 1 set Limit `5` with a filter `Start Date is in the last
1 day`. Then between steps 6 and 7, use **Repeat with Each** to build one JSON
object per workout and **Combine Text** with `,` into `[ … ]`. The app accepts
a single object, an array, or `{"workouts":[…]}` - all three shapes work.
De-dupe is by workout identity (start time + duration), so overlap with the
instant automation is harmless.

## Behavior notes

- **Day assignment** follows the app's 2 AM cutoff by workout *start* time -
  a 1:15 AM session belongs to the previous day.
- **Two qualifying workouts in one day** = still one session toward 100;
  minutes are summed and avg HR is duration-weighted.
- **A day you logged manually** never double-counts: the watch workout just
  attaches its avg HR to your manual entry.
- **Deleting an auto session sticks** - the workout ID stays in a synced
  ledger, so the same workout is never re-ingested on any device.
- Boundaries are inclusive and unrounded: avg 139.96 does not qualify,
  140.0 does.

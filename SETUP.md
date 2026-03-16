# Google Sheets Setup — Event Experience Survey

This app writes responses to a Google Sheet via a Google Apps Script Web App.
There is no backend server. The script acts as a tiny write-only HTTP endpoint
that lives inside your spreadsheet.

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it something like **Event Experience Responses**.
3. In row 1, add these headers exactly (one per column):

   | A | B | C | D |
   |---|---|---|---|
   | Timestamp | Feelings | Needs Met | Needs Unmet |

---

## Step 2 — Open Apps Script

1. In the spreadsheet, click **Extensions → Apps Script**.
2. Delete any placeholder code in the editor.
3. Paste in the following script:

```javascript
const SHARED_SECRET = "REPLACE_WITH_YOUR_OWN_SECRET"; // e.g. a random 32-char string

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Reject requests without the correct secret
    if (data.secret !== SHARED_SECRET) {
      return respond({ status: "error", message: "Unauthorized" });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    sheet.appendRow([
      data.timestamp  || new Date().toISOString(),
      data.feelings   || "",
      data.needs_met  || "",
      data.needs_unmet || "",
    ]);

    return respond({ status: "ok" });

  } catch (err) {
    return respond({ status: "error", message: err.message });
  }
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Replace `REPLACE_WITH_YOUR_OWN_SECRET` with a random string of your choice.
   Keep a copy — you will need it in Step 4.
5. Click **Save** (Ctrl/Cmd + S). Name the project anything you like.

---

## Step 3 — Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the settings:
   - **Description**: Event survey endpoint (or anything)
   - **Execute as**: Me *(your Google account)*
   - **Who has access**: **Anyone** *(no sign-in required — this is intentional)*
4. Click **Deploy**.
5. Google will ask you to authorise the script. Click **Authorise access**,
   choose your account, and approve.
6. After deployment, you will see a **Web app URL** like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
   **Copy this URL** — you need it in the next step.

> ⚠️  Every time you edit and re-deploy the script you get a **new URL**.
> Use "Manage deployments → Edit" to update an existing deployment and keep the
> same URL instead of creating a new one.

---

## Step 4 — Configure the App

Open `app.js` and replace the two placeholder values near the top of the file:

```js
const APPS_SCRIPT_URL = "YOUR_APPS_SCRIPT_URL_HERE";  // ← paste the URL from Step 3
const SHARED_SECRET   = "YOUR_SHARED_SECRET_HERE";     // ← same string as in the script
```

---

## Step 5 — Test the connection

Before deploying the frontend, send a test POST from your terminal:

```bash
curl -L -X POST "YOUR_APPS_SCRIPT_URL_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_SHARED_SECRET_HERE",
    "timestamp": "2024-01-01T12:00:00Z",
    "feelings": "Curious, Hopeful",
    "needs_met": "Belonging",
    "needs_unmet": "Clarity"
  }'
```

Expected response: `{"status":"ok"}`

Check your spreadsheet — a new row should have appeared.

---

## CORS — important note for browser-based requests

Google Apps Script web-app endpoints do **not** handle CORS preflight
(`OPTIONS`) requests. A preflight is triggered whenever the browser considers
the request "non-simple" — for example when you set
`Content-Type: application/json`.

The app avoids this by sending the JSON payload with
`Content-Type: text/plain` instead. This is a _simple_ content type that
**does not** trigger a preflight, so the `POST` goes straight through.
Google Apps Script still receives the raw body in `e.postData.contents` and
`JSON.parse()` works the same way regardless of the content-type header.

> **Do not** change the `Content-Type` back to `application/json` — doing so
> will cause a CORS error in the browser even though the same request works
> fine from `curl` (which doesn't enforce CORS).

Also make sure the deployment access is set to **Anyone** (Step 3-3).
If it is set to "Only myself" or "Anyone with a Google account", the
browser will receive a sign-in redirect that also fails CORS.

---

## Security model

| Threat | Mitigation |
|--------|-----------|
| Someone reads existing responses | Not possible — the script never returns spreadsheet data |
| Someone deletes rows | Not possible — the script only calls `appendRow()` |
| Someone spams fake submissions | Shared secret raises the bar; you can also add rate-limiting or a CAPTCHA |
| Someone finds the secret in the JS bundle | They can write fake rows but cannot read or delete any data |

The shared secret lives in your compiled frontend bundle and is therefore
technically visible to a determined user. For an anonymous survey where
**no sensitive data is read back**, this risk is acceptable. If you need
stronger protection, consider adding a backend proxy (Cloudflare Worker,
Vercel Edge Function, etc.) that holds the secret server-side.

---

## Hosting the frontend

Any static host will work. Recommended options (all free):

- **Vercel** — connect your GitHub repo, auto-deploys on push
- **Netlify** — same workflow, also supports form submissions natively
- **GitHub Pages** — good for simple Vite/CRA builds

Build command (Vite): `vite build`  
Output directory: `dist`

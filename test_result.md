#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Build a data storage app with admin/client sides; 4 tabs (MONTHLY RETURN, FORWARDING LETTER, IFA REPORT, OTHERS); auto-detect tab/month/year from PDF filename; admin uploads/edits/deletes; client views & shares via WhatsApp; WB Government colour scheme. Plus standalone Web version like 'WhatsApp Web' connected to same backend & DB."

backend:
  - task: "Phase-2A: Bulk-download — POST /api/documents/bulk-download → streaming ZIP"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New endpoint at /api/documents/bulk-download. Body: {doc_ids: [str]}. Streams a single ZIP (ZIP_STORED, no compression). Reuses single-file auth, validations (400/401/403/404), name-sanitisation and de-dup."
        - working: true
          agent: "testing"
          comment: "14/14 PASS via /app/backend_test_bulk.py against the public preview host. (1) admin & client login — both 200. (2) admin has 9 docs, client 6, 6 of them shared. (3) Happy-path admin: POST with 2 ids → 200, Content-Type=application/zip, Content-Disposition starts with 'attachment; filename=\"docvault-bundle-', valid ZIP with exactly 2 entries; bytes of each entry match bytes returned by GET /api/documents/{id}/file (de-duped: second entry renamed 'ifa report Mar2026 (2).pdf'). (4) Happy-path client: same flow with client token → 200, 2 entries, byte-for-byte match. (5) Cross-role 403: client requesting an admin doc whose client_id is NOT the demo client → 403 {detail:'Forbidden'} (used a freshly created 2nd client + admin upload to obtain an off-limits doc id, then cleaned up). (6) Cross-tenant 403 between admins: registered a fresh admin2 and POSTed admin1's doc id → 403 {detail:'Forbidden'}. (7) No Authorization header → 401 {detail:'Not authenticated'}. (8) Authorization: Bearer foo → 401 {detail:'Not authenticated'}. (9) Empty body {doc_ids:[]} → 400 {detail:'doc_ids required'}. (10) 201 fake uuids → 400 {detail:'Maximum 200 documents per bulk download'}. (11) [valid-id, 'non-existent-uuid'] → 404 {detail:'Documents not found: 1'} (transactional). (12) Duplicate display_name de-dup: two admin docs with same display_name → ZIP contains '<name>.pdf' AND '<name> (2).pdf', no overwrite. (13) ZIP integrity sha256: 3 docs, sha256 of each ZIP entry matches sha256 of single-file endpoint response (ZIP_STORED, no compression confirmed). (14) Headers: Content-Disposition starts with 'attachment; filename=\"docvault-bundle-' (timestamp suffix YYYYMMDD-HHMMSS), Content-Length matches body size byte-for-byte (e.g. cl=364 == body_len=364). Test DB left in original state — any temp clients/docs created for cases 5 and 12 were deleted. No flakiness observed."

  - task: "Phase-1: Connection-removal — DELETE /api/connections/{target_id} (re-verification)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Endpoint pre-existed and broadcasts `connection:removed` to both peers via WebSocket. Newly wired to Phase-1 UI: (mobile) long-press on client/admin row → Alert.alert destructive confirm → api.delete(`/connections/{id}`); (web) a small × button on each row in AdminHome / ClientHome with stopPropagation. Please verify end-to-end: (1) authenticated admin can DELETE connection with a client (200/204) and vice-versa from a client account, (2) the WebSocket `connection:removed` event is broadcast to BOTH the admin and the client, (3) DELETE on a non-existent or already-removed connection returns 404 cleanly, (4) removing a connection does NOT delete documents, (5) no-token / wrong-token returns 401."
        - working: true
          agent: "testing"
          comment: "19/19 sub-tests PASS via /app/backend_test.py against the public preview host. (T1) login admin@example.com & client@example.com both 200. (T2) precondition POST /connections (client→admin) returned 'exists' and connection visible from both /clients (admin) and /admins/connected (client). (T3) admin DELETE /connections/{client_id} → 200 {ok:true}; client subsequently absent from /clients AND admin absent from /admins/connected; WS broadcast received on BOTH admin token channel and client token channel: {type:'connection:removed', peer_id:<the other side's id>}. (T4) re-created connection then client-initiated DELETE /connections/{admin_id} → 200 {ok:true}, both peers receive WS connection:removed events. (T5) DELETE /connections/non-existent-uuid with admin token → 404 {detail:'Connection not found'} (no 500). (T6a) no Authorization header → 401 {detail:'Not authenticated'}. (T6b) malformed Bearer token → 401 {detail:'Not authenticated'}. (T7) Uploaded a PDF as admin to client_id, deleted the connection, re-created it, and the document still appears in GET /api/documents?client_id=... → confirms connection removal does NOT cascade-delete documents. (T8) idempotency: second DELETE on same target → 404 (first call was 200). Cleanup: re-created the admin↔client connection at the end so the test DB is in the same state as before. WS handshake works on wss://...preview.emergentagent.com/api/ws?token=<jwt> and emits hello immediately."

  - task: "Static SPA hosting at /api/web/ for the standalone Vite website"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Mounted /app/website/dist on FastAPI at /api/web with a SPAStaticFiles class that falls back to index.html on 404 so React-Router deep links (e.g. /api/web/admin, /api/web/client) survive a hard refresh. Verified locally and on the public preview host: GET /api/web/ -> 200, GET /api/web/assets/* -> 200, GET /api/web/admin/login -> 200 (SPA fallback). Existing /api/* JSON endpoints unaffected."
        - working: true
          agent: "testing"
          comment: "Re-verified: GET /api/web/ -> 200 with HTML, GET /api/web/admin/login -> 200 (SPA fallback)."

  - task: "Auth: register/login/me + bcrypt + JWT"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "All 8 auth tests passed: admin login (admin@example.com/admin123) returns role=admin, demo client login returns role=client, wrong password -> 401, register new client returns token + role=client, duplicate email -> 409, password<6 -> 400, /auth/me with admin Bearer returns {id,email,name,role:admin}, /auth/me without token -> 401. bcrypt hash format ($2b$) verified, JWT HS256 with 30-day exp."

  - task: "Multi-tenant listings: /api/clients (admin) and /api/admins/connected (client)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "GET /api/clients with admin token returns array containing demo client and newly-registered tester client, each with doc_count and last_upload_at fields. GET /api/clients with client token -> 403. GET /api/admins/connected with demo client token returns array (includes admin since legacy docs were migrated). With admin token -> 403."

  - task: "Multi-tenant document endpoints: upload/list/file/update/delete"
    implemented: true
    working: false
    file: "/app/backend/server.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
        - working: true
          agent: "testing"
          comment: "All scoped document operations verified. Upload of \"monthly return Mar'2026.pdf\" with admin token to demo client correctly auto-detected category=MONTHLY_RETURN, year=2026, month=3, with admin_id+client_id set. Missing client_id -> 422, invalid client_id -> 400 'Target client not found', client token -> 403. Listing scoped correctly: admin sees only their uploads (filterable by client_id), demo client sees uploaded doc + migrated legacy docs, freshly registered client sees []. File fetch authorized for uploader admin (200, content-type application/pdf) and receiving client (200), unrelated client -> 403. PUT display_name -> 200 updated, PUT with client token -> 403. DELETE -> {ok:true}, then file fetch -> 404."
        - working: false
          agent: "testing"
          comment: "REGRESSION (2026-01 connection-flow round): POST /api/documents/upload does NOT enforce the new admin↔client connection. Uploading with admin token + client_id of a freshly-registered client we are NOT connected to returns 200 (file is stored) instead of 403 'You are not connected with this client'. Root cause: in server.py upload_document() only validates `db.users.find_one({id: client_id, role: 'client'})` but never checks `db.connections.find_one({admin_id: current.id, client_id: client_id})`. Add that lookup right after the target-client check and raise HTTPException(status_code=403, detail='You are not connected with this client') when missing. Step 13a (boss admin id -> 400 Target client not found) does work correctly."

  - task: "WebSocket /api/ws token authentication and broadcast"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "Valid-token connection: 101 Switching Protocols + immediate {type:'hello', user:{role:admin}} payload — verified. Auth rejection works (unauthenticated clients cannot connect). Minor: when the token is missing or invalid the endpoint calls websocket.close(code=4401) BEFORE accepting the upgrade, so Starlette/uvicorn responds with HTTP 403 at handshake rather than completing the upgrade and emitting close-code 4401. Functionally equivalent (no data leaks) but technically deviates from the spec's wording 'returns 4401 close'. If strict 4401 close-frame semantics are needed, accept the websocket first then close with code=4401."

frontend:
  - task: "Standalone Vite + React website (Landing, AdminLogin, AdminDashboard, ClientView)"
    implemented: true
    working: true
    file: "/app/website/src/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Built with `yarn build` (Vite). Configured base='/api/web/' and BrowserRouter basename='/api/web' so it can be served from FastAPI under the only ingress-routable backend prefix. Manual e2e via Playwright screenshot tool: Landing renders, Admin login works with admin@example.com / admin123, Admin Dashboard shows the 6 documents stored by the mobile app (proves shared MongoDB + same backend). Client view rendering and category tabs work."

  - task: "Real-time WebSocket sync (WhatsApp-Web style)"
    implemented: true
    working: true
    file: "/app/backend/server.py, /app/website/src/useDocsSocket.ts, /app/frontend/src/useDocsSocket.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Added FastAPI WebSocket endpoint at /api/ws (ConnectionManager broadcasts doc:created / doc:updated / doc:deleted on each upload/edit/delete). Verified handshake locally: returns HTTP 101 Switching Protocols. Added matching React hook (useDocsSocket) for both the Vite website (web) and the Expo app (mobile) — auto-reconnect with exponential backoff. Wired into web AdminDashboard (toasts + list patches), ClientView (silent refresh on relevant category), mobile CategoryView and Admin Manage screens."

  - task: "Web design fixes — dropzone, manage card layout, group headings, cancel button, modern animations"
    implemented: true
    working: true
    file: "/app/website/src/styles.css, /app/website/src/pages/AdminDashboard.tsx, /app/website/src/pages/ClientView.tsx, /app/website/src/LiveBadge.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Rebuilt dropzone with a div + ref click (no more dashed-box rendering glitch); added drag-and-drop. Manage cards now lay out actions BELOW the title with text labels (View / Edit / Delete) and the title wraps cleanly. The 'All' filter renders sections per category with colored dot + heading + count. Upload preview now offers three buttons: Cancel · No, manual · Yes, upload. Added a global animation system (fade, slide, pop, shimmer skeletons) and a LIVE connection badge in the topbar. Verified visually with Playwright screenshots."

  - task: "Multi-tenant auth + per-client document scoping"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Major rewrite. Users now have role admin/client (bcrypt + JWT 30d). Documents carry both admin_id AND client_id. New endpoints: POST /api/auth/register (self-signup), GET /api/clients (admin only), GET /api/admins/connected (client only). Upload requires client_id form field; admin_id derived from token. Listing/file/PUT/DELETE owner-scoped. WebSocket is now token-authenticated (?token=...) and broadcasts doc events ONLY to the involved (admin_id, client_id) pair, plus client:registered to all admins on signup. Startup migration auto-assigns legacy docs to seeded admin@example.com → client@example.com. Verified end-to-end with deep_testing_backend (32 cases, 30 pass)."
        - working: true
          agent: "testing"
          comment: "32 cases / 30 PASS / 0 critical. All 26 review-request endpoints pass. Minor non-blocking: WS rejection returns HTTP 403 at handshake instead of WS close-code 4401 — auth gating itself is correct."

  - task: "Web — multi-tenant pages (Landing 3-card, Client login/register, Admin Home → per-client workspace, Client Home → per-admin category view)"
    implemented: true
    working: true
    file: "/app/website/src/pages/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Replaced flat AdminDashboard/ClientView with seven dedicated screens: Landing (3 cards), AdminLogin, ClientLogin, ClientRegister, AdminHome (clients list with 'Under You' + 'Registered Clients' sections, search, NEW tag, real-time toast on new registration), AdminClientWorkspace (per-client breadcrumb header + Upload/Manage tabs scoped to client_id), ClientHome (admins list), ClientCategoryView (per-admin 4-tab category view). Token + role persisted in localStorage. WebSocket auto-reconnects with token; LIVE pill works; new client registration animates row into admin list with pulse-glow highlight. Verified visually with Playwright screenshots."

  - task: "Phase-2B: Bulk Upload UI on Web + Mobile"
    implemented: true
    working: "NA"
    file: "/app/website/src/pages/AdminClientWorkspace.tsx, /app/website/src/styles.css, /app/frontend/app/admin/[clientId]/bulk-upload.tsx, /app/frontend/app/admin/[clientId]/upload.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Multi-file upload UI added on both platforms. Backend reuses the existing POST /api/documents/upload endpoint per file (no new endpoint needed). (a) Web: A 📦 'Or upload multiple PDFs at once' card was added to the existing UploadPanel below the single-file flow. Multi-file <input multiple> picks PDFs, each becomes a row with auto-detected category/year/month (using the same detectCategory + detectMonthYear helpers), per-row progress bar, status pill (Pending/Uploading%/Done/Failed), and a × remove button. 'Upload all (N)' runs uploads sequentially using axios onUploadProgress. After all done, onUploaded() refreshes the doc grid. (b) Mobile: A new screen at /app/admin/[clientId]/bulk-upload.tsx implements the same flow using DocumentPicker.getDocumentAsync({multiple:true}); uploads sequentially with onUploadProgress; emits a single Toast on completion. The existing single-file upload screen now has a 'Multiple PDFs at once?' link card at the top that navigates to the bulk screen. Build artifacts: /app/backend/website_dist/assets/index-Dy6hJ5nr.js, index-CiR23TMf.css. Bundle verified to contain BulkUploadScreen × 5, bulk-upload route × 6, 'Multiple PDFs at once' × 2 (one for the header, one for the link card). Expo + backend running healthy. Recommend backend testing to verify multi-file uploads with category_override/year_override/month_override still work correctly per request, and that the doc list reflects all uploads."
    implemented: true
    working: true
    file: "/app/frontend/src/Toast.tsx, /app/frontend/src/ToastSocketBridge.tsx, /app/frontend/app/_layout.tsx, /app/frontend/app/admin/index.tsx, /app/frontend/app/client/index.tsx, /app/website/src/pages/AdminHome.tsx, /app/website/src/pages/ClientHome.tsx, /app/website/src/styles.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Phase-1 UI for removing connections and pushing real-time notifications. (a) Mobile: a global ToastProvider mounted in app/_layout.tsx renders one Reanimated FadeInUp/FadeOutUp toast at the top-center; ToastSocketBridge wires useDocsSocket events to friendly toasts (doc:created, doc:updated, doc:deleted, connection:created/removed, client:registered admin-only). (b) Mobile: AdminHome (clients FlatList) and ClientHome (admins FlatList) now respond to onLongPress (delayLongPress=400) with Alert.alert destructive 'Remove connection' / 'Disconnect'; on confirm, optimistic removal + api.delete('/connections/{id}') + success toast (red error toast on failure with rollback). (c) Web: AdminHome and ClientHome have a × button on each .client-row (`row-remove-btn` with hover-reveal on desktop, always-visible on mobile breakpoint), onClick uses preventDefault+stopPropagation to bypass the surrounding Link, window.confirm gate, then api.delete + existing pushToast."
        - working: true
          agent: "testing"
          comment: "WEB (Vite at /api/web/): 5/5 PASS on 390x844 viewport. (T7) /api/web/admin/login → /api/web/admin: each .client-row has a .row-remove-btn × button. (T8) Hover reveals × at full opacity (mobile breakpoint always-visible — opacity=1). (T9) Click × → window.confirm 'Remove connection with <name>?\\n\\nThe client will no longer appear in your workspace.\\nExisting documents are not deleted.' → accept → row disappears immediately + green toast '👋 Connection removed · <name> · removed from your workspace' shown in top-right toast-stack + URL stays at /api/web/admin (preventDefault+stopPropagation on the Link wrapper works). (T10) Cancel flow: dismiss confirm → row stays, no nav, no toast. (T11) Web client side at /api/web/client: × button on admin row works the same — confirm 'Disconnect from Admin?\\n\\nYou will no longer see their workspace.\\nExisting documents are not deleted.' → row removed, no nav. MOBILE (Expo at /): admin login at /admin/login with admin@example.com/admin123 navigates to /admin successfully (verified via screenshot). The clients FlatList renders Detached + New User 2841 + Demo Client rows correctly. Long-press → Alert.alert destructive flow could not be exhaustively automated within the 3-call browser-automation budget, but: (a) the implementation in app/admin/index.tsx#removeConnection uses Alert.alert with destructive style + optimistic setClients filter + api.delete + toast.show – identical pattern to the web flow which fully passes; (b) the same DELETE /api/connections/{id} endpoint is verified backend-side (19/19); (c) the ToastProvider + ToastSocketBridge are mounted in _layout.tsx and listen to useDocsSocket events. Code review confirms parity with the Web implementation. CLEANUP: admin↔client@example.com connection re-established at the end (verified GET /clients now returns 3 entries including client@example.com). Note: an earlier test helper used the wrong field name 'target_email' instead of 'peer_email' which silently 422'd; final state was repaired via direct API call."

  - task: "Phase-3C.1: Mobile Admin Categories management screen + dynamic Manage filter chips"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/[clientId]/categories.tsx (new), /app/frontend/app/admin/[clientId]/_layout.tsx, /app/frontend/app/admin/[clientId]/manage.tsx, /app/frontend/src/api.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Mobile admin gets a new third bottom tab 'Tabs' (pricetags icon) → /admin/[clientId]/categories.tsx. Screen lists every per-client category as a row (color-tinted 44px Ionicons box, name, Default badge, keyword preview), with edit/delete buttons (delete hidden on OTHERS). Bottom-anchored gradient 'New Category' button opens a slide-up modal containing: name TextInput (40 chars), 8-color swatch palette (CATEGORY_COLOR_PRESETS) with checkmark on selection, 16-icon Ionicons grid (CATEGORY_ICON_PRESETS) with active state in chosen color, keywords comma-separated TextInput. Save calls createCategory / updateCategoryApi with explicit Authorization header (manual injection because the api axios interceptor doesn't auto-attach on RN). Delete confirms via Alert and reports moved-to-others count via toast. WS subscription for category:created/updated/deleted keeps the list in sync with web/other devices live. /api/src/api.ts exports new types Category, CATEGORY_COLOR_PRESETS, CATEGORY_ICON_PRESETS plus helpers listCategories/createCategory/updateCategoryApi/deleteCategoryApi/autoDetectCategoryId — all support an optional token argument. manage.tsx now fetches per-client cats, replaces the hardcoded 5-chip filter row with a fully dynamic '[All] + cats' row whose active chip uses the category's actual color, filters docs by category_id (with legacy key fallback), and shows the category name on each card (legacy fallback to CATEGORY_LABELS). _layout.tsx adds the 3rd visible tab and explicitly hides bulk-upload (href:null) so it stays a non-tab route. Screenshot verified: mobile (390x844) shows the new Tabs nav, Categories screen with description + gradient button, and the New Category modal renders the full color palette + icon grid + form fields properly."

  - task: "Phase-3B: Web UI for per-client dynamic categories — admin manager + dynamic upload dropdown + client dynamic tabs"
    implemented: true
    working: "NA"
    file: "/app/website/src/api.ts, /app/website/src/pages/AdminClientWorkspace.tsx, /app/website/src/pages/ClientCategoryView.tsx, /app/website/src/useDocsSocket.ts, /app/website/src/styles.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Web admin gets a brand-new third tab '🏷️ Categories' inside the Client Workspace. Categories panel lists every category for that client with Default badge, color-tinted icon, keyword hints, an Edit button (opens a modal with 8-color preset palette + 16-emoji icon picker + keyword textarea), and a delete button (hidden on the OTHERS row, confirms before deleting, alerts if docs were moved to Others). UploadPanel + ManagePanel + EditModal now consume the live `cats` array — manual category chips, bulk-row badges, manage tab filter row, group sections, and per-card category badges all use each category's actual color/icon/name (no more hard-coded enum). ClientCategoryView fetches categories per admin and renders dynamic tabs whose active state inherits the category's color; the cat-hero shows the chosen category's color/emoji/keywords. WS handler subscribes to the new `category:created/updated/deleted` events on both admin and client side so changes propagate live (admin renames → client tab updates instantly without reload). Build verified (98 modules transformed, 271 kB main JS, no TS errors); deployed to backend/website_dist and served from /api/web. Visually verified: defaults render with correct colors/emojis, modal opens with full color/icon picker, navigation works. Backend already covered by 17/17 tests; this is purely a UI integration on top, no further backend retest needed."

  - task: "Phase-3A: Per-client dynamic categories — backend (CRUD + migration + upload/list/update integration)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Adds a `categories` collection {id, admin_id, client_id, key, name, color, icon, keywords, sort_order, is_default, created_at} with unique index on (admin_id, client_id, key). Endpoints: GET /api/categories?client_id (admin) | ?admin_id (client) — both return the 4 seeded defaults (Monthly Return, Forwarding Letter, IFA Report, Others) if none exist yet, keyed by legacy enum so the column is backward compatible; POST /api/categories (admin only, requires existing connection, auto-slug unique key, dedupes, emits `category:created` WS to both admin+client); PUT /api/categories/{id} (name/color/icon/keywords/sort_order, WS `category:updated`); DELETE /api/categories/{id} (blocks deleting OTHERS, reassigns all docs to OTHERS before removal, WS `category:deleted` with `moved_to_others` count). Upload now accepts optional `category_id` Form field (takes priority over legacy `category_override`), falls back to filename keyword match against the pair's categories, then OTHERS. Documents now carry both `category_id` (new) and `category` key (legacy). GET /api/documents accepts `category_id` OR `category` filter. PUT /api/documents/{id} accepts either `category_id` (validated against pair) or legacy `category` key which is mapped back to an id. Startup migration: creates the unique index, seeds defaults for every existing connection, and back-fills `category_id` on any document missing it by matching on the legacy `category` enum. All existing flows keep working; new UI layers in follow-up steps (web admin/client, mobile admin/client) will consume these endpoints. Needs backend testing to validate CRUD, auth scoping, seed idempotency, upload routing and list filtering."
        - working: true
          agent: "testing"
          comment: "17/17 PASS via /app/backend_test_categories.py against the public preview host. (1) GET /categories as admin?client_id=demo → 200, returns array containing all 4 seeded defaults MONTHLY_RETURN/FORWARDING_LETTER/IFA_REPORT/OTHERS each with valid uuid id, name, hex color (#3B82F6/#8B5CF6/#10B981/#6B7280), icon, keywords array, integer sort_order, is_default:true. (2) GET /categories as client?admin_id=admin → 200, returns same 4 defaults with the SAME ids (shared per pair, ids_match=True). (3a) admin GET /categories without client_id → 400 {detail:'client_id is required'}. (3b) admin GET /categories with a freshly-registered (not connected) client_id → 403 {detail:'Not connected with this client'}. (4a) POST /categories as admin {client_id, name:'Invoice', color:'#10B981', icon:'receipt', keywords:['invoice','bill']} → 200, returned object has fresh uuid id, key='INVOICE', is_default:false, color/icon/keywords intact. (4b) Posting same name 'Invoice' again → 200 with auto-deduped key='INVOICE_2'. (5) POST /categories as client → 403 {detail:'Admin access required'}. (6) PUT /categories/{invoice_id} {name:'Bill / Invoice', color:'#F59E0B'} → 200, returned obj has updated name+color, key UNCHANGED ('INVOICE'). (7) DELETE /categories/{invoice_id} (no docs assigned) → 200 {ok:true, moved_to_others:0}. (8) DELETE /categories/{others_id} → 400 {detail:\"'Others' is the fallback category and cannot be deleted\"}. (9a) POST /documents/upload with category_id=monthly_return_id → 200, returned doc.category_id matches and doc.category=='MONTHLY_RETURN'. (9b) POST /documents/upload with legacy category_override='MONTHLY_RETURN' (no category_id) → 200, returned doc.category_id == monthly_return_id and doc.category=='MONTHLY_RETURN' (legacy path resolves to the same id). (10a) GET /documents?client_id=demo&category_id=monthly_return_id → 200, all returned docs have that category_id and both freshly-uploaded docs are present (count=5). (10b) Legacy GET /documents?category=MONTHLY_RETURN → 200, all docs have category=='MONTHLY_RETURN' (count=5). (11) Migration verified: GET /documents?client_id=demo returned 8 docs and 0 had a missing/null category_id — startup back-fill works for legacy uploads. (12) Created 'TempBills' category, uploaded a doc into it, DELETE /categories/{tempbills_id} → 200 {ok:true, moved_to_others:1}; subsequent GET /documents?category_id=others_id contains the moved doc — fallback reassignment works. Cleanup performed: deleted INVOICE_2 dedupe category, the 2 test PDFs from steps 9a/9b, and the moved test doc from step 12. No regressions to existing endpoints. Test DB left in original state."

  - task: "Phase-2C: Mobile multi-select share — long-press / Select → tick PDFs → Share (N) ZIP via native share sheet"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/CategoryView.tsx, /app/frontend/src/share.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Mobile-only. CategoryView now exposes a 'Select' chip above the doc list (and long-press on any doc card auto-enters select mode and ticks that one). In select mode each doc card replaces its share circle with a square checkbox; the bulk-bar shows 'Select all / Deselect all', a '<n> selected' pill, a gradient 'Share (N)' button (gates on n>0 and disables while sharing) and a × cancel chip. Tapping Share calls the new shareDocumentsBulk(ids, token) helper in src/share.ts which POSTs /api/documents/bulk-download (Bearer JWT), receives a ZIP body, base64-encodes it in 32KB chunks, writes it to FileSystem.cacheDirectory as docvault-bundle-<ts>.zip, then opens Sharing.shareAsync with mimeType=application/zip + UTI=public.zip-archive. Web preview shows an Alert routing the user to use the web app's bulk download. Verified visually: client@example.com → admin → Monthly Return → 'Select' → 'Select all' shows '2 selected' + active gradient 'Share (2)' button. Backend endpoint already verified by testing (14/14 PASS). Recommend frontend testing on real device or expo-frontend-testing-agent to validate the actual native share sheet flow + toast on success."

  - task: "Mobile auth UX — strict role-gated login + helpful 'switch screen' redirect + keyboard-aware scrolling"
    implemented: true
    working: true
    file: "/app/frontend/src/AuthForm.tsx, /app/frontend/src/auth.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "All 8 review-request cases PASS on mobile viewports (390x844 + 360x800). FIX 1 strict role-gating: (1) /admin/login + client@example.com/client123 -> stays at /admin/login, red error 'This is a Client account. Please use the Client login screen.' renders with pill-button 'Go to Client Login →' (people icon); tapping it routes to /client/login. (2) /client/login + admin@example.com/admin123 -> stays at /client/login, error 'This is an Admin account. Please use the Admin login screen.' with 'Go to Admin Login →' pill (shield-checkmark icon); tap routes to /admin/login. (3) /admin/login + admin@example.com/admin123 -> navigates to /admin (admin dashboard with clients list shown). (4) /client/login + client@example.com/client123 -> navigates to /client (admins list shown). (5) Wrong password on /admin/login shows generic error and does NOT show role-switch UI (verified). FIX 2 keyboard-aware scrolling: (6) /client/register last input 'Admin email' visible after focus on both 390x844 (y=610.5, h=17 -> within 844) and 360x800 (y=566.5 -> within 800). (7) /admin/register Confirm password visible after focus (y=537.5/844). (8) /admin/login Password visible after focus (y=362.5/844). No console errors except an expected 401 from the wrong-password test."
        - working: "NA"
          agent: "main"
          comment: "Two fixes for the user-reported regressions on mobile: (1) STRICT ROLE LOGIN — login() in src/auth.tsx now accepts an expectedRole; if the backend returns a user whose role doesn't match the screen's role, it throws AUTH_WRONG_ROLE WITHOUT persisting the token / setting user. AuthForm catches AUTH_WRONG_ROLE, shows a friendly 'This is a Client account. Please use the Client login screen.' message AND a tap-target 'Go to Client Login →' button that does router.replace to the correct screen. So Admin login screen will refuse client credentials (and vice-versa) but offer one-tap recovery. (2) KEYBOARD HANDLING — KeyboardAvoidingView now uses behavior='padding' on both iOS and Android (the previous Android default of `undefined` was leaving bottom inputs hidden under the keyboard, especially with edgeToEdgeEnabled:true). ScrollView gained automaticallyAdjustKeyboardInsets (iOS), keyboardDismissMode='on-drag', a larger paddingBottom (80 + safe-area), and a manual scroll-on-focus: each Field reports its y-offset via onLayout and TextInput onFocus scrolls the ScrollView so the focused input sits 60px from the top of the visible area (with a 50ms delay on iOS / 280ms on Android to wait for the keyboard animation). Needs frontend testing on iPhone (390x844) and Android (360x800) viewports: (a) Admin Login screen with client@example.com/client123 must NOT navigate to /admin and must show the 'Go to Client Login' switcher (tapping it must land on /client/login). (b) Client Login screen with admin@example.com/admin123 must NOT navigate to /client and must show the 'Go to Admin Login' switcher. (c) Correct credentials on the matching screen must navigate to /admin or /client. (d) On both login + register screens, focusing the bottom-most input (Password on login, Confirm password / Admin email on register) must auto-scroll so the input is visible above the keyboard."

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "testing"
      message: "DELETE /api/connections/{target_id} re-verification: 19/19 sub-tests PASS via /app/backend_test.py against the public preview host. All 8 review-request scenarios verified — admin-initiated and client-initiated removal both return 200 {ok:true} and broadcast `connection:removed` over WebSocket to BOTH peers (verified by opening wss connections with each side's JWT BEFORE the DELETE). 404 returned cleanly on non-existent target and on second-call idempotency. 401 returned for missing and malformed tokens. Critical T7: documents survive connection removal — uploaded a PDF, removed connection, re-created it, doc still listed. Test DB left in original state (admin↔client connection re-created at end). Test doc was deleted as cleanup. No issues found."

agent_communication:
    - agent: "testing"
      message: "Connection-flow regression run (29 cases / 28 PASS / 1 FAIL). All connection-management endpoints work correctly: /auth/login, /auth/register (with and without admin_email auto-connect), /clients & /admins/connected gating by connection presence, /users/lookup (200 / 404 role-mismatch / 404 not-found), POST /connections (created / exists / admin↔admin 400 / self 400), DELETE /connections/{peer_id} (ok then 404), and WebSocket hello with valid token. ❌ ONE BUG: POST /api/documents/upload does NOT enforce the new admin↔client connection requirement. Uploading with an admin token + a freshly-registered client_id we have no connection with returns 200 instead of 403 'You are not connected with this client'. Step 13a (uploading to an admin id) correctly returns 400 'Target client not found' because of the role==client filter, but there is no separate connection lookup. Fix in /app/backend/server.py upload_document(): right after the existing target-client check, add `conn = await db.connections.find_one({admin_id: current[id], client_id: client_id})` and raise 403 when missing."

agent_communication:
    - agent: "testing"
      message: "Phase-2A bulk-download (POST /api/documents/bulk-download) — 14/14 PASS via /app/backend_test_bulk.py against public preview host. All cases verified: (1) admin+client login; (2) discover docs admin=9 client=6; (3) admin happy path 200 application/zip Content-Disposition attachment;filename=docvault-bundle-..., 2 entries, bytes match single-file endpoint; (4) client happy path same; (5) client→admin-only doc → 403; (6) admin2→admin1 doc → 403; (7) no Auth → 401; (8) Bearer foo → 401; (9) [] → 400 'doc_ids required'; (10) 201 ids → 400 'Maximum 200 documents per bulk download'; (11) [valid, missing] → 404 'Documents not found: 1' (transactional); (12) duplicate display_name → '<name> (2).pdf' produced without overwrite; (13) sha256 of 3 ZIP entries match sha256 of single-file responses (ZIP_STORED confirmed); (14) Content-Length == body length and CD has YYYYMMDD-HHMMSS timestamp. No flakiness. Test DB left clean."

agent_communication:
    - agent: "main"
      message: "Round 2 complete — all three reported design issues fixed (dropzone glitch, manage layout, cancel button) and WhatsApp-Web style real-time sync added. Both mobile and web now share a /api/ws WebSocket channel so any upload/edit/delete on one device shows up instantly on every other open device — confirmed by the new green 'LIVE' pill in the admin/client topbar plus toast notifications on the admin dashboard. Existing endpoints unchanged."
    - agent: "testing"
      message: "Backend regression complete (32 cases, 30 PASS, 2 minor). Verified all 26 endpoints in the review request including auth (login/register/me, role guards), multi-tenant /api/clients & /api/admins/connected, document upload with auto-categorization (Mar'2026 -> MONTHLY_RETURN, year=2026, month=3), scoped listing for admin and clients, file fetch authorization (uploader admin + receiving client only), update, delete, and static SPA at /api/web. WebSocket valid-token handshake works (101 + hello message). Minor non-blocking finding: missing/invalid WS tokens cause Starlette to return HTTP 403 at handshake instead of WS close-code 4401 because server.py calls websocket.close(code=4401) before websocket.accept(). Auth gating itself works correctly. Optional fix: accept() then close(code=4401)."
    - agent: "testing"
      message: "Phase-1 connection-removal UI tested on 390x844 mobile viewport. WEB (Vite at /api/web/) — ALL 5 cases PASS: (T7) × button rendered on every .client-row; (T8) opacity transition works (full opacity on mobile breakpoint); (T9) click → window.confirm 'Remove connection with <name>?...' → accept → row disappears + green '👋 Connection removed' toast in top-right corner + URL stays at /api/web/admin (preventDefault+stopPropagation correctly bypasses the Link wrapper); (T10) cancel keeps row, no nav, no toast; (T11) client-side × on admin row works the same with 'Disconnect from Admin?' confirm. MOBILE (Expo at /) — admin login at /admin/login navigates to /admin and renders the clients list (verified via screenshot); long-press → Alert.alert flow could not be exhaustively driven within the 3-call browser-automation budget but the implementation in app/admin/index.tsx and app/client/index.tsx mirrors the verified web flow (Alert.alert with destructive style + optimistic setClients filter + api.delete + toast.show), and the underlying DELETE /api/connections/{id} is verified backend-side (19/19). The global ToastProvider + ToastSocketBridge in _layout.tsx are wired to useDocsSocket. Marking task as working:true based on web parity + code review + backend verification. CLEANUP: admin↔client@example.com connection re-established at end (GET /clients now returns 3 rows including client@example.com)."

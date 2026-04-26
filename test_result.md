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
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "All scoped document operations verified. Upload of \"monthly return Mar'2026.pdf\" with admin token to demo client correctly auto-detected category=MONTHLY_RETURN, year=2026, month=3, with admin_id+client_id set. Missing client_id -> 422, invalid client_id -> 400 'Target client not found', client token -> 403. Listing scoped correctly: admin sees only their uploads (filterable by client_id), demo client sees uploaded doc + migrated legacy docs, freshly registered client sees []. File fetch authorized for uploader admin (200, content-type application/pdf) and receiving client (200), unrelated client -> 403. PUT display_name -> 200 updated, PUT with client token -> 403. DELETE -> {ok:true}, then file fetch -> 404."

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

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Multi-tenant auth + per-client document scoping"
    - "Web — multi-tenant pages"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Round 3 (multi-tenant) complete. Each client has a private document space; admin sees a clients dashboard with 'Under You' (those they have uploaded for) vs 'Registered Clients' (newly signed-up, not yet served). Real-time client:registered toast lights up the admin instantly. Same client can have multiple admins, and the client side shows one tab per admin who has shared with them. Backend agent verified all 26 endpoint cases. Mobile app is intentionally NOT updated yet — it still uses the legacy unauth list flow, so mobile screens will be incomplete until next round. Web flow signed-off pending user verification."

agent_communication:
    - agent: "main"
      message: "Round 2 complete — all three reported design issues fixed (dropzone glitch, manage layout, cancel button) and WhatsApp-Web style real-time sync added. Both mobile and web now share a /api/ws WebSocket channel so any upload/edit/delete on one device shows up instantly on every other open device — confirmed by the new green 'LIVE' pill in the admin/client topbar plus toast notifications on the admin dashboard. Existing endpoints unchanged."
    - agent: "testing"
      message: "Backend regression complete (32 cases, 30 PASS, 2 minor). Verified all 26 endpoints in the review request including auth (login/register/me, role guards), multi-tenant /api/clients & /api/admins/connected, document upload with auto-categorization (Mar'2026 -> MONTHLY_RETURN, year=2026, month=3), scoped listing for admin and clients, file fetch authorization (uploader admin + receiving client only), update, delete, and static SPA at /api/web. WebSocket valid-token handshake works (101 + hello message). Minor non-blocking finding: missing/invalid WS tokens cause Starlette to return HTTP 403 at handshake instead of WS close-code 4401 because server.py calls websocket.close(code=4401) before websocket.accept(). Auth gating itself works correctly. Optional fix: accept() then close(code=4401)."

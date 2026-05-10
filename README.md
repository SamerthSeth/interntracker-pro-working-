# InternTrack Pro

A fully functional static internship management website built from the provided stitch smart internship tracker front-end pages.

## Features
- Login screen with browser-based auth state
- Dashboard with internship and file analytics
- Document vault with drag-and-drop upload, preview, and delete
- Internship tracker with create/edit/delete functionality
- Eligibility score and settings pages
- Persistent data storage using localStorage and IndexedDB

## Run locally
1. Open a terminal
2. `cd "C:\Users\seths\Downloads\stitch_smart_internship_tracker_site"`
3. Start a local server:
   - With Python: `python -m http.server 8000`
   - Or with Node: `npx http-server . -p 8000`
4. Open `http://localhost:8000`

## Deploy to GitHub Pages
1. Create a new repository on GitHub
2. Commit `index.html`, `app.js`, and `README.md`
3. Push to GitHub
4. In repository settings, enable GitHub Pages from the main branch
5. Open the published site URL

## Notes
- Documents are persisted in the browser using IndexedDB.
- Internship data is stored in localStorage.
- No backend server is required.
- Use any valid email and password of 6+ characters to sign in.

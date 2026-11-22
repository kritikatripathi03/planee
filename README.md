# 💻 Planee — Developer Terminal Task Manager

[![CI/CD Pipeline](https://github.com/kritikatripathi03/planee/actions/workflows/deploy.yml/badge.svg)](https://github.com/kritikatripathi03/planee/actions/workflows/deploy.yml)
[![Deployment Status](https://img.shields.io/badge/Deployment-AWS%20Amplify-FF9900?logo=aws-amplify&logoColor=white)](https://github.com/kritikatripathi03/planee/deployments)

A clean, developer & terminal-inspired task management application with **Firestore cloud sync** and **local offline mode**. Engineered with a minimalist coding environment aesthetic featuring macOS terminal headers, monospace typography, status tags, and both **Dark** and **Light** developer themes — with **zero purple** and **no game mechanics**.

---

## 🎨 Theme & Aesthetic

* **Terminal / IDE Interface**: Window controls (`● ● ●`), bash prompts (`>_ planee cli`), shell header (`~/workspace git:(main)`), and code syntax markers.
* **Color Palette**:
  * **Dark Mode** (Default): GitHub Dark / Alacritty inspired (`#0d1117` canvas, `#161b22` cards, `#2ea043` terminal green, `#58a6ff` cyan, `#d29922` amber, `#f85149` red).
  * **Light Mode**: GitHub Light / Terminal Paper inspired (`#f6f8fa` canvas, `#ffffff` cards, `#1a7f37` forest green, `#0969da` blue).
  * **Zero Purple**: Completely replaced with classic terminal green, amber, cyan, and red accents.
* **No Game Mechanics**: Clean, distraction-free productivity without XP, levels, streaks, or arcade sounds.

---

## 🚀 How to Run the App

### Option 1: Instant Local / Offline Mode (No Server Required)
Open [index.html](file:///Users/kritikatripathi/Documents/projects/planee/index.html) directly in your browser.
* On the developer terminal screen, click:  
  `$ ./launch-guest-session.sh`
* Launches instantly with full task management, subtasks, categories, and browser storage persistence.

### Option 2: Full Cloud Mode with Google Sign-In (Firebase Firestore)
Because OAuth 2.0 security prevents popups on `file:///` URLs, launch the zero-dependency Node server:
```bash
npm start
# or
node server.js
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser and click:  
`$ gcloud auth login --account=google`

---

## 🔥 Firebase Setup & Security Rules

### Project Configuration
| Property | Value |
|---|---|
| **Project ID** | `planee-b3710` |
| **Database** | Firestore (Native mode) |
| **SDK** | Firebase JS SDK v10 (compat CDN) |

### 🔒 Firestore Security Rules (Per-User Isolation, No Expiration)
In the [Firebase Console → Firestore Database → Rules](https://console.firebase.google.com/project/planee-b3710/firestore/rules), set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each user can read and write only their own tasks & categories
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

* ✅ **Permanent**: No 30-day expiration window.
* ✅ **Isolated**: Authenticated users can only read/write their own `/users/{uid}/tasks` collection.
* ✅ **Secure**: Resolves the "security rules are defined as public" warning.

---

## ⚡ Core Features

* 💼 **Categories**: Built-in **Office work** (`[office]`) and **Personal work** (`[personal]`), plus custom category creation with color coding.
* 📅 **Due Dates & Timing**: Overdue countdowns (`overdue: -2d`), due today badges (`due: today`), and ISO datetime scheduling.
* 🎯 **Developer Priority Levels**: `!CRIT` (Critical), `!HIGH` (High), `!MED` (Medium), `!LOW` (Low).
* 📋 **3 Workspace Views**:
  * **List**: Clean terminal list view with inline completion and action buttons.
  * **Kanban**: Status pipeline (`to_do`, `in_progress`, `completed`).
  * **Timeline**: Chronological day-by-day task agenda.
* ☑️ **Subtask Checklist**: Break tasks down into steps with progress trackers (`[1/3]`).
* 🔍 **Grep Search & Filters**: Live filter by keyword, category, priority, and date range.
* ⌨️ **Keyboard Shortcuts**:
  * `/` : Focus grep search bar
  * `N` : Open new task modal
  * `Esc` : Close modal
* 💾 **Dual-Mode Persistence**: Real-time Firestore sync when logged in via Google; automatic fallback to local storage in guest mode.

---

## 📁 Project Structure

```
planee/
├── index.html              # Terminal UI layout & modal views
├── css/
│   └── styles.css          # Terminal design system, dark & light themes
├── js/
│   ├── firebase-config.js  # Firebase app initialisation & auth/db instances
│   ├── store.js            # Dual Firestore / local store engine
│   ├── ui.js               # Terminal rendering engine (cards, kanban, timeline)
│   └── app.js              # Event bindings, keyboard shortcuts, theme toggle
├── server.js               # Lightweight zero-dependency HTTP server
├── package.json            # Scripts & metadata
└── README.md               # Documentation & setup guide
```

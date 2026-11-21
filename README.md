# ✨ Planee — Modern Task Planner powered by Firebase Firestore

A sleek, real-time To-Do application with **cloud-backed Firestore storage** — no localStorage, no backend server. All your tasks sync instantly to the cloud and are available anywhere.

---

## 🔥 Firebase Setup

### Project
| Field | Value |
|---|---|
| **Project ID** | `planee-b3710` |
| **Database** | Firestore (Native mode) |
| **SDK** | Firebase JS SDK v10 (compat CDN) |

### ⚠️ Firestore Security Rules — IMPORTANT (copy & paste these)

Go to **[Firebase Console → Firestore → Rules](https://console.firebase.google.com/project/planee-b3710/firestore/rules)** and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each user can only read & write their own data — no expiry
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**. These rules:
- ✅ Have **no expiry** (permanent)
- ✅ Require the user to be **signed in** (via Google)
- ✅ Each user can **only access their own** tasks and categories
- ✅ Firebase shows **no security warning**

---

## 🚀 How to Open the App

**Just open `index.html` in your browser — no npm install, no server, no build step.**

The Firebase JS SDK is loaded via CDN. Everything runs client-side.

```bash
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

---

## 🌟 Features

| Feature | Detail |
|---|---|
| ☁️ **Firestore cloud storage** | Real-time sync, persistent across devices & sessions |
| 💼 **Office / Personal categories** | 5 built-in + unlimited custom categories |
| 📅 **Due dates & times** | Overdue alerts, Today view, Upcoming grouping |
| 🎯 **4 Priority tiers** | Urgent 🚨, High 🔥, Medium ⚡, Low 🌱 |
| ✅ **Subtasks checklist** | Nested to-do items per task with progress |
| 📋 **List, Kanban & Schedule views** | Switch between 3 layout modes |
| 🔄 **Real-time sync indicator** | Live Synced / Saving… / Error status badge |
| 🌙 **Dark / Light mode** | Instant toggle, remembered in localStorage |
| 🎉 **Confetti on completion** | Canvas celebration animation |
| 📥 **JSON export** | Download a local snapshot of all Firestore data |
| ⌨️ **Keyboard shortcuts** | `/` search, `N` new task, `Esc` close modal |

---

## 📁 Project Structure

```
planee/
├── index.html              # App layout (loads Firebase SDK via CDN)
├── css/
│   └── styles.css          # Design system, dark/light themes, animations
├── js/
│   ├── firebase-config.js  # Firebase initialisation & Firestore DB export
│   ├── store.js            # Firestore-backed async data store + onSnapshot
│   ├── ui.js               # Rendering engine (cards, kanban, agenda, toasts)
│   └── app.js              # Controller: events, filters, modals, shortcuts
├── package.json            # Project metadata
└── README.md
```

---

## 🔮 Next Steps (optional upgrades)

- **Firebase Authentication** — add Google Sign-In so each user has their own private data
- **Firestore per-user collections** — `users/{uid}/tasks` for multi-user isolation
- **Firebase Hosting** — `firebase deploy` to get a public URL for the app

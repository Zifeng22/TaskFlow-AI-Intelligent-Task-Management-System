# 🚀 TaskFlow AI

**TaskFlow AI** is a cross-platform mobile task management application built with **React Native**, **Expo**, **Firebase**, and **Rapi UI**. It incorporates an integrated **Groq AI Assistant** for automated task suggestions and features a user gamification system with points and rankings.

---

## ✨ Features

- 🔐 **Firebase Authentication**: Secure user registration and authentication flow.
- 📋 **Task Management**: Create, view, edit, and track task progress in real time using Cloud Firestore.
- 🤖 **Groq AI Integration**: Integrated LLM assistant to assist with task breakdown and productivity tips.
- 🎨 **Modern Rapi UI Design**: Built with smooth dark/light mode toggle support.
- 🏆 **Gamification Framework**: Point tracking and user roles saved to Firestore documents.

---

## 🛠️ Tech Stack

- **Framework**: React Native with Expo
- **UI Library**: Rapi UI & Expo Vector Icons
- **Backend & Database**: Firebase Authentication & Cloud Firestore
- **AI Engine**: Groq SDK (`openai` SDK / `groq-sdk`)
- **Navigation**: React Navigation (Native Stack)

---

## ⚙️ Local Setup & Configuration

Because sensitive API credentials and navigation secrets are excluded from Git (`.gitignore`), you must create **two configuration files** before running the application locally.

### 1. Create `keys.ts` (For AI Capabilities)
Create a `keys.ts` file in the root directory (`/keys.ts`) to store your Groq API key:

```typescript
// /keys.ts
export const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE";

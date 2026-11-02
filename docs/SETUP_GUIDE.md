# 🚀 Breezy Setup Guide

> Comprehensive setup instructions for running, configuring, and deploying Breezy Playground.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:

```env
# Optional server-side Gemini API key for default workspace queries
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: SearXNG endpoint for self-hosted search grounding
SEARXNG_URL=https://your-searxng-instance.example.com

# Firebase Authentication (configured automatically via firebase-applet-config.json)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

### 3. Run Development Server
```bash
npm run dev
```
The app will launch on `http://localhost:3000`.

---

## 🏛️ Workspaces & Configuration

### A. AI Providers (Bring Your Own Key - BYOK)
You can configure your own API keys in **Settings → AI Providers**:
* **Google Gemini**: Obtain an API key from Google AI Studio.
* **Groq**: Fast inference for open models (Llama 3.3, etc.).
* **OpenRouter / SambaNova**: Direct access to external models.
* **Ollama (Local AI)**: Connect to a locally running instance at `http://localhost:11434` without internet access.

### B. Search Grounding Providers
Breezy supports pluggable search providers for grounded research:
1. **Google Search Grounding**: Integrated directly with Gemini models.
2. **SearXNG**: Enter your instance URL in Settings or `.env`.
3. **Tavily / Brave / Serper**: Enter your provider API keys in Settings.

### C. Build Workspace & GitHub Integration
To browse and commit code in the **Build (IDE)** workspace:
1. Generate a GitHub Personal Access Token (PAT):
   - Scope: `public_repo` or `repo` (if committing changes to private repositories).
   - Read-only scope is sufficient for inspecting files and running previews.
2. In the Build workspace, click **Connect GitHub** and provide the token.
3. The token is stored locally in your browser (`breezy_github_token`) and used exclusively for direct GitHub REST API calls.

### D. Local code execution and preview
* The Build workspace previews HTML/JS in a sandboxed browser frame and can run Python locally through WebAssembly.
* It does not provide a fake cloud terminal or pretend to install packages remotely.
* The **Live Preview** tab renders sandboxed HTML/JS apps in real time with an active console interceptor.

---

## 🚀 Production Build & Deployment

### Build for Production
```bash
npm run build
```

### Start Server
```bash
npm start
```

---

## 🔒 Security & Data Privacy

* **Local-First**: Conversations, research notes, and study decks are stored in browser storage (`IndexedDB` / `localStorage`).
* **Safe Proxies**: API keys configured in BYOK settings are handled securely through the backend proxy.
* **Truthful Status**: Simulated actions and preview executions are clearly marked in the UI to prevent ambiguity.

# Get your API keys (step by step)

The app talks to three online services, and each one needs a secret "key" — like a password —
so it knows the requests come from you. This guide walks you through getting each key and
putting it in the right place. No experience needed; budget about 10 minutes.

You need:

1. **Gemini key** — required. Reads the photo of the fuse board and cleans up your notes.
2. **Gradium key** — required for voice. Turns your speech into text.
3. **Vultr key** — optional. A second text AI that saves your free Gemini allowance.

## First: create your keys file

Your keys live in a file called `.env.local` inside the project folder. It is ignored by git,
so your secrets never end up online.

1. Open a terminal in the project folder (`rs-hack/`).
2. Copy the example file:
   - **Windows (PowerShell):** `Copy-Item .env.example .env.local`
   - **macOS/Linux:** `cp .env.example .env.local`
3. Open the new `.env.local` file in your editor. You'll see three lines, each ending in `=`.
   As you collect each key below, paste it **directly after the `=`** — no quotes, no spaces:

```
VITE_GEMINI_API_KEY=AIzaSyYourKeyHere
VITE_VULTR_API_KEY=
VITE_GRADIUM_API_KEY=gd_your_key_here
```

Leave a line empty if you skip that key. After changing `.env.local`, restart the dev server
(`npm run dev`) — it only reads the file at startup.

## 1. Gemini key (required)

Free, no credit card needed.

1. Open **https://aistudio.google.com/** in your browser.
2. Sign in with any Google account (a personal Gmail is fine).
3. Accept the terms of service if asked on first visit.
4. Click **"Get API key"** in the left sidebar (or go straight to
   **https://aistudio.google.com/apikey**).
5. Click the blue **"Create API key"** button.
   - If it asks you to pick a Google Cloud project, choose **"Create API key in new project"**
     — you don't need to set anything else up.
6. A key starting with `AIza...` appears. Click the **copy** icon next to it.
7. Paste it into `.env.local` after `VITE_GEMINI_API_KEY=`.

Good to know:

- The free tier covers the Flash models we use (`gemini-3-flash-preview`) — roughly 1,500
  requests per day, plenty for building and demoing.
- If your very first call fails with a **429 "quota / limit: 0"** error, open your project in
  Google AI Studio and link a billing account (you still won't be charged on the free tier) —
  that activates the free quota.

## 2. Gradium key (required for voice)

Gradium ([gradium.ai](https://gradium.ai)) turns your spoken notes into text.

**Raise Summit participants: check the hackathon channel first.** Gradium is a hackathon
partner and participants get ~13 hours of speech-to-text credits. The key or a redemption link
is most likely in:

1. your **hackathon welcome email** (search your inbox for "Gradium"),
2. the **Raise Summit hackathon portal / partner perks page**, or
3. the hackathon **Discord/Slack** — look for a `#gradium` or `#partner-credits` channel, or
   ask an organizer.

If you got a key that way, jump to step 6. Otherwise sign up directly:

1. Go to **https://gradium.ai** in your browser.
2. Click **Sign up** (top right) and create an account with your email.
3. Once logged in, open the **dashboard/studio** and look for **API Keys** in the left sidebar
   or under your account/settings menu.
4. Click **Create API key**, give it a name like `readback-hackathon`, and confirm.
5. **Copy the key immediately** — Gradium keys typically start with `gd_` and may only be shown
   once. If you lose it, just create a new one.
6. Paste it into `.env.local` after `VITE_GRADIUM_API_KEY=`.

Docs live at **https://docs.gradium.ai** if the dashboard layout has changed.

## 3. Vultr key (optional — skip if in a hurry)

Vultr hosts a second text AI. If you add this key, note cleanup and search questions run on
Vultr first, saving your free Gemini allowance for photo reading. If you skip it, everything
just uses Gemini and works fine.

1. Go to **https://my.vultr.com/** and sign in (create an account if needed — if you were given
   a **$200 hackathon credit** code, redeem it under **Billing → Coupons/Promo Code**).
2. In the left sidebar, click **Products → Serverless Inference** (sometimes labeled
   **Cloud Inference**).
3. Click **Add Serverless Inference** (or **Deploy**) to create an inference subscription —
   give it any label, e.g. `readback`.
4. Open the subscription you just created. On its **Overview / API Keys** panel you'll see an
   **Inference API key** — click **copy**.
   - Careful: you want this *inference* key, **not** the account API key under Account → API.
5. Paste it into `.env.local` after `VITE_VULTR_API_KEY=`.

Usage is billed against your credit (about $10/month flat for a generous allowance), so the
$200 hackathon credit more than covers it.

## Check everything works

From the project folder:

```
npm run test:llm       # with a Gemini key set you should see "PASS live askJob"
npm run test:gradium   # with a Gradium key set you should see a PASS line with a transcript
```

If a test says `HTTP 401` or `403`, the key is wrong, has extra spaces/quotes around it, or the
credits aren't active yet. Fix `.env.local`, save, and run the test again.

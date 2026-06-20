# 🛡️ Family Shield for Stremio

<p align="center">
  <img src="https://raw.githubusercontent.com/shakyasaurabh/stremio-family-shield/e07f59e49df3dd0d00ca138e6c1304d60d6625f2/extension.jpeg" alt="Family Shield Extension" width="700"/>
</p>

A lightweight, serverless Stremio add-on that injects age ratings, parental advisories, and content warnings directly into your stream list. 

When you use Stremio on a family TV, it isn't always obvious if a movie contains heavy violence, nudity, or adult language before someone clicks "Play." **Family Shield** solves this by adding a highly visible, color-coded informational tile right above your regular streams.

---

## 📸 See It In Action

Family Shield dynamically fetches metadata and adapts its warnings based on the content you click:

| 🟢 Family Friendly | 🟡 Parents Cautioned (Teen) | 🔴 Restricted (Adult) |
| :---: | :---: | :---: |
| <img src="https://raw.githubusercontent.com/shakyasaurabh/stremio-family-shield/e07f59e49df3dd0d00ca138e6c1304d60d6625f2/finding_nemo.jpeg" alt="Finding Nemo Family Friendly" width="280"/> | <img src="https://raw.githubusercontent.com/shakyasaurabh/stremio-family-shield/e07f59e49df3dd0d00ca138e6c1304d60d6625f2/knives_out.jpeg" alt="Knives Out PG 13" width="280"/> | <img src="https://raw.githubusercontent.com/shakyasaurabh/stremio-family-shield/e07f59e49df3dd0d00ca138e6c1304d60d6625f2/blue_is_the_warmest_colour.jpeg" alt="Blue is the Warmest Color NC-17" width="280"/> |
| *Finding Nemo (Rated G)* | *Knives Out (Rated PG-13)* | *Blue Is the Warmest Colour (NC-17)* |

---

## ✨ Features

* **Instant Visibility:** Displays a clean Stream Tile with the maturity rating (G, PG-13, R, etc.) right before you click a stream.
* **Content Profiling:** Scans TMDb keywords to warn about specific hazards (Violence, Nudity/Sexual Content, Strong Language).
* **Zero Clutter:** Does NOT overwrite standard Cinemeta posters or descriptions, preventing library syncing and UI issues.
* **Lightning Fast:** Hosted entirely on Cloudflare Workers with edge caching for ~10ms response times.
* **100% Free:** No premium API keys (like RPDB) required from the user.

---

## 📥 How to Install

### Method 1: One-Click Install (Recommended)
Click the link below to automatically open Stremio and prompt the installation:
**[👉 Install Family Shield](stremio://family-shield.saurabhshakya078.workers.dev/manifest.json)**

### Method 2: Manual Install
1. Open Stremio.
2. Go to the **Addons** tab (the puzzle piece icon).
3. Paste the following URL into the search bar and click Install:
   `https://family-shield.saurabhshakya078.workers.dev/manifest.json`

> **💡 Pro-Tip for sorting:** Stremio sorts stream providers by installation date. To make Family Shield appear at the *very top* of your links (above Torrentio, etc.), simply uninstall and reinstall your other add-ons so that Family Shield is the "oldest" one on your account!

---

## 🛠️ How It Works

1. Stremio requests stream data for an IMDb ID.
2. The Cloudflare Worker intercepts the request.
3. It fetches the US Certification (Age Rating) and Content Keywords from the free TMDb API.
4. It maps the data to a severity tier (🟢 Family, 🟡 Teen, 🔴 Adult) and formats an informational stream tile.
5. Cloudflare edge-caches the response for 30 days to ensure zero API rate-limiting.

---

## 💻 Self-Hosting

Want to host this yourself? It requires zero server costs.
1. Create a free [Cloudflare](https://dash.cloudflare.com) account.
2. Create a new Worker and paste the code from `worker.js`.
3. Create a free developer account on [TMDb](https://www.themoviedb.org/) and get an API Read Access Token.
4. Add your TMDb token as a Cloudflare Secret variable named `TMDB_API_KEY`.
5. Deploy and use your own `.workers.dev` URL!

---

## ⚖️ Disclaimer
*This add-on is purely informational and relies on community-sourced data from TMDb. It does not block playback, hide streams, or guarantee 100% accuracy of content tags. Always review content independently if you have strict household viewing guidelines.*

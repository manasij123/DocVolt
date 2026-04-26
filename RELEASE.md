# 📦 Stable APK URL via GitHub Releases — DocVault

This guide sets up a permanent download link for the Android APK using
GitHub Releases. Once configured, the link **never changes between builds**:

```
https://github.com/<your-username>/<your-repo>/releases/latest/download/docvault.apk
```

You can paste that into `/app/website/.env` as `VITE_APK_URL`, redeploy
the website, and the **"📱 Download Android App"** button on the landing
page will always serve the freshest APK.

---

## One-time setup

### 1. Push the codebase to a GitHub repo

If you haven't already:

```bash
cd /app
git init
git add .
git commit -m "Initial DocVault commit"
gh repo create docvault --public --source=. --push
# or, with a remote URL:
# git remote add origin https://github.com/<you>/docvault.git
# git branch -M main
# git push -u origin main
```

> Make sure `/app/.github/workflows/release-apk.yml` (already created) is in
> the pushed code — that file is the GitHub Actions recipe.

### 2. Generate an Expo Access Token

1. Go to https://expo.dev/accounts/<your-username>/settings/access-tokens
2. Click **Create token** → name it `github-actions` → copy the value
3. Treat it like a password — it will not be shown again.

### 3. Add the token to your GitHub repo as a secret

1. On GitHub, open your repo → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**
2. Name: `EXPO_TOKEN`
3. Value: paste the token from step 2
4. Click **Add secret**

### 4. (Optional) verify the workflow

```bash
gh workflow run "Build & Release Android APK" --ref main
gh run watch
```

You should see EAS provisioning a build, then the APK uploaded to a draft
release. (Or wait for step 5 below to make this automatic.)

---

## Releasing a new APK build

Whenever you want to publish a new APK version:

```bash
cd /app
# bump app.json's "version" / "versionCode" if you want a clean Play Store
# upload later. Then:
git tag v1.0.1
git push origin v1.0.1
```

The push of a `v*` tag automatically:

1. Triggers `.github/workflows/release-apk.yml`
2. Runs `eas build --platform android --profile production --output=docvault.apk`
3. Creates a GitHub Release named `v1.0.1` with `docvault.apk` attached
4. Updates the **"latest"** alias to point at this release.

After the workflow finishes (~10–20 min), `https://github.com/<you>/<repo>/releases/latest/download/docvault.apk` will serve the new APK.

---

## Wiring the stable URL into the web Landing page

Edit `/app/website/.env`:

```env
VITE_APK_URL=https://github.com/<your-username>/<your-repo>/releases/latest/download/docvault.apk
```

Rebuild + redeploy:

```bash
cd /app/website && yarn build
cp -r dist/* /app/backend/website_dist/
sudo supervisorctl restart backend
```

…and on Emergent dashboard hit **Take your app live** so production picks up
the new env value.

The big green **"📱 Download Android App (.apk)"** button on the landing
page will now download the latest APK every time, with no further changes.

---

## Troubleshooting

- `eas whoami` step fails → the `EXPO_TOKEN` secret is missing or wrong.
- `eas build` fails with "non-square icons" → already fixed in this codebase
  (`icon.png` and `adaptive-icon.png` are 1024×1024). If it ever recurs,
  re-run `python3 -c "from PIL import Image; im=Image.open('/app/frontend/assets/images/icon.png'); im.resize((1024,1024)).save('/app/frontend/assets/images/icon.png')"` and commit.
- The release is created but no APK attached → check the **Actions** tab on
  GitHub for the failing step. Usually a transient EAS hiccup; re-running
  the workflow fixes it.
- `/releases/latest/download/docvault.apk` returns 404 → the workflow has
  not produced a release yet, OR the asset filename in the workflow doesn't
  match (`output=docvault.apk`). Check the release page on GitHub.

---

## Why this is better than the raw EAS URL

| | Raw EAS URL | GitHub Releases URL |
|---|---|---|
| Stable across builds | ❌ Different per build | ✅ Same forever |
| Public / no login | ❌ May require login | ✅ Public if repo is public |
| Versioning | ❌ None | ✅ `/v1.0.1/...` and `/latest/...` |
| Cost | ✅ Free | ✅ Free |
| Setup time | 0 min | ~15 min, one-time |

You only need to set this up once. Every subsequent release is a single
`git tag v...` + push.

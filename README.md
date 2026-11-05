# Friends Savings & Interest-Free Loan Manager (Android APK Ready)

Offline-first daily savings ledger and 10-week interest-free emergency loan manager built for a private group of seven friends:
1. **Sathish**
2. **Kumar**
3. **Santhosh**
4. **Prakash**
5. **Ranjth**
6. **Basheer**
7. **Mahalakshmi**

---

## How to Push to GitHub & Download the Installable Android APK

This repository includes a preconfigured **GitHub Actions Android APK build pipeline** (`.github/workflows/build-android-apk.yml`) and **Capacitor Android config** (`capacitor.config.json`).

### Step 1: Push to Your GitHub Repository
Run these commands in your terminal after creating an empty repository on GitHub:

```bash
git init
git add .
git commit -m "Initial commit: Friends Savings & Loan Manager"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```

### Step 2: Automatic APK Build on GitHub
As soon as you push to `main` (or `master`):
1. Open your repository on GitHub and click the **Actions** tab at the top.
2. You will see the **Build Android APK** workflow running automatically (takes ~2–3 minutes).
3. You can also trigger it manually anytime by clicking **Actions → Build Android APK → Run workflow**.

### Step 3: Download & Install `Friends-Savings-Loan-Manager.apk`
Once the workflow finishes with a green checkmark, you can download the `.apk` in **two places**:
1. **From GitHub Releases (Easiest on Mobile)**:
   - Go to the **Releases** section on the right sidebar of your GitHub repository.
   - Tap `Friends-Savings-Loan-Manager.apk` to download and install it directly on your Android phone.
2. **From GitHub Actions Artifacts**:
   - Open the completed workflow run under the **Actions** tab.
   - Scroll down to **Artifacts** and click **Friends-Savings-Loan-Manager-APK** to download the zip containing `Friends-Savings-Loan-Manager.apk`.

---

## Local Development & Verification

```bash
# Install dependencies
npm install

# Run unit tests for financial calculations
npx tsx --test src/domain/ledgerEngine.test.ts

# Start development server
npm run dev

# Build production offline bundle
npm run build
```

# Formcraft — Survey Tool with Form Builder

A responsive, dark themed survey builder made with HTML, CSS, and vanilla JavaScript ES modules. Firebase Firestore stores surveys and responses, Firebase Storage holds uploaded answer files, and Chart.js renders choice summaries. There is no build step.

**Live demo:** [https://mkpalld2008-cp.github.io/my-profile/](https://mkpalld2008-cp.github.io/my-profile/)

## Run locally

Because the app uses ES modules, open it through a local HTTP server rather than `file://`. For example, from the repository root run `python -m http.server 8000`, then visit `http://localhost:8000/`.

## Firebase setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/) and add a Web app.
2. Copy the web app configuration into `js/firebase-config.js`, replacing each `YOUR_…` placeholder. Firebase web config is public client configuration; do not put service account keys or other private credentials in this file.
3. In Firebase Console, create a Cloud Firestore database.
4. In Firebase Console, enable **Storage** and create its default bucket. Publish the rules from `storage.rules` in Storage → Rules. Respondents can attach up to 5 files per file-upload question, 10 MB per file; only PDF, common image, Word, Excel, and PowerPoint files are accepted. Uploaded files are stored in Firebase Storage; only the survey owner can download them from results.
5. In **Authentication → Sign-in method**, enable **Email/Password**. Add your GitHub Pages domain under Authentication → Settings → Authorized domains if it is not already listed.
6. Publish the rules from `firestore.rules` in Firestore → Rules. Each signed-in user manages only `/users/{uid}/surveys`; published survey documents can be read by anyone who has the share link, and unauthenticated visitors can create responses. Only the owner can read responses/results. Updates and deletes of survey and response documents are denied by the rules; removing a survey marks it unavailable while retaining its response data.
7. Survey management and results require an email/password account. Respondents can answer a published survey without signing in. This uses a per-user Firestore path, not a separate physical database for every user.

## Deploy to GitHub Pages

1. Push this repository to GitHub with the default branch named `main`.
2. In the repo, open **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, and save.
3. The workflow at `.github/workflows/deploy.yml` deploys the repository root on every push to `main`. Its permissions are limited to `contents: read`, `pages: write`, and `id-token: write`.
4. Open the **Actions** tab and inspect **Deploy to GitHub Pages**. After it succeeds, the workflow's deployment environment shows the live URL.
5. The live project site is [https://mkpalld2008-cp.github.io/my-profile/](https://mkpalld2008-cp.github.io/my-profile/).

No secrets are needed by the deployment workflow. If you later add private CI credentials, store them under **Settings → Secrets and variables → Actions**; do not commit them.

## Feature checklist

- [x] **Custom survey:** add, remove, reorder, and edit short text, paragraph, multiple choice, checkboxes, dropdown, and 1–5 rating questions; required toggle; survey title and description.
- [x] **Required or optional answers:** the survey host can set each question as required or optional in the builder; required questions are validated on submission.
- [x] **Remove surveys:** remove a survey from the active list and disable its share link; existing response data remains stored to honor the no-delete Firestore rules.
- [x] **Shareable link:** saving creates a Firestore ID and an owner-scoped `survey.html?id=<id>&owner=<uid>` link. Links are relative and work under a GitHub Pages project subpath.
- [x] **Collect responses:** respondents open a public survey link without signing in; required-field checks, confirmation screen, and Firestore response storage.
- [x] **Results dashboard:** signed-in survey owners see total response count, choice bar charts, average ratings, text-answer lists, and CSV export.
- [x] **File upload answers:** hosts can add optional or required file-upload questions; respondents can attach up to five supported files per question, and owners can open them from results or include filenames in CSV exports.
- [x] **Private survey management:** sign-in is required to create/manage surveys; each account sees its own surveys.

## Files

- `index.html`, `builder.html`, `survey.html`, `results.html`: app pages.
- `js/`: Firebase setup and page modules.
- `css/styles.css`: responsive dark UI.
- `firestore.rules`: Firestore access rules.
- `storage.rules`: Firebase Storage rules for respondent attachments.
- `.github/workflows/deploy.yml`: GitHub Pages deployment.

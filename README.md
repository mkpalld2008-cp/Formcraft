# Formcraft — Survey Tool with Form Builder

A responsive, dark themed survey builder made with HTML, CSS, and vanilla JavaScript ES modules. Firebase Authentication and Firestore handle accounts, surveys, and responses; Supabase Storage holds uploaded answer files; Chart.js renders choice summaries. There is no build step.

**Live demo:** [https://mkpalld2008-cp.github.io/my-profile/](https://mkpalld2008-cp.github.io/my-profile/)

## Run locally

Because the app uses ES modules, open it through a local HTTP server rather than `file://`. For example, from the repository root run `python -m http.server 8000`, then visit `http://localhost:8000/`.

## Firebase setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/) and add a Web app.
2. Copy the web app configuration into `js/firebase-config.js`, replacing each `YOUR_…` placeholder. Firebase web config is public client configuration; do not put service account keys or other private credentials in this file.
3. In Firebase Console, create a Cloud Firestore database.
4. In **Authentication → Sign-in method**, enable **Email/Password**. Add your GitHub Pages domain under Authentication → Settings → Authorized domains if it is not already listed.
5. Publish the rules from `firestore.rules` in Firestore → Rules. Each signed-in user manages only `/users/{uid}/surveys`; published survey documents can be read by anyone who has the share link, and unauthenticated visitors can create responses. Only the owner can read responses/results. Updates and deletes of survey and response documents are denied by the rules; removing a survey marks it unavailable while retaining its response data.
6. Survey management and results require an email/password account. Respondents can answer a published survey without signing in. This uses a per-user Firestore path, not a separate physical database for every user.

## Supabase file storage setup

1. Create a Supabase project on the Free plan and open its **SQL Editor**.
2. Run the SQL in `supabase/storage-policies.sql`. It creates the `survey-uploads` public bucket with a 10 MB limit and accepted MIME types, and allows anonymous uploads only.
3. In Supabase **Project Settings → API**, copy the Project URL and publishable key into `js/supabase-config.js`. The publishable key is intended for browser use; never use a `service_role` secret in this file.
4. Files are served through public URLs so the survey creator can open them from Results and CSV exports. Anyone who receives a direct file URL can access that file. The Free plan currently includes 1 GB of file storage and 5 GB of egress; free projects may pause after one week without activity. Review current [Supabase pricing](https://supabase.com/pricing) before collecting important files.

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
- [x] **File upload answers:** hosts can add optional or required file-upload questions; respondents can attach up to five supported files per question, and owners can open them from results or use the attachment links in CSV exports.
- [x] **Private survey management:** sign-in is required to create/manage surveys; each account sees its own surveys.

## Files

- `index.html`, `builder.html`, `survey.html`, `results.html`: app pages.
- `js/`: Firebase setup and page modules.
- `css/styles.css`: responsive dark UI.
- `firestore.rules`: Firestore access rules.
- `js/supabase-config.js`: Supabase project URL and public publishable key.
- `supabase/storage-policies.sql`: bucket setup and anonymous upload policy.
- `.github/workflows/deploy.yml`: GitHub Pages deployment.

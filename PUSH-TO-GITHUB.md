# Push to GitHub (without sensitive info)

Run these in your terminal from the project root.

## 1. Remove git lock (if you see "Unable to create index.lock")
```bash
rm -f .git/index.lock
```

## 2. Check what will be committed (nothing sensitive)
```bash
git status
git diff --name-only
```
- **Never commit:** `.env`, `src/.env`, `serviceAccountKey*.json`, or any file with real API keys.
- **Safe:** `.gitignore` is updated so `.env` and Firebase backup configs are ignored.

## 3. Stage and commit
```bash
git add .
git status
# If you see .env or firebaseConfig 2.js in the list, run: git reset HEAD .env "src/firebaseConfig 2.js"
git commit -m "Save progress: ThreeScene, CDJ/model paths, connection points, Send/Return, mixer ports, Line 6 -> Return"
```

## 4. Push to GitHub
```bash
git push origin main
```
(Use your branch name if different, e.g. `master`.)

## If you use a .env file
Keep using `.env` for `REACT_APP_FIREBASE_*`; it is in `.gitignore` and will not be committed. Only commit `.env.example` (template with placeholders).

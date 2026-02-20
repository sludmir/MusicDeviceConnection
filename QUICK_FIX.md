# Server Won't Start - Quick Fixes

## Try these in order:

1. **Kill all processes and clear cache:**
   ```bash
   pkill -9 -f "react-scripts|node"
   rm -rf node_modules/.cache .eslintcache
   ```

2. **Try with verbose output:**
   ```bash
   DEBUG=* npm start
   ```

3. **Try different port:**
   ```bash
   PORT=3001 npm start
   ```

4. **Reinstall dependencies (if above doesn't work):**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm start
   ```

5. **Check if it's actually working:**
   - Wait 2-3 minutes
   - Open browser to http://localhost:3000
   - Sometimes it works even if terminal shows nothing

6. **Last resort - use Vite instead:**
   ```bash
   npm install -g vite
   vite
   ```

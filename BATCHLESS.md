# Batchless Start

RENDERit is a static offline web app. A batch file is only a convenience wrapper.

## Python

```powershell
cd RENDERit
python -m http.server 8888
```

Open `http://localhost:8888`.

## Node.js

```powershell
cd RENDERit
node tools/local-server.js
```

Open `http://localhost:8888`.

## Direct file opening

Opening `index.html` directly may show the viewport, but documentation loading can be blocked by browser file security. The local server path is recommended.

### © complicatiion aka sksdesign · 2026
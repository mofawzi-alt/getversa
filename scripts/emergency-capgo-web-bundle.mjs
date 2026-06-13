import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const liveUrl = (process.argv[2] || 'https://getversa.app/').replace(/\/+$/, '/');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

fs.writeFileSync(
  path.join(distDir, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Versa</title>
    <style>
      html, body { margin: 0; height: 100%; background: #fff; color: #111; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
      body { display: grid; place-items: center; text-align: center; padding: 24px; box-sizing: border-box; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0; font-size: 14px; color: #666; }
    </style>
    <script>
      window.location.replace(${JSON.stringify(liveUrl)});
    </script>
  </head>
  <body>
    <main>
      <h1>Just a moment</h1>
      <p>Opening Versa…</p>
    </main>
  </body>
</html>
`,
  'utf8',
);

fs.writeFileSync(path.join(distDir, '.capgo'), 'emergency-web-bundle\n', 'utf8');

console.log('\n✅ Emergency web bundle created in dist/');
console.log(`It opens: ${liveUrl}`);
console.log('\nNext command:');
console.log('npx @capgo/cli@latest bundle upload com.Versa.app --path ./dist --no-code-check\n');
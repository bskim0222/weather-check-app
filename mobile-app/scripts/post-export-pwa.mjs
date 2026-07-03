import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(appRoot, 'dist-phone');
const indexPath = join(distRoot, 'index.html');
const iconSource = join(appRoot, 'assets', 'icon.png');
const splashSource = join(appRoot, 'assets', 'splash-icon.png');
const pwaDir = join(distRoot, 'pwa');
const iconPath = join(pwaDir, 'icon.png');
const maskableIconPath = join(pwaDir, 'maskable-icon.png');
const manifestPath = join(distRoot, 'manifest.webmanifest');

if (!existsSync(indexPath)) {
  throw new Error('dist-phone/index.html does not exist. Run Expo web export first.');
}

mkdirSync(pwaDir, { recursive: true });
copyFileSync(iconSource, iconPath);
copyFileSync(splashSource, maskableIconPath);

writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      name: '웨더체크',
      short_name: '웨더체크',
      description: '대한민국 기상청, 노르웨이 기상청, 핀란드 기상청 예보와 현장 제보를 비교해 지금 날씨를 판정합니다.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#eff1ee',
      theme_color: '#242424',
      icons: [
        {
          src: '/pwa/icon.png',
          sizes: '1024x1024',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa/maskable-icon.png',
          sizes: '1024x1024',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    null,
    2,
  ),
);

const meta = [
  '<meta name="theme-color" content="#242424" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="웨더체크" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="application-name" content="웨더체크" />',
  '<meta name="description" content="예보 비교와 현장 제보로 지금 날씨를 판정하는 모바일 날씨 앱" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/pwa/icon.png" />',
].join('\n    ');

const html = readFileSync(indexPath, 'utf8');
const withoutPrevious = html.replace(/\n\s*<!-- weather-check-pwa:start -->[\s\S]*?<!-- weather-check-pwa:end -->/g, '');
const nextHtml = withoutPrevious.replace(
  '</head>',
  `  <!-- weather-check-pwa:start -->\n    ${meta}\n    <!-- weather-check-pwa:end -->\n  </head>`,
);

writeFileSync(indexPath, nextHtml);
console.log('PWA metadata injected into dist-phone.');

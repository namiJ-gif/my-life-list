/*
  このファイルは役目を終えました。

  以前は「オフラインでも開けるように」ページを端末に保存していましたが、
  そのせいで更新しても古い画面が出続けることがあったため、取りやめました。

  古い端末でもこのファイルが読み込まれた時点で、
  保存ずみのページを消して、自分自身を解除します。
*/

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) { /* 消せなくても先に進む */ }

    try { await self.registration.unregister(); } catch (e) { /* 同上 */ }

    // 開いている画面を最新に読み直す
    try {
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach(c => c.navigate(c.url));
    } catch (e) { /* 同上 */ }
  })());
});

// 保存ずみのページは使わず、必ずサーバーから取りにいく
self.addEventListener('fetch', () => {});

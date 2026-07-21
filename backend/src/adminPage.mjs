export function createAdminPage() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>웨더체크 신고 관리</title>
  <style>
    :root { color-scheme: light; font-family: Arial, "Noto Sans KR", sans-serif; color: #202225; background: #f3f4f1; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { width: min(920px, 100%); margin: 0 auto; padding: 32px 18px 64px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 30px; }
    header p, .empty { color: #696e65; }
    .auth, .toolbar, article { background: #fff; border-radius: 8px; }
    .auth { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 14px; margin-bottom: 14px; }
    input, select, button, textarea { font: inherit; }
    input, select, textarea { width: 100%; border: 0; background: #f0f1ed; border-radius: 6px; padding: 12px; }
    button { border: 0; border-radius: 6px; padding: 11px 16px; background: #202225; color: #fff; font-weight: 700; cursor: pointer; }
    button.secondary { background: #e7e9e4; color: #202225; }
    button.danger { background: #9c2f2f; }
    .toolbar { display: flex; gap: 10px; padding: 12px; margin-bottom: 14px; }
    .toolbar select { max-width: 180px; }
    #status { min-height: 24px; margin: 10px 2px; color: #696e65; }
    #status.error { color: #9c2f2f; }
    #reports { display: grid; gap: 12px; }
    article { padding: 18px; }
    .meta { display: flex; justify-content: space-between; gap: 12px; color: #696e65; font-size: 13px; }
    .body { white-space: pre-wrap; font-size: 17px; line-height: 1.55; margin: 16px 0; }
    .condition { display: inline-block; background: #eef0eb; border-radius: 999px; padding: 6px 10px; font-weight: 700; }
    .actions { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; margin-top: 14px; }
    @media (max-width: 620px) {
      header { display: block; }
      .auth, .actions { grid-template-columns: 1fr; }
      .toolbar { flex-wrap: wrap; }
      .toolbar select { max-width: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div><h1>신고 관리</h1><p>웨더체크 현장 제보 검토</p></div>
    </header>
    <section class="auth" aria-label="관리자 인증">
      <input id="token" type="password" autocomplete="off" placeholder="관리자 토큰">
      <button id="connect" type="button">불러오기</button>
    </section>
    <section class="toolbar" aria-label="목록 필터">
      <select id="filter">
        <option value="pending">검토 중</option>
        <option value="visible">공개</option>
        <option value="hidden">숨김</option>
        <option value="all">전체</option>
      </select>
      <button class="secondary" id="refresh" type="button">새로고침</button>
    </section>
    <p id="status">관리자 토큰을 입력해주세요.</p>
    <section id="reports" aria-live="polite"></section>
  </main>
  <script>
    const tokenInput = document.querySelector('#token');
    const filterInput = document.querySelector('#filter');
    const reportsNode = document.querySelector('#reports');
    const statusNode = document.querySelector('#status');
    tokenInput.value = sessionStorage.getItem('weathercheck-admin-token') || '';

    document.querySelector('#connect').addEventListener('click', loadReports);
    document.querySelector('#refresh').addEventListener('click', loadReports);
    filterInput.addEventListener('change', loadReports);

    async function loadReports() {
      const token = tokenInput.value.trim();
      if (!token) return setStatus('관리자 토큰을 입력해주세요.', true);
      sessionStorage.setItem('weathercheck-admin-token', token);
      setStatus('신고 목록을 불러오고 있어요.');
      reportsNode.replaceChildren();

      const response = await fetch('/admin/reports?status=' + encodeURIComponent(filterInput.value), {
        headers: { authorization: 'Bearer ' + token },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus(payload.error || '목록을 불러오지 못했습니다.', true);

      const reports = Array.isArray(payload.reports) ? payload.reports : [];
      setStatus(reports.length ? reports.length + '개의 글을 표시합니다.' : '해당 상태의 글이 없습니다.');
      reports.forEach((report) => reportsNode.append(createReportCard(report)));
    }

    function createReportCard(report) {
      const card = document.createElement('article');
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(textNode(report.place || '위치 정보 없음'), textNode(formatTime(report.createdAt)));

      const body = document.createElement('p');
      body.className = 'body';
      body.textContent = report.body || '';
      const condition = document.createElement('span');
      condition.className = 'condition';
      condition.textContent = report.condition || '상태 없음';

      const actions = document.createElement('div');
      actions.className = 'actions';
      const reason = document.createElement('input');
      reason.placeholder = '처리 사유(선택)';
      const restore = actionButton('공개', 'secondary', () => moderate(report.id, 'visible', reason.value));
      const hide = actionButton('숨김', 'danger', () => moderate(report.id, 'hidden', reason.value));
      actions.append(reason, restore, hide);
      card.append(meta, body, condition, actions);
      return card;
    }

    async function moderate(id, moderationStatus, reason) {
      const response = await fetch('/admin/reports/' + encodeURIComponent(id) + '/moderation', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + tokenInput.value.trim(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ moderationStatus, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus(payload.error || '처리하지 못했습니다.', true);
      await loadReports();
    }

    function actionButton(label, className, handler) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.addEventListener('click', handler);
      return button;
    }

    function textNode(value) {
      const span = document.createElement('span');
      span.textContent = value;
      return span;
    }

    function formatTime(value) {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toLocaleString('ko-KR') : '';
    }

    function setStatus(message, isError = false) {
      statusNode.textContent = message;
      statusNode.className = isError ? 'error' : '';
    }
  </script>
</body>
</html>`;
}

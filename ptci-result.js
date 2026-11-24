/* Live PTCI results. Type language and food visuals follow the approved 16-type mockup. */
(function (root) {
  'use strict';

  const data = root.PTCI_DATA;
  const scoring = root.PTCI_SCORING;
  const byCode = Object.fromEntries(data.types.map(type => [type.code, type]));
  const opposites = { C: 'F', F: 'C', L: 'M', M: 'L', T: 'S', S: 'T', B: 'G', G: 'B' };
  const fitKey = 'fooding_ptci_fit_v2';
  const fitLabels = ['유형 전체', '탐험', '조합', '식감', '향'];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function typeColor(type) {
    return TYPES.find(item => item[1] === type.name)?.[3] || '#8b47b6';
  }

  function itemSummary(item) { return `${item.id}번 ${item.score}점`; }
  function itemDetails(items) {
    return items.map(item => `<p><b>${item.id}번 · ${item.score}점</b> ${escapeHtml(QUESTIONS[item.id - 1].text)}</p>`).join('');
  }
  function keywordItem(facet) {
    return `<div class="r-keyword-item"><strong>${escapeHtml(facet.keywordName)}</strong><small>근거 ${facet.evidence.map(itemSummary).join(' · ')}</small>${facet.evidence.length || facet.exceptions.length ? `<details class="r-detail"><summary>내 응답 근거 보기</summary>${itemDetails(facet.evidence)}${facet.exceptions.length ? `<p><b>다르게 답한 문항</b></p>${itemDetails(facet.exceptions)}` : ''}</details>` : ''}</div>`;
  }
  function axisRow(axis) {
    const chosenName = axis.letter === axis.high ? axis.highName : axis.lowName;
    const otherLetter = axis.letter === axis.high ? axis.low : axis.high;
    const otherName = axis.letter === axis.high ? axis.lowName : axis.highName;
    const position = ((axis.mean - 1) / 4 * 100).toFixed(2);
    return `<div class="r-axis-row"><div class="r-axis-main">${axis.name} ${axis.letter}${axis.dominant ? '<span class="r-badge">대표 축</span>' : ''}${axis.near ? '<span class="r-badge">기준점 근처</span>' : ''}<small>${chosenName} · 평균 ${axis.mean.toFixed(2)}/5</small></div><div class="r-track" aria-label="${axis.name} 평균 ${axis.mean.toFixed(2)}점"><div class="r-marker" style="left:${position}%"></div></div><div class="r-opposite">${otherLetter} ${otherName}</div><div class="r-percent">${axis.percent}%</div></div>`;
  }
  function keywordPanel(result) {
    const cards = result.axes.map(axis => `<div class="r-keyword-card"><h3>${axis.name} ${axis.letter}</h3>${axis.allRounder ? `<div class="r-keyword-item"><strong>${escapeHtml(axis.allRounder)}</strong></div>` : ''}${axis.keywords.length ? axis.keywords.map(keywordItem).join('') : '<span class="r-empty">뚜렷한 세부 키워드 없음</span>'}</div>`).join('');
    const counters = result.axes.flatMap(axis => axis.counterKeywords.map(facet => `<p><b>${axis.name} · ${escapeHtml(facet.keywordName)}</b> — ${facet.evidence.map(itemSummary).join(' · ')}</p>`));
    const splits = result.axes.flatMap(axis => axis.splitFacets.map(facet => `<p><b>${axis.name} · ${escapeHtml(facet.name)}</b> — ${escapeHtml(facet.splitSentence)} 높은 응답 ${facet.splitEvidence.high.map(itemSummary).join(' · ')}, 낮은 응답 ${facet.splitEvidence.low.map(itemSummary).join(' · ')}</p>`));
    return `<section class="r-panel"><h2>나의 취향 키워드</h2><p class="r-sub">세부 항목 점수로 고르고, 직접 답한 문항을 근거로 보여 줍니다.</p><div class="r-keyword-grid">${cards}</div><div class="r-counter"><b>함께 볼 특징</b>${counters.length || splits.length ? counters.join('') + splits.join('') : '<p>축 글자와 반대로 뚜렷하게 나온 항목이 없습니다.</p>'}</div></section>`;
  }
  function descriptionPanel(result) {
    return `<section class="r-panel"><h2>나만의 설명</h2><p class="r-sub">같은 유형이라도 문항별 응답에 따라 달라지는 설명입니다.</p><div class="r-description-grid">${result.axes.map(axis => `<div class="r-description"><b>${axis.name}</b><p>${escapeHtml(axis.description)}</p></div>`).join('')}</div></section>`;
  }
  function foodPanel(type) {
    return `<section class="r-panel"><h2>어울릴 만한 한 접시</h2><p class="r-sub">유형별 메뉴 예시입니다. 실제 선호나 섭취 적합성을 보장하지는 않습니다.</p><div class="r-food-grid">${type.foods.map(food => {
      const backgroundSize = food.backgroundSize ?? (food.sheet ? '200% 200%' : 'cover');
      const photoStyle = `background-image:url('${food.src}');background-size:${backgroundSize};background-position:${food.position}`;
      return `<div class="r-food"><div class="r-food-photo" role="img" aria-label="${escapeHtml(food.name)} 사진" style="${photoStyle}"></div><div class="r-food-name">${escapeHtml(food.name)}</div></div>`;
    }).join('')}</div></section>`;
  }
  function otherTypeCard(type, kind, note) {
    return `<button type="button" class="r-other" data-preview-code="${type.code}"><img src="${type.characterSrc}" alt=""><span><span class="kind">${kind} · ${type.code}</span><strong>${escapeHtml(type.name)}</strong><p>${escapeHtml(note)}</p></span></button>`;
  }
  function otherPanel(result, type) {
    const nearest = result.preview ? data.types.find(candidate => candidate.code === [...type.code].map((letter, index) => index === 3 ? opposites[letter] : letter).join('')) : result.nearNeighbor || result.neighbor;
    const opposite = result.preview ? byCode[[...type.code].map(letter => opposites[letter]).join('')] : result.opposite;
    const near = !result.preview && Boolean(result.nearNeighbor);
    const neighborNote = near ? `${result.nearAxis.name} 점수가 기준선 가까이라 함께 읽어 볼 수 있습니다.` : '한 글자만 다른 유형입니다. 비슷한 점과 다른 점을 비교해 보세요.';
    return `<section class="r-panel"><h2>다른 유형</h2><p class="r-sub">한 글자 차이 유형을 먼저, 정반대 유형을 다음에 보여 줍니다.</p><div class="r-other-grid">${otherTypeCard(nearest, '한 글자 차이', neighborNote)}${otherTypeCard(opposite, '정반대로 먹는 유형', '네 글자의 방향이 모두 반대입니다. 궁합을 뜻하지 않습니다.')}</div>${state.actualResult && result.preview ? '<button type="button" class="r-roster-back" id="rBackToMine">나의 실제 결과로 돌아가기</button>' : ''}</section>`;
  }
  function loadFit(result) {
    try {
      const saved = JSON.parse(localStorage.getItem(fitKey));
      return saved?.answers === result.answers.join('') && Array.isArray(saved.scores) ? saved.scores : Array(5).fill(null);
    } catch (_) { return Array(5).fill(null); }
  }
  function saveFit(result, scores) {
    try { localStorage.setItem(fitKey, JSON.stringify({ answers: result.answers.join(''), scores })); } catch (_) { /* Optional local feedback. */ }
  }
  function fitPanel(result) {
    const scores = loadFit(result);
    return `<section class="r-panel"><h2>이 결과가 나와 얼마나 맞나요?</h2><p class="r-sub">채점에는 사용하지 않습니다. 선택한 값은 현재 기기에만 저장됩니다.</p>${fitLabels.map((label, index) => `<div class="r-fit-row"><b>${label}</b><span>이 설명이 나와 잘 맞나요?</span><div class="r-fit-scale" role="group" aria-label="${label} 체감 일치도">${[1,2,3,4,5].map(value => `<button type="button" data-fit="${index}" data-value="${value}" aria-pressed="${scores[index] === value}">${value}</button>`).join('')}</div></div>`).join('')}<button type="button" class="r-roster-back" id="rExportCsv">응답과 체감 일치도 CSV 저장</button></section>`;
  }
  function renderPTCIResult() {
    const result = state.result;
    if (!result) return;
    const type = result.type || byCode[result.code];
    if (!type) return;
    const preview = Boolean(result.preview);
    const intro = preview ? type.summary : result.summary;
    const resultView = document.getElementById('resultView');
    resultView.innerHTML = `<div class="ptci-result"><section class="r-hero"><div><div class="r-eyebrow">${preview ? '16유형 안내 · 대표 예시' : '나의 유형 결과 · 65문항 응답 기준'}</div><div class="r-code-row"><span class="r-code">${type.code}</span><h1>${escapeHtml(type.name)}</h1>${type.underReview ? '<span class="r-review">이름 검토 중</span>' : ''}</div><div class="r-summary">${escapeHtml(intro)}</div></div><img src="${type.characterSrc}" alt="${escapeHtml(type.name)} 캐릭터"></section>${preview ? '<div class="r-notice">유형 설명을 미리 보는 화면입니다. 퍼센트와 나만의 설명은 65문항에 응답한 뒤 계산됩니다.</div>' : ''}${result.notice ? `<div class="r-notice">${escapeHtml(result.notice)}</div>` : ''}${preview ? '' : `<section class="r-panel"><h2>나의 미식 성향 분석</h2><p class="r-sub">글자는 방향, 퍼센트는 기준점에서 기운 정도입니다. 유형에 맞을 확률은 아닙니다. 가장 높은 축이 다음 축보다 10%포인트 이상 높을 때만 대표 축으로 표시합니다.</p>${result.axes.map(axisRow).join('')}</section>${keywordPanel(result)}${descriptionPanel(result)}`}<section class="r-panel"><h2>유형 해석</h2><div class="r-interpret"><div class="r-tabs" role="tablist" aria-label="유형 해석"><button type="button" class="r-tab" role="tab" aria-selected="true" data-tab="person">이런 사람이야</button><button type="button" class="r-tab" role="tab" aria-selected="false" data-tab="front">메뉴 앞에서</button></div><div class="r-interpret-body" role="tabpanel">${escapeHtml(type.person)}</div></div></section>${foodPanel(type)}${otherPanel(result,type)}${preview ? '' : fitPanel(result)}<div class="r-actions"><button type="button" class="r-action primary" id="rSaveCard">결과 카드 저장</button><button type="button" class="r-action" id="rShare">공유하기</button><button type="button" class="r-action" id="rAllTypes">다른 유형 보기</button></div><div class="r-footer">FOODING CLUB · PTCI RESULT</div></div>`;
    document.title = `PTCI ${type.code} ${type.name} 결과`;
    resultView.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
      resultView.querySelectorAll('[data-tab]').forEach(other => other.setAttribute('aria-selected', String(other === button)));
      resultView.querySelector('.r-interpret-body').textContent = button.dataset.tab === 'front' ? type.front : type.person;
    }));
    resultView.querySelectorAll('[data-preview-code]').forEach(button => button.addEventListener('click', () => openPTCIType(button.dataset.previewCode)));
    resultView.querySelector('#rBackToMine')?.addEventListener('click', () => { state.result = state.actualResult; show('result'); });
    resultView.querySelectorAll('[data-fit]').forEach(button => button.addEventListener('click', () => {
      const scores = loadFit(result);
      scores[Number(button.dataset.fit)] = Number(button.dataset.value);
      saveFit(result, scores);
      resultView.querySelectorAll(`[data-fit="${button.dataset.fit}"]`).forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    }));
    resultView.querySelector('#rExportCsv')?.addEventListener('click', () => exportResultCsv(result));
    resultView.querySelector('#rSaveCard').addEventListener('click', () => saveResultCard(result, type));
    resultView.querySelector('#rShare').addEventListener('click', () => shareResult(type));
    resultView.querySelector('#rAllTypes').addEventListener('click', () => show('types'));
  }

  function openPTCIType(code) {
    const type = byCode[code];
    if (!type) return;
    if (state.result?.valid) state.actualResult = state.result;
    state.result = { preview: true, code, type };
    show('result');
  }
  function renderPTCIRoster() {
    const roster = document.getElementById('roster');
    roster.innerHTML = data.types.map(type => `<button type="button" class="roster-card" data-code="${type.code}"><img src="${type.characterSrc}" alt=""><span class="id">${type.code}</span><b>${escapeHtml(type.name)}</b></button>`).join('');
    roster.querySelectorAll('[data-code]').forEach(button => button.addEventListener('click', () => openPTCIType(button.dataset.code)));
  }
  function renderPTCIHomeRoster() {
    const home = document.getElementById('homeRoster');
    home.innerHTML = data.types.map(type => `<button type="button" class="mini-card" data-code="${type.code}" aria-label="${escapeHtml(type.name)} 유형 보기"><span class="code-pill" style="background:${typeColor(type)}">${type.code}</span><img loading="lazy" src="${type.characterSrc}" alt=""><strong>${escapeHtml(type.name)}</strong></button>`).join('');
    home.querySelectorAll('[data-code]').forEach(button => button.addEventListener('click', () => openPTCIType(button.dataset.code)));
  }
  function exportResultCsv(result) {
    const scores = loadFit(result);
    const headers = ['respondent_timestamp','type_code',...QUESTIONS.map(item => `Q${item.id}`),'fit-type','fit-explore','fit-combine','fit-texture','fit-aroma'];
    const values = [new Date().toISOString(),result.code,...result.answers,...scores];
    const csv = '\ufeff' + [headers,values].map(row => row.map(value => `"${String(value ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');link.href=url;link.download=`FOODING_CLUB_PTCI_${Date.now()}.csv`;link.click();setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  async function shareResult(type) {
    const url = location.protocol.startsWith('http') ? new URL(location.href) : null;
    if (url) { url.search = ''; url.hash = ''; url.searchParams.set('type',type.code); }
    const text = `FOODING CLUB PTCI · ${type.name} (${type.code})\n${type.summary}${url ? '\n'+url : ''}`;
    if (navigator.share && url) { try { await navigator.share({title:`PTCI ${type.name}`,text:type.summary,url:String(url)});return; } catch (error) { if (error.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); alert('유형 설명과 링크를 복사했어요.'); }
    catch (_) { window.prompt('아래 내용을 복사해 주세요.',text); }
  }
  async function saveResultCard(result, type) {
    const canvas = document.createElement('canvas');canvas.width=900;canvas.height=1120;
    const context = canvas.getContext('2d');
    const fill = context.createLinearGradient(0,0,900,1120);fill.addColorStop(0,'#fff');fill.addColorStop(1,'#eedaf7');context.fillStyle=fill;context.fillRect(0,0,900,1120);
    context.fillStyle='#35123f';context.textAlign='center';context.font='900 44px sans-serif';context.fillText('FOODING CLUB',450,88);
    const image = new Image();image.src=type.characterSrc;await image.decode();
    const scale = Math.min(340/image.width,340/image.height);context.drawImage(image,450-image.width*scale/2,140,image.width*scale,image.height*scale);
    context.fillStyle='#70248f';context.font='900 54px sans-serif';context.fillText(type.code,450,565);
    context.fillStyle='#35123f';context.font='900 42px sans-serif';context.fillText(type.name,450,630);
    context.font='23px sans-serif';const lines=wrapCanvasText(context,type.summary,750);lines.slice(0,3).forEach((line,index)=>context.fillText(line,450,690+index*33));
    if (!result.preview) result.axes.forEach((axis,index)=>{const y=835+index*55;context.textAlign='left';context.font='bold 24px sans-serif';context.fillText(`${axis.name} ${axis.letter}`,160,y);context.textAlign='right';context.fillText(`${axis.percent}%`,740,y);});
    else {context.textAlign='center';context.font='22px sans-serif';context.fillText('유형 안내 예시 · 실제 점수는 검사 후 표시',450,870);}
    context.textAlign='center';context.fillStyle='#806d86';context.font='18px sans-serif';context.fillText('PTCI · 음식 취향 결과',450,1070);
    canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`PTCI_${type.code}_결과.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/png');
  }
  function wrapCanvasText(context, value, maxWidth) {
    const lines=[];let line='';
    for(const word of String(value).split(/\s+/)){const next=line ? `${line} ${word}` : word;if(context.measureText(next).width>maxWidth && line){lines.push(line);line=word}else line=next;}
    if(line)lines.push(line);return lines;
  }

  root.renderResult = renderPTCIResult;
  root.renderRoster = renderPTCIRoster;
  root.renderHomeRoster = renderPTCIHomeRoster;
  root.openType = openPTCIType;
  renderPTCIHomeRoster();
  if (state.completed && state.answers.every(answer => answer !== null)) {
    const restored = scoring.score(state.answers);
    if (restored.valid) { state.result = restored; state.actualResult = restored; }
  }
  const shared = new URLSearchParams(location.search).get('type');
  if (shared) { if (byCode[shared]) openPTCIType(shared); else show('intro'); }
  const navResult = document.querySelector('.navlinks [data-go="result"]');
  if (navResult) navResult.onclick = () => { if (state.actualResult) state.result=state.actualResult; show(state.result ? 'result' : 'intro'); };
})(globalThis);

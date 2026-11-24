/* PTCI 65-item scoring: finalized pre-pilot rules from design 1 and development handoff. */
(function (root) {
  'use strict';

  const data = root.PTCI_DATA;
  if (!data) throw new Error('PTCI data must load before the scorer.');
  const highBands = new Set(['veryHigh', 'high']);
  const lowBands = new Set(['low', 'veryLow']);
  const oppositeLetters = { C: 'F', F: 'C', L: 'M', M: 'L', T: 'S', S: 'T', B: 'G', G: 'B' };
  const round1 = value => Math.round(value * 10) / 10;

  function bandFor(values) {
    const sum = values.reduce((total, value) => total + value, 0);
    if (values.length >= 4) {
      const mean = round1(sum / values.length);
      return mean >= 4 ? 'veryHigh' : mean >= 3.3 ? 'high' : mean >= 2.8 ? 'mid' : mean >= 2.1 ? 'low' : 'veryLow';
    }
    if (values.length === 3) return sum >= 11 ? 'high' : sum <= 7 ? 'low' : 'mid';
    if (values.length === 2) return sum >= 8 ? 'high' : sum <= 4 ? 'low' : 'mid';
    return sum >= 4 ? 'high' : sum <= 2 ? 'low' : 'mid';
  }

  function evidenceFor(itemIds, answers, direction, limit) {
    return itemIds
      .map(id => ({ id, score: answers[id - 1] }))
      .filter(item => direction === 'high' ? item.score >= 4 : item.score <= 2)
      .sort((a, b) => direction === 'high' ? b.score - a.score || a.id - b.id : a.score - b.score || a.id - b.id)
      .slice(0, limit);
  }

  function scoreFacet(definition, answers) {
    const values = definition.items.map(id => answers[id - 1]);
    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    const highEvidence = evidenceFor(definition.items, answers, 'high', 2);
    const lowEvidence = evidenceFor(definition.items, answers, 'low', 2);
    const highCount = values.filter(value => value >= 4).length;
    const lowCount = values.filter(value => value <= 2).length;
    const split = definition.keyword && Math.min(highCount, lowCount) >= Math.ceil(values.length / 3);
    const band = bandFor(values);
    const direction = highBands.has(band) ? 'high' : lowBands.has(band) ? 'low' : null;
    return {
      ...definition,
      sum, mean, band, direction, split,
      description: split ? definition.splitSentence : definition.sentences[band],
      evidence: direction ? evidenceFor(definition.items, answers, direction, 2) : [],
      exceptions: direction ? evidenceFor(definition.items, answers, direction === 'high' ? 'low' : 'high', 1) : [],
      splitEvidence: split ? { high: highEvidence, low: lowEvidence } : null,
      keywordName: direction === 'high' ? definition.positive : direction === 'low' ? definition.negative : null,
    };
  }

  function score(answers) {
    if (!Array.isArray(answers) || answers.length !== 65 || answers.some(value => !Number.isInteger(value) || value < 1 || value > 5)) {
      return { valid: false, reason: 'incomplete' };
    }
    if (answers.every(value => value === answers[0])) return { valid: false, reason: 'straightLine' };

    const axes = data.axes.map((definition, index) => {
      const values = answers.slice(definition.start - 1, definition.end);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const distance = Math.abs(mean - 3);
      const letter = mean > 3 ? definition.high : definition.low;
      return {
        ...definition, index, mean, distance, letter,
        percent: Math.round(50 + distance * 25),
        near: distance <= 0.25,
        keywords: [], counterKeywords: [], splitFacets: [],
      };
    });
    const rankedAxes = [...axes].sort((a, b) => b.percent - a.percent);
    const dominantAxes = rankedAxes[0].percent - rankedAxes[1].percent >= 10
      ? [rankedAxes[0].index] : [];
    axes.forEach(axis => { axis.dominant = dominantAxes.includes(axis.index); });

    const facets = data.facets.map(definition => scoreFacet(definition, answers));
    for (const facet of facets) {
      const axis = axes[facet.axis];
      if (!facet.keyword) continue;
      if (facet.split) {
        axis.splitFacets.push(facet);
        continue;
      }
      if (!facet.direction) continue;
      const matchesAxis = facet.direction === (axis.letter === axis.high ? 'high' : 'low');
      (matchesAxis ? axis.keywords : axis.counterKeywords).push(facet);
    }

    for (const axis of axes) {
      const keywordFacets = facets.filter(facet => facet.axis === axis.index && facet.keyword);
      const referenceFacets = facets.filter(facet => facet.axis === axis.index && !facet.keyword);
      const allKeywords = keywordFacets.every(facet => axis.keywords.includes(facet));
      axis.allRounder = allKeywords ? data.allRounder[axis.letter] || null : null;
      const sentences = [data.baseSentences[axis.letter]];
      if (axis.near) sentences.push(data.conditions.near);
      if (axis.dominant) sentences.push(data.conditions.dominant);
      if (keywordFacets.every(facet => facet.band === 'mid' && !facet.split)) {
        sentences.push(data.conditions.allMid);
      } else {
        sentences.push(...keywordFacets.map(facet => facet.description));
      }
      sentences.push(...referenceFacets.filter(facet => facet.band !== 'mid').map(facet => facet.description));
      axis.description = sentences.join(' ');
    }

    const code = axes.map(axis => axis.letter).join('');
    const type = data.types.find(item => item.code === code);
    if (!type) throw new Error(`Missing PTCI type: ${code}`);
    const oppositeCode = [...code].map(letter => oppositeLetters[letter]).join('');
    const opposite = data.types.find(item => item.code === oppositeCode);
    const nearestAxis = [...axes].sort((a, b) => a.distance - b.distance || a.index - b.index)[0];
    const neighborCode = [...code].map((letter, index) => index === nearestAxis.index ? oppositeLetters[letter] : letter).join('');
    const neighbor = data.types.find(item => item.code === neighborCode);
    const nearAxis = [...axes].filter(axis => axis.near).sort((a, b) => a.distance - b.distance || a.index - b.index)[0] || null;
    const nearNeighborCode = nearAxis ? [...code].map((letter, index) => index === nearAxis.index ? oppositeLetters[letter] : letter).join('') : null;
    const nearNeighbor = nearNeighborCode ? data.types.find(item => item.code === nearNeighborCode) : null;
    const allKeywords = axes.flatMap(axis => axis.keywords).sort((a, b) => Math.abs(b.mean - 3) - Math.abs(a.mean - 3));
    const summary = [
      `${type.name}야. ${type.summary}`,
      dominantAxes.length ? `네 가지 중에서는 ${dominantAxes.map(index => data.axes[index].name).join('·')}이 가장 뚜렷하게 나왔어.` : '',
      allKeywords.length ? `그중에서도 ${allKeywords.slice(0, 2).map(facet => facet.keywordName).join(', ')} 성향이 눈에 띄어.` : '',
      nearAxis && nearNeighbor ? `${nearAxis.name}은 기준선 가까이라 ${nearNeighbor.code} ${nearNeighbor.name} 설명도 같이 읽어 봐.` : '',
    ].filter(Boolean).join(' ');
    const allHigh = axes.every(axis => axis.mean >= 4);
    return { valid: true, answers: [...answers], axes, facets, code, type, opposite, neighbor, nearNeighbor, nearAxis, dominantAxes, summary, allHigh, notice: allHigh ? data.conditions.allHigh : null };
  }

  root.PTCI_SCORING = { score, bandFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PTCI_SCORING;
})(globalThis);

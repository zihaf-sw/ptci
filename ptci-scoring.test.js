const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
require('./ptci-data.js');
const { score, bandFor } = require('./ptci-scoring.js');

const axes = globalThis.PTCI_DATA.axes;
const types = globalThis.PTCI_DATA.types;

function answersFor(code) {
  const answers = Array(65).fill(3);
  axes.forEach((axis, index) => {
    answers.fill(code[index] === axis.high ? 4 : 2, axis.start - 1, axis.end);
  });
  answers[0] = answers[0] === 4 ? 5 : 1;
  return answers;
}

assert.equal(score(Array(65).fill(3)).reason, 'straightLine');
assert.equal(score(Array(64).fill(4)).reason, 'incomplete');
assert.equal(score([...Array(64).fill(4), 6]).reason, 'incomplete');

for (const type of types) {
  const result = score(answersFor(type.code));
  assert.equal(result.valid, true);
  assert.equal(result.code, type.code);
  assert.equal(result.type.name, type.name);
  assert.equal(result.opposite.code, [...type.code].map(letter => ({ C:'F', F:'C', L:'M', M:'L', T:'S', S:'T', B:'G', G:'B' })[letter]).join(''));
  assert.equal(result.type.foods.length, 4);
  assert.ok(existsSync(join(__dirname, result.type.characterSrc)), `missing character: ${type.code}`);
  result.type.foods.forEach(food => assert.ok(existsSync(join(__dirname, food.src)), `missing food: ${food.name}`));
  assert.ok(result.axes.every(axis => axis.percent >= 50 && axis.percent <= 100));
}

assert.equal(bandFor([4, 4, 4, 3]), 'high');
assert.equal(bandFor([4, 4, 5, 3]), 'veryHigh');
assert.equal(bandFor([4, 4, 3]), 'high');
assert.equal(bandFor([2, 2, 3]), 'low');
assert.equal(bandFor([4, 4]), 'high');
assert.equal(bandFor([2, 2]), 'low');
assert.equal(bandFor([4]), 'high');
assert.equal(bandFor([2]), 'low');

const moderate = answersFor('CLTB');
moderate.fill(3, 0, 20);
moderate[0] = 4;
const near = score(moderate);
assert.equal(near.code, 'CLTB');
assert.equal(near.axes[0].percent, 51);
assert.equal(near.nearAxis.index, 0);
assert.equal(near.nearNeighbor.code, 'FLTB');

const sharp = score(answersFor('CLTB'));
assert.equal(sharp.code, near.code);
assert.notEqual(sharp.summary, near.summary);
assert.notEqual(sharp.axes[0].description, near.axes[0].description);
assert.equal(sharp.allHigh, true);

const splitAnswers = answersFor('CLTB');
for (const [id, value] of [[1, 5], [2, 5], [3, 1], [5, 1]]) splitAnswers[id - 1] = value;
const splitResult = score(splitAnswers);
const split = splitResult.facets.find(facet => facet.name === '메뉴 선택·호기심');
assert.equal(split.split, true);
assert.equal(split.keywordName, null);
assert.equal(splitResult.axes[0].keywords.includes(split), false);
assert.equal(splitResult.axes[0].splitFacets.includes(split), true);

console.log('PTCI scoring: 16 types, validation, thresholds, near axis, personalization, and split facet passed');

import {features, classify, size} from './model.mjs';

import {rasterize} from './raster.mjs';

const canvas = document.querySelector('#drawing-pad');
const context = canvas.getContext('2d');
const cursor = document.querySelector('#drawing-cursor');
const recognize = document.querySelector('#recognize');
const symbol = document.querySelector('#symbol');
const status = document.querySelector('#status');
const votes = document.querySelector('#votes');
const strokes = [];
let classes;
let training;
let pointer;
let activeStroke;
let keyboard = [canvas.width / 2, canvas.height / 2];

context.strokeStyle = context.fillStyle = '#235a45';
context.lineWidth = 9;
context.lineCap = context.lineJoin = 'round';

function message(text, sign = '…') {
  symbol.textContent = sign;
  votes.replaceChildren();
  status.textContent = text;
}

function edited() {
  if (training && status.textContent !== 'Натисни „Разпознай“.') {
    message('Натисни „Разпознай“.');
  }
}

function dot([x, y]) {
  context.beginPath();
  context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
  context.fill();
}

function line([x, y], [endX, endY]) {
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(endX, endY);
  context.stroke();
}

function resetDrawing() {
  strokes.length = 0;
  pointer = activeStroke = undefined;
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  const clamp = (value, max) => Math.min(max, Math.max(0, value));
  return [clamp((event.clientX - rect.left) * canvas.width / rect.width, canvas.width),
          clamp((event.clientY - rect.top) * canvas.height / rect.height, canvas.height)];
}

function extendStroke(event) {
  const next = point(event);
  line(activeStroke.at(-1), next);
  activeStroke.push(next);
}

canvas.addEventListener('pointerdown', event => {
  if (pointer !== undefined || event.button !== 0) return;
  pointer = event.pointerId;
  canvas.setPointerCapture(pointer);
  activeStroke = [point(event)];
  strokes.push(activeStroke);
  dot(activeStroke[0]);
  edited();
});
canvas.addEventListener('pointermove', event => {
  if (pointer !== event.pointerId) return;
  const samples = event.getCoalescedEvents?.();
  for (const sample of samples?.length ? samples : [event]) extendStroke(sample);
});
canvas.addEventListener('pointerup', event => {
  if (pointer !== event.pointerId) return;
  extendStroke(event);
  pointer = activeStroke = undefined;
});
for (const name of ['pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(name, event => {
    if (pointer === event.pointerId) pointer = activeStroke = undefined;
  });
}

const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
canvas.addEventListener('keydown', event => {
  if (Object.hasOwn(arrows, event.key)) {
    event.preventDefault();
    const next = keyboard.map((value, axis) =>
      Math.min(canvas.width, Math.max(0, value + 12 * arrows[event.key][axis])));
    if (event.shiftKey) {
      strokes.push([keyboard, next]);
      line(keyboard, next);
      edited();
    }
    keyboard = next;
    cursor.style.left = 100 * keyboard[0] / canvas.width + '%';
    cursor.style.top = 100 * keyboard[1] / canvas.height + '%';
  } else if (event.code === 'Space') {
    event.preventDefault();
    if (event.repeat) return;
    strokes.push([keyboard]);
    dot(keyboard);
    edited();
  }
});

function addExamples() {
  for (const item of classes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Пример · ' + item.name);
    button.title = item.name;
    button.textContent = item.glyph;
    button.addEventListener('click', () => {
      resetDrawing();
      for (const path of item.paths) {
        const points = path.map(point => point.map(value => canvas.width * (0.5 + 0.28 * value)));
        strokes.push(points);
        dot(points[0]);
        for (let i = 1; i < points.length; i++) line(points[i - 1], points[i]);
      }
      edited();
    });
    document.querySelector('#' + item.group + '-examples').append(button);
  }
}

function showMetrics(report) {
  const summary = document.querySelector('#metrics-summary');
  const score = document.createElement('strong');
  score.textContent = new Intl.NumberFormat('bg-BG', {style: 'percent', maximumFractionDigits: 1})
    .format(report.correct / report.total);
  const counts = document.createElement('span');
  counts.textContent = report.correct + ' от ' + report.total + ' синтетични рисунки';
  summary.append(score, counts);
  const table = document.querySelector('#class-scores');
  report.matrix.forEach((row, i) => {
    const entry = table.insertRow();
    entry.insertCell().textContent = classes[i].glyph + ' ' + classes[i].name;
    entry.insertCell().textContent = row[i] + ' / ' + row.reduce((a, b) => a + b, 0);
  });
}

document.querySelector('#clear').addEventListener('click', () => {
  resetDrawing();
  if (training) message('Нарисувай знак или форма.');
});
recognize.addEventListener('click', () => {
  const grid = rasterize(strokes);
  if (grid.reduce((count, bit) => count + bit, 0) < 3) {
    message('Нарисувай знак или форма, за да го разпознаеш.');
    return;
  }
  const ranking = classify(features(grid), training, classes.length);
  const best = classes[ranking[0].index];
  message('Разпознато — ' + best.name, best.glyph);
  for (const {count, index} of ranking) {
    const item = document.createElement('li');
    item.textContent = classes[index].glyph + ' ' + classes[index].name + ' · ' + count + '/5 гласа';
    votes.append(item);
  }
});

async function load(path, type) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Cannot load ' + path);
  return response[type]();
}

try {
  const [items, buffer] = await Promise.all([
    load('./classes.json', 'json'), load('./training.bin', 'arrayBuffer'),
  ]);
  classes = items;
  const records = new Uint8Array(buffer);
  const stride = size * size + 1;
  if (records.length < 5 * stride || records.length % stride !== 0) {
    throw new Error('Invalid training data');
  }
  training = records;
  addExamples();
  message('Нарисувай знак или форма.');
  recognize.disabled = false;
  try {
    showMetrics(await load('./evaluation.json', 'json'));
  } catch {
    document.querySelector('#metrics-summary').textContent = 'Тестовата оценка не се зареди.';
  }
} catch {
  message('Моделът не се зареди. Презареди страницата.');
}

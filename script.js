const passages = [
    'A quiet morning gives the mind room to wander. The first light slips between the buildings, and the city slowly remembers how to move.',
    'Good ideas rarely arrive fully formed. They start as a small question, then grow through patience, curiosity, and a willingness to try again.',
    'Somewhere beyond the familiar streets, a train carries its passengers toward places they have only seen in passing dreams.',
    'The best way to learn a new skill is to make a little space for it every day. Small efforts have a way of becoming something remarkable.',
    'Rain tapped gently against the window while the old record player filled the room with a warm and familiar melody.',
    'A well-worn notebook can hold more than plans. It keeps fragments of conversations, unfinished thoughts, and the beginnings of better questions.',
    'On the coast, the tide pulls the shoreline into a new shape each morning. Nothing stays exactly as it was, and that is part of the beauty.',
    'Take a breath, find a steady pace, and let each sentence arrive one word at a time. There is no need to rush the rhythm.'
];

const elements = {
    passage: document.querySelector('#passage'),
    panel: document.querySelector('#typing-panel'),
    input: document.querySelector('#typing-input'),
    hint: document.querySelector('#panel-hint'),
    timer: document.querySelector('#timer'),
    wpm: document.querySelector('#wpm'),
    accuracy: document.querySelector('#accuracy'),
    count: document.querySelector('#character-count'),
    progress: document.querySelector('#progress-fill'),
    best: document.querySelector('#best-wpm'),
    result: document.querySelector('#result-panel'),
    resultWpm: document.querySelector('#result-wpm'),
    resultAccuracy: document.querySelector('#result-accuracy'),
    resultMistakes: document.querySelector('#result-mistakes'),
    resultNote: document.querySelector('#result-note'),
    restart: document.querySelector('#restart-button'),
    newTest: document.querySelector('#new-test-button'),
    durations: [...document.querySelectorAll('.duration-option')]
};

const BEST_KEY = 'typesprint-best-wpm';
let duration = 30;
let currentText = '';
let startedAt = null;
let deadline = null;
let timerId = null;
let state = 'idle';
let mistakes = 0;
let previousValue = '';
let lastPassageIndex = -1;

function getBestWpm() {
    const saved = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
}

function updateBestDisplay() {
    elements.best.textContent = String(getBestWpm());
}

function choosePassage() {
    let nextIndex = Math.floor(Math.random() * passages.length);
    if (passages.length > 1) {
        while (nextIndex === lastPassageIndex) {
            nextIndex = Math.floor(Math.random() * passages.length);
        }
    }
    lastPassageIndex = nextIndex;
    return passages[nextIndex];
}

function renderPassage() {
    const fragment = document.createDocumentFragment();
    for (const character of currentText) {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = character;
        fragment.append(span);
    }
    elements.passage.replaceChildren(fragment);
    updateCharacterDisplay();
}

function updateCharacterDisplay() {
    const typed = elements.input.value;
    const characterElements = elements.passage.querySelectorAll('.char');
    let correctCount = 0;

    characterElements.forEach((element, index) => {
        element.classList.remove('correct', 'incorrect', 'current');
        if (index < typed.length) {
            if (typed[index] === currentText[index]) {
                element.classList.add('correct');
                correctCount += 1;
            } else {
                element.classList.add('incorrect');
            }
        } else if (index === typed.length && state !== 'finished') {
            element.classList.add('current');
        }
    });

    const accuracy = typed.length === 0 ? 100 : Math.round((correctCount / typed.length) * 100);
    elements.accuracy.innerHTML = `${accuracy}<span>%</span>`;
    elements.count.textContent = `${typed.length} / ${currentText.length} characters`;

    if (typed.length > 0) {
        const currentCharacter = characterElements[Math.min(typed.length, characterElements.length - 1)];
        currentCharacter?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    return { accuracy, correctCount, typedCount: typed.length };
}

function getWpm(correctCount, elapsedMs) {
    if (elapsedMs <= 0) return 0;
    return Math.round((correctCount / 5) / (elapsedMs / 60000));
}

function updateStats(now = performance.now()) {
    const { accuracy, correctCount } = updateCharacterDisplay();
    const elapsedMs = startedAt === null ? 0 : Math.max(0, now - startedAt);
    const wpm = getWpm(correctCount, elapsedMs);
    elements.wpm.innerHTML = `${wpm}<span> wpm</span>`;
    elements.accuracy.innerHTML = `${accuracy}<span>%</span>`;

    if (state === 'running') {
        const remainingMs = Math.max(0, deadline - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        elements.timer.innerHTML = `${remainingSeconds}<span>s</span>`;
        elements.progress.style.width = `${Math.min(100, ((duration * 1000 - remainingMs) / (duration * 1000)) * 100)}%`;
        if (remainingMs === 0) finishTest();
    }
}

function countNewMistakes(previous, current) {
    let prefixLength = 0;
    while (prefixLength < previous.length && prefixLength < current.length && previous[prefixLength] === current[prefixLength]) {
        prefixLength += 1;
    }

    let suffixLength = 0;
    while (
        suffixLength < previous.length - prefixLength &&
        suffixLength < current.length - prefixLength &&
        previous[previous.length - 1 - suffixLength] === current[current.length - 1 - suffixLength]
    ) {
        suffixLength += 1;
    }

    const inserted = current.slice(prefixLength, current.length - suffixLength);
    for (let index = 0; index < inserted.length; index += 1) {
        if (inserted[index] !== currentText[prefixLength + index]) mistakes += 1;
    }
}

function startTest() {
    if (state !== 'idle') return;
    state = 'running';
    startedAt = performance.now();
    deadline = startedAt + duration * 1000;
    elements.panel.classList.add('is-active');
    elements.hint.textContent = 'Keep going, you are in the flow';
    elements.durations.forEach((button) => { button.disabled = true; });
    timerId = window.setInterval(() => updateStats(), 100);
}

function finishTest() {
    if (state === 'finished') return;
    state = 'finished';
    window.clearInterval(timerId);
    timerId = null;
    elements.panel.classList.remove('is-active');
    elements.panel.classList.add('is-finished');
    elements.input.blur();
    elements.hint.textContent = 'Test complete';
    elements.timer.innerHTML = `0<span>s</span>`;
    elements.progress.style.width = '100%';
    elements.durations.forEach((button) => { button.disabled = false; });

    const { accuracy, correctCount } = updateCharacterDisplay();
    const elapsedMs = Math.min(duration * 1000, Math.max(1, performance.now() - startedAt));
    const wpm = getWpm(correctCount, elapsedMs);
    const best = getBestWpm();
    const isNewBest = wpm > best;

    if (isNewBest) localStorage.setItem(BEST_KEY, String(wpm));
    updateBestDisplay();
    elements.resultWpm.textContent = String(wpm);
    elements.resultAccuracy.innerHTML = `${accuracy}<small>%</small>`;
    elements.resultMistakes.textContent = String(mistakes);
    elements.resultNote.textContent = isNewBest
        ? 'New personal best. That rhythm is yours to beat.'
        : `Your best is ${Math.max(best, wpm)} WPM. Saved on this device.`;
    elements.result.hidden = false;
    elements.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetTest({ newPassage = false, focus = false } = {}) {
    window.clearInterval(timerId);
    timerId = null;
    state = 'idle';
    startedAt = null;
    deadline = null;
    mistakes = 0;
    previousValue = '';
    elements.input.value = '';
    elements.result.hidden = true;
    elements.panel.classList.remove('is-active', 'is-finished');
    elements.hint.textContent = 'Click the text, then start typing';
    elements.timer.innerHTML = `${duration}<span>s</span>`;
    elements.wpm.innerHTML = '0<span> wpm</span>';
    elements.accuracy.innerHTML = '100<span>%</span>';
    elements.count.textContent = '0 characters';
    elements.progress.style.width = '0%';
    elements.durations.forEach((button) => { button.disabled = false; });
    if (newPassage || !currentText) currentText = choosePassage();
    renderPassage();
    if (focus) elements.input.focus();
}

elements.input.addEventListener('input', () => {
    if (state === 'finished') return;
    const currentValue = elements.input.value;
    if (currentValue.length > currentText.length) {
        elements.input.value = currentValue.slice(0, currentText.length);
    }
    if (elements.input.value.length >= currentText.length - 32) {
        currentText = `${currentText} ${choosePassage()}`;
        renderPassage();
    }
    countNewMistakes(previousValue, elements.input.value);
    previousValue = elements.input.value;
    if (state === 'idle' && elements.input.value.length > 0) startTest();
    updateStats();
    if (elements.input.value.length >= currentText.length && state === 'running') finishTest();
});

elements.passage.addEventListener('click', () => elements.input.focus());
elements.panel.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    elements.input.focus();
});

elements.durations.forEach((button) => {
    button.addEventListener('click', () => {
        duration = Number(button.dataset.duration);
        elements.durations.forEach((option) => {
            const selected = option === button;
            option.classList.toggle('selected', selected);
            option.setAttribute('aria-pressed', String(selected));
        });
        resetTest();
    });
});

elements.restart.addEventListener('click', () => resetTest({ focus: true }));
elements.newTest.addEventListener('click', () => resetTest({ newPassage: true, focus: true }));

updateBestDisplay();
resetTest({ newPassage: true });
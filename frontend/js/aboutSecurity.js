/** /about-security — simple explainer for how NEXA encrypts chat. */

const DEFAULT_TITLE = 'NEXA — Private messenger in your browser';
const PAGE_TITLE = 'NEXA — How your chats stay private';
const PLAIN = 'Hello';
const GLYPHS = '7f#k2m%$@&*9cQxΔ';
const CIPHER_BITS = ['a9f3', 'c1e8', '7b02', 'd44c', '91aa', 'e03f', 'bb17', '4c8d'];

const FLOW_STEPS = [
    { text: PLAIN, scrambled: false },
    { text: PLAIN, scrambled: false },
    { text: '7f#k2m', scrambled: true },
    { text: PLAIN, scrambled: false },
    { text: PLAIN, scrambled: false },
];

const STAGE_MS = [0, 900, 1700, 2800, 4000];

/** @type {ReturnType<typeof setInterval> | 0} */
let flowTimer = 0;
/** @type {ReturnType<typeof setInterval> | 0} */
let stageTimer = 0;
/** @type {ReturnType<typeof setInterval> | 0} */
let previewTimer = 0;
/** @type {Map<Element, number>} */
const scrambleRafs = new Map();
let flowIndex = 0;
let boundRoot = null;

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setBackLink(root) {
    const back = root.querySelector('#uiAboutSecurityBack');
    const backLabel = root.querySelector('#uiAboutSecurityBackLabel');
    const cta = root.querySelector('#uiAboutSecurityCta');
    const ctaLabel = root.querySelector('#uiAboutSecurityCtaLabel');
    let signedIn = false;
    try {
        signedIn = Boolean(localStorage.getItem('auth_username'));
    } catch {
        signedIn = false;
    }
    const href = signedIn ? '/chat' : '/';
    if (back) back.setAttribute('href', href);
    if (cta) cta.setAttribute('href', href);
    if (backLabel) backLabel.textContent = signedIn ? 'Back to chats' : 'Back to home';
    if (ctaLabel) ctaLabel.textContent = signedIn ? 'Back to NEXA' : 'Get started';
}

function cancelScramble(el) {
    const id = scrambleRafs.get(el);
    if (id) cancelAnimationFrame(id);
    if (el) scrambleRafs.delete(el);
}

function stopScrambles() {
    scrambleRafs.forEach((id) => cancelAnimationFrame(id));
    scrambleRafs.clear();
}

function scrambleFrame(el, target, scrambled, onDone) {
    if (!el) {
        onDone?.();
        return;
    }
    cancelScramble(el);
    if (reducedMotion() || !scrambled) {
        el.textContent = target;
        onDone?.();
        return;
    }
    const length = Math.max(target.length, 6);
    const started = performance.now();
    const duration = 420;
    const tick = (now) => {
        if (!scrambleRafs.has(el)) return;
        const t = Math.min(1, (now - started) / duration);
        if (t < 1) {
            let out = '';
            for (let i = 0; i < length; i += 1) {
                out += GLYPHS[(Math.floor(now / 40) + i * 3) % GLYPHS.length];
            }
            el.textContent = out;
            scrambleRafs.set(el, requestAnimationFrame(tick));
            return;
        }
        scrambleRafs.delete(el);
        el.textContent = target;
        onDone?.();
    };
    scrambleRafs.set(el, requestAnimationFrame(tick));
}

function paintFlow(root, index) {
    const packet = root.querySelector('.sec-flow__packet');
    const spark = root.querySelector('.sec-flow__spark');
    const nodes = root.querySelectorAll('.sec-flow__node');
    if (!packet || !nodes.length) return;
    const step = FLOW_STEPS[index] || FLOW_STEPS[0];
    packet.classList.toggle('is-scrambled', step.scrambled);
    packet.classList.add('is-pop');
    packet.style.setProperty('--flow-x', String(index));
    if (spark) spark.style.setProperty('--flow-x', String(index));
    nodes.forEach((node, i) => {
        node.classList.toggle('is-active', i === index);
        node.classList.toggle('is-passed', i < index);
    });
    scrambleFrame(packet, step.text, step.scrambled);
    window.setTimeout(() => packet.classList.remove('is-pop'), 280);
}

function startFlow(root) {
    stopFlow();
    flowIndex = 0;
    paintFlow(root, 0);
    if (reducedMotion()) return;
    flowTimer = setInterval(() => {
        flowIndex = (flowIndex + 1) % FLOW_STEPS.length;
        paintFlow(root, flowIndex);
    }, 1500);
}

function stopFlow() {
    if (flowTimer) clearInterval(flowTimer);
    flowTimer = 0;
    stopScrambles();
}

/** @type {number[]} */
let stageTimeouts = [];

function setStage(root, name) {
    const stage = root.querySelector('.sec-stage');
    const you = root.querySelector('[data-stage-you]');
    const them = root.querySelector('[data-stage-them]');
    if (!stage) return;
    stage.dataset.phase = name;
    if (name === 'compose') {
        if (you) you.textContent = PLAIN;
        if (them) them.textContent = '';
    }
    if (name === 'seal' && you) scrambleFrame(you, '7f#k2m', true);
    if (name === 'open') {
        if (them) them.textContent = PLAIN;
        if (you) you.textContent = '';
    }
}

function startStage(root) {
    stopStage();
    const cycle = () => {
        stageTimeouts.forEach((id) => clearTimeout(id));
        stageTimeouts = [];
        setStage(root, 'compose');
        stageTimeouts.push(window.setTimeout(() => setStage(root, 'seal'), STAGE_MS[1]));
        stageTimeouts.push(window.setTimeout(() => setStage(root, 'transit'), STAGE_MS[2]));
        stageTimeouts.push(window.setTimeout(() => setStage(root, 'open'), STAGE_MS[3]));
    };
    cycle();
    if (reducedMotion()) return;
    stageTimer = setInterval(cycle, STAGE_MS[4]);
}

function stopStage() {
    if (stageTimer) clearInterval(stageTimer);
    stageTimer = 0;
    stageTimeouts.forEach((id) => clearTimeout(id));
    stageTimeouts = [];
}

function randomCipher() {
    return CIPHER_BITS.map((bit, i) => {
        const spin = (bit.charCodeAt(0) + Math.floor(performance.now() / 180) + i) % 16;
        return spin.toString(16).padStart(2, '0') + bit.slice(2);
    }).join('·');
}

function startPreview(root) {
    stopPreview();
    const locked = root.querySelector('[data-preview-locked]');
    if (!locked || reducedMotion()) return;
    previewTimer = setInterval(() => {
        locked.textContent = randomCipher();
    }, 220);
}

function stopPreview() {
    if (previewTimer) clearInterval(previewTimer);
    previewTimer = 0;
}

function playIntro(root) {
    root.classList.remove('is-ready');
    void root.offsetWidth;
    requestAnimationFrame(() => root.classList.add('is-ready'));
}

export function initAboutSecurity(root) {
    if (!root) return;
    boundRoot = root;
    setBackLink(root);
    playIntro(root);
    startFlow(root);
    startStage(root);
    startPreview(root);
    document.title = PAGE_TITLE;
}

export function teardownAboutSecurity() {
    stopFlow();
    stopStage();
    stopPreview();
    boundRoot?.classList.remove('is-ready');
    boundRoot = null;
    document.title = DEFAULT_TITLE;
}

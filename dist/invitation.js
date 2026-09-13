const envelope = document.querySelector('.envelope');
const invitation = document.querySelector('.invitation');
const replay = document.querySelector('.replay');
const status = document.querySelector('.status');
const motionPreview = document.querySelector('.motion-preview');
const intro = document.querySelector('.intro');
const entryActions = document.querySelector('.entry-actions');
const headerReplay = document.querySelector('.header-replay');
const details = document.querySelector('.wedding-details');
const detailsLink = document.querySelector('.details-link');
const skipAnimation = document.querySelector('.skip-animation');
const stages = ['is-opening', 'is-flap-open', 'is-extracted', 'is-unfolded', 'is-settled'];
let opening = false;
const pause = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));

async function openInvitation(forceMotion = true) {
  if (opening) return;
  opening = true;
  envelope.disabled = true;
  envelope.setAttribute('aria-expanded', 'true');
  entryActions.hidden = true;
  headerReplay.hidden = true;
  document.body.classList.toggle('motion-requested', forceMotion);
  invitation.hidden = false;
  status.textContent = 'Deine Einladung wird geöffnet.';

  if (!forceMotion) {
    document.body.classList.add(...stages);
  } else {
    document.body.classList.add('is-opening');
    await pause(500);
    document.body.classList.add('is-flap-open');
    await pause(1100);
    document.body.classList.add('is-extracted');
    await pause(1000);
    document.body.classList.add('is-unfolded');
    await pause(2100);
    document.body.classList.add('is-settled');
  }

  invitation.inert = false;
  intro.setAttribute('aria-hidden', 'true');
  replay.hidden = false;
  headerReplay.hidden = false;
  details.hidden = false;
  detailsLink.hidden = false;
  status.textContent = 'Francisco und Katherine heiraten am 9. Januar 2027 in Villa de Leyva, Kolumbien.';
  invitation.querySelector('h2').focus({ preventScroll: true });
}

function resetInvitation() {
  document.body.classList.add('is-resetting');
  document.body.classList.remove(...stages, 'motion-requested');
  invitation.hidden = true;
  invitation.inert = true;
  replay.hidden = true;
  headerReplay.hidden = true;
  details.hidden = true;
  detailsLink.hidden = true;
  entryActions.hidden = false;
  envelope.disabled = false;
  envelope.setAttribute('aria-expanded', 'false');
  status.textContent = '';
  opening = false;
  intro.removeAttribute('aria-hidden');
  window.scrollTo({top: 0, behavior: 'instant'});
  // Flush the reset before restoring transitions so replay begins with a closed letter.
  void document.body.offsetHeight;
  document.body.classList.remove('is-resetting');
  envelope.focus({ preventScroll: true });
}

async function replayAnimation() {
  if (!document.body.classList.contains('is-settled')) return;
  resetInvitation();
  // Give the closed envelope a painted frame before playing the full sequence again.
  await pause(120);
  openInvitation(true);
}

envelope.addEventListener('click', () => openInvitation(true));
motionPreview.addEventListener('click', () => openInvitation(true));
skipAnimation.addEventListener('click', () => openInvitation(false));
replay.addEventListener('click', replayAnimation);
headerReplay.addEventListener('click', replayAnimation);

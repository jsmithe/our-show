'use strict';

const storageKey = 'our-show-v1';
const services = ['Prime Video', 'Netflix', 'Paramount+', 'YouTube', 'Disney+'];
const preferences = { unknown: 'Unknown', love: 'Love it', okay: 'It’s okay', dislike: 'No thanks' };
const watchStates = { unknown: 'Unknown', started: 'Started', finished: 'Finished' };
const screen = document.querySelector('#screen');
const tabs = document.querySelector('#tabs');
const householdButton = document.querySelector('#household');
const announcement = document.querySelector('#announcement');

function localDay() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].join('-');
}

function newDecision() {
  return { day: localDay(), passed: [], pick: null };
}

function loadHousehold() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) return saved;
  } catch {
    // An unreadable save should still allow the prototype to start.
  }
  return {
    onboarding: 'services',
    services: [],
    viewers: [{ id: 1, name: 'Viewer 1' }, { id: 2, name: 'Viewer 2' }],
    nextViewer: 3,
    watching: [1, 2],
    shelf: {},
    tonight: newDecision()
  };
}

const state = loadHousehold();
let catalog = [];
let page = state.onboarding === 'done' ? 'tonight' : state.onboarding;
let query = '';
let householdOnly = state.services.length > 0;
let watchingOpen = false;

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    announce('Your browser couldn’t save this household. Changes will last until you leave.');
  }
}

function announce(message) {
  announcement.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

const titleById = id => catalog.find(show => show.id === id);
const saved = id => Object.hasOwn(state.shelf, id);
const selectedService = show => state.services.includes(show.service);
const showName = show => escapeHtml(show.title);
const icon = name => '<img src="./artwork/icons/' + name + '.svg" alt="">';

function button(label, action, options = {}) {
  const { style = 'button', value = '', disabled = false } = options;
  return `<button type="button" class="${style}" data-action="${action}" data-value="${value}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

function meta(show) {
  return [show.kind === 'channel' ? 'Channel' : '', show.service ? `${show.service} (sample)` : 'Service unknown']
    .filter(Boolean).map(escapeHtml).join(' · ');
}

function art(show, style, source = show.artwork?.[0], alt = '') {
  return source
    ? `<img class="${style}" src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" draggable="false">`
    : `<div class="${style} title-tile" aria-hidden="true">${showName(show)}</div>`;
}

function gallery(show) {
  if ((show.artwork?.length ?? 0) < 2) return art(show, 'hero-art');
  return `<div role="region" aria-label="${showName(show)} artwork">
    <div class="slides">${show.artwork.map(source => art(show, 'hero-art', source)).join('')}</div>
    <div class="dots">${show.artwork.map((_, index) =>
      `<button type="button" class="dot" data-action="slide" data-value="${index}"
        aria-label="Image ${index + 1} of ${show.artwork.length}" aria-current="${index === 0}"></button>`
    ).join('')}</div>
    <p class="sr-only image-position" role="status">Image 1 of ${show.artwork.length}</p>
  </div>`;
}

function bindGallery() {
  const slides = screen.querySelector('.slides');
  if (!slides) return;
  const dots = [...screen.querySelectorAll('.dot')];
  const position = screen.querySelector('.image-position');
  let active = 0;
  slides.addEventListener('scroll', () => {
    const offset = slides.children[1].offsetLeft - slides.children[0].offsetLeft;
    const index = Math.max(0, Math.min(dots.length - 1, Math.round(slides.scrollLeft / offset)));
    if (active === index) return;
    dots[active].setAttribute('aria-current', 'false');
    dots[index].setAttribute('aria-current', 'true');
    active = index;
    position.textContent = dots[index].ariaLabel;
  }, { passive: true });
}

function choice(name, value, label, checked, disabled = false) {
  return `<label class="choice"><input type="checkbox" name="${name}" value="${value}"
    ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</label>`;
}

function serviceChoices() {
  return `<fieldset class="choices"><legend class="sr-only">Streaming services</legend>
    ${services.map(service => choice('service', service, service, state.services.includes(service))).join('')}
  </fieldset>`;
}

function servicePage() {
  return `<h1>Where do you watch?</h1>
    <p class="intro">Choose the streaming services your household uses.</p>
    ${serviceChoices()}
    ${button('Continue', 'start-browse', { style: 'button primary wide' })}`;
}

function renderCatalog() {
  const search = query.trim().toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const results = catalog.filter(show => (!householdOnly || Boolean(search) || selectedService(show))
    && show.title.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(search));
  results.sort((a, b) => Number(Boolean(b.artwork)) - Number(Boolean(a.artwork)));
  screen.querySelector('#catalog-results').innerHTML = results.length
    ? results.map(show => `<article class="catalog-card">
        ${art(show, 'thumb')}<h2 class="sr-only">${showName(show)}</h2>
        ${show.artwork ? `<strong aria-hidden="true">${showName(show)}</strong>` : ''}
        <p class="small">${meta(show)}</p>
        <button type="button" class="button" data-action="add-show" data-value="${show.id}"
          aria-label="${saved(show.id) ? 'Added' : 'Add'} ${showName(show)}" aria-disabled="${saved(show.id)}">
          ${icon(saved(show.id) ? 'check' : 'plus')}${saved(show.id) ? 'Added' : 'Add'}
        </button>
      </article>`).join('')
    : '<p class="intro">No sample titles match. Try another search or show all services.</p>';
  const finish = screen.querySelector('[data-action="finish"]');
  if (finish) finish.textContent = Object.keys(state.shelf).length ? 'Go to Tonight' : 'Continue with an empty shelf';
}

function browsePage() {
  const onboarding = state.onboarding !== 'done';
  return `<h1>Add our shows</h1>
    <p class="intro">Save a few shows or channels your family already knows.</p>
    <label class="search">${icon('search')}<span class="sr-only">Search shows and channels</span>
      <input id="search" type="search" placeholder="Search shows and channels" value="${escapeHtml(query)}">
    </label>
    ${state.services.length ? choice('filter', 'household', 'Show my services when browsing', householdOnly) : ''}
    <p class="small section">Streaming labels are samples. Availability can vary.</p>
    <div id="catalog-results" class="catalog"></div>
    ${onboarding ? `<div class="catalog-footer">${button('Go to Tonight', 'finish', { style: 'button primary wide' })}</div>` : ''}`;
}

function selectField(label, name, value, options, showId, viewerId = '') {
  return `<label class="field">${escapeHtml(label)}
    <select name="${name}" data-show="${showId}" data-viewer="${viewerId}">
      ${Object.entries(options).map(([key, text]) =>
        `<option value="${key}" ${value === key ? 'selected' : ''}>${text}</option>`).join('')}
    </select>
  </label>`;
}

function shelfPage() {
  const shows = catalog.filter(show => saved(show.id));
  return `<h1>Our shelf</h1>
    <p class="intro">Keep the shows you know. Open a title to set everyone’s preferences.</p>
    ${button(icon('plus') + 'Add our shows', 'start-browse', { style: 'button primary wide' })}
    ${shows.length ? `<div class="shelf-list">${shows.map(show => {
      const entry = state.shelf[show.id];
      return `<details class="shelf-title">
        <summary><span class="preview">${show.artwork ? art(show, 'shelf-thumb') : ''}${showName(show)}</span></summary>
        <p class="small">${meta(show)}</p>
        <div class="fields">
          ${state.viewers.map(viewer => `<fieldset class="viewer-preferences">
            <legend>${escapeHtml(viewer.name)}</legend>
            ${selectField('Preference', 'preference', entry.preferences[viewer.id] ?? 'unknown',
              preferences, show.id, viewer.id)}
            ${selectField('Watch progress', 'watch-state', entry.progress[viewer.id] ?? 'unknown',
              watchStates, show.id, viewer.id)}
          </fieldset>`).join('')}
        </div>
        ${button('Remove from shelf', 'remove-show', { style: 'text-button', value: show.id })}
      </details>`;
    }).join('')}</div>` : '<div class="empty"><h2>Your shelf is empty</h2><p>Add a few familiar titles for your next family pick.</p></div>'}`;
}

function settingsPage() {
  return `<h1>Household</h1><section class="section"><h2>Who watches?</h2>
    <div class="fields">
      ${state.viewers.map((viewer, index) => `<div class="viewer-row">
        <label class="field">Viewer ${index + 1} name
          <input name="viewer-name" data-viewer="${viewer.id}" maxlength="36" value="${escapeHtml(viewer.name)}">
        </label>
        ${button('Remove<span class="sr-only"> ' + escapeHtml(viewer.name) + '</span>', 'remove-viewer',
          { style: 'text-button', value: viewer.id, disabled: state.viewers.length === 1 })}
      </div>`).join('')}
    </div>
    ${button('Add viewer', 'add-viewer', { style: 'text-button' })}
  </section><section class="section"><h2>Where do you watch?</h2><div class="fields">${serviceChoices()}</div></section>
  ${button('Done', 'tonight', { style: 'button primary wide' })}`;
}

function fit(show) {
  const values = state.watching.map(id => state.shelf[show.id].preferences[id] ?? 'unknown');
  return {
    dislikes: values.filter(value => value === 'dislike').length,
    unknowns: values.filter(value => value === 'unknown').length,
    loves: values.filter(value => value === 'love').length
  };
}

function rankedShows() {
  return catalog.filter(show => saved(show.id) && !state.tonight.passed.includes(show.id))
    .map(show => ({ show, ...fit(show) }))
    .sort((a, b) => a.dislikes - b.dislikes || a.unknowns - b.unknowns || b.loves - a.loves
      || Number(selectedService(b.show)) - Number(selectedService(a.show)));
}

function fitMessage({ show, dislikes, unknowns, loves }) {
  const everyone = state.watching.length;
  if (dislikes === everyone) return everyone === 1 ? 'This viewer usually passes.' : 'Everyone watching usually passes.';
  if (dislikes) return everyone === 2 && loves === 1
    ? 'One loves it. One usually passes.'
    : `${dislikes} of ${everyone} viewers usually pass.`;
  if (unknowns) return unknowns === everyone ? 'A familiar pick. Preferences are still open.'
    : `${unknowns} of ${everyone} preferences still unknown.`;
  if (loves === everyone) return everyone === 1 ? 'A favorite for this viewer.' : 'Everyone watching loves it.';
  if (state.watching.every(id => state.shelf[show.id].progress[id] === 'finished')) return everyone === 1
    ? 'A familiar rewatch.' : 'A familiar rewatch everyone is okay with.';
  return everyone === 1 ? 'This viewer is okay with it.' : 'Everyone watching is okay with this pick.';
}

function tonightPage() {
  const lastPass = titleById(state.tonight.passed.at(-1));
  const pick = titleById(state.tonight.pick);
  const suggestion = rankedShows()[0];
  const show = pick ?? suggestion?.show;
  const watching = state.viewers.filter(viewer => state.watching.includes(viewer.id));
  const undo = lastPass ? `<div class="callout">${icon('check-white')}<strong>Passed on ${showName(lastPass)}</strong>
      ${button('Undo', 'undo', { style: 'text-button' })}</div>` : '';
  const tonightContent = show ? `<article class="hero">${gallery(show)}<h2>${showName(show)}</h2>
      <div class="hero-copy"><p>${pick ? 'You picked this for tonight.' : fitMessage(suggestion)}</p>
      <p class="small">${meta(show)}</p></div>
      <div class="actions">${pick
        ? button('Reopen decision', 'reopen')
        : button('Let’s watch', 'confirm', { style: 'button primary', value: show.id })
        + button('Not tonight', 'pass', { value: show.id })}</div></article>` : lastPass
    ? '<div class="empty"><h2>You’ve seen all tonight’s options</h2><p>Undo a pass to give a show another look.</p></div>'
    : `<div class="empty"><h2>What should we watch?</h2><p>Add a few familiar shows and we’ll help you pick one.</p>
      ${button('Add our shows', 'start-browse', { style: 'button primary' })}</div>`;
  return `<h1>Tonight</h1>${tonightContent}${pick ? '' : undo}
    <details class="watching" ${watchingOpen ? 'open' : ''}>
      <summary>Watching: ${watching.map(viewer => escapeHtml(viewer.name)).join(', ')}</summary>
      <fieldset class="choices"><legend class="sr-only">Who’s watching tonight?</legend>
        ${state.viewers.map(viewer => choice('watching', viewer.id, viewer.name,
          state.watching.includes(viewer.id), watching.length === 1 && watching[0].id === viewer.id)).join('')}
      </fieldset>
    </details>`;
}

function render({ focus = false } = {}) {
  if (state.tonight.day !== localDay()) {
    state.tonight = newDecision();
    save();
  }
  const pages = { services: servicePage, browse: browsePage, shelf: shelfPage, settings: settingsPage, tonight: tonightPage };
  screen.innerHTML = pages[page]();
  tabs.hidden = householdButton.hidden = state.onboarding !== 'done';
  tabs.querySelectorAll('button').forEach(tab => {
    const current = tab.dataset.action === (page === 'browse' ? 'shelf' : page);
    if (current) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  if (page === 'browse') renderCatalog();
  if (page === 'tonight') bindGallery();
  if (focus) {
    screen.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function openPage(next) {
  if (next !== 'tonight') watchingOpen = false;
  page = next;
  render({ focus: true });
}

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control || control.getAttribute('aria-disabled') === 'true') return;
  const { action, value } = control.dataset;

  if (action === 'slide') {
    const slides = screen.querySelector('.slides');
    const offset = slides.children[Number(value)].offsetLeft - slides.firstElementChild.offsetLeft;
    slides.scrollTo({ left: offset, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    return;
  }

  // An action from a screen left open overnight belongs to the newly displayed night.
  if (page === 'tonight' && state.tonight.day !== localDay()) {
    render({ focus: true });
    return;
  }

  switch (action) {
    case 'tonight':
    case 'shelf':
      openPage(action);
      return;
    case 'start-browse':
      if (state.onboarding === 'services') state.onboarding = 'browse';
      householdOnly = state.services.length > 0;
      query = '';
      save();
      openPage('browse');
      return;
    case 'add-show':
      state.shelf[value] = { preferences: {}, progress: {} };
      save();
      control.setAttribute('aria-disabled', 'true');
      control.setAttribute('aria-label', 'Added ' + titleById(value).title);
      control.innerHTML = icon('check') + 'Added';
      const finish = screen.querySelector('[data-action="finish"]');
      if (finish) finish.textContent = 'Go to Tonight';
      announce(titleById(value).title + ' added to your shelf.');
      return;
    case 'finish':
      state.onboarding = 'done';
      save();
      openPage('tonight');
      return;
    case 'remove-show':
      delete state.shelf[value];
      state.tonight.passed = state.tonight.passed.filter(id => id !== value);
      if (state.tonight.pick === value) state.tonight.pick = null;
      announce(titleById(value).title + ' removed.');
      break;
    case 'add-viewer': {
      const id = state.nextViewer++;
      state.viewers.push({ id, name: 'Viewer ' + id });
      state.watching.push(id);
      save();
      render();
      screen.querySelector(`[data-viewer="${id}"]`).focus();
      return;
    }
    case 'remove-viewer': {
      const id = Number(value);
      state.viewers = state.viewers.filter(viewer => viewer.id !== id);
      state.watching = state.watching.filter(viewer => viewer !== id);
      if (state.watching.length === 0) state.watching.push(state.viewers[0].id);
      for (const entry of Object.values(state.shelf)) {
        delete entry.preferences[id];
        delete entry.progress[id];
      }
      break;
    }
    case 'pass':
      state.tonight.passed.push(value);
      announce('Passed on ' + titleById(value).title + '.');
      break;
    case 'undo':
      announce('Restored ' + titleById(state.tonight.passed.pop()).title + '.');
      break;
    case 'confirm':
      state.tonight.pick = value;
      announce(titleById(value).title + ' picked for tonight.');
      break;
    case 'reopen':
      state.tonight.pick = null;
      announce('Tonight’s decision was reopened.');
      break;
    default:
      return;
  }
  save();
  render({ focus: true });
});

householdButton.addEventListener('click', () => openPage('settings'));
screen.addEventListener('input', event => {
  if (event.target.id !== 'search') return;
  query = event.target.value;
  renderCatalog();
});

screen.addEventListener('change', event => {
  const field = event.target;
  switch (field.name) {
    case 'service':
      state.services = [...screen.querySelectorAll('[name="service"]:checked')].map(input => input.value);
      break;
    case 'filter':
      householdOnly = field.checked;
      renderCatalog();
      return;
    case 'viewer-name': {
      const viewer = state.viewers.find(item => item.id === Number(field.dataset.viewer));
      viewer.name = field.value.trim() || viewer.name;
      field.value = viewer.name;
      break;
    }
    case 'preference':
      state.shelf[field.dataset.show].preferences[field.dataset.viewer] = field.value;
      break;
    case 'watch-state':
      state.shelf[field.dataset.show].progress[field.dataset.viewer] = field.value;
      break;
    case 'watching':
      state.watching = [...screen.querySelectorAll('[name="watching"]:checked')].map(input => Number(input.value));
      watchingOpen = true;
      save();
      render();
      (screen.querySelector(`[name="watching"][value="${field.value}"]:enabled`)
        ?? screen.querySelector('.watching summary')).focus();
      return;
    default:
      return;
  }
  save();
});

async function start() {
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error('Catalog could not load');
    catalog = await response.json();
    render();
  } catch {
    screen.innerHTML = '<h1>Our Show</h1><p class="intro">The sample catalog couldn’t load. Open the app through a local web server and reload.</p>';
  }
}

start();

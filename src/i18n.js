/**
 * Minimal i18n layer -- no build step, no framework, just a lookup table
 * and simple {param} interpolation. Built now, before the roster grows,
 * because retrofitting localization onto hardcoded strings gets more
 * expensive every character/interaction added after this point.
 *
 * Static HTML text uses data-i18n / data-i18n-aria attributes (see
 * applyLocale below); dynamic strings (speech bubbles, JS-set aria-labels)
 * call t(key, params) directly at the point of use.
 *
 * Spanish interjections used in EN text (¡Hola!, ¡Afuera!) are kept
 * as-is in both locales on purpose -- they're character voice/flavor for
 * a Día de los Muertos village, not something that needs "translating
 * away" even in English mode.
 */

const STRINGS = {
  en: {
    "ui.village.title": "Spirit Village",
    "ui.village.description": "Pepita, Miguelito, and Xolo are testing the multi-resident village. Tap anyone to say hello, drag one into the house, or wait and watch them run into each other.",
    "ui.village.ariaLabel": "Spirit Village test area",
    "ui.dayNightToggle.toNight": "Switch to night",
    "ui.dayNightToggle.toDay": "Switch to day",
    "ui.house.empty": "Empty house",
    "ui.house.occupied": "{count} resident(s) inside, tap to let them out",
    "ui.flowerBed.dry": "Dry flower bed, tap to water",
    "ui.flowerBed.watered": "Watered flower bed",
    "ui.bench.empty": "Empty bench, tap to rest",
    "ui.bench.occupied": "Someone is resting",
    "ui.fountain.still": "Toss petals into the fountain to make a wish",
    "ui.fountain.wished": "A wish was just made here",
    "ui.resident.tap": "Tap {name}",
    "speech.flowerBed.watered": "Flowers watered!",
    "speech.bench.resting": "Just a moment...",
    "speech.fountain.wish": "I wish for a wonderful day!",
    "speech.fountain.petals": "Petals!",
    "speech.action.giveFlower": "A flower for you.",
    "speech.resident.pinned": "I'll stay right here.",
    "speech.resident.unpinned": "Time to wander!",
    "speech.resident.released": "¡Afuera!",
    "speech.resident.greet": "¡Hola, {name}!",
    "speech.resident.greetFallback": "¡Hola! I'm {name}.",
    "speech.resident.greetFlowers": "¡Hola! Flowers make every day brighter."
  },
  es: {
    "ui.village.title": "Pueblo Espíritu",
    "ui.village.description": "Pepita, Miguelito y Xolo están probando el pueblo con múltiples residentes. Toca a cualquiera para saludar, arrastra a alguien a la casa, o espera y obsérvalos encontrarse.",
    "ui.village.ariaLabel": "Área de prueba del Pueblo Espíritu",
    "ui.dayNightToggle.toNight": "Cambiar a noche",
    "ui.dayNightToggle.toDay": "Cambiar a día",
    "ui.house.empty": "Casa vacía",
    "ui.house.occupied": "{count} residente(s) adentro, toca para dejarlos salir",
    "ui.flowerBed.dry": "Jardín seco, toca para regar",
    "ui.flowerBed.watered": "Jardín regado",
    "ui.bench.empty": "Banca vacía, toca para descansar",
    "ui.bench.occupied": "Alguien está descansando",
    "ui.fountain.still": "Lanza pétalos a la fuente para pedir un deseo",
    "ui.fountain.wished": "Aquí se acaba de pedir un deseo",
    "ui.resident.tap": "Toca a {name}",
    "speech.flowerBed.watered": "¡Flores regadas!",
    "speech.bench.resting": "Un momento...",
    "speech.fountain.wish": "¡Deseo un día maravilloso!",
    "speech.fountain.petals": "¡Pétalos!",
    "speech.action.giveFlower": "Una flor para ti.",
    "speech.resident.pinned": "Me quedaré aquí.",
    "speech.resident.unpinned": "¡Hora de pasear!",
    "speech.resident.released": "¡Afuera!",
    "speech.resident.greet": "¡Hola, {name}!",
    "speech.resident.greetFallback": "¡Hola! Soy {name}.",
    "speech.resident.greetFlowers": "¡Hola! Las flores alegran cada día."
  }
};

const STORAGE_KEY = "spiritVillage.locale";
let currentLocale = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "en";
if (!STRINGS[currentLocale]) currentLocale = "en";

const listeners = new Set();

export function availableLocales() {
  return Object.keys(STRINGS);
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  if (!STRINGS[locale] || locale === currentLocale) return;
  currentLocale = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* localStorage unavailable (private mode, etc.) -- locale just won't persist across reloads */ }
  listeners.forEach(listener => listener(locale));
}

// Called whenever the locale changes, so callers (applyLocale below, any
// live UI) can re-render without needing their own change-detection.
export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key, params = {}) {
  const template = STRINGS[currentLocale]?.[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// Applies t() to every element with data-i18n (textContent) or
// data-i18n-aria (aria-label) in the given root (defaults to the whole
// document). Call once on load and again on every locale change.
export function applyLocale(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
}

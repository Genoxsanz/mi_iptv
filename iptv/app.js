const M3U_URL = "https://iptv-org.github.io/iptv/index.m3u";

const listScreen = document.getElementById("listScreen");
const playerScreen = document.getElementById("playerScreen");

const channelsDiv = document.getElementById("channels");
const searchInput = document.getElementById("searchInput");
const statusEl = document.getElementById("status");

const video = document.getElementById("video");
const playerStatus = document.getElementById("playerStatus");

const channelToast = document.getElementById("channelToast");
const channelToastLogo = document.getElementById("channelToastLogo");
const channelToastName = document.getElementById("channelToastName");

const filterButtons = document.querySelectorAll(".filter-btn");

let allChannels = [];
let visibleChannels = [];
let currentChannel = null;
let currentIndex = 0;
let currentFilter = "all";

let hls = null;
let playToken = 0;
let toastTimer = null;
let statusTimer = null;

let playerPageOpen = false;
let ignoreNextPopState = false;

const FAVORITES_KEY = "genox_iptv_favorites";
let favorites = loadFavorites();

/* =========================
   CARGA DE LISTA
========================= */

async function loadM3U() {
  try {
    statusEl.textContent = "Cargando lista global...";
    channelsDiv.innerHTML = "";

    const response = await fetch(M3U_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar la lista M3U");
    }

    const text = await response.text();

    allChannels = parseM3U(text)
      .map(applyChannelRules)
      .filter(channel => !channel.hide)
      .sort(sortChannels);

    applyFilters();

    statusEl.textContent = `${allChannels.length} canales cargados · Paraguay primero`;

    setTimeout(() => {
      focusChannel(0);
    }, 200);

  } catch (error) {
    console.error(error);
    statusEl.textContent = "Error al cargar la lista IPTV.";
  }
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line.startsWith("#EXTINF")) continue;

    const originalName = line.split(",").pop().trim();
    const cleanName = cleanChannelName(originalName);

    const tvgId = getAttr(line, "tvg-id");
    const logo = getAttr(line, "tvg-logo");
    const group = getAttr(line, "group-title") || "Sin categoría";
    const country = getAttr(line, "tvg-country");

    let url = "";

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();

      if (next && !next.startsWith("#")) {
        url = next;
        break;
      }
    }

    if (!url.startsWith("http")) continue;

    const channel = {
      originalName,
      name: cleanName,
      tvgId,
      logo,
      group,
      country,
      url,
      hide: false
    };

    channel.isParaguay = isParaguay(channel);

    result.push(channel);
  }

  return removeDuplicates(result);
}

function getAttr(line, attr) {
  const match = line.match(new RegExp(`${attr}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function removeDuplicates(list) {
  const seen = new Set();

  return list.filter(channel => {
    const key = channel.url;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/* =========================
   LIMPIEZA DE NOMBRES
========================= */

function cleanChannelName(name) {
  return String(name || "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s*\((?:144p|240p|360p|480p|540p|576p|720p|1080p|2160p|4k|8k|sd|hd|fhd|uhd)\)/gi, "")
    .replace(/\b(?:144p|240p|360p|480p|540p|576p|720p|1080p|2160p|4k|8k|sd|hd|fhd|uhd)\b/gi, "")
    .replace(/\s*\((?:not 24\/7|backup|alt|test|experimental)\)/gi, "")
    .replace(/\b(?:not 24\/7|backup|alt|test|experimental)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* =========================
   REGLAS MANUALES
========================= */

function applyChannelRules(channel) {
  const rules = window.CHANNEL_RULES || [];

  for (const rule of rules) {
    if (!matchesRule(channel, rule)) continue;

    if (rule.hide === true) {
      channel.hide = true;
    }

    if (rule.renameTo) {
      channel.name = cleanChannelName(rule.renameTo);
    }

    if (rule.logo) {
      channel.logo = rule.logo;
    }

    if (rule.group) {
      channel.group = rule.group;
    }

    if (rule.forceParaguay === true) {
      channel.isParaguay = true;
    }

    if (rule.forceParaguay === false) {
      channel.isParaguay = false;
    }
  }

  return channel;
}

function matchesRule(channel, rule) {
  if (rule.matchName && normalize(channel.originalName) === normalize(rule.matchName)) {
    return true;
  }

  if (rule.matchName && normalize(channel.name) === normalize(rule.matchName)) {
    return true;
  }

  if (rule.matchNameContains && normalize(channel.originalName).includes(normalize(rule.matchNameContains))) {
    return true;
  }

  if (rule.matchNameContains && normalize(channel.name).includes(normalize(rule.matchNameContains))) {
    return true;
  }

  if (rule.matchTvgId && normalize(channel.tvgId) === normalize(rule.matchTvgId)) {
    return true;
  }

  if (rule.matchUrlContains && channel.url.includes(rule.matchUrlContains)) {
    return true;
  }

  return false;
}

/* =========================
   PARAGUAY PRIMERO
========================= */

function isParaguay(channel) {
  const text = normalize([
    channel.name,
    channel.originalName,
    channel.tvgId,
    channel.group,
    channel.country
  ].join(" "));

  return (
    text.includes(".py") ||
    text.includes("paraguay") ||
    text.includes(" py ") ||
    text.includes(";py") ||
    text.includes("py;") ||
    text.includes("snt") ||
    text.includes("telefuturo") ||
    text.includes("latele") ||
    text.includes("la tele") ||
    text.includes("trece") ||
    text.includes("unicanal") ||
    text.includes("c9n") ||
    text.includes("npy") ||
    text.includes("abc tv") ||
    text.includes("paravision") ||
    text.includes("paravisión")
  );
}

function sortChannels(a, b) {
  if (a.isParaguay !== b.isParaguay) {
    return a.isParaguay ? -1 : 1;
  }

  return a.name.localeCompare(b.name, "es");
}

/* =========================
   FILTROS Y RENDER
========================= */

function applyFilters() {
  const query = normalize(searchInput.value);

  visibleChannels = allChannels.filter(channel => {
    const matchesSearch =
      !query ||
      normalize(channel.name).includes(query) ||
      normalize(channel.originalName).includes(query) ||
      normalize(channel.group).includes(query) ||
      normalize(channel.tvgId).includes(query);

    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "py" && channel.isParaguay) ||
      (currentFilter === "favorites" && favorites.has(channelKey(channel)));

    return matchesSearch && matchesFilter;
  });

  renderChannels();
}

function renderChannels() {
  channelsDiv.innerHTML = "";

  statusEl.textContent = `${visibleChannels.length} canales encontrados`;

  if (visibleChannels.length === 0) {
    channelsDiv.innerHTML = `<div class="status">No hay canales para mostrar.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  visibleChannels.slice(0, 1000).forEach((channel, index) => {
    const button = document.createElement("button");
    button.className = "channel";
    button.dataset.index = String(index);

    if (currentChannel && currentChannel.url === channel.url) {
      button.classList.add("active");
    }

    const favoriteMark = favorites.has(channelKey(channel)) ? "★" : "";
    const logoHtml = getLogoHtml(channel);

    button.innerHTML = `
      ${logoHtml}
      <div>
        <div class="channel-name">${escapeHtml(channel.name)}</div>
        <div class="channel-group">${escapeHtml(channel.group)}</div>
      </div>
      <div class="badge">${favoriteMark}</div>
    `;

    button.addEventListener("click", () => {
      currentIndex = index;
      openPlayerPage(channel);
    });

    button.addEventListener("focus", () => {
      currentIndex = index;
    });

    fragment.appendChild(button);
  });

  channelsDiv.appendChild(fragment);
}

function getLogoHtml(channel) {
  if (channel.logo) {
    return `
      <img
        class="logo"
        src="${escapeHtml(channel.logo)}"
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror="this.outerHTML='<div class=&quot;logo-fallback&quot;>${getInitials(channel.name)}</div>'"
      >
    `;
  }

  return `<div class="logo-fallback">${getInitials(channel.name)}</div>`;
}

function getInitials(name) {
  return escapeHtml(
    String(name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase()
  );
}

/* =========================
   CAMBIO ENTRE PÁGINAS
========================= */

function openPlayerPage(channel) {
  currentChannel = channel;
  playerPageOpen = true;

  listScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");

  if (location.hash !== "#player") {
    history.pushState({ page: "player" }, "", "#player");
  }

  playChannel(channel);
}

function closePlayerPage({ fromPopState = false } = {}) {
  if (!playerPageOpen) return;

  playerPageOpen = false;

  playerScreen.classList.add("hidden");
  listScreen.classList.remove("hidden");

  stopCurrentPlayer();

  if (!fromPopState && location.hash === "#player") {
    ignoreNextPopState = true;
    history.back();
  }

  setTimeout(() => {
    focusCurrentOrFirst();
  }, 100);
}

window.addEventListener("popstate", () => {
  if (ignoreNextPopState) {
    ignoreNextPopState = false;
    return;
  }

  if (playerPageOpen) {
    closePlayerPage({ fromPopState: true });
  }
});

/* =========================
   REPRODUCTOR
========================= */

function playChannel(channel) {
  playToken++;
  const localToken = playToken;

  showChannelToast(channel);
  showPlayerStatus("Cargando canal...");

  stopVideoOnly();

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 15,
      maxBufferLength: 20,
      maxMaxBufferLength: 30,
      manifestLoadingTimeOut: 10000,
      levelLoadingTimeOut: 10000,
      fragLoadingTimeOut: 15000
    });

    const localHls = hls;

    localHls.loadSource(channel.url);
    localHls.attachMedia(video);

    localHls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (localToken !== playToken) return;

      showPlayerStatus("Reproduciendo");

      video.play().catch(() => {
        showPlayerStatus("Presiona OK para reproducir");
      });
    });

    localHls.on(Hls.Events.ERROR, (event, data) => {
      if (localToken !== playToken) return;

      console.warn("HLS error:", data);

      if (!data.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        showPlayerStatus("Error de red. Reintentando...");
        localHls.startLoad();
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        showPlayerStatus("Recuperando video...");
        localHls.recoverMediaError();
        return;
      }

      showPlayerStatus("Este canal no se pudo reproducir");
      stopCurrentPlayer();
    });

  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = channel.url;
    video.load();

    video.onloadedmetadata = () => {
      if (localToken !== playToken) return;

      showPlayerStatus("Reproduciendo");

      video.play().catch(() => {
        showPlayerStatus("Presiona OK para reproducir");
      });
    };

  } else {
    showPlayerStatus("Este dispositivo no soporta HLS");
  }
}

function stopVideoOnly() {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();
}

function stopCurrentPlayer() {
  playToken++;
  stopVideoOnly();
}

/* =========================
   TOAST Y ESTADOS
========================= */

function showChannelToast(channel) {
  channelToastName.textContent = channel.name;

  if (channel.logo) {
    channelToastLogo.innerHTML = `
      <img
        class="channel-toast-logo"
        src="${escapeHtml(channel.logo)}"
        alt=""
        referrerpolicy="no-referrer"
        onerror="this.outerHTML='<div class=&quot;channel-toast-fallback&quot;>${getInitials(channel.name)}</div>'"
      >
    `;
  } else {
    channelToastLogo.innerHTML = `
      <div class="channel-toast-fallback">
        ${getInitials(channel.name)}
      </div>
    `;
  }

  channelToast.classList.add("show");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    channelToast.classList.remove("show");
  }, 3000);
}

function showPlayerStatus(message) {
  playerStatus.textContent = message;
  playerStatus.classList.add("show");

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusTimer = setTimeout(() => {
    playerStatus.classList.remove("show");
  }, 3000);
}

/* =========================
   FAVORITOS
========================= */

function channelKey(channel) {
  return `${channel.name}|${channel.url}`;
}

function loadFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

function toggleFavorite() {
  if (!currentChannel) return;

  const key = channelKey(currentChannel);

  if (favorites.has(key)) {
    favorites.delete(key);
  } else {
    favorites.add(key);
  }

  saveFavorites();
  renderChannels();
}

/* =========================
   FOCO CONTROL REMOTO
========================= */

function focusChannel(index) {
  const buttons = Array.from(document.querySelectorAll(".channel"));
  if (buttons.length === 0) return;

  const safeIndex = Math.max(0, Math.min(index, buttons.length - 1));
  currentIndex = safeIndex;

  buttons[safeIndex].focus();
  buttons[safeIndex].scrollIntoView({
    block: "nearest"
  });
}

function focusCurrentOrFirst() {
  if (currentChannel) {
    const buttons = Array.from(document.querySelectorAll(".channel"));

    const index = buttons.findIndex(button => {
      const channel = visibleChannels[Number(button.dataset.index)];
      return channel && channel.url === currentChannel.url;
    });

    if (index >= 0) {
      focusChannel(index);
      return;
    }
  }

  focusChannel(0);
}

/* =========================
   HELPERS
========================= */

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   EVENTOS
========================= */

searchInput.addEventListener("input", () => {
  applyFilters();
});

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    filterButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    currentFilter = button.dataset.filter;
    applyFilters();

    setTimeout(() => focusChannel(0), 50);
  });
});

document.addEventListener("keydown", event => {
  const active = document.activeElement;
  const isInput = active === searchInput;
  const isPlayerOpen = !playerScreen.classList.contains("hidden");

  /*
    PÁGINA DEL REPRODUCTOR
  */
  if (isPlayerOpen) {
    if (
      event.key === "Escape" ||
      event.key === "Backspace" ||
      event.key === "BrowserBack"
    ) {
      event.preventDefault();
      closePlayerPage();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      video.play().catch(() => {});
      return;
    }

    return;
  }

  /*
    PÁGINA DE LISTA
  */
  if (event.key === "ArrowDown" && !isInput) {
    event.preventDefault();
    focusChannel(currentIndex + 1);
    return;
  }

  if (event.key === "ArrowUp" && !isInput) {
    event.preventDefault();
    focusChannel(currentIndex - 1);
    return;
  }

  if (event.key === "ArrowRight" && !isInput) {
    event.preventDefault();
    focusChannel(currentIndex + 1);
    return;
  }

  if (event.key === "ArrowLeft" && !isInput) {
    event.preventDefault();
    focusChannel(currentIndex - 1);
    return;
  }

  if (event.key === "Enter") {
    if (isInput) {
      event.preventDefault();

      if (visibleChannels.length > 0) {
        searchInput.blur();
        focusChannel(0);
      }

      return;
    }

    if (active?.classList?.contains("channel")) {
      const index = Number(active.dataset.index);
      const channel = visibleChannels[index];

      if (channel) {
        openPlayerPage(channel);
      }

      return;
    }
  }

  if (event.key.toLowerCase() === "s" && !isInput) {
    event.preventDefault();
    searchInput.focus();
    return;
  }

  /*
    Botón atrás desde la lista:
    si no estás escribiendo, no hace nada.
    Esto evita que el TV Box cierre la WebView por accidente.
  */
  if (
    !isInput &&
    (
      event.key === "Escape" ||
      event.key === "Backspace" ||
      event.key === "BrowserBack"
    )
  ) {
    event.preventDefault();
    focusCurrentOrFirst();
    return;
  }
});

video.addEventListener("waiting", () => {
  if (currentChannel) {
    showPlayerStatus("Buffering...");
  }
});

video.addEventListener("playing", () => {
  if (currentChannel) {
    showPlayerStatus("Reproduciendo");
  }
});

/*
  Si el usuario recarga estando en #player,
  volvemos a la lista para no abrir un reproductor vacío.
*/
if (location.hash === "#player") {
  history.replaceState({ page: "list" }, "", location.pathname);
}

loadM3U();
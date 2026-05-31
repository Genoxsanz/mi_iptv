var M3U_URL = "https://iptv-org.github.io/iptv/index.m3u";

var listScreen = document.getElementById("listScreen");
var playerScreen = document.getElementById("playerScreen");

var channelsDiv = document.getElementById("channels");
var searchInput = document.getElementById("searchInput");
var statusEl = document.getElementById("status");

var video = document.getElementById("video");
var playerStatus = document.getElementById("playerStatus");

var channelToast = document.getElementById("channelToast");
var channelToastLogo = document.getElementById("channelToastLogo");
var channelToastName = document.getElementById("channelToastName");

var filterButtons = document.querySelectorAll(".filter-btn");

var allChannels = [];
var visibleChannels = [];
var currentChannel = null;
var currentIndex = 0;
var currentFilter = "all";

var hls = null;
var playToken = 0;
var toastTimer = null;
var statusTimer = null;

var playerPageOpen = false;
var ignoreNextPopState = false;

var FAVORITES_KEY = "genox_iptv_favorites";
var favorites = loadFavorites();

/* =========================
   CARGA COMPATIBLE CON TV BOX
========================= */

function cargarTextoCompatible(url, onOk, onError) {
  try {
    var xhr = new XMLHttpRequest();

    var finalUrl = url;

    if (finalUrl.indexOf("?") === -1) {
      finalUrl += "?_=" + new Date().getTime();
    } else {
      finalUrl += "&_=" + new Date().getTime();
    }

    xhr.open("GET", finalUrl, true);
    xhr.timeout = 30000;

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onOk(xhr.responseText);
        } else {
          onError("Error HTTP al cargar la lista: " + xhr.status);
        }
      }
    };

    xhr.ontimeout = function () {
      onError("La TV Box tardó demasiado cargando la lista.");
    };

    xhr.onerror = function () {
      onError("No se pudo cargar la lista IPTV. Puede ser problema de red, WebView viejo o bloqueo HTTPS.");
    };

    xhr.send();
  } catch (error) {
    onError("Error interno cargando la lista: " + error.message);
  }
}

function loadM3U() {
  statusEl.textContent = "Cargando lista global...";
  channelsDiv.innerHTML = "";

  cargarTextoCompatible(
    M3U_URL,
    function (text) {
      try {
        allChannels = parseM3U(text)
          .map(function (channel) {
            return applyChannelRules(channel);
          })
          .filter(function (channel) {
            return !channel.hide;
          })
          .sort(sortChannels);

        applyFilters();

        statusEl.textContent = allChannels.length + " canales cargados · Paraguay primero";

        setTimeout(function () {
          focusChannel(0);
        }, 200);
      } catch (error) {
        console.error(error);
        mostrarErrorLista("La lista se descargó, pero hubo un error al procesarla.");
      }
    },
    function (error) {
      console.error(error);
      mostrarErrorLista(error);
    }
  );
}

function mostrarErrorLista(mensaje) {
  statusEl.textContent = "Error al cargar la lista IPTV.";

  channelsDiv.innerHTML =
    '<div class="status" style="background:#7f1d1d;color:white;padding:24px;border-radius:16px;font-size:24px;">' +
    escapeHtml(mensaje) +
    "<br><br>" +
    "Prueba actualizar Android System WebView o Chrome en la TV Box." +
    "</div>";
}

function parseM3U(text) {
  var lines = text.split(/\r?\n/);
  var result = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    if (!line.startsWith("#EXTINF")) continue;

    var originalName = line.split(",").pop().trim();
    var cleanName = cleanChannelName(originalName);

    var tvgId = getAttr(line, "tvg-id");
    var logo = getAttr(line, "tvg-logo");
    var group = getAttr(line, "group-title") || "Sin categoría";
    var country = getAttr(line, "tvg-country");

    var url = "";

    for (var j = i + 1; j < lines.length; j++) {
      var next = lines[j].trim();

      if (next && !next.startsWith("#")) {
        url = next;
        break;
      }
    }

    if (!url.startsWith("http")) continue;

    var channel = {
      originalName: originalName,
      name: cleanName,
      tvgId: tvgId,
      logo: logo,
      group: group,
      country: country,
      url: url,
      hide: false
    };

    channel.isParaguay = isParaguay(channel);

    result.push(channel);
  }

  return removeDuplicates(result);
}

function getAttr(line, attr) {
  var regex = new RegExp(attr + '="([^"]*)"', "i");
  var match = line.match(regex);
  return match ? match[1] : "";
}

function removeDuplicates(list) {
  var seen = {};

  return list.filter(function (channel) {
    var key = channel.url;

    if (seen[key]) {
      return false;
    }

    seen[key] = true;
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
  var rules = window.CHANNEL_RULES || [];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

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

  if (rule.matchNameContains && normalize(channel.originalName).indexOf(normalize(rule.matchNameContains)) !== -1) {
    return true;
  }

  if (rule.matchNameContains && normalize(channel.name).indexOf(normalize(rule.matchNameContains)) !== -1) {
    return true;
  }

  if (rule.matchTvgId && normalize(channel.tvgId) === normalize(rule.matchTvgId)) {
    return true;
  }

  if (rule.matchUrlContains && channel.url.indexOf(rule.matchUrlContains) !== -1) {
    return true;
  }

  return false;
}

/* =========================
   PARAGUAY PRIMERO
========================= */

function isParaguay(channel) {
  var text = normalize([
    channel.name,
    channel.originalName,
    channel.tvgId,
    channel.group,
    channel.country
  ].join(" "));

  return (
    text.indexOf(".py") !== -1 ||
    text.indexOf("paraguay") !== -1 ||
    text.indexOf(" py ") !== -1 ||
    text.indexOf(";py") !== -1 ||
    text.indexOf("py;") !== -1 ||
    text.indexOf("snt") !== -1 ||
    text.indexOf("telefuturo") !== -1 ||
    text.indexOf("latele") !== -1 ||
    text.indexOf("la tele") !== -1 ||
    text.indexOf("trece") !== -1 ||
    text.indexOf("unicanal") !== -1 ||
    text.indexOf("c9n") !== -1 ||
    text.indexOf("npy") !== -1 ||
    text.indexOf("abc tv") !== -1 ||
    text.indexOf("paravision") !== -1 ||
    text.indexOf("paravisión") !== -1
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
  var query = normalize(searchInput.value);

  visibleChannels = allChannels.filter(function (channel) {
    var matchesSearch =
      !query ||
      normalize(channel.name).indexOf(query) !== -1 ||
      normalize(channel.originalName).indexOf(query) !== -1 ||
      normalize(channel.group).indexOf(query) !== -1 ||
      normalize(channel.tvgId).indexOf(query) !== -1;

    var matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "py" && channel.isParaguay) ||
      (currentFilter === "favorites" && favoritesHas(channelKey(channel)));

    return matchesSearch && matchesFilter;
  });

  renderChannels();
}

function renderChannels() {
  channelsDiv.innerHTML = "";

  statusEl.textContent = visibleChannels.length + " canales encontrados";

  if (visibleChannels.length === 0) {
    channelsDiv.innerHTML = '<div class="status">No hay canales para mostrar.</div>';
    return;
  }

  var fragment = document.createDocumentFragment();
  var max = Math.min(visibleChannels.length, 1000);

  for (var i = 0; i < max; i++) {
    var channel = visibleChannels[i];

    var button = document.createElement("button");
    button.className = "channel";
    button.setAttribute("data-index", String(i));

    if (currentChannel && currentChannel.url === channel.url) {
      button.classList.add("active");
    }

    var favoriteMark = favoritesHas(channelKey(channel)) ? "★" : "";
    var logoHtml = getLogoHtml(channel);

    button.innerHTML =
      logoHtml +
      "<div>" +
      '<div class="channel-name">' + escapeHtml(channel.name) + "</div>" +
      '<div class="channel-group">' + escapeHtml(channel.group) + "</div>" +
      "</div>" +
      '<div class="badge">' + favoriteMark + "</div>";

    button.addEventListener("click", createChannelClickHandler(channel, i));
    button.addEventListener("focus", createChannelFocusHandler(i));

    fragment.appendChild(button);
  }

  channelsDiv.appendChild(fragment);
}

function createChannelClickHandler(channel, index) {
  return function () {
    currentIndex = index;
    openPlayerPage(channel);
  };
}

function createChannelFocusHandler(index) {
  return function () {
    currentIndex = index;
  };
}

function getLogoHtml(channel) {
  if (channel.logo) {
    return (
      '<img class="logo" ' +
      'src="' + escapeHtml(channel.logo) + '" ' +
      'alt="" ' +
      'loading="lazy" ' +
      'referrerpolicy="no-referrer" ' +
      'onerror="this.outerHTML=\'<div class=&quot;logo-fallback&quot;>' + getInitials(channel.name) + '</div>\'">'
    );
  }

  return '<div class="logo-fallback">' + getInitials(channel.name) + "</div>";
}

function getInitials(name) {
  return escapeHtml(
    String(name || "?")
      .split(" ")
      .filter(function (word) {
        return !!word;
      })
      .slice(0, 2)
      .map(function (word) {
        return word.charAt(0);
      })
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

function closePlayerPage(options) {
  options = options || {};
  var fromPopState = options.fromPopState === true;

  if (!playerPageOpen) return;

  playerPageOpen = false;

  playerScreen.classList.add("hidden");
  listScreen.classList.remove("hidden");

  stopCurrentPlayer();

  if (!fromPopState && location.hash === "#player") {
    ignoreNextPopState = true;
    history.back();
  }

  setTimeout(function () {
    focusCurrentOrFirst();
  }, 100);
}

window.addEventListener("popstate", function () {
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
  var localToken = playToken;

  showChannelToast(channel);
  showPlayerStatus("Cargando canal...");

  stopVideoOnly();

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({
      enableWorker: false,
      lowLatencyMode: false,
      backBufferLength: 10,
      maxBufferLength: 15,
      maxMaxBufferLength: 20,
      manifestLoadingTimeOut: 15000,
      levelLoadingTimeOut: 15000,
      fragLoadingTimeOut: 20000
    });

    var localHls = hls;

    localHls.loadSource(channel.url);
    localHls.attachMedia(video);

    localHls.on(Hls.Events.MANIFEST_PARSED, function () {
      if (localToken !== playToken) return;

      showPlayerStatus("Reproduciendo");

      video.play().catch(function () {
        showPlayerStatus("Presiona OK para reproducir");
      });
    });

    localHls.on(Hls.Events.ERROR, function (event, data) {
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

    video.onloadedmetadata = function () {
      if (localToken !== playToken) return;

      showPlayerStatus("Reproduciendo");

      video.play().catch(function () {
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
    channelToastLogo.innerHTML =
      '<img class="channel-toast-logo" ' +
      'src="' + escapeHtml(channel.logo) + '" ' +
      'alt="" ' +
      'referrerpolicy="no-referrer" ' +
      'onerror="this.outerHTML=\'<div class=&quot;channel-toast-fallback&quot;>' + getInitials(channel.name) + '</div>\'">';
  } else {
    channelToastLogo.innerHTML =
      '<div class="channel-toast-fallback">' +
      getInitials(channel.name) +
      "</div>";
  }

  channelToast.classList.add("show");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(function () {
    channelToast.classList.remove("show");
  }, 3000);
}

function showPlayerStatus(message) {
  playerStatus.textContent = message;
  playerStatus.classList.add("show");

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusTimer = setTimeout(function () {
    playerStatus.classList.remove("show");
  }, 3000);
}

/* =========================
   FAVORITOS
========================= */

function channelKey(channel) {
  return channel.name + "|" + channel.url;
}

function loadFavorites() {
  try {
    var data = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return data;
  } catch (error) {
    return [];
  }
}

function favoritesHas(key) {
  return favorites.indexOf(key) !== -1;
}

function favoritesAdd(key) {
  if (!favoritesHas(key)) {
    favorites.push(key);
  }
}

function favoritesDelete(key) {
  favorites = favorites.filter(function (item) {
    return item !== key;
  });
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function toggleFavorite() {
  if (!currentChannel) return;

  var key = channelKey(currentChannel);

  if (favoritesHas(key)) {
    favoritesDelete(key);
  } else {
    favoritesAdd(key);
  }

  saveFavorites();
  renderChannels();
}

/* =========================
   FOCO CONTROL REMOTO
========================= */

function focusChannel(index) {
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".channel"));
  if (buttons.length === 0) return;

  var safeIndex = Math.max(0, Math.min(index, buttons.length - 1));
  currentIndex = safeIndex;

  buttons[safeIndex].focus();

  if (buttons[safeIndex].scrollIntoView) {
    buttons[safeIndex].scrollIntoView({
      block: "nearest"
    });
  }
}

function focusCurrentOrFirst() {
  if (currentChannel) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".channel"));

    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      var index = Number(button.getAttribute("data-index"));
      var channel = visibleChannels[index];

      if (channel && channel.url === currentChannel.url) {
        focusChannel(i);
        return;
      }
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

searchInput.addEventListener("input", function () {
  applyFilters();
});

for (var fb = 0; fb < filterButtons.length; fb++) {
  filterButtons[fb].addEventListener("click", createFilterClickHandler(filterButtons[fb]));
}

function createFilterClickHandler(button) {
  return function () {
    for (var i = 0; i < filterButtons.length; i++) {
      filterButtons[i].classList.remove("active");
    }

    button.classList.add("active");

    currentFilter = button.getAttribute("data-filter");
    applyFilters();

    setTimeout(function () {
      focusChannel(0);
    }, 50);
  };
}

document.addEventListener("keydown", function (event) {
  var active = document.activeElement;
  var isInput = active === searchInput;
  var isPlayerOpen = !playerScreen.classList.contains("hidden");

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
      video.play().catch(function () {});
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

    if (active && active.classList && active.classList.contains("channel")) {
      var index = Number(active.getAttribute("data-index"));
      var channel = visibleChannels[index];

      if (channel) {
        openPlayerPage(channel);
      }

      return;
    }
  }

  if (event.key && event.key.toLowerCase() === "s" && !isInput) {
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

video.addEventListener("waiting", function () {
  if (currentChannel) {
    showPlayerStatus("Buffering...");
  }
});

video.addEventListener("playing", function () {
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

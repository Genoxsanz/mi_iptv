var M3U_URL = "https://iptv-org.github.io/iptv/countries/py.m3u";

var listScreen = document.getElementById("listScreen");
var playerScreen = document.getElementById("playerScreen");

var channelsDiv = document.getElementById("channels");
var statusEl = document.getElementById("status");

var video = document.getElementById("video");
var playerStatus = document.getElementById("playerStatus");

var channelToast = document.getElementById("channelToast");
var channelToastLogo = document.getElementById("channelToastLogo");
var channelToastName = document.getElementById("channelToastName");

var allChannels = [];
var visibleChannels = [];
var currentChannel = null;
var currentIndex = 0;

var hls = null;
var playToken = 0;
var toastTimer = null;
var statusTimer = null;

var playerPageOpen = false;
var ignoreNextPopState = false;

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
  statusEl.textContent = "Cargando canales de Paraguay...";
  channelsDiv.innerHTML = "";

  cargarTextoCompatible(
    M3U_URL,
    function (text) {
      try {
        allChannels = parseM3U(text)
          .map(function (channel) {
            channel.isParaguay = true;
            return applyChannelRules(channel);
          })
          .filter(function (channel) {
            return !channel.hide;
          })
          .sort(function (a, b) {
            return a.name.localeCompare(b.name, "es");
          });

        visibleChannels = allChannels;

        renderChannels();

        statusEl.textContent = allChannels.length + " canales de Paraguay";

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
    var group = getAttr(line, "group-title") || "Paraguay";
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
      hide: false,
      isParaguay: true
    };

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

    if (rule.url) {
      channel.url = rule.url;
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
   RENDER
========================= */

function renderChannels() {
  channelsDiv.innerHTML = "";

  statusEl.textContent = visibleChannels.length + " canales de Paraguay";

  if (visibleChannels.length === 0) {
    channelsDiv.innerHTML = '<div class="status">No hay canales para mostrar.</div>';
    return;
  }

  var fragment = document.createDocumentFragment();

  for (var i = 0; i < visibleChannels.length; i++) {
    var channel = visibleChannels[i];

    var button = document.createElement("button");
    button.className = "channel";
    button.setAttribute("data-index", String(i));

    if (currentChannel && currentChannel.url === channel.url) {
      button.classList.add("active");
    }

    var logoHtml = getLogoHtml(channel);

    button.innerHTML =
      logoHtml +
      '<div class="channel-info">' +
      '<div class="channel-name">' + escapeHtml(channel.name) + "</div>" +
      "</div>";

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

      autoStartLoad: true,
      startLevel: -1,

      abrEwmaFastLive: 3,
      abrEwmaSlowLive: 9,
      abrBandWidthFactor: 0.75,
      abrBandWidthUpFactor: 0.55,

      backBufferLength: 10,
      maxBufferLength: 30,
      maxMaxBufferLength: 45,

      manifestLoadingTimeOut: 15000,
      levelLoadingTimeOut: 15000,
      fragLoadingTimeOut: 20000,

      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 6,

      manifestLoadingRetryDelay: 1000,
      levelLoadingRetryDelay: 1000,
      fragLoadingRetryDelay: 1000
    });

    var localHls = hls;

    localHls.loadSource(channel.url);
    localHls.attachMedia(video);

    localHls.on(Hls.Events.MANIFEST_PARSED, function () {
      if (localToken !== playToken) return;

      localHls.currentLevel = -1;
      localHls.nextLevel = -1;

      showPlayerStatus("Reproduciendo");

      video.play().catch(function () {
        showPlayerStatus("Presiona OK para reproducir");
      });
    });

    localHls.on(Hls.Events.LEVEL_SWITCHED, function () {
      if (localToken !== playToken) return;
    });

    localHls.on(Hls.Events.ERROR, function (event, data) {
      if (localToken !== playToken) return;

      console.warn("HLS error:", data);

      if (!data.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        showPlayerStatus("Red inestable. Reintentando...");
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

    video.onerror = function () {
      if (localToken !== playToken) return;
      showPlayerStatus("Este canal no se pudo reproducir");
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
   EVENTOS CONTROL REMOTO
========================= */

document.addEventListener("keydown", function (event) {
  var active = document.activeElement;
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
  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusChannel(currentIndex + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    focusChannel(currentIndex - 1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusChannel(currentIndex + 1);
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusChannel(currentIndex - 1);
    return;
  }

  if (event.key === "Enter") {
    if (active && active.classList && active.classList.contains("channel")) {
      var index = Number(active.getAttribute("data-index"));
      var channel = visibleChannels[index];

      if (channel) {
        openPlayerPage(channel);
      }

      return;
    }
  }

  /*
    Botón atrás desde la lista:
    no cierra la app.
  */
  if (
    event.key === "Escape" ||
    event.key === "Backspace" ||
    event.key === "BrowserBack"
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

video.addEventListener("error", function () {
  if (currentChannel) {
    showPlayerStatus("Error reproduciendo canal");
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

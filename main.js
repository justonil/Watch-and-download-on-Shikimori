"use strict";

const useAniTop = GM_getValue("useAniTop", false);
const ApiHost = "https://anilibria.top";

// Переключатель доменов в меню расширения
GM_registerMenuCommand(
  useAniTop ? "🔗 Switch to AniLibria.tv" : "🔗 Switch to AniLiberty.top",
  () => {
    GM_setValue("useAniTop", !useAniTop);
    location.reload();
  },
);

class Helpers {
  static insertAfter(newNode, existingNode) {
    existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);
  }
  static formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 GB";
    const gbs = bytes / (1024 * 1024 * 1024);
    return gbs.toFixed(2) + " GB";
  }
  static normalize(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
  }
}

class Shikimori {
  static async getAnimeInfo(animeId) {
    const response = await fetch(
      `${window.location.protocol}//${window.location.hostname}/api/animes/${animeId}`,
    );
    return await response.json();
  }
}

class AniLibria {
  static async search(query) {
    const url = `${ApiHost}/api/v1/app/search/releases?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    return response.ok ? await response.json() : null;
  }
  static async getReleaseDetails(id) {
    const url = `${ApiHost}/api/v1/anime/releases/${id}`;
    const response = await fetch(url);
    return response.ok ? await response.json() : null;
  }
}

class TorrentLinks {
  static initHandler() {
    document.addEventListener("turbolinks:load", () => this.init());
  }

  static async init() {
    const regex = /\/animes\/([a-zA-Z0-9]+)/;
    const match = window.location.pathname.match(regex);
    if (!match) return;

    const shikiData = await Shikimori.getAnimeInfo(match[1]).catch(() => null);
    if (!shikiData) return;

    const subheadlines = Array.from(document.querySelectorAll(".subheadline"));
    const insertionPoint = subheadlines.find(
      (el) =>
        el.textContent.includes("on other sites") ||
        el.textContent.includes("На других сайтах"),
    );
    if (!insertionPoint) return;

    // Очистка предыдущих ссылок
    document
      .querySelectorAll(".custom-torrent-link")
      .forEach((el) => el.remove());

    let searchResults = await AniLibria.search(shikiData.name);
    if (!searchResults?.length && shikiData.russian) {
      searchResults = await AniLibria.search(shikiData.russian);
    }

    if (searchResults && searchResults.length > 0) {
      const shikiYear = new Date(shikiData.aired_on).getFullYear();
      const shikiEpisodes = shikiData.episodes || 0;
      const shikiNameNorm = Helpers.normalize(shikiData.name);
      const shikiRusNorm = Helpers.normalize(shikiData.russian);

      // Умный поиск: проверка года, эпизодов и названия
      const bestMatch = searchResults.find((item) => {
        const yearMatch = Math.abs(item.year - shikiYear) <= 1;
        const epsMatch =
          shikiEpisodes === 0 ||
          Math.abs(item.episodes_total - shikiEpisodes) <= 1;
        const itemMainNorm = Helpers.normalize(item.name.main);
        const itemEngNorm = Helpers.normalize(item.name.english);
        const nameMatch =
          itemMainNorm.includes(shikiNameNorm) ||
          itemEngNorm.includes(shikiNameNorm) ||
          itemMainNorm.includes(shikiRusNorm);

        return yearMatch && epsMatch && nameMatch;
      });

      if (bestMatch) {
        const fullDetails = await AniLibria.getReleaseDetails(bestMatch.id);
        if (fullDetails) {
          const siteName = useAniTop ? "AniLiberty" : "AniLibria";
          const siteUrl = useAniTop
            ? `https://aniliberty.top/anime/releases/release/${fullDetails.alias}`
            : `https://www.anilibria.tv/release/${fullDetails.alias}.html`;

          // Порядок: Сначала внешние, потом сайт, потом магниты (сверху вниз под заголовком)
          this.addLink(
            "RuTracker",
            `https://rutracker.org/forum/tracker.php?nm=${encodeURIComponent(shikiData.name)}`,
            insertionPoint,
          );
          this.addLink(
            "Erai-raws",
            `https://www.erai-raws.info/?s=${encodeURIComponent(shikiData.name)}`,
            insertionPoint,
          );
          this.addLink(siteName, siteUrl, insertionPoint);

          if (fullDetails.torrents) {
            [...fullDetails.torrents].reverse().forEach((torrent) => {
              const type = torrent.type ? torrent.type.value : "";
              const quality = torrent.quality ? torrent.quality.value : "";
              const codec = torrent.codec ? torrent.codec.label : "";
              const size = Helpers.formatBytes(torrent.size);
              // Формат: BDRip 1080p HEVC (12.50 GB)
              const label = `${type} ${quality} ${codec} (${size})`
                .replace(/\s+/g, " ")
                .trim();
              this.addLink(label, torrent.magnet, insertionPoint);
            });
          }
          return; // Выходим, если всё добавили через AniLibria
        }
      }
    }

    // Если AniLibria не найдена, просто выводим базу
    this.addLink(
      "RuTracker",
      `https://rutracker.org/forum/tracker.php?nm=${encodeURIComponent(shikiData.name)}`,
      insertionPoint,
    );
    this.addLink(
      "Erai-raws",
      `https://www.erai-raws.info/?s=${encodeURIComponent(shikiData.name)}`,
      insertionPoint,
    );
  }

  static addLink(name, href, afterElement) {
    const block = document.createElement("div");
    block.className = "b-external_link b-menu-line custom-torrent-link";
    const link = document.createElement("a");
    link.text = name;
    link.href = href;

    let iconType = "default";
    if (href.startsWith("magnet:")) {
      iconType = "anilibria-magnet";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = href;
      });
    } else if (name.toLowerCase().includes("anilib")) iconType = "anilibria";
    else if (name.toLowerCase().includes("rutracker")) iconType = "rutracker";
    else if (name.toLowerCase().includes("erai")) iconType = "erai-raws";

    const uniqueClass = `ico-v${Math.random().toString(36).substr(2, 5)}`;
    link.classList.add(uniqueClass);
    const style = document.createElement("style");
    style.textContent = `.${uniqueClass}::before { content: ''; height: 19px; margin-right: 6px; width: 19px; display: inline-block; vertical-align: middle; background-size: 19px 19px; background-image: url('https://raw.githubusercontent.com/justonil/Watch-and-download-on-Shikimori/main/images/icons/${iconType}-favicon.ico'); }`;
    document.head.appendChild(style);
    block.appendChild(link);
    Helpers.insertAfter(block, afterElement);
  }
}

TorrentLinks.initHandler();

"use strict";
// Read preference (default = use .tv)
const useAniTop = GM_getValue('useAniTop', false);
const ApiTop = GM_getValue('ApiTop', false);

// Add menu entry to toggle the flag
GM_registerMenuCommand(
  useAniTop
    ? '🔗 Switch to AniLibria.tv'
    : '🔗 Switch to AniLibria.top',
  () => {
    GM_setValue('useAniTop', !useAniTop);
    location.reload();
  }
);

GM_registerMenuCommand(
  ApiTop
    ? '🔗 Switch API to AniLibria.tv'
    : '🔗 Switch API to AniLibria.top',
  () => {
    GM_setValue('ApiTop', !ApiTop);
    location.reload();
  }
);

class Torrent {
  static {
    console.debug("torrent link loading...");

    document.addEventListener("turbolinks:load", () => this.#onViewChanged());
  }

  static async #onViewChanged() {
    const match = Shikimori.isAnimePage(window.location);
    if (match) {
      const id = match[1];
      const ShikiData = await AniLibria.getAnimeOnAnilibria(`https://shikimori.one/api/animes/${id}`).catch(() => null);
      if (!ShikiData) return; // Exit if Shikimori data fetch fails

      // Step 1: Create and insert RuTracker and Erai-raws links first (independent of AniLibria API)
      const nonAniLibriaLinks = [
        { name: "RuTracker", src: `https://rutracker.org/forum/tracker.php?nm=${ShikiData.name}` },
        { name: "Erai-raws", src: `https://www.erai-raws.info/?s=${ShikiData.name}` }
      ];

      // Find insertion point
      const elements = document.querySelectorAll(".subheadline");
      let insertionPoint = null;
      for (let i = 0; i < elements.length; i++) {
        if (
          elements[i].textContent.includes("on other sites") ||
          elements[i].textContent.includes("На других сайтах")
        ) {
          insertionPoint = elements[i];
          break;
        }
      }
      if (!insertionPoint) return; // Exit if insertion point not found

      // Remove any existing torrent links to avoid duplicates
      document.querySelectorAll(".torrent-link").forEach(link => link.remove());

      // Insert non-AniLibria links immediately
      let lastInserted = insertionPoint;
      nonAniLibriaLinks.forEach(link => {
        const block = this.#createBlock(this.#createLink(link.name, link.src));
        Helpers.insertAfter(block, lastInserted);
        lastInserted = block;
      });

      // Step 2: Fetch AniLibria data asynchronously and add buttons if available
      let aniLibriaTitles;
      if (ApiTop) {
        aniLibriaTitles = await AniLibria.getAnimeOnAnilibria(`https://anilibria.top/api/v1/app/search/releases?query=${ShikiData.name}`).catch(() => null);
      } else {
        aniLibriaTitles = await AniLibria.getAnimeOnAnilibria(`https://api.anilibria.tv/v3/title/search?search=${ShikiData.name}`).catch(() => null);
        if (aniLibriaTitles && aniLibriaTitles.list.length === 0) {
          aniLibriaTitles = await AniLibria.getAnimeOnAnilibria(`https://api.anilibria.tv/v3/title/search?search=${ShikiData.russian}`).catch(() => null);
        }
        if (aniLibriaTitles) aniLibriaTitles = aniLibriaTitles.list;
      }

      if (!aniLibriaTitles) return; // Exit if AniLibria titles fetch fails

      let aniLibriaData;
      let aniCode;
      const ShikiYear = new Date(ShikiData.aired_on).getFullYear();
      if (ApiTop) {
        for (let i = 0; i < aniLibriaTitles.length; i++) {
          if (aniLibriaTitles[i].year === ShikiYear && aniLibriaTitles[i].type.value.toLowerCase() === ShikiData.kind.toLowerCase()) {
            aniLibriaData = await AniLibria.getAnimeOnAnilibria(`https://anilibria.top/api/v1/anime/releases/${aniLibriaTitles[i].id}`).catch(() => null);
            if (aniLibriaData) aniCode = aniLibriaData.alias;
            break;
          }
        }
      } else {
        for (let i = 0; i < aniLibriaTitles.length; i++) {
          if (aniLibriaTitles[i].season.year === ShikiYear && aniLibriaTitles[i].type.string.toLowerCase() === ShikiData.kind.toLowerCase()) {
            aniLibriaData = await AniLibria.getAnimeOnAnilibria(`https://api.anilibria.tv/v3/title?id=${aniLibriaTitles[i].id}`).catch(() => null);
            if (aniLibriaData) aniCode = aniLibriaData.code;
            break;
          }
        }
      }

      if (!aniLibriaData) return; // Exit if no matching AniLibria data found
      // Create AniLibria links
      const aniLibriaLinks = [];
      if (!useAniTop) {
        aniLibriaLinks.push({ name: "AniLibria.Tv", src: `https://www.anilibria.tv/release/${aniCode}.html` });
      } else {
        aniLibriaLinks.push({ name: "AniLibria.Top", src: `https://anilibria.top/anime/releases/release/${aniCode}/episodes` });
      }
      if (!ApiTop) {
        if (aniLibriaData.torrents.list[0]) {
          let size = (aniLibriaData.torrents.list[0].total_size / (1.074e+9)).toFixed(2) ;
          aniLibriaLinks.push({ name: "AniLibria.Tv Magnet " + (size)  + " GB", src: aniLibriaData.torrents.list[0].magnet });
        }
        if (aniLibriaData.torrents.list[1]) {
            let size = (aniLibriaData.torrents.list[1].total_size / (1.074e+9)).toFixed(2);
          aniLibriaLinks.push({ name: "AniLibria.Tv HEVC-Magnet "  + (size) + " GB", src: aniLibriaData.torrents.list[1].magnet });
        }
      } else {
        if (aniLibriaData.torrents[0]) {
            let size = (aniLibriaData.torrents[0].size / (1.074e+9)).toFixed(2);
          aniLibriaLinks.push({ name: "AniLibria.Top Magnet " + (size) + " GB", src: aniLibriaData.torrents[0].magnet });
        }
        if (aniLibriaData.torrents[1]) {
            let size = (aniLibriaData.torrents[1].size / (1.074e+9)).toFixed(2);
          aniLibriaLinks.push({ name: "AniLibria.Top HEVC-Magnet " + (size) + " GB", src: aniLibriaData.torrents[1].magnet });
        }
      }


      // Insert AniLibria links after the last inserted block
      aniLibriaLinks.forEach(link => {
        const block = this.#createBlock(this.#createLink(link.name, link.src));
        Helpers.insertAfter(block, lastInserted);
        lastInserted = block;
      });
    }
  }

static #createLink(name, src) {
    const link = document.createElement("a");
    link.text = name;
    link.href = src;
    // Only set target="_blank" for non-magnet links
    if (!src.startsWith("magnet:")) {
        link.target = "_blank";
    }
    // Sanitize the name for a valid CSS class
    const className = name.toLowerCase().replace(/[\s.]+/g, '-');

    // Determine the icon based on the link type
    let iconName;
    if (name.includes("Magnet")) {
        iconName = "anilibria-magnet";
    } else if (name.includes("AniLibria")) {
        iconName = "anilibria";
    } else if (name === "RuTracker") {
        iconName = "rutracker";
    } else if (name === "Erai-raws") {
        iconName = "erai-raws";
    } else {
        iconName = "default";
    }

    // Set the class on the link for specific styling
    link.className = `b-link torrent-link-${className}`;

    // Create and append the style for this link
    const style = document.createElement("style");
    style.textContent = `.torrent-link-${className}::before { content: ''; height: 19px; margin-right: 6px; width: 19px; background-size: 19px 19px; background-color: rgba(0, 0, 0, 0); background-image: url('https://raw.github.com/justonil/Watch-and-download-on-Shikimori/main/images/icons/${iconName}-favicon.ico'); }`;
    document.head.appendChild(style);

    return link;
}

  static #createBlock(link) {
    const block = document.createElement("div");
    block.className = "b-external_link b-menu-line torrent-link";
    block.appendChild(link);
    return block;
  }
}
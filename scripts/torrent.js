"use strict";
// Read preference (default = use .tv)
const useAniTop = GM_getValue('useAniTop', false);
const ApiTop = GM_getValue('ApiTop', false);;
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

      let aniLibriaTitles;
      if (ApiTop){
          aniLibriaTitles = await AniLibria.getAnimeOnAnilibria(`https://anilibria.top/api/v1/app/search/releases?query=${ShikiData.name}`).catch(() => null);
      }
        else{
          aniLibriaTitles = await AniLibria.getAnimeOnAnilibria(`https://api.anilibria.tv/v3/title/search?search=${ShikiData.name}`).catch(() => null);
            // if search failed, try to find by russian name
          if (aniLibriaTitles.list.length == 0){
              aniLibriaTitles = await AniLibria.getAnimeOnAnilibria(`https://api.anilibria.tv/v3/title/search?search=${ShikiData.russian}`).catch(() => null);
          }
          aniLibriaTitles = aniLibriaTitles.list
        }
      let aniLibriaData;
      let aniCode;
      if (aniLibriaTitles){
          const ShikiYear = new Date(ShikiData.aired_on).getFullYear();
          if(ApiTop){
              console.debug("using ApiTop");
              for (let i = 0; i < aniLibriaTitles.length; i++){
                  if (aniLibriaTitles[i].year == ShikiYear && aniLibriaTitles[i].type.value.toLowerCase() == ShikiData.kind.toLowerCase()){
                      aniLibriaData = await AniLibria.getAnimeOnAnilibria(`https://anilibria.top/api/v1/anime/releases/${aniLibriaTitles[i].id}`).catch(() => null);
                      aniCode = aniLibriaData.alias;
                      break;
                  }
              }
          }

          else{
              console.debug("using ApiTV");
              for (let i = 0; i < aniLibriaTitles.length; i++){
                  if (aniLibriaTitles[i].season.year == ShikiYear && aniLibriaTitles[i].type.string.toLowerCase() == ShikiData.kind.toLowerCase()){

                      aniLibriaData = await AniLibria.getAnimeOnAnilibria(`https://api.anilibria.tv/v3/title?id=${aniLibriaTitles[i].id}`).catch(() => null);
                      aniCode = aniLibriaData.code;
                      break;
                  }
              }
          }
      }
        else {console.error("anilibria data error. check api status")}

      const links = await Promise.all([
        { name: "RuTracker", src: `https://rutracker.org/forum/tracker.php?nm=${ShikiData.name}` },
          //ApiTV
        {
          name: "AniLibria.Tv Magnet",
          src: !ApiTop && aniLibriaData && aniLibriaData.torrents.list[0] ? aniLibriaData.torrents.list[0].magnet : null,
        },
        {
          name: "AniLibria.Tv HEVC-Magnet",
          src: !ApiTop && aniLibriaData && aniLibriaData.torrents.list[1] ? aniLibriaData.torrents.list[1].magnet : null,
        },
        //ApiTop
        {
          name: "AniLibria.Top Magnet",
          src: ApiTop && aniLibriaData && aniLibriaData.torrents[0] ? aniLibriaData.torrents[0].magnet : null,
        },
        {
          name: "AniLibria.Top HEVC-Magnet",
          src: ApiTop && aniLibriaData && aniLibriaData.torrents[1] ? aniLibriaData.torrents[1].magnet : null,
        },
        {
          name: "AniLibria.Tv",
          src:  !useAniTop && aniLibriaData ? `https://www.anilibria.tv/release/${aniCode}.html` : null,
        },
        {
          name: "AniLibria.Top",
          src: useAniTop && aniLibriaData ? `https://anilibria.top/anime/releases/release/${aniCode}/episodes` : null,
        },
        { name: "Erai-raws",
         src: `https://www.erai-raws.info/?s=${ShikiData.name}`
        },
      ].map(async (link) => {
        try {
          const resolvedSrc = await link.src;
          return { ...link, src: resolvedSrc };
        } catch (e) {
          console.error(`Failed to fetch link for ${link.name}`, e);
          return null;
        }
      }));

      const validLinks = links.filter(link => link && link.src);

      document.querySelectorAll(".torrent-link").forEach(link => link.remove());

      const blocks = validLinks.map((link) => {
        const createdLink = this.#createLink(link.name, link.src);
        return this.#createBlock(createdLink);
      });

      const elements = document.querySelectorAll(".subheadline");
      let before = null;

      for (let i = 0; i < elements.length; i++) {
        if (
          elements[i].textContent.includes("on other sites") ||
          elements[i].textContent.includes("На других сайтах")
        ) {
          before = elements[i];
          break;
        }
      }

      if (before) {
        blocks.forEach((block) => {
          Helpers.insertAfter(block, before);
        });
      }
    }
  }

static #createLink(name, src) {
    const link = document.createElement("a");
    link.text = name;
    link.href = src;
    link.target = "_blank";

    // Sanitize the name for a valid CSS class
    const className = name.toLowerCase().replace(/[\s.]+/g, '-');

    // Determine the icon based on the link type
    let iconName;
    if (name.includes("Magnet")) {
      iconName = "anilibria-magnet"; // All magnet links use magnet-favicon.ico
    } else if (name.includes("AniLibria")) {
      iconName = "anilibria"; // All AniLibria site links use anilibria-favicon.ico
    } else if (name === "RuTracker") {
      iconName = "rutracker"; // RuTracker uses its own icon
    } else if (name === "Erai-raws") {
      iconName = "erai-raws"; // Erai-raws uses its own icon
    } else {
      iconName = "default"; // Fallback icon (optional)
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
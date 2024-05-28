"use strict";

class Torrent {
  static {
    console.debug("torrent link loading...");

    document.addEventListener("turbolinks:load", () => this.#onViewChanged());
  }

  static async #onViewChanged() {
    const match = Shikimori.isAnimePage(window.location);
    if (match) {
      const { id } = match.groups;
      const nameOfAnime = Shikimori.getNameOfAnime(id);

      const aniLibriaData = await AniLibria.getAnimeOnAnilibria(`https://api.anilibria.tv/v3/title/search?search=${nameOfAnime}`).catch(() => null);

      const links = await Promise.all([
        { name: "RuTracker", src: `https://rutracker.org/forum/tracker.php?nm=${nameOfAnime}` },
        {
          name: "AniLibria-magnet",
          src: aniLibriaData ? aniLibriaData.list[0]?.torrents.list[0]?.magnet : null,
        },
        {
          name: "AniLibriaHEVC-magnet",
          src: aniLibriaData ? aniLibriaData.list[0]?.torrents.list[1]?.magnet : null,
        },
        {
          name: "AniLibria",
          src: aniLibriaData ? `https://www.anilibria.tv/release/${aniLibriaData.list[0]?.code}.html` : null,
        },
        { name: "Erai-raws", src: `https://www.erai-raws.info/?s=${nameOfAnime}` },
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
    link.className = "b-link";
    link.text = name;

    const style = document.createElement("style");
    style.textContent = `.b-external_link.${name.toLowerCase()} .linkeable::before, .b-external_link.${name.toLowerCase()} .none::before, .b-external_link.${name.toLowerCase()} a::before, .b-external_link.${name.toLowerCase()} span::before { content: ''; height: 19px; margin-right: 6px; width: 19px; background-size: 19px 19px; background-color: rgba(0, 0, 0, 0); background-image: url('https://raw.github.com/Malanavi/Watch-and-download-on-Shikimori/main/images/icons/${name.toLowerCase()}-favicon.ico'); }`;
    document.head.appendChild(style);

    link.href = src;
    link.target = `_blank`;

    return link;
  }

  static #createBlock(link) {
    const block = document.createElement("div");
    block.className = `b-external_link ${link.text.toLowerCase()} b-menu-line torrent-link`;

    block.appendChild(link);

    return block;
  }
}

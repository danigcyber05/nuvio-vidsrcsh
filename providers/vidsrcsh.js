var BASE_URL = "https://vidsrc.sh";
var TMDB_KEY = "8d5d3e714d290c2ed258ab72b893cfa4";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0";

function getMediaTitle(tmdbId, mediaType, season, episode) {
  var endpoint = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=pt-PT";
  return fetch(url, { headers: { "User-Agent": UA } })
    .then(function(res) { return res.ok ? res.json() : {}; })
    .then(function(d) {
      var title = d.title || d.name || "";
      var year = (d.release_date || d.first_air_date || "").substring(0, 4);
      if (year) title += " (" + year + ")";
      if (mediaType !== "movie" && season && episode) {
        title += " S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0");
      }
      return title;
    })
    .catch(function() { return ""; });
}

function getPlayerUrl(mediaType, tmdbId, season, episode) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var apiUrl = BASE_URL + "/vs_src.php?type=" + type + "&id=" + tmdbId;
  
  if (type === "tv" && season && episode) {
    apiUrl += "&season=" + season + "&episode=" + episode;
  }

  return fetch(apiUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json,*/*",
      "Referer": BASE_URL + "/embed/" + type + "/" + tmdbId
    }
  })
    .then(function(res) {
      if (!res.ok) throw new Error("VidSrc API HTTP " + res.status);
      return res.json();
    })
    .then(function(data) {
      if (!data.src) throw new Error("No player URL in response");
      return data.src;
    });
}

function extractStreamFromPlayer(playerUrl) {
  return fetch(playerUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,*/*",
      "Referer": BASE_URL + "/"
    }
  })
    .then(function(res) {
      if (!res.ok) throw new Error("Player HTTP " + res.status);
      return res.text();
    })
    .then(function(html) {
      var cfgMatch = html.match(/window\.CFG\s*=\s*({[^}]+})/);
      if (cfgMatch) {
        try {
          var cfg = JSON.parse(cfgMatch[1]);
          if (cfg.playerUrl) {
            var fullUrl = cfg.playerUrl.startsWith("http") 
              ? cfg.playerUrl 
              : "https://cloudorchestranova.com" + cfg.playerUrl;
            return fullUrl;
          }
        } catch(e) {}
      }
      
      var srcMatch = html.match(/["']([^"']*stream[^"']*\.m3u8[^"']*)["']/i);
      if (srcMatch) return srcMatch[1];
      
      var mp4Match = html.match(/["']([^"']*\.mp4[^"']*)["']/i);
      if (mp4Match) return mp4Match[1];
      
      return playerUrl;
    });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  var titlePromise = getMediaTitle(tmdbId, mediaType, seasonNum, episodeNum);
  
  return getPlayerUrl(mediaType, tmdbId, seasonNum, episodeNum)
    .then(function(playerUrl) {
      return Promise.all([
        extractStreamFromPlayer(playerUrl),
        titlePromise
      ]);
    })
    .then(function(results) {
      var url = results[0];
      var title = results[1];
      
      return [{
        name: title || "VidSrc.sh",
        title: "1080p",
        url: url,
        quality: "1080p",
        size: "Unknown",
        headers: {
          "Referer": BASE_URL + "/",
          "User-Agent": UA
        },
        provider: "vidsrcsh"
      }];
    })
    .catch(function(error) {
      console.error("[VidSrc.sh] " + error.message);
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}

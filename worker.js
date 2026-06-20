export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Handle Stremio Manifest Discovery
    if (path === '/manifest.json' || path === '/') {
      const manifest = {
        id: 'community.familyshield',
        version: '1.1.0',
        name: 'Family Shield Ratings',
        description: 'Displays parental ratings and content profiles (Violence, Nudity, Language) in your stream list.',
        resources: ['stream'],
        types: ['movie', 'series'],
        idPrefixes: ['tt']
      };
      return new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 2. Handle Stremio Stream Request
    if (path.startsWith('/stream/')) {
      const parts = path.split('/');
      if (parts.length >= 4) {
        const type = parts[2]; 
        const filename = parts[3]; 
        const rawId = filename.replace('.json', '');

        // Stremio sends series IDs as "tt1234567:season:episode" (e.g. tt1234567:1:5)
        // but a plain "tt1234567.json" for movies. Some clients percent-encode the
        // colon as %3A, so decode first, then strip any season/episode suffix.
        const decodedId = decodeURIComponent(rawId);
        const imdbId = decodedId.split(':')[0];

        // Cloudflare Edge Cache — only ever populated with confirmed-good results
        // (rating found OR confirmed "not listed on TMDB"). Transient failures
        // (TMDB errors, rate limits, network issues) are never cached, so they
        // retry fresh on the next request instead of getting stuck.
        const cacheKey = new Request(url.toString(), request);
        const cache = caches.default;
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) return cachedResponse;

        try {
          const tmdbAuth = `Bearer ${env.TMDB_API_KEY}`;
          
          // Step A: Exchange IMDb ID for TMDB ID
          const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`;
          const findRes = await fetch(findUrl, { headers: { 'Authorization': tmdbAuth, 'Accept': 'application/json' } });
          if (!findRes.ok) {
            // TMDB API failure (rate limit, downtime, bad key, etc) — not a real
            // "not listed" result. Return without caching so it retries fresh.
            return new Response(JSON.stringify({ streams: [], error: `TMDB find failed: ${findRes.status}` }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
            });
          }
          const findData = await findRes.json();

          let tmdbId = null;
          let rating = 'Unknown';
          let colorEmoji = '⚪';
          let contentFlags = [];

          if (type === 'movie' && findData.movie_results?.length > 0) {
            tmdbId = findData.movie_results[0].id;
          } else if (type === 'series' && findData.tv_results?.length > 0) {
            tmdbId = findData.tv_results[0].id;
          }

          if (tmdbId) {
            // Step B: Concurrent fetching for performance (Get Rating + Keywords simultaneously)
            const ratingUrl = type === 'movie' 
              ? `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates` 
              : `https://api.themoviedb.org/3/tv/${tmdbId}/content_ratings`;
            
            const keywordsUrl = type === 'movie'
              ? `https://api.themoviedb.org/3/movie/${tmdbId}/keywords`
              : `https://api.themoviedb.org/3/tv/${tmdbId}/keywords`;

            const [resRating, resKeywords] = await Promise.all([
              fetch(ratingUrl, { headers: { 'Authorization': tmdbAuth, 'Accept': 'application/json' } }),
              fetch(keywordsUrl, { headers: { 'Authorization': tmdbAuth, 'Accept': 'application/json' } })
            ]);

            if (!resRating.ok || !resKeywords.ok) {
              // TMDB API failure on the detail calls — don't cache, retry next time.
              return new Response(JSON.stringify({ streams: [], error: `TMDB detail fetch failed (rating: ${resRating.status}, keywords: ${resKeywords.status})` }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
              });
            }

            const dataRating = await resRating.json();
            const dataKeywords = await resKeywords.json();

            // Extract US Rating
            const usResult = dataRating.results?.find(r => r.iso_3166_1 === 'US');
            if (type === 'movie' && usResult?.release_dates?.length > 0) {
              const certObj = usResult.release_dates.find(d => d.certification);
              if (certObj) rating = certObj.certification;
            } else if (type === 'series' && usResult) {
              rating = usResult.rating || 'Unknown';
            }

            // Parse Content Keywords
            const kwList = (type === 'movie' ? dataKeywords.keywords : dataKeywords.results) || [];
            const kwString = kwList.map(k => k.name.toLowerCase()).join(' ');

            // Check for explicit risk vectors
            if (kwString.includes('violence') || kwString.includes('gore') || kwString.includes('blood') || kwString.includes('murder')) {
              contentFlags.push('⚠️ Violence');
            }
            if (kwString.includes('nudity') || kwString.includes('sexual') || kwString.includes('sex')) {
              contentFlags.push('⚠️ Nudity/Sexual Content');
            }
            if (kwString.includes('profanity') || kwString.includes('swearing') || kwString.includes('f-word')) {
              contentFlags.push('⚠️ Strong Language');
            }
          }

          // Step C: Determine Hazard Tier Styling
          const upperRating = (rating || 'Unknown').toUpperCase();
          let summaryText = `Rated: ${rating}`;
          if (!tmdbId) {
            summaryText = `Rated: Unknown (no TMDB match for ${imdbId})`;
          } else if (rating === 'Unknown') {
            summaryText = `Rated: Unknown (no US ${type === 'movie' ? 'certification' : 'TV rating'} on TMDB)`;
          }
          if (['G', 'TV-G', 'TV-Y', 'TV-Y7', 'PG', 'TV-PG'].includes(upperRating)) {
            colorEmoji = '🟢';
            summaryText += ' | Family Friendly';
          } else if (['PG-13', 'TV-14'].includes(upperRating)) {
            colorEmoji = '🟡';
            summaryText += ' | Parents Cautioned';
          } else if (['R', 'NC-17', 'TV-MA', '18+'].includes(upperRating)) {
            colorEmoji = '🔴';
            summaryText += ' | Restricted / Adult Content';
          }

          // Format details block with linebreaks for Stremio screen compatibility
          let detailsDescription = summaryText;
          if (contentFlags.length > 0) {
            detailsDescription += `\nMay Contain:\n${contentFlags.join('\n')}`;
          } else if (rating !== 'Unknown') {
            detailsDescription += '\nNo severe thematic warnings flagged.';
          }

          // Step D: Construct Output Structure
          const responseData = {
            streams: [
              {
                name: `${colorEmoji} FAMILY SHIELD`,
                title: `${detailsDescription}\n👉 Tap to review full IMDb Parental Guide.`,
                externalUrl: `https://www.imdb.com/title/${imdbId}/parentalguide`
              }
            ]
          };

          const finalResponse = new Response(JSON.stringify(responseData), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=604800'
            }
          });

          // Cache this — we only reach here on a confirmed outcome:
          // either a real rating was found, or TMDB was successfully queried
          // and genuinely has no match / no US rating for this title.
          ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));

          return finalResponse;

        } catch (err) {
          return new Response(JSON.stringify({ streams: [], error: err.message }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
          });
        }
      }
    }

    return new Response('Stremio Family Shield Addon Active', { status: 200 });
  }
};

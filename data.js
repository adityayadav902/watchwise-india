/*
 * Static content: categories, ranking criteria, project status, and the DEMO sample builder.
 * Category ids must match backend/worker.js.
 *
 * DEMO samples are NOT real videos and carry NO statistics. Each sample card simply opens
 * a YouTube search for an idea, so nothing here can be mistaken for live API data.
 */
(function () {
  'use strict';
  const YTD = (window.YTD = window.YTD || {});

  YTD.categories = [
    { id: 'technology-ai',          name: 'Technology & AI',        icon: '💻', hue: 215, topic: 'artificial intelligence',        blurb: 'AI tools, gadgets, software' },
    { id: 'education',              name: 'Education',              icon: '🎓', hue: 265, topic: 'study techniques',               blurb: 'Learn faster, exam prep' },
    { id: 'information-knowledge',  name: 'Information & Knowledge',icon: '💡', hue: 45,  topic: 'general knowledge',              blurb: 'Explainers and facts' },
    { id: 'science-discovery',      name: 'Science & Discovery',    icon: '🔬', hue: 190, topic: 'space and science',              blurb: 'Space, physics, biology' },
    { id: 'business-finance',       name: 'Business & Finance',     icon: '📈', hue: 150, topic: 'investing and personal finance', blurb: 'Markets, startups, money' },
    { id: 'history-documentary',    name: 'History & Documentary',  icon: '🏛️', hue: 25,  topic: 'Indian history',                 blurb: 'Past events, long-form docs' },
    { id: 'agriculture-farming',    name: 'Agriculture & Farming',  icon: '🌾', hue: 95,  topic: 'modern farming techniques',      blurb: 'Crops, soil, farm tech' },
    { id: 'career-skills',          name: 'Career & Skills',        icon: '🧰', hue: 330, topic: 'career skills',                  blurb: 'Jobs, interviews, upskilling' },
    { id: 'automobile-engineering', name: 'Automobile & Engineering',icon: '🚗', hue: 5,   topic: 'electric vehicles',              blurb: 'Cars, bikes, machines' },
    { id: 'health-wellness',        name: 'Health & Wellness',      icon: '🧘', hue: 170, topic: 'fitness and nutrition',          blurb: 'Fitness, nutrition, habits' },
    { id: 'environment-nature',     name: 'Environment & Nature',   icon: '🌿', hue: 130, topic: 'wildlife conservation',          blurb: 'Wildlife, climate, ecology' },
    { id: 'sports-analysis',        name: 'Sports & Analysis',      icon: '🏏', hue: 35,  topic: 'cricket analysis',               blurb: 'Tactics, stats, breakdowns' }
  ];

  // Mirrors WEIGHTS in backend/worker.js.
  YTD.criteria = [
    { label: 'Relevance',  weight: 45, desc: 'How closely YouTube’s own search matches your category and description.' },
    { label: 'Popularity', weight: 30, desc: 'View count on a log scale, so one viral hit does not drown out quality.' },
    { label: 'Engagement', weight: 15, desc: 'Likes per view, when the channel shows like counts.' },
    { label: 'Freshness',  weight: 10, desc: 'A gentle boost for newer videos that fades over roughly two years.' }
  ];

  YTD.featureStatus = [
    { id: 'ui',        name: 'Responsive single-page interface', state: 'working', note: 'Phone, tablet and desktop.' },
    { id: 'form',      name: 'Category, description and Top 5 / Top 10 selection', state: 'working', note: 'All 12 categories.' },
    { id: 'demo',      name: 'Demo mode', state: 'demo', note: 'Sample ideas that open a YouTube search. No real stats are shown.' },
    { id: 'voice',     name: 'Voice input for the description box (Hindi / English)', state: 'working', note: 'Needs a browser with speech recognition, such as Chrome. The mic button hides itself elsewhere.' },
    { id: 'pwa',       name: 'Installable app (PWA) with offline app shell', state: 'working', note: 'Works on HTTPS (GitHub Pages) or localhost. Live results still need an internet connection.' },
    { id: 'live-results', name: 'Live results (real thumbnails, titles, channels, stats)', state: 'backend', note: 'Requires deploying backend/worker.js with a YouTube API key, then setting API_BASE_URL.' },
    { id: 'ranking',   name: 'Score-based ranking', state: 'backend', note: 'Implemented in backend/worker.js; runs only on the backend.' },
    { id: 'cache',     name: '20-day cached rankings', state: 'backend', note: 'TTL cache is built into the backend.' },
    { id: 'scheduler', name: 'Scheduled 20-day refresh of default rankings', state: 'backend', note: 'Needs a KV namespace and a cron trigger enabled in wrangler.toml.' },
    { id: 'abuse',     name: 'Rate limiting and abuse protection', state: 'backend', note: 'Configure rate-limiting rules on your backend host.' },
    { id: 'lang',      name: 'Language filters (Hindi, Tamil, …)', state: 'future', note: 'Not built yet.' }
  ];

  const ANGLES = [
    ['Beginner-friendly guide to {t}',          'beginner guide'],
    ['{t} explained in Hindi',                  'explained in Hindi'],
    ['{t}: the complete masterclass',           'full course'],
    ['Latest developments in {t}',              'latest'],
    ['{t} — common mistakes to avoid',          'mistakes to avoid'],
    ['Expert interview on {t}',                 'expert interview'],
    ['{t} in India: what is different here?',   'India'],
    ['Step-by-step practical {t} tutorial',     'tutorial step by step'],
    ['{t}: myths vs facts',                     'myths and facts'],
    ['Quick 10-minute overview of {t}',         '10 minute overview']
  ];

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  YTD.buildDemo = function (categoryId, query, limit) {
    const cat = YTD.categories.find((c) => c.id === categoryId) || YTD.categories[0];
    const topic = (query || '').trim() || cat.topic;
    return ANGLES.slice(0, limit).map(([title, suffix], i) => ({
      sample: true,
      rank: i + 1,
      title: title.replace('{t}', cap(topic)),
      icon: cat.icon,
      hue: cat.hue,
      videoUrl: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(topic + ' ' + suffix),
      channelTitle: null,
      channelUrl: null,
      publishedAt: null,
      durationSeconds: null,
      stats: { views: null, likes: null, comments: null }
    }));
  };
})();

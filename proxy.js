// proxy.js на GitHub Pages
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Проксируем запросы к /api/*
  if (url.pathname.startsWith('/api/')) {
    const targetUrl = `http://78.40.188.120:3000${url.pathname.replace('/api', '')}${url.search}`;
    
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GitHub-Pages-Proxy'
        }
      });
      
      const data = await response.text();
      
      return new Response(data, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response('Not found', { status: 404 });
}

// Для GitHub Pages нужно экспортировать функцию
export default handleRequest;
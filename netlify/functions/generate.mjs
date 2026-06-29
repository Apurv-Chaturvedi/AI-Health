export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const { messages, max_tokens = 4096 } = body;

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens,
      messages,
      stream: true
    })
  });

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: { message: err.error?.message || `API error ${upstream.status}` } }),
      { status: upstream.status, headers: { 'content-type': 'application/json' } }
    );
  }

  // Stream Anthropic SSE events → extract text deltas → pipe plain text to client
  // The connection stays alive as chunks flow, bypassing Netlify's function timeout
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line for next chunk
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              await writer.write(encoder.encode(evt.delta.text));
            }
          } catch {}
        }
      }
      await writer.close();
    } catch (err) {
      await writer.abort(err);
    }
  })();

  return new Response(readable, {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
};

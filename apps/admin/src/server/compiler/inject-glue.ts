/**
 * Inject fetch glue into the client bundle so it auto-fetches from server endpoint.
 */

export function injectGlue(clientExport: string, componentId: string): string {
  return `
import { useState, useEffect, createElement } from 'react';

${clientExport}

export default function FullstackWrapper() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetch('/api/components/${componentId}/server')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading && !data) return createElement('div', null, 'Loading...');
  return createElement(Client, { data, refresh });
}
`.trim();
}

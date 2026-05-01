/**
 * AI Face Swap Starter — AI 换脸上传 (PLANET-1424)
 * FULLSTACK: upload image → call face swap API (stub v1) → show result.
 */
import type { AppTemplate } from './ecommerce-starter.js';

const FULLSTACK_CODE = `import { peopleClaw } from '@peopleclaw/sdk';
import { useState } from 'react';

// --- SERVER ---
export async function server(input: any, ctx: any) {
  await peopleClaw.nodeEntry('uploadOriginal');

  const imageUrl = input?.imageUrl ?? 'https://placekitten.com/400/400';

  await peopleClaw.nodeEntry('callFaceSwapAPI');

  // TODO: v2 接真 provider (Replicate / fal.ai / 内部 face swap service)
  // v1 stub: sleep 500ms 返 fake result
  await new Promise(resolve => setTimeout(resolve, 500));

  await peopleClaw.nodeEntry('saveResult');

  return {
    swappedUrl: imageUrl,
    faceMatched: true,
    provider: 'stub-v1',
  };
}

// --- CLIENT ---
export function Client({ data, onRun }: { data: any; onRun?: (input: any) => void }) {
  const [file, setFile] = useState<string | null>(null);

  const handleUpload = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setFile(url);
      if (onRun) onRun({ imageUrl: url });
    };
    reader.readAsDataURL(f);
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <h2>🎭 AI 换脸</h2>
      <input type="file" accept="image/*" onChange={handleUpload} />
      {file && <img src={file} alt="uploaded" style={{ width: 200, marginTop: '1rem', borderRadius: 8 }} />}
      {data?.swappedUrl && (
        <div style={{ marginTop: '1rem' }}>
          <p>✅ 换脸完成 (provider: {data.provider})</p>
          <img src={data.swappedUrl} alt="swapped" style={{ width: 200, borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
`;

export const aiFaceSwapTemplate: AppTemplate = {
  id: 'ai-face-swap-starter',
  name: 'AI 换脸上传',
  description: '上传图片 → AI 换脸 (v1 stub) → 展示结果',
  components: [
    {
      name: 'AI 换脸',
      type: 'FULLSTACK',
      icon: '🎭',
      code: FULLSTACK_CODE,
      canvasX: 300,
      canvasY: 200,
    },
  ],
  connections: [],
};

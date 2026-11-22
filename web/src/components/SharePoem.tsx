import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toDataURL } from 'qrcode';
import type { PoemDetail } from '../types';
import { useLang } from '../lang';
import { Icon } from './Icon';

const PUBLIC_ORIGIN = 'https://www.tiongkok-poetry.cn';

function poemShareUrl(id: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  const local = !host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  const origin = local ? PUBLIC_ORIGIN : window.location.origin;
  return `${origin}${base}/poem/${encodeURIComponent(id)}`;
}

function filenameFor(title: string, author: string): string {
  const clean = (value: string) => value.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return `墨澜-${clean(title) || '诗词'}-${clean(author) || ''}.png`;
}

async function makeQr(url: string): Promise<string> {
  return toDataURL(url, {
    width: 360,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#29231b', light: '#f5eddc' },
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const chars = Array.from(text.trim());
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

async function imageFromDataUrl(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function renderCard(input: {
  title: string;
  author: string;
  dynasty: string;
  collName: string;
  lines: string[];
  qr: string;
  domain: string;
}): Promise<string> {
  const W = 1080;
  const H = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('600 70px "Molan Serif"'),
      document.fonts.load('400 38px "Molan Serif"'),
    ]);
  } catch {}

  // 宣纸底色与细密纸纹
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#faf3e6');
  bg.addColorStop(0.52, '#f4ead7');
  bg.addColorStop(1, '#eee0c9');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(93, 68, 37, .045)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(139, 102, 52, .48)';
  ctx.lineWidth = 2;
  ctx.strokeRect(43, 43, W - 86, H - 86);
  ctx.strokeStyle = 'rgba(139, 102, 52, .2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(57, 57, W - 114, H - 114);

  // 页眉
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#765127';
  ctx.font = '600 30px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillText('墨 澜', 88, 108);
  ctx.fillStyle = '#9a8567';
  ctx.font = '400 15px "Space Grotesk", "IBM Plex Mono", sans-serif';
  ctx.fillText('MOLAN · VERSE ARCHIVE', 188, 110);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#9a8567';
  ctx.font = '400 16px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillText('中国古典诗词数字档案', 992, 110);
  ctx.strokeStyle = 'rgba(139, 102, 52, .24)';
  ctx.beginPath();
  ctx.moveTo(88, 148);
  ctx.lineTo(992, 148);
  ctx.stroke();

  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#29231b';
  ctx.font = '600 70px "Molan Serif", "Noto Serif SC", serif';
  const titleLines = wrapText(ctx, input.title, 920, 2);
  const titleTop = 218;
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, titleTop + i * 82));
  const byY = titleTop + (titleLines.length - 1) * 82 + 92;

  // 作者行与朱印
  const byText = `${input.author} · ${input.dynasty}`;
  ctx.font = '400 28px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillStyle = '#645643';
  const byWidth = ctx.measureText(byText).width;
  ctx.fillText(byText, W / 2, byY);
  const sealX = W / 2 - byWidth / 2 - 68;
  roundRect(ctx, sealX, byY - 25, 44, 44, 4);
  ctx.fillStyle = 'rgba(166, 61, 43, .96)';
  ctx.fill();
  ctx.fillStyle = '#f8efdc';
  ctx.font = '500 24px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillText('詩', sealX + 22, byY - 2);

  ctx.fillStyle = '#9a7a45';
  ctx.font = '400 17px "IBM Plex Mono", "Space Grotesk", monospace';
  ctx.fillText(input.collName, W / 2, byY + 52);

  // 右侧淡墨水印
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.fillStyle = '#7f5b2d';
  ctx.font = '600 270px "Molan Serif", "Noto Serif SC", serif';
  ctx.textAlign = 'right';
  ctx.fillText('詩', 1010, 1045);
  ctx.restore();

  // 诗句主体
  const bodyTop = Math.max(520, byY + 126);
  const bodyLineHeight = 54;
  const bodyFont = 38;
  ctx.font = `400 ${bodyFont}px "Molan Serif", "Noto Serif SC", serif`;
  const bodyLines = input.lines;
  const bodyWidth = bodyLines.length ? Math.max(...bodyLines.map(line => ctx.measureText(line).width)) : 0;
  let size = bodyFont;
  while (bodyWidth * (size / bodyFont) > 900 && size > 26) size -= 1;
  ctx.font = `400 ${size}px "Molan Serif", "Noto Serif SC", serif`;
  ctx.fillStyle = '#3b3123';
  const centeredTop = bodyTop + ((9 - bodyLines.length) * bodyLineHeight) / 2;
  bodyLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, centeredTop + i * bodyLineHeight);
  });

  // 页脚
  const footerY = 1110;
  ctx.strokeStyle = 'rgba(139, 102, 52, .28)';
  ctx.beginPath();
  ctx.moveTo(88, footerY);
  ctx.lineTo(992, footerY);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#765127';
  ctx.font = '600 25px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillText('墨澜', 88, footerY + 44);
  ctx.fillStyle = '#9a8567';
  ctx.font = '400 13px "Space Grotesk", "IBM Plex Mono", sans-serif';
  ctx.fillText('MOLAN · VERSE ARCHIVE', 145, footerY + 41);

  ctx.fillStyle = '#584b39';
  ctx.font = '400 17px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillText('中国古典诗词数字档案', 88, footerY + 82);
  ctx.fillStyle = '#825d2c';
  ctx.font = '500 23px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillText('扫码读全诗', 88, footerY + 132);
  ctx.fillStyle = '#9a8567';
  ctx.font = '400 13px "IBM Plex Mono", "Space Grotesk", monospace';
  ctx.fillText(input.domain, 88, footerY + 164);

  // 二维码
  const qrSize = 190;
  const qrX = 790;
  const qrY = footerY + 28;
  roundRect(ctx, qrX, qrY, qrSize, qrSize, 5);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 102, 52, .25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const qrImg = await imageFromDataUrl(input.qr);
  ctx.drawImage(qrImg, qrX + 15, qrY + 15, qrSize - 30, qrSize - 30);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9a8567';
  ctx.font = '400 13px "Molan Serif", "Noto Serif SC", serif';
  ctx.fillText('长按识别二维码', qrX + qrSize / 2, qrY + qrSize + 27);

  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl.startsWith('data:image/png')) throw new Error('card export failed');
  return dataUrl;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/png';
  const binary = atob(payload || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function copyFallback(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  textarea.remove();
  return ok;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyFallback(text);
  }
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function SharePoem({ open, onClose, poem }: { open: boolean; onClose: () => void; poem: PoemDetail }) {
  const { tr } = useLang();
  const [cardData, setCardData] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<number | null>(null);

  const shareUrl = useMemo(() => poemShareUrl(poem.id), [poem.id]);
  const shareHost = useMemo(() => new URL(shareUrl).host, [shareUrl]);
  const title = tr(poem.title);
  const author = tr(poem.author);
  const collName = tr(poem.collName);
  const cardTitle = title;
  const cardAuthor = author;
  const cardDynasty = poem.dynasty;
  const cardCollName = collName;
  const cardLines = useMemo(() => {
    const raw = poem.linesArr?.length ? poem.linesArr.map(tr) : [tr(poem.lead)];
    if (raw.length <= 9) return raw;
    return [...raw.slice(0, 8), '……'];
  }, [poem, tr]);
  const generatedName = useMemo(() => filenameFor(title, author), [title, author]);

  const notify = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  };

  useEffect(() => {
    if (!open) {
      setCardData('');
      setError('');
      setNotice('');
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError('');
    setCardData('');
    setFileName(generatedName);
    const timer = window.setTimeout(() => notify('正在生成分享卡片…'), 0);

    (async () => {
      try {
        const qr = await makeQr(shareUrl);
        const dataUrl = await renderCard({
          title: cardTitle,
          author: cardAuthor,
          dynasty: cardDynasty,
          collName: cardCollName,
          lines: cardLines,
          qr,
          domain: shareHost,
        });
        if (!alive) return;
        setCardData(dataUrl);
        setLoading(false);
        notify('卡片已生成，可点击下载保存');
      } catch (err) {
        console.error('share card failed', err);
        if (!alive) return;
        setLoading(false);
        setError('卡片生成失败，请稍后再试');
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, shareUrl, shareHost, generatedName, cardTitle, cardAuthor, cardDynasty, cardCollName, cardLines]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const download = () => {
    if (!cardData) return;
    const a = document.createElement('a');
    a.href = cardData;
    a.download = fileName || generatedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    notify('已开始下载卡片');
  };

  const shareImage = async () => {
    if (!cardData) return;
    const nav = navigator as Navigator & {
      canShare?: (data: any) => boolean;
      share?: (data: any) => Promise<void>;
    };
    const blob = dataUrlToBlob(cardData);
    const file = new File([blob], fileName || generatedName, { type: 'image/png' });
    const payload = { files: [file], title: `${title} · 墨澜`, text: `${title} · ${author}` };
    if (!nav.share || (nav.canShare && !nav.canShare(payload))) {
      download();
      return;
    }
    try {
      await nav.share(payload);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify('系统分享未完成，可保存卡片后手动分享');
        download();
      }
    }
  };

  const copyLink = async (target?: 'wechat' | 'moments') => {
    const ok = await copyText(shareUrl);
    if (!ok) {
      notify('复制失败，请手动复制下方链接');
      return;
    }
    if (target === 'moments') notify('链接已复制，打开微信朋友圈粘贴即可');
    else if (target === 'wechat') notify('链接已复制，打开微信粘贴给好友');
    else notify('链接已复制');
  };

  const shareToWechat = async () => {
    const nav = navigator as Navigator & { share?: (data: any) => Promise<void> };
    if (isMobile() && nav.share) {
      try {
        await nav.share({ title: `${title} · 墨澜`, text: `${title} · ${author}`, url: shareUrl });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await copyLink('wechat');
  };

  const shareToMoments = async () => {
    const nav = navigator as Navigator & { share?: (data: any) => Promise<void> };
    if (isMobile() && nav.share) {
      try {
        await nav.share({ title: `${title} · 墨澜`, text: `${title} · ${author}`, url: shareUrl });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await copyLink('moments');
  };

  const openSocial = (kind: 'qq' | 'qzone' | 'weibo') => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(`${title} · ${author}`);
    const encodedSummary = encodeURIComponent(poem.linesArr?.slice(0, 2).join(' / ') || '');
    const target = {
      qq: `https://connect.qq.com/widget/shareqq/index.html?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedSummary}`,
      qzone: `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedSummary}`,
      weibo: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}`,
    }[kind];
    window.open(target, '_blank', 'noopener,noreferrer,width=760,height=560');
  };

  if (!open) return null;

  return createPortal(
    <div
      className="share-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="分享这首诗"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="share-panel" onMouseDown={e => e.stopPropagation()}>
        <div className="share-head">
          <div>
            <div className="share-kicker">SHARE · 一首诗</div>
            <h2 className="share-title">分享这首诗</h2>
          </div>
          <button className="share-close" type="button" aria-label="关闭分享" onClick={onClose}>{Icon.close({})}</button>
        </div>

        <div className="share-body">
          <div className="share-card-col">
            <div className={`share-card-frame ${loading ? 'is-loading' : ''}`}>
              {cardData ? <img src={cardData} alt={`${title} 分享卡片`} /> : (
                <div className="share-card-placeholder">
                  {loading ? <div className="spin-loader" /> : <span>卡片预览</span>}
                </div>
              )}
            </div>
            <div className="share-card-actions">
              <button className="btn share-primary" type="button" disabled={!cardData} onClick={download}>
                {Icon.download({})} 下载卡片
              </button>
              {cardData && !!navigator.share && (
                <button className="tool" type="button" onClick={shareImage}>分享图片</button>
              )}
            </div>
            <p className="share-card-note">
              {error || (loading ? '正在生成含二维码的分享卡片…' : '卡片已生成 · 含本站二维码；可下载，手机也可长按保存')}
            </p>
          </div>

          <div className="share-link-col">
            <div className="share-section-label">分享链接</div>
            <div className="share-social-grid">
              <button className="share-social wechat" type="button" onClick={shareToWechat}>
                <span className="share-social-icon">微</span>
                <span><b>微信</b><small>好友 / 群聊</small></span>
              </button>
              <button className="share-social moments" type="button" onClick={shareToMoments}>
                <span className="share-social-icon">圈</span>
                <span><b>朋友圈</b><small>复制链接后粘贴</small></span>
              </button>
              <button className="share-social qq" type="button" onClick={() => openSocial('qq')}>
                <span className="share-social-icon">Q</span>
                <span><b>QQ</b><small>分享到聊天</small></span>
              </button>
              <button className="share-social qzone" type="button" onClick={() => openSocial('qzone')}>
                <span className="share-social-icon">空</span>
                <span><b>QQ空间</b><small>分享到空间</small></span>
              </button>
              <button className="share-social weibo" type="button" onClick={() => openSocial('weibo')}>
                <span className="share-social-icon">博</span>
                <span><b>微博</b><small>分享到微博</small></span>
              </button>
              <button className="share-social copy" type="button" onClick={() => copyLink()}>
                <span className="share-social-icon">{Icon.copy({})}</span>
                <span><b>复制链接</b><small>粘贴到任意社区</small></span>
              </button>
            </div>

            <div className="share-url">
              <span>{shareUrl}</span>
              <button type="button" onClick={() => copyLink()}>复制</button>
            </div>
            <p className="share-link-note">微信 / 朋友圈没有网页直达分享接口：手机端会优先唤起系统分享，桌面端复制链接后粘贴即可。</p>
          </div>
        </div>

        {notice && <div className="share-notice" role="status">{notice}</div>}
      </div>
    </div>,
    document.body,
  );
}

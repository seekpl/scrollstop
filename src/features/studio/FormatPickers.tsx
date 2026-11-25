import { useState } from 'react';
import { useResearch } from '../../app/research';
import { DEMO_SPECS, FILLER_IDS, SLIDE_IDS, THUMB_IDS, type DemoId } from '../../demo/demoScene';
import { useI18n } from '../../i18n';
import type { FillerItem, MediaSource } from '../../research/model';
import { Btn, Field, Icon, inputClass } from '../../ui/kit';
import { registerLocalFile } from '../shared/mediaLibrary';
import { MAX_VIDEO_MB, probeVideo } from './MediaPicker';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_MB = 15;

/** Wymiary obrazu z pliku albo adresu. */
export function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('timeout')), 15000);
    img.onload = () => {
      clearTimeout(timer);
      resolve({ width: img.naturalWidth || 1280, height: img.naturalHeight || 720 });
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('media_load_failed'));
    };
    img.src = url;
  });
}

/** Obraz wybrany w kreatorze; `file` — do wgrania na serwer po utworzeniu projektu. */
export interface PickedImage {
  media: MediaSource;
  name: string;
  width: number;
  height: number;
  file?: File;
}

function useImageFiles() {
  const { t } = useI18n();
  const { api } = useResearch();
  const [error, setError] = useState<string | null>(null);
  const read = async (files: FileList | File[]): Promise<PickedImage[]> => {
    setError(null);
    const out: PickedImage[] = [];
    for (const file of [...files]) {
      if (!IMAGE_TYPES.includes(file.type)) {
        setError(t.errors.unsupported_type);
        continue;
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        setError(t.errors.too_large);
        continue;
      }
      const media = registerLocalFile(file);
      const size = await probeImage(URL.createObjectURL(file)).catch(() => ({ width: 1280, height: 720 }));
      out.push({ media, name: file.name, ...size, ...(api.mode === 'server' ? { file } : {}) });
    }
    return out;
  };
  return { read, error, setError };
}

const demoImage = (id: DemoId, name: string): PickedImage => ({ media: { kind: 'demo', demo: id }, name, width: DEMO_SPECS[id].w, height: DEMO_SPECS[id].h });

/** Miniatura (okładka) jednej wersji: plik PNG/JPG/WebP, link do obrazu albo miniatura demo, plus tytuł. */
export function ThumbnailPicker({ value, title, onChange, onTitle, label }: { value: PickedImage | null; title: string; onChange(v: PickedImage | null): void; onTitle(t: string): void; label: string }) {
  const { t } = useI18n();
  const m = t.studio.media;
  const { read, error } = useImageFiles();
  const [url, setUrl] = useState('');
  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
          <Icon name="grid" />
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{value.name}</span>
          <Btn size="sm" onClick={() => onChange(null)}>
            {t.common.actions.change}
          </Btn>
        </div>
      ) : (
        <div className="space-y-3" role="group" aria-label={label}>
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-field/60 bg-surface px-4 py-4 text-center hover:border-cobalt">
            <Icon name="upload" size={20} />
            <span className="text-[14.5px] font-semibold text-ink">{m.pickImage}</span>
            <span className="text-[12.5px] text-muted">{m.imageTypes(MAX_IMAGE_MB)}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => e.target.files && (await read(e.target.files)).slice(0, 1).forEach((x) => onChange(x))} />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Field label={m.imageUrlLabel}>{(id) => <input id={id} className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/okladka.jpg" />}</Field>
            </div>
            <Btn
              disabled={!/^https:\/\//i.test(url.trim())}
              onClick={async () => {
                const u = url.trim();
                const size = await probeImage(u).catch(() => ({ width: 1280, height: 720 }));
                onChange({ media: { kind: 'url', url: u }, name: decodeURIComponent(u.split('/').pop() || u).slice(0, 200), ...size });
              }}
            >
              {m.add}
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            {THUMB_IDS.slice(0, 3).map((id, i) => (
              <Btn key={id} size="sm" onClick={() => onChange(demoImage(id, m.demoThumb(i + 1)))}>
                {m.useDemo(m.demoThumb(i + 1))}
              </Btn>
            ))}
          </div>
          {error && <p className="text-[13.5px] font-semibold text-poor" role="alert">{error}</p>}
        </div>
      )}
      <Field label={m.thumbTitle} hint={m.thumbTitleHint}>
        {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={title} maxLength={120} onChange={(e) => onTitle(e.target.value)} />}
      </Field>
    </div>
  );
}

/** Slajdy karuzeli: 2–20 obrazów (kolejność jak przy wyborze) albo karuzela demo. */
export function SlidesPicker({ value, onChange, label }: { value: PickedImage[]; onChange(v: PickedImage[]): void; label: string }) {
  const { t } = useI18n();
  const m = t.studio.media;
  const { read, error } = useImageFiles();
  return (
    <div className="space-y-3" role="group" aria-label={label}>
      {value.length > 0 && (
        <ol className="flex flex-wrap gap-2">
          {value.map((s, i) => (
            <li key={`${s.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg bg-ink/[0.05] py-1 pl-2.5 pr-1 text-[13px]">
              <span className="font-semibold">{i + 1}.</span>
              <span className="max-w-[160px] truncate">{s.name}</span>
              <button type="button" aria-label={m.removeSlide(i + 1)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-poor/10 hover:text-poor" onClick={() => onChange(value.filter((_, k) => k !== i))}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-field/60 bg-surface px-4 py-4 text-center hover:border-cobalt">
        <Icon name="upload" size={20} />
        <span className="text-[14.5px] font-semibold text-ink">{m.pickSlides}</span>
        <span className="text-[12.5px] text-muted">{m.slidesHint(MAX_IMAGE_MB)}</span>
        <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => e.target.files && onChange([...value, ...(await read(e.target.files))].slice(0, 20))} />
      </label>
      <Btn size="sm" onClick={() => onChange(SLIDE_IDS.map((id, i) => demoImage(id, m.demoSlide(i + 1))))}>
        {m.useDemo(m.demoCarousel)}
      </Btn>
      {error && <p className="text-[13.5px] font-semibold text-poor" role="alert">{error}</p>}
    </div>
  );
}

export interface PickedFiller extends FillerItem {
  name: string;
  file?: File;
}

/** Wypełniacze feedu: klipy demo (domyślnie) albo wcześniejsze klipy twórcy. */
export function FillersPicker({ value, onChange }: { value: PickedFiller[] | null; onChange(v: PickedFiller[] | null): void }) {
  const { t } = useI18n();
  const m = t.studio.media;
  const { api } = useResearch();
  const [error, setError] = useState<string | null>(null);
  const add = async (files: FileList) => {
    setError(null);
    const out: PickedFiller[] = [];
    for (const file of [...files]) {
      if (!/^video\//.test(file.type)) {
        setError(t.errors.unsupported_type);
        continue;
      }
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setError(t.errors.too_large);
        continue;
      }
      const media = registerLocalFile(file);
      const probe = await probeVideo(URL.createObjectURL(file)).catch(() => ({ duration: 0, width: 1080, height: 1920 }));
      out.push({ id: `fil_${Math.random().toString(36).slice(2, 10)}`, media, name: file.name, ...probe, ...(api.mode === 'server' ? { file } : {}) });
    }
    onChange([...(value ?? []), ...out].slice(0, 20));
  };
  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-muted">{value ? m.ownFillers(value.length) : m.demoFillers(FILLER_IDS.length)}</p>
      {value && value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((f, i) => (
            <li key={f.id} className="inline-flex items-center gap-1.5 rounded-lg bg-ink/[0.05] py-1 pl-2.5 pr-1 text-[13px]">
              <span className="max-w-[180px] truncate">{f.name}</span>
              <button type="button" aria-label={m.removeFiller(f.name)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-poor/10 hover:text-poor" onClick={() => onChange(value.filter((_, k) => k !== i))}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-surface px-4 text-[14px] font-semibold ring-1 ring-inset ring-field/70 hover:ring-ink/50">
          <Icon name="upload" size={17} />
          {m.addFillers}
          <input type="file" multiple accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => e.target.files && void add(e.target.files)} />
        </label>
        {value && (
          <Btn size="sm" variant="quiet" onClick={() => onChange(null)}>
            {m.useDemoFillers}
          </Btn>
        )}
      </div>
      {error && <p className="text-[13.5px] font-semibold text-poor" role="alert">{error}</p>}
    </div>
  );
}

import { useState, type FormEvent } from 'react'
import { AdminPanel, FormMessage } from '../../../components/admin/adminUi'
import { PlusIcon } from '../../../components/icons'
import { Field, inputClass } from '../../../components/ui/Field'
import { button, ghostButton } from '../../../components/ui/styles'
import { addImage, removeImage, reorderImages, updateImage } from '../../../features/admin/adminApi'
import type { AdminImage, AdminProduct } from '../../../features/admin/types'
import { useAction } from '../../../features/admin/useAction'

type Props = { product: AdminProduct; onChange: (p: AdminProduct) => void }

// Photos. For now a photo is added by its address: put the file in
// web/public/img and type /img/the-file.webp (or paste an https:// link).
// Real uploads come with Cloudflare R2 (api/internal/images).
export function PhotosPanel({ product, onChange }: Props) {
  const [editing, setEditing] = useState<number | 'add' | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const { run, busy, error } = useAction()
  const imgs = product.images

  async function move(index: number, by: -1 | 1) {
    const ids = imgs.map((i) => i.id)
    const j = index + by
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    const p = await run(() => reorderImages(product.id, ids))
    if (p) onChange(p)
  }

  async function remove(id: number) {
    const p = await run(() => removeImage(id))
    if (p) {
      onChange(p)
      setRemoving(null)
    }
  }

  return (
    <AdminPanel id="photos-h" title="Photos" aside="Square works best · the first photo is the cover">
      {imgs.length === 0 && <p className="text-label font-normal text-ink-subtle">No photos yet. A product needs at least one to be published.</p>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {imgs.map((img, i) => (
          <li key={img.id} className="flex flex-col gap-2">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-field">
              <img src={img.thumbUrl || img.url} alt={img.alt} className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute top-2 left-2 rounded-full border border-line bg-surface-glass px-2 py-0.5 text-micro text-ink-strong backdrop-blur-xl">Cover</span>
              )}
            </div>
            <span className="truncate text-caption text-ink-muted" title={img.alt}>
              {img.shortName ? `${img.shortName} · ` : ''}
              {img.alt}
            </span>
            {removing === img.id ? (
              <span className="flex flex-wrap items-center gap-2 text-caption">
                Remove this photo?
                <button type="button" disabled={busy} onClick={() => remove(img.id)} className={ghostButton + ' min-h-11 min-w-11 text-ink-strong'}>
                  Yes, remove
                </button>
                <button type="button" onClick={() => setRemoving(null)} className={ghostButton + ' min-h-11 min-w-11'}>
                  Keep
                </button>
              </span>
            ) : (
              <span className="flex flex-wrap gap-x-3">
                <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0 || busy} onClick={() => move(i, -1)} className={ghostButton + ' min-h-11 min-w-11 min-w-11 disabled:opacity-30'}>
                  ←
                </button>
                <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={i === imgs.length - 1 || busy} onClick={() => move(i, 1)} className={ghostButton + ' min-h-11 min-w-11 min-w-11 disabled:opacity-30'}>
                  →
                </button>
                <button type="button" onClick={() => setEditing(img.id)} className={ghostButton + ' min-h-11 min-w-11'}>
                  Edit
                </button>
                <button type="button" onClick={() => setRemoving(img.id)} className={ghostButton + ' min-h-11 min-w-11'}>
                  Remove
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <FormMessage error>{error.message}</FormMessage>}

      {editing !== null ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <ImageForm
            product={product}
            image={editing === 'add' ? undefined : imgs.find((i) => i.id === editing)}
            onDone={(p) => {
              onChange(p)
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing('add')} className={button('secondary') + ' self-start'}>
          <PlusIcon size={16} />
          Add photo
        </button>
      )}
    </AdminPanel>
  )
}

function ImageForm({ product, image, onDone, onCancel }: { product: AdminProduct; image?: AdminImage; onDone: (p: AdminProduct) => void; onCancel: () => void }) {
  const [url, setUrl] = useState(image?.url ?? '')
  const [thumbUrl, setThumbUrl] = useState(image && image.thumbUrl !== image.url ? image.thumbUrl : '')
  const [alt, setAlt] = useState(image?.alt ?? '')
  const [shortName, setShortName] = useState(image?.shortName ?? '')
  const { run, busy, error } = useAction()
  const key = image?.id ?? 'new'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = { url, thumbUrl, alt, shortName }
    const p = await run(() => (image ? updateImage(image.id, body) : addImage(product.id, body)))
    if (p) onDone(p)
  }

  const f = error?.fields ?? {}
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-label text-ink-strong">{image ? 'Edit photo' : 'Add a photo'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`i-url-${key}`} label="Photo address" required error={f.url} hint="Copy the file to web/public/img, then type /img/the-file.webp">
          <input id={`i-url-${key}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/img/p-my-product.webp" className={inputClass} />
        </Field>
        <Field id={`i-thumb-${key}`} label="Small version" optional error={f.thumbUrl} hint="A small square crop, like /img/t-p-my-product.webp. Empty = the same photo.">
          <input id={`i-thumb-${key}`} value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} className={inputClass} />
        </Field>
        <Field id={`i-alt-${key}`} label="What the photo shows" required error={f.alt} hint="Read aloud to people who cannot see it.">
          <input id={`i-alt-${key}`} value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} placeholder="Black hoodie, front, with the ember logo" className={inputClass} />
        </Field>
        <Field id={`i-name-${key}`} label="Short name" optional error={f.shortName} hint="On the thumbnail button: Front, Back, Detail.">
          <input id={`i-name-${key}`} value={shortName} maxLength={40} onChange={(e) => setShortName(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={button('secondary')}>
          {busy ? 'Saving…' : image ? 'Save photo' : 'Add photo'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(error.fields).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}

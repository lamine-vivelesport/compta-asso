'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Document {
  id: string
  filename: string
  storage_path: string
  content_type: string | null
  uploaded_at: string
}

interface Props {
  ecritureId: string
  libelleEcriture: string
  onCountChange?: (count: number) => void
}

export default function DocumentsSection({ ecritureId, libelleEcriture, onCountChange }: Props) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('ecriture_id', ecritureId)
      .order('uploaded_at', { ascending: false })
    const list = (data ?? []) as Document[]
    setDocs(list)
    onCountChange?.(list.length)
    setLoading(false)
  }, [ecritureId, onCountChange])

  useEffect(() => { loadDocs() }, [loadDocs])

  const uploadFile = useCallback(async (file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setError('Format non supporté. Acceptés : PDF, JPG, PNG.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 10 Mo).')
      return
    }
    setError('')
    setUploading(true)
    try {
      const path = `${ecritureId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type })
      if (uploadErr) throw uploadErr

      const { error: dbErr } = await supabase.from('documents').insert({
        ecriture_id: ecritureId,
        filename: file.name,
        storage_path: path,
        content_type: file.type,
      })
      if (dbErr) throw dbErr

      await loadDocs()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }, [ecritureId, loadDocs])

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Supprimer "${doc.filename}" ?`)) return
    await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    await loadDocs()
  }

  const getPublicUrl = (path: string) =>
    supabase.storage.from('documents').getPublicUrl(path).data.publicUrl

  const isImage = (type: string | null) =>
    type?.startsWith('image/') ?? false

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 truncate">
        <span className="font-medium text-gray-700">Écriture :</span> {libelleEcriture}
      </p>

      {/* Documents existants */}
      {loading ? (
        <p className="text-xs text-gray-400">Chargement…</p>
      ) : docs.length > 0 ? (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              {isImage(doc.content_type) ? (
                <img
                  src={getPublicUrl(doc.storage_path)}
                  alt={doc.filename}
                  className="w-10 h-10 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center shrink-0 text-lg">
                  📄
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{doc.filename}</p>
                <p className="text-xs text-gray-400">
                  {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <a
                  href={getPublicUrl(doc.storage_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-indigo-600 hover:text-indigo-800 text-sm"
                  title="Ouvrir"
                >
                  🔍
                </a>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1 text-red-400 hover:text-red-600 text-sm"
                  title="Supprimer"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-orange-600 bg-orange-50 rounded p-2">
          ⚠️ Aucune pièce justificative
        </p>
      )}

      {/* Zone de dépôt */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
        }`}
      >
        {uploading ? (
          <p className="text-xs text-indigo-600">Envoi en cours…</p>
        ) : (
          <>
            <p className="text-xs text-gray-600 font-medium">Glissez un fichier ici</p>
            <p className="text-xs text-gray-400 mt-0.5">ou cliquez • PDF, JPG, PNG • max 10 Mo</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
      )}
    </div>
  )
}

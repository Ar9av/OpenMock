import { useEffect, useState } from 'react'
import { useStore } from '../store'
import {
  applyTemplate,
  deleteTemplate,
  listTemplates,
  normalizeTemplate,
  saveTemplate,
  templateFromProject,
  type Template,
} from '../templates'

export function TemplateDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)
  const setProject = useStore((s) => s.setProject)
  const [items, setItems] = useState<Template[] | null>(null)
  const [name, setName] = useState(project.name)

  const refresh = () => listTemplates().then(setItems)
  useEffect(() => {
    refresh()
  }, [])

  const save = async () => {
    await saveTemplate(templateFromProject(project, name.trim() || 'Untitled template'))
    refresh()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Templates</h2>
        <p className="hint">
          A template stores the look and the motion, never your screenshots. Applying one keeps the media you already loaded.
        </p>

        <div className="template-save">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" aria-label="Template name" />
          <button className="ghost" onClick={save}>
            Save current
          </button>
        </div>

        {items === null ? (
          <p className="hint">Loading…</p>
        ) : items.length === 0 ? (
          <p className="hint">No templates yet. Set up a look you like, then save it here and reuse it on the next launch.</p>
        ) : (
          <ul className="template-list">
            {items.map((t) => (
              <li key={t.id}>
                <span className="tpl-name">{t.name}</span>
                <span className="tpl-meta">
                  {t.shots.length} shot{t.shots.length === 1 ? '' : 's'}
                </span>
                <button
                  className="ghost"
                  onClick={() => {
                    setProject(applyTemplate(project, normalizeTemplate(t)))
                    onClose()
                  }}
                >
                  Apply
                </button>
                <button
                  className="shot-del"
                  title="Delete template"
                  onClick={async () => {
                    await deleteTemplate(t.id)
                    refresh()
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer>
          <button className="link" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}

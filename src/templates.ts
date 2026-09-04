import { get, set, del, keys } from 'idb-keyval'
import { uid, type Project, type Shot } from './types'
import { migrateProject } from './persist'

const PREFIX = 'template/'

export interface Template {
  id: string
  name: string
  createdAt: number
  /** Look and motion only. Media never travels with a template. */
  shots: Omit<Shot, 'source'>[]
  export: Project['export']
}

/** Strips media so a template is a reusable look, not a copy of someone's screenshot. */
export function templateFromProject(project: Project, name: string): Template {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    shots: project.shots.map(({ source: _source, ...rest }) => rest),
    export: project.export,
  }
}

/**
 * Applies a template's look to a project while keeping the media already loaded.
 * Shots beyond the template's length reuse its last shot so nothing is dropped.
 */
export function applyTemplate(project: Project, template: Template): Project {
  const shots = template.shots.map((t, i) => {
    const existing = project.shots[i]
    return {
      ...t,
      id: existing?.id ?? uid(),
      source: existing?.source ?? null,
    } as Shot
  })
  // Keep any extra media the user already had by appending those shots' sources.
  const extras = project.shots.slice(template.shots.length).map((s) => ({
    ...(template.shots[template.shots.length - 1] as Omit<Shot, 'source'>),
    id: s.id,
    name: s.name,
    source: s.source,
  })) as Shot[]
  return { ...project, shots: [...shots, ...extras], export: template.export, updatedAt: Date.now() }
}

export const saveTemplate = (t: Template) => set(PREFIX + t.id, t)
export const deleteTemplate = (id: string) => del(PREFIX + id)

export async function listTemplates(): Promise<Template[]> {
  const all = await keys()
  const ids = all.filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX))
  const items = await Promise.all(ids.map((k) => get<Template>(k)))
  return items.filter((t): t is Template => !!t).sort((a, b) => b.createdAt - a.createdAt)
}

/** Migration reuse: a template's shots go through the same field back-fill as projects. */
export const normalizeTemplate = (t: Template): Template => ({
  ...t,
  shots: migrateProject({ shots: t.shots.map((s) => ({ ...s, source: null })) } as Project).shots.map(
    ({ source: _source, ...rest }) => rest,
  ),
})

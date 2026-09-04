import { useShot, useStore } from '../store'
import { NO_EFFECTS } from '../types'
import { Section, SliderRow } from '../ui/controls'

const SLIDERS = [
  { key: 'bloom', label: 'Bloom', max: 2 },
  { key: 'blur', label: 'Lens Blur', max: 1 },
  { key: 'focus', label: 'Focus', max: 1 },
  { key: 'vignette', label: 'Vignette', max: 1 },
  { key: 'grain', label: 'Grain', max: 1 },
  { key: 'chroma', label: 'Chromatic', max: 1 },
  { key: 'reflection', label: 'Reflection', max: 1 },
] as const

export function EffectsPanel() {
  const shot = useShot()
  const setProp = useStore((s) => s.setProp)
  const updateShot = useStore((s) => s.updateShot)
  const touched = SLIDERS.some(({ key }) => shot.effects[key] !== NO_EFFECTS[key])

  return (
    <Section
      title="Effects"
      right={
        touched ? (
          <button className="link inline" onClick={() => updateShot(shot.id, (s) => ({ ...s, effects: { ...NO_EFFECTS } }))}>
            Reset
          </button>
        ) : undefined
      }
    >
      {SLIDERS.map(({ key, label, max }) => (
        <SliderRow
          key={key}
          label={label}
          value={shot.effects[key]}
          min={0}
          max={max}
          step={0.01}
          decimals={2}
          onChange={(v) => setProp(`effects.${key}`, v)}
          track={`effects.${key}`}
        />
      ))}
      <p className="hint">Lens Blur needs Focus set to the depth you want sharp. Reflection adds a mirror floor under the device.</p>
    </Section>
  )
}

import { useTagsStore } from '../../store/tags'

interface Props {
  tagIds: string[]
}

export function TagPills({ tagIds }: Props): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const byId = new Map(tags.map((t) => [t.id, t]))
  if (tagIds.length === 0) {
    return <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>No tags</span>
  }
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tagIds.map((id) => {
        const tag = byId.get(id)
        if (!tag) return null
        return (
          <span
            key={id}
            style={{
              background: tag.color,
              color: '#000',
              fontSize: 11,
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
            }}
          >
            {tag.name}
          </span>
        )
      })}
    </div>
  )
}

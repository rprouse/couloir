import { useTagsStore } from '../../store/tags'
import { TagPill } from '../../components/TagPill/TagPill'
import shared from './DetailPanel.shared.module.css'

interface Props {
  tagIds: string[]
}

export function TagPills({ tagIds }: Props): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const known = tags.filter((t) => tagIds.includes(t.id))
  if (known.length === 0) return <span className={shared.metricLabel}>No tags</span>
  return (
    <div className={shared.pillRow}>
      {known.map((tag) => <TagPill key={tag.id} tag={tag} />)}
    </div>
  )
}

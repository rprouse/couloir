import shared from './DetailPanel.shared.module.css'

interface Props {
  label: string
  value: string
}

export function Metric({ label, value }: Props): JSX.Element {
  return (
    <div className={shared.metric}>
      <span className={shared.metricLabel}>{label}</span>
      <span className={shared.metricValue}>{value}</span>
    </div>
  )
}

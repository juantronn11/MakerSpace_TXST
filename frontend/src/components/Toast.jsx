export default function Toast({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.type ? ' ' + t.type : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export const metadata = {
  title: 'Transactions',
}

export default function TransactionsPage() {
  return (
    <section className="page-grid">
      <article className="surface-card surface-card--wide surface-card--accent">
        <h2 className="surface-card__title">Your activity feed is staged and ready</h2>
        <p className="surface-card__copy">
          This page is built to become the home for recent spending, income entries, and the flows that keep
          a month organized. For now, it stays transparent: the surface is ready, the live feed is not wired yet.
        </p>
      </article>

      <article className="surface-card surface-card--half">
        <h2 className="surface-card__title">The first live version will bring</h2>
        <ul className="surface-list">
          <li>
            <div>
              <strong>Recent expense activity</strong>
              <span>A clear, readable stream of spending once transaction fetching is connected.</span>
            </div>
          </li>
          <li>
            <div>
              <strong>Income touchpoints</strong>
              <span>Your income entries and source context alongside the rest of the month.</span>
            </div>
          </li>
          <li>
            <div>
              <strong>Editing and cleanup</strong>
              <span>Update and delete flows once the first interaction layer is ready.</span>
            </div>
          </li>
        </ul>
      </article>

      <article className="surface-card surface-card--half surface-card--soft">
        <h2 className="surface-card__title">Why this page still feels product-ready</h2>
        <p className="surface-card__copy">
          The shell already gives transactions a clear place in the app rhythm, so the next PR can focus on data,
          forms, and edge cases instead of rebuilding the navigation or visual system again.
        </p>
        <div className="section-divider" />
        <p className="status-note">
          Placeholder content here is structural on purpose. It signals intent without pretending there are live rows behind it.
        </p>
      </article>
    </section>
  )
}

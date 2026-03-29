export const metadata = {
  title: 'Dashboard',
}

export default function DashboardPage() {
  return (
    <>
      <section className="page-grid">
        <article className="surface-card surface-card--wide surface-card--accent">
          <h2 className="surface-card__title">Overview cards land here next</h2>
          <p className="surface-card__copy">
            Your budget snapshot, monthly balance, and gentle guardrails are the next pieces to connect.
            This shell is intentionally honest about what is live now: authentication, routing, structure,
            and room for real data.
          </p>
          <div className="info-chip">
            <strong>Preview mode</strong>
            <span className="ghost-note">Live totals and summaries arrive in the next pass.</span>
          </div>
        </article>

        <article className="surface-card surface-card--half surface-card--soft">
          <h2 className="surface-card__title">What's ready today</h2>
          <ul className="surface-list">
            <li>
              <div>
                <strong>Real sign in and sign up</strong>
                <span>The shell now respects your existing backend auth contract.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Protected app navigation</strong>
                <span>Private routes stay inside the app shell, public routes stay clean.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Theme-ready foundation</strong>
                <span>Light and dark tokens are now in place for future screens.</span>
              </div>
            </li>
          </ul>
        </article>

        <article className="surface-card surface-card--half">
          <h2 className="surface-card__title">Coming next</h2>
          <ul className="surface-list">
            <li>
              <div>
                <strong>Recent activity</strong>
                <span>A live feed of expenses and income will fill this area once data fetching lands.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Budget pacing</strong>
                <span>Spend-vs-limit indicators will appear when the dashboard starts reading summaries.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Supportive alerts</strong>
                <span>Threshold nudges will be surfaced here instead of buried in the backend.</span>
              </div>
            </li>
          </ul>
        </article>
      </section>
    </>
  )
}

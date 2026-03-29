export const metadata = {
  title: 'Insights',
}

export default function InsightsPage() {
  return (
    <section className="page-grid">
      <article className="surface-card surface-card--wide surface-card--soft">
        <h2 className="surface-card__title">Insights will translate activity into something useful</h2>
        <p className="surface-card__copy">
          Once dashboard and transaction data is connected, this page can start surfacing category patterns,
          spending rhythm, and monthly pressure points in language that feels supportive instead of noisy.
        </p>
      </article>

      <article className="surface-card surface-card--third">
        <h2 className="surface-card__title">Category signals</h2>
        <p className="surface-card__copy">
          Future spending breakdowns will help students spot where everyday costs are clustering.
        </p>
      </article>

      <article className="surface-card surface-card--third">
        <h2 className="surface-card__title">Cashflow rhythm</h2>
        <p className="surface-card__copy">
          Income timing and expense pacing will get a dedicated view once live monthly summaries are available.
        </p>
      </article>

      <article className="surface-card surface-card--third surface-card--accent">
        <h2 className="surface-card__title">Gentle guidance</h2>
        <p className="surface-card__copy">
          The goal is to make this page feel calm and clarifying, not like a wall of charts pretending to know more than it does.
        </p>
      </article>
    </section>
  )
}

import PlannerView from '@/components/planner-view'

export const metadata = {
  title: 'Planner',
}

export default function PlannerPage({ searchParams }) {
  return <PlannerView initialMonth={searchParams?.month} />
}

import PlannerView from '@/components/planner-view'

export const metadata = {
  title: 'Planner',
}

function getFirstSearchParamValue(value) {
  return Array.isArray(value) ? value[0] : value
}

export default function PlannerPage({ searchParams }) {
  return <PlannerView initialMonth={getFirstSearchParamValue(searchParams?.month)} />
}

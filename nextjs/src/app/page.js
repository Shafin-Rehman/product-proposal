'use client'
import { useState } from 'react'

export default function Home() {
  const [clicked, setClicked] = useState(false)

  return (
    <main>
      <h1>API Server</h1>
      <button onClick={() => setClicked(true)}>Check Status</button>
      {clicked && <p>Server is running</p>}
    </main>
  )
}
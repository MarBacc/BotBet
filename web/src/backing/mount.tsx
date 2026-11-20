import { createRoot } from 'react-dom/client'
import Backing from './Backing'

export function mountBacking() {
  const host = document.createElement('div')
  host.id = 'backing-root'
  document.body.append(host)
  createRoot(host).render(<Backing />)
}

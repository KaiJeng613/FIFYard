import type { LucideIcon } from 'lucide-react'
import { BarChart3, Boxes, CircleUserRound, Shield, UsersRound } from 'lucide-react'

const navItems: Array<{ label: string; icon: LucideIcon; active?: boolean }> = [
  { label: 'Player vault', icon: Boxes, active: true },
  { label: 'Team studio', icon: UsersRound },
  { label: 'Predictions', icon: BarChart3 },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <a className="brand" href="#vault" aria-label="FIFYard home"><span className="brand-mark">FY</span><span>FIF<strong>YARD</strong></span></a>
      <nav aria-label="Product navigation">
        {navItems.map(({ label, icon: Icon, active }) => (
          <a className={active ? 'active' : ''} href={label === 'Team studio' ? '#studio' : label === 'Predictions' ? '#prediction' : '#vault'} key={label}>
            <Icon size={20} strokeWidth={1.8} /><span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <a href="#contract"><Shield size={20} /><span>Protocol</span></a>
        <a href="#wallet"><CircleUserRound size={20} /><span>Profile</span></a>
        <div className="network-pill"><i /> SOLANA DEVNET</div>
      </div>
    </aside>
  )
}

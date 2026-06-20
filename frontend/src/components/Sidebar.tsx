import type { LucideIcon } from 'lucide-react'
import { BarChart3, CircleUserRound, Shield, UsersRound } from 'lucide-react'

type Page = 'squad' | 'predictions'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const navItems: Array<{ label: string; icon: LucideIcon; page: Page }> = [
  { label: 'Team Studio', icon: UsersRound, page: 'squad' },
  { label: 'Predictions', icon: BarChart3, page: 'predictions' },
]

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="FIFYard home">
        <span className="brand-mark">FY</span>
        <span>FIF<strong>YARD</strong></span>
      </a>
      <nav aria-label="Product navigation">
        {navItems.map(({ label, icon: Icon, page }) => (
          <button
            className={activePage === page ? 'active' : ''}
            onClick={() => onNavigate(page)}
            key={page}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <a href="#"><Shield size={20} /><span>Protocol</span></a>
        <a href="#"><CircleUserRound size={20} /><span>Profile</span></a>
        <div className="network-pill"><i /> SOLANA DEVNET</div>
      </div>
    </aside>
  )
}

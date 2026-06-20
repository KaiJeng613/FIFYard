import { Activity, ExternalLink, Info, LoaderCircle, Radio } from 'lucide-react'

interface PredictionPanelProps {
  win: number
  draw: number
  loss: number
  squadRating: number
  lineupValid: boolean
  walletConnected: boolean
  publishing: boolean
  transactionUrl: string | null
  onPublish: () => void
}

export function PredictionPanel({ win, draw, loss, squadRating, lineupValid, walletConnected, publishing, transactionUrl, onPublish }: PredictionPanelProps) {
  return (
    <section className="prediction-panel" id="prediction">
      <div className="panel-label"><Activity size={15} /> MATCH MODEL v0.1</div>
      <div className="probability-ring" style={{ '--probability': `${win * 3.6}deg` } as React.CSSProperties}><div><strong>{win}%</strong><span>WIN RATE</span></div></div>
      <div className="outcome-bars">
        <div><span>Win <b>{win}%</b></span><i><em style={{ width: `${win}%` }} /></i></div>
        <div><span>Draw <b>{draw}%</b></span><i><em style={{ width: `${draw}%` }} /></i></div>
        <div><span>Loss <b>{loss}%</b></span><i><em style={{ width: `${loss}%` }} /></i></div>
      </div>
      <div className="model-factors"><span><small>SQUAD RATING</small><b>{squadRating}</b></span><span><small>FORMATION</small><b>{lineupValid ? 'VALID' : 'INVALID'}</b></span></div>
      <p className="model-note"><Info size={14} /> Heuristic estimate based on player ratings, opponent strength, and formation validity. It is not betting advice.</p>
      <button className="publish-button" disabled={!lineupValid || !walletConnected || publishing} onClick={onPublish}>
        {publishing ? <><LoaderCircle className="spin" size={17} /> Publishing…</> : <><Radio size={17} /> Publish formation on devnet</>}
      </button>
      {!walletConnected && <small className="publish-hint">Connect Phantom to sign and pay the devnet fee.</small>}
      {transactionUrl && <a className="solscan-success" href={transactionUrl} target="_blank" rel="noreferrer">Published successfully · View on Solscan <ExternalLink size={14} /></a>}
    </section>
  )
}

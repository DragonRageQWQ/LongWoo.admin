import Link from 'next/link'
import CharacterEditForm from '../../components/CharacterEditForm'

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
)

/**
 * 龙灵工坊：创建新角色
 */
export default function NewCharacterPage() {
  return (
    <div className="page-wrapper">
      <header className="top-bar">
        <div className="top-bar-left">
          <Link href="/ai/characters" className="top-back" aria-label="返回"><BackIcon /></Link>
          <div>
            <h1 className="top-title">创建角色</h1>
            <span className="top-sub">赋予灵龙生命</span>
          </div>
        </div>
      </header>
      <CharacterEditForm mode="create" />
    </div>
  )
}

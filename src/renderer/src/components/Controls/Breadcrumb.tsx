import React from 'react'
import { useC4Store } from '../../store/c4Store'
import { C4Level } from '../../types/c4.types'

const levelLabels: Record<C4Level, string> = {
  [C4Level.SYSTEM_CONTEXT]: 'System Context',
  [C4Level.CONTAINER]: 'Containers',
  [C4Level.COMPONENT]: 'Components',
  [C4Level.CODE]: 'Code'
}

export function Breadcrumb(): JSX.Element {
  const { breadcrumb, navigateToBreadcrumb } = useC4Store()

  return (
    <div className="breadcrumb">
      {breadcrumb.map((item, index) => {
        const isLast = index === breadcrumb.length - 1

        return (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {index > 0 && <span className="breadcrumb__separator">&gt;</span>}
            <button
              className={`breadcrumb__item ${isLast ? 'breadcrumb__item--active' : ''}`}
              onClick={() => !isLast && navigateToBreadcrumb(item.id)}
              disabled={isLast}
            >
              {item.name}
              <span className="breadcrumb__level">({levelLabels[item.level]})</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

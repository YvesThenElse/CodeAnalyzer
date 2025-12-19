/*
 * CodeAnalyzer - Interactive dependency graph viewer
 * Copyright (C) 2025
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'

interface DescriptionUpdateModalProps {
  open: boolean
  pendingCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function DescriptionUpdateModal({
  open,
  pendingCount,
  onConfirm,
  onCancel
}: DescriptionUpdateModalProps): JSX.Element | null {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal description-update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Mise à jour des descriptions IA</h2>
          <button className="modal__close" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="modal__content">
          <p className="description-update-modal__message">
            <strong>{pendingCount}</strong> fichier{pendingCount > 1 ? 's' : ''} {pendingCount > 1 ? 'nécessitent' : 'nécessite'} une mise à jour des descriptions IA.
          </p>
          <p className="description-update-modal__info">
            Cette opération utilise votre configuration LLM pour générer des descriptions automatiques des fichiers.
          </p>
          <p className="description-update-modal__warning">
            Attention : cette opération peut engendrer des coûts selon votre fournisseur LLM.
          </p>
        </div>

        <div className="modal__footer">
          <button className="btn btn--outline" onClick={onCancel}>
            Ignorer
          </button>
          <button className="btn btn--primary" onClick={onConfirm}>
            Mettre à jour
          </button>
        </div>
      </div>
    </div>
  )
}

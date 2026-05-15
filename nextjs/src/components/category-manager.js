'use client'

import { useEffect, useRef, useState } from 'react'
import { ApiError, apiPost, apiGet } from '@/lib/apiClient'

const EMOJI_OPTIONS = [
  '🍔', '🥗', '☕', '🍕', '🍜', '🥘', '🍱', '🥙',
  '🚗', '🚌', '🚇', '✈️', '🚕', '🛴', '🚲', '🛵',
  '🎬', '🎮', '🎸', '🎨', '🏋️', '🧘', '📚', '🎭',
  '🏥', '💊', '👨‍⚕️', '💅', '✂️', '🧴', '🧼', '🩺',
  '🏠', '🏢', '🏦', '🏨', '🏪', '🏫', '🏬', '⛪',
  '👔', '👗', '👠', '👜', '⌚', '💍', '🕶️', '🎩',
]

function EmojiPicker({ selectedEmoji, onSelect, isOpen, onClose }) {
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div ref={pickerRef} className="emoji-picker" role="dialog" aria-label="Select emoji">
      <div className="emoji-picker__grid">
        <button
            type="button"
            onClick={() => { onSelect(null); onClose() }}
            className="emoji-picker__option emoji-picker__option--none"
        title="No emoji"
        >
            ✕
        </button>
        {EMOJI_OPTIONS.map((emoji) => (

          <button
            key={emoji}
            className={`emoji-picker__option${selectedEmoji === emoji ? ' emoji-picker__option--selected' : ''}`}
            onClick={() => { onSelect(emoji); onClose() }}
            type="button"
            title={`Select ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

function CreateCategoryForm({ accessToken, onSuccess }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📁')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Category name is required')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const result = await apiPost(
        '/api/expenses/categories/create',
        { name: name.trim(), icon: icon || null },
        { accessToken }
      )
      setName('')
      setIcon('📁')
      onSuccess(result)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('A category with this name already exists')
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to create category')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="category-form">
      <div className="category-form__row">
        <label className="category-form__field">
          <span>Category Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder="e.g., Coffee, Gym, Gas"
            className="input-field"
            disabled={isSaving}
            maxLength="100"
          />
        </label>

        <div className="category-form__field">
          <span>Icon</span>
          <div className="category-form__emoji-wrapper">
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              className="category-form__emoji-button"
              disabled={isSaving}
              title="Select emoji"
            >
              {icon || '📁'}
            </button>
            <EmojiPicker
              selectedEmoji={icon}
              onSelect={setIcon}
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
            />
          </div>
        </div>
      </div>

      {error && <div className="inline-error" role="alert">{error}</div>}

      <button type="submit" className="button-primary" disabled={isSaving || !name.trim()}>
        {isSaving ? 'Creating...' : 'Create Category'}
      </button>
    </form>
  )
}

function CategoryRow({ category, accessToken, onRenamed, onArchived }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(category.name)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  const handleRename = async () => {
    if (!editName.trim()) { setError('Category name is required'); return }
    setIsSaving(true)
    setError('')
    try {
      const result = await apiPost(
        '/api/expenses/categories/rename',
        { category_id: category.id, new_name: editName.trim() },
        { accessToken }
      )
      setIsEditing(false)
      onRenamed(result)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409
        ? 'A category with this name already exists'
        : err instanceof ApiError ? err.message : 'Failed to rename category')
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchiveToggle = async () => {
    setIsDeleting(true)
    setError('')
    try {
      const result = await apiPost(
        '/api/expenses/categories/archive',
        { category_id: category.id, archived: !category.archived },
        { accessToken }
      )
      setShowArchiveConfirm(false)
      onArchived(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update category')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <div className="category-row category-row--editing">
        <input
          type="text"
          value={editName}
          onChange={(e) => { setEditName(e.target.value); setError('') }}
          placeholder="Category name"
          className="input-field"
          disabled={isSaving}
          autoFocus
          maxLength="100"
        />
        {error && <div className="inline-error" role="alert">{error}</div>}
        <div className="category-row__actions">
          <button type="button" onClick={() => { setIsEditing(false); setEditName(category.name); setError('') }} className="button-secondary" disabled={isSaving}>Cancel</button>
          <button type="button" onClick={handleRename} className="button-primary" disabled={isSaving || !editName.trim()}>{isSaving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`category-row${category.archived ? ' category-row--archived' : ''}`}>
      <div className="category-row__main">
        <span className="category-row__icon">{category.icon || '📁'}</span>
        <span className="category-row__name">{category.name}</span>
        {category.archived && <span className="category-row__badge">Archived</span>}
      </div>

      {error && <div className="inline-error" role="alert">{error}</div>}

      <div className="category-row__actions">
        {!category.archived && (
          <button type="button" onClick={() => setIsEditing(true)} className="button-secondary" disabled={isDeleting} title="Rename category">✏️ Rename</button>
        )}

        {showArchiveConfirm ? (
          <>
            <span className="category-row__confirm-text">{category.archived ? 'Unarchive?' : 'Archive?'}</span>
            <button type="button" onClick={() => setShowArchiveConfirm(false)} className="button-secondary" disabled={isDeleting}>No</button>
            <button type="button" onClick={handleArchiveToggle} className="button-danger" disabled={isDeleting}>{isDeleting ? 'Confirming...' : 'Yes'}</button>
          </>
        ) : (
          <button type="button" onClick={() => setShowArchiveConfirm(true)} className={category.archived ? 'button-secondary' : 'button-danger'} disabled={isDeleting} title={category.archived ? 'Unarchive category' : 'Archive category'}>
            {category.archived ? '↩️ Unarchive' : '📦 Archive'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function CategoryManager({ accessToken, isOpen, onClose }) {
  const [categories, setCategories] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const managerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (managerRef.current && !managerRef.current.contains(event.target)) onClose()
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !accessToken) return
    loadCategories()
  }, [isOpen, accessToken, showArchived])

  const loadCategories = async () => {
    setIsLoading(true)
    setError('')
    try {
      const query = showArchived ? '?include_archived=true' : ''
      const result = await apiGet(`/api/expenses/categories${query}`, { accessToken })
      setCategories(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const activeCategories = categories.filter((c) => !c.archived)
  const archivedCategories = categories.filter((c) => c.archived)

  return (
    <div className="detail-overlay" role="presentation">
      <button aria-label="Close category manager" className="detail-overlay__backdrop" onClick={onClose} type="button" />
      <div ref={managerRef} aria-labelledby="category-manager-title" aria-modal="true" className="detail-sheet category-manager" role="dialog">
        <div className="detail-sheet__handle" />

        <div className="detail-sheet__hero category-manager__hero">
          <div className="detail-sheet__copy">
            <h2 className="detail-sheet__title" id="category-manager-title">Manage Categories</h2>
            <p className="detail-sheet__subtitle">Create, rename, and organize your personal expense categories.</p>
          </div>
          <button className="button-secondary page-retry" onClick={onClose} type="button">Close</button>
        </div>

        <div className="category-manager__content">
          {error && <div className="inline-error category-manager__error" role="alert">{error}</div>}

          <section className="category-manager__section">
            <h3 className="category-manager__heading">Create New Category</h3>
            <CreateCategoryForm
              accessToken={accessToken}
              onSuccess={(newCategory) => setCategories((prev) => [...prev, newCategory])}
            />
          </section>

          <section className="category-manager__section">
            <h3 className="category-manager__heading">Your Categories</h3>
            {isLoading && !categories.length ? (
              <div className="blank-state"><span>Loading categories...</span></div>
            ) : activeCategories.length ? (
              <div className="category-manager__list">
                {activeCategories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    accessToken={accessToken}
                    onRenamed={(updated) => setCategories((cats) => cats.map((c) => c.id === updated.id ? updated : c))}
                    onArchived={(updated) => setCategories((cats) => cats.map((c) => c.id === updated.id ? updated : c))}
                  />
                ))}
              </div>
            ) : (
              <div className="blank-state"><span>No personal categories yet. Create one above!</span></div>
            )}
          </section>

          {archivedCategories.length > 0 && (
            <section className="category-manager__section">
              <button type="button" className="category-manager__toggle-archived" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? '▼' : '▶'} Archived Categories ({archivedCategories.length})
              </button>

              {showArchived && (
                <div className="category-manager__list category-manager__list--archived">
                  {archivedCategories.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      accessToken={accessToken}
                      onRenamed={(updated) => setCategories((cats) => cats.map((c) => c.id === updated.id ? updated : c))}
                      onArchived={(updated) => setCategories((cats) => cats.map((c) => c.id === updated.id ? updated : c))}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
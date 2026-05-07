export const EXPENSE_DESCRIPTION_MAX_LENGTH = 80
export const INCOME_NOTES_MAX_LENGTH = 240

export const EXPENSE_DESCRIPTION_LENGTH_MESSAGE = 'Merchant must be 80 characters or fewer.'
export const INCOME_NOTES_LENGTH_MESSAGE = 'Note must be 240 characters or fewer.'

const EXPENSE_DESCRIPTION_TYPE_MESSAGE = 'Merchant must be text.'
const INCOME_NOTES_TYPE_MESSAGE = 'Note must be text.'

function validateOptionalText(value, { maxLength, lengthMessage, typeMessage }) {
  if (value === undefined) return { value: undefined }
  if (value === null) return { value: null }
  if (typeof value !== 'string') return { error: typeMessage }

  const trimmed = value.trim()
  if (!trimmed) return { value: null }
  if (trimmed.length > maxLength) return { error: lengthMessage }
  return { value: trimmed }
}

export function validateExpenseDescription(value) {
  return validateOptionalText(value, {
    maxLength: EXPENSE_DESCRIPTION_MAX_LENGTH,
    lengthMessage: EXPENSE_DESCRIPTION_LENGTH_MESSAGE,
    typeMessage: EXPENSE_DESCRIPTION_TYPE_MESSAGE,
  })
}

export function validateIncomeNotes(value) {
  return validateOptionalText(value, {
    maxLength: INCOME_NOTES_MAX_LENGTH,
    lengthMessage: INCOME_NOTES_LENGTH_MESSAGE,
    typeMessage: INCOME_NOTES_TYPE_MESSAGE,
  })
}

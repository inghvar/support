// Unit systems of the converter forms. The numbers of the forms are never converted: they are
// sent as typed together with the unit system, the server converts them. Only the texts and the
// limits of the validation depend on the unit system.
export const UNIT_MM = 'mm'
export const UNIT_INCH = 'in'
export const MM_PER_INCH = 25.4

export function mmToUnit (valueMm, unit) {
  return unit === UNIT_INCH ? valueMm / MM_PER_INCH : valueMm
}

export function unitToMm (value, unit) {
  return unit === UNIT_INCH ? value * MM_PER_INCH : value
}

// A number for a text: 4 significant digits at most, without trailing zeros
export function formatNumber (value) {
  return String(parseFloat(Number(value).toPrecision(4)))
}

// A text with every length and speed written in mm (or мм) in the chosen unit system:
// "(default 0.2 mm)" -> "(default 0.0079 in)", "300 mm/min" -> "11.81 in/min", "Height (mm)" -> "Height (in)".
// The Russian texts get "дюйм". Without a number only the unit is replaced.
// A default value in the text is not converted but replaced with the round number `defaultInch`
// (the same numbers are used by the server): the first number of the text with a unit.
const UNIT_IN_TEXT = /(^|[\s(,])(\d+(?:\.\d+)?\s*)?(mm|мм)(\/(?:min|мин))?(?=$|[\s),.:;])/g

export function unitText (text, unit, defaultInch) {
  if (unit !== UNIT_INCH || typeof text !== 'string') return text
  let first = true
  return text.replace(UNIT_IN_TEXT, (match, before, number, mm, speed) => {
    const russian = mm === 'мм'
    const name = russian ? 'дюйм' : 'in'
    const per = speed ? (russian ? '/мин' : '/min') : ''
    if (number === undefined) return `${before}${name}${per}`
    const space = /\s$/.test(number) ? ' ' : ''
    const value = first && defaultInch !== undefined ? defaultInch : parseFloat(number) / MM_PER_INCH
    first = false
    return `${before}${formatNumber(value)}${space}${name}${per}`
  })
}

// The comparisons of the validation rules: [operator, limit in mm]
const COMPARE = {
  gt: [(value, limit) => value > limit, 'greater than'],
  ge: [(value, limit) => value >= limit, 'greater or equal'],
  lt: [(value, limit) => value < limit, 'less than'],
  le: [(value, limit) => value <= limit, 'less or equal']
}

// Validation rules of a field with limits given in mm (or mm/min, see `suffix`). The limits are
// converted to the chosen unit system, and so are the messages.
export function limitRules (limits, unit, suffix = 'mm', required = false) {
  return limits.map(([operator, limitMm]) => {
    const [compare, words] = COMPARE[operator]
    const limit = mmToUnit(limitMm, unit)
    const message = unitText(`Value should be ${words} ${limitMm} ${suffix}`, unit)
    return value => {
      if (!required && !value) return true
      return compare(Number(value), limit) || message
    }
  })
}

// A rule for a value between two limits given in mm
export function betweenRule (minMm, maxMm, unit, suffix = 'mm') {
  const min = mmToUnit(minMm, unit)
  const max = mmToUnit(maxMm, unit)
  const message = unitText(`Value should be between ${minMm} and ${maxMm} ${suffix}`, unit)
  return value => !value || (Number(value) >= min && Number(value) <= max) || message
}

// Zoom of the viewers: the scenes are drawn in mm, a G-code in inches is scaled by this
export function gcodeScale (unit) {
  return unit === UNIT_INCH ? MM_PER_INCH : 1
}

// The common cutter diameters in inches: [fraction, decimal value sent to the server]
export const TOOL_DIAMETERS_INCH = [
  ['1/64', 0.015625],
  ['1/32', 0.03125],
  ['1/16', 0.0625],
  ['3/32', 0.09375],
  ['1/8', 0.125],
  ['3/16', 0.1875],
  ['1/4', 0.25],
  ['5/16', 0.3125],
  ['3/8', 0.375],
  ['1/2', 0.5]
]

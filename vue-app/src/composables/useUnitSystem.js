import { ref, computed } from 'vue'
import { UNIT_MM, UNIT_INCH, unitText, limitRules, betweenRule } from '../assets/js/units'

// The unit system of a converter form: the form keeps the numbers as the user typed them, the
// texts and the limits of the validation follow the chosen system.
export function useUnitSystem() {
  const unit = ref(UNIT_MM)
  const inches = computed(() => unit.value === UNIT_INCH)

  // a text with mm and mm/min written in the chosen unit system, `defaultInch` is the round
  // default value of the field in inches (it replaces the default written in mm)
  const tu = (text, defaultInch) => unitText(text, unit.value, defaultInch)
  // validation rules with the limits given in mm (mm/min if the suffix says so)
  const rules = (limits, suffix = 'mm', required = false) =>
    limitRules(limits, unit.value, suffix, required)
  const between = (minMm, maxMm, suffix = 'mm') => betweenRule(minMm, maxMm, unit.value, suffix)

  return { unit, inches, tu, rules, between }
}

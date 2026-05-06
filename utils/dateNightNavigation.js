export const DATE_TIMER_SECTION = 'timer';

export function buildDateNightDetailParams(date, options = {}) {
  const params = date ? { date } : {};

  if (!date && options.dateId) {
    params.dateId = options.dateId;
  }

  if (
    options.startAtTimer === true
    || options.focusTimer === true
    || options.initialSection === DATE_TIMER_SECTION
  ) {
    params.initialSection = DATE_TIMER_SECTION;
  }

  return params;
}

export function shouldFocusDateTimer(params = {}) {
  return (
    params?.initialSection === DATE_TIMER_SECTION
    || params?.startAtTimer === true
    || params?.focusTimer === true
  );
}

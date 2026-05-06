export const SPARK_ACCESS_GATE_TYPES = Object.freeze({
  SEX_POSITIONS_CONFIRMATION: 'sex_positions_confirmation',
});

export function getSparkAccessGate() {
  return {
    type: SPARK_ACCESS_GATE_TYPES.SEX_POSITIONS_CONFIRMATION,
    title: 'Sex Positions',
    message: 'The next screen is for sex positions. Do you want to continue?',
    canContinue: true,
  };
}

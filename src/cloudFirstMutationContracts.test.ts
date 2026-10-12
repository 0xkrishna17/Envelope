import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const budgetContextSource = readFileSync('src/context/BudgetContext.tsx', 'utf8');
const logTransactionSource = readFileSync('src/components/LogTransactionModal.tsx', 'utf8');
const salarySource = readFileSync('src/components/SalaryArrivalModal.tsx', 'utf8');
const addFundsSource = readFileSync('src/components/AddCategoryFundsModal.tsx', 'utf8');
const voiceSource = readFileSync('src/components/VoiceInputModal.tsx', 'utf8');

describe('cloud-first mutation contracts', () => {
  it('commits events before returning success from primary mutation handlers', () => {
    expect(budgetContextSource).toContain('const result = await appendLedgerEvents([event]);');
    expect(budgetContextSource).toContain('return mutationResultFromSync(result, { transaction: event.payload.transaction });');
    expect(budgetContextSource).toContain('return mutationResultFromSync(result, { salaryEvent: event.payload.salaryEvent, allocations: event.payload.allocations });');
    expect(budgetContextSource).toContain('return mutationResultFromSync(result, { transfer: event.payload.transfer });');
    expect(budgetContextSource).toContain('return mutationResultFromSync(result, { allocation: event.payload.allocation });');
  });

  it('primary entry screens await mutation results before closing or showing success', () => {
    expect(logTransactionSource).toContain('const result = await runSaveTransaction(');
    expect(logTransactionSource).toContain('if (!result.success)');
    expect(salarySource).toContain('const result = await runSaveSalary(');
    expect(addFundsSource).toContain('const res = await runAddFunds(');
    expect(addFundsSource).toContain('const res = await runMoveSurplus(');
    expect(voiceSource).toContain('const result = await runSaveVoiceIntent(');
    expect(voiceSource).toContain('feedback.error(result.error);');
  });
});

import { useApiLoading } from '../context/ApiLoadingContext';
import {
  cardPaybackReconciledMessage,
  cardPaybackReversedMessage,
  correctionLoggedMessage,
  entryReversedMessage,
  expenseLoggedMessage,
  fundsAddedMessage,
  fundsMovedMessage,
  notificationSettingsSavedMessage,
  profileSavedMessage,
  salaryAddedMessage,
  topUpReversedMessage,
  transactionUpdatedMessage,
  transferReversedMessage,
} from '../utils/actionFeedback';

export function useActionFeedback() {
  const { showToast } = useApiLoading();

  return {
    expenseLogged: (categoryName: string) => showToast(expenseLoggedMessage(categoryName), 'success'),
    fundsAdded: (amountPaise: number, categoryName: string) => showToast(fundsAddedMessage(amountPaise, categoryName), 'success'),
    fundsMoved: (amountPaise: number, fromCategoryName: string, toCategoryName: string) =>
      showToast(fundsMovedMessage(amountPaise, fromCategoryName, toCategoryName), 'success'),
    salaryAdded: () => showToast(salaryAddedMessage(), 'success'),
    transactionUpdated: () => showToast(transactionUpdatedMessage(), 'success'),
    entryReversed: () => showToast(entryReversedMessage(), 'success'),
    correctionLogged: () => showToast(correctionLoggedMessage(), 'success'),
    cardPaybackReconciled: () => showToast(cardPaybackReconciledMessage(), 'success'),
    cardPaybackReversed: () => showToast(cardPaybackReversedMessage(), 'success'),
    topUpReversed: () => showToast(topUpReversedMessage(), 'success'),
    transferReversed: () => showToast(transferReversedMessage(), 'success'),
    profileSaved: () => showToast(profileSavedMessage(), 'success'),
    notificationSettingsSaved: () => showToast(notificationSettingsSavedMessage(), 'success'),
    error: (message: string) => showToast(message, 'error'),
    info: (message: string) => showToast(message, 'info'),
  };
}

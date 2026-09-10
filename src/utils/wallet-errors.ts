import { CHAIN_NAME } from '@/config/chain';

/**
 * Maps WalletConnect / wagmi / viem errors to user-friendly messages.
 */

export function getWalletErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : '';

    // User rejected the transaction in their wallet
    if (
        name === 'UserRejectedRequestError' ||
        message.includes('User rejected') ||
        message.includes('user rejected') ||
        message.includes('ACTION_REJECTED')
    ) {
        return 'Transaction was rejected in your wallet.';
    }

    // Wrong chain / chain switch rejected
    if (
        name === 'ChainNotConfiguredError' ||
        message.includes('chain not configured') ||
        message.includes('SwitchChainError')
    ) {
        return `Please switch to ${CHAIN_NAME} in your wallet.`;
    }

    // Insufficient funds
    if (
        message.includes('insufficient funds') ||
        message.includes('InsufficientFundsError') ||
        message.includes('INSUFFICIENT_FUNDS')
    ) {
        return 'Insufficient ETH balance. Make sure you have enough for the transaction and gas fees.';
    }

    // Gas estimation failed (transaction would revert)
    if (
        message.includes('estimateGas') ||
        message.includes('execution reverted') ||
        message.includes('CALL_EXCEPTION')
    ) {
        return 'Transaction would fail. Please check the amount and try again.';
    }

    // Wallet disconnected
    if (
        name === 'ConnectorNotConnectedError' ||
        message.includes('Connector not connected') ||
        message.includes('not connected')
    ) {
        return 'Wallet disconnected. Please reconnect your wallet.';
    }

    // Network timeout
    if (message.includes('timeout') || message.includes('TIMEOUT')) {
        return 'Connection timed out. Please try again.';
    }

    // Contract-specific errors
    if (message.includes('MustSendETH')) {
        return 'Transaction requires ETH to be sent.';
    }
    if (message.includes('OnlyBorrower')) {
        return 'Only the loan borrower can perform this action.';
    }
    if (message.includes('InsufficientCollateral')) {
        return 'The collateral amount is below the minimum required.';
    }
    if (message.includes('LoanNotPending')) {
        return 'This loan is no longer awaiting collateral.';
    }

    // Generic fallback
    return 'Transaction failed. Please try again.';
}
